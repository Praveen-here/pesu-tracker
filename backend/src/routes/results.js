const express = require('express');
const router = express.Router();
const { fetchAllResults } = require('../services/pesuService');
const { parseResultsHTML, computeMinMarks, projectSGPA } = require('../services/resultsParser');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.srn) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  next();
}

// GET /api/results
router.get('/', requireAuth, async (req, res) => {
  try {
    const CACHE_TTL = 5 * 60 * 1000;
    const now = Date.now();
    if (req.session.resultsCache && now - req.session.resultsFetchedAt < CACHE_TTL) {
      return res.json({ ...req.session.resultsCache, cached: true });
    }

    console.log('[Results] Fetching for SRN:', req.session.srn);
    const { sems, allResults } = await fetchAllResults(
      req.session.pesuJar,
      req.session.csrf,
      req.session.finalUrl
    );

    const parsed = [];
    for (const semData of allResults) {
      if (!semData.html) continue;

      const result = parseResultsHTML(semData.html);
      result.semId = semData.semId;
      result.semLabel = semData.semLabel;

      // Add analysis per subject
      result.subjects = result.subjects.map(sub => ({
        ...sub,
        analysis: computeMinMarks(sub),
      }));
      result.projectedSgpa = result.sgpa ?? projectSGPA(result.subjects);
      parsed.push(result);
    }

    // Calculate current CGPA
    const completedSems = parsed.filter(s => s.isCompleted && s.sgpa && s.totalCredits);
    let cgpa = null;
    if (completedSems.length > 0) {
      const tw = completedSems.reduce((a, s) => a + s.sgpa * s.totalCredits, 0);
      const tc = completedSems.reduce((a, s) => a + s.totalCredits, 0);
      cgpa = tc > 0 ? Math.round(tw / tc * 100) / 100 : null;
    }

    const payload = { sems, results: parsed, cgpa, fetchedAt: now };
    req.session.resultsCache = payload;
    req.session.resultsFetchedAt = now;
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

    return res.json({ ...payload, cached: false });
  } catch (err) {
    console.error('[Results] Error:', err.message);
    return res.status(500).json({ error: `Failed to fetch results: ${err.message}` });
  }
});

// POST /api/results/refresh
router.post('/refresh', requireAuth, async (req, res) => {
  req.session.resultsCache = null;
  req.session.resultsFetchedAt = null;
  await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
  return res.json({ success: true });
});

module.exports = router;
