const express = require('express');
const router = express.Router();
const { fetchAllResults, fetchISAGraph } = require('../services/pesuService');
const { parseResultsHTML, computeMinMarks, projectSGPA } = require('../services/resultsParser');
const { calculatePercentile, computeOverallPercentile } = require('../services/percentileService');

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
  req.session.percentileCache = null;
  req.session.percentileFetchedAt = null;
  await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
  return res.json({ success: true });
});

// GET /api/results/percentile
// Fetches graph distribution data for the LATEST semester and computes percentile
router.get('/percentile', requireAuth, async (req, res) => {
  try {
    const CACHE_TTL = 15 * 60 * 1000; // 15 min cache (graph data rarely changes)
    const now = Date.now();
    if (req.session.percentileCache && now - req.session.percentileFetchedAt < CACHE_TTL) {
      return res.json({ ...req.session.percentileCache, cached: true });
    }

    // First ensure we have results data
    if (!req.session.resultsCache) {
      return res.status(400).json({ error: 'Please fetch results first.' });
    }

    const results = req.session.resultsCache.results;
    if (!results || results.length === 0) {
      return res.json({ percentile: null, error: 'No results available.' });
    }

    // Use the LATEST (first) semester — this is the current one
    const currentSem = results[0];
    const semId = currentSem.semId;

    console.log(`[Percentile] Computing for ${req.session.srn}, sem=${semId} (${currentSem.semLabel})`);

    const subjectPercentiles = [];

    for (const sub of currentSem.subjects) {
      // Skip 0-credit subjects and subjects without a subjectId
      if (sub.isZeroCredit || !sub.subjectId) continue;

      const credits = sub.credits?.total || 4;

      // Build the assessments list for graph fetching.
      // Prefer graphCalls extracted from PESU's HTML — they contain the REAL
      // isaMarksMasterId for every published assessment (ISA 1, ISA 2, Assignment,
      // FINAL ISA when available), so the graph API always gets the correct params.
      // Fall back to hardcoded IDs only when graphCalls aren't available.
      let assessments = [];

      if (sub.graphCalls && sub.graphCalls.length > 0) {
        // Use all graph calls from PESU's HTML directly.
        // Each call has: subjectId, marks, totalMarks, batchClassId, isaMarksMasterId.
        // Label is derived from the ID for display only — it doesn't affect the API call.
        assessments = sub.graphCalls.map(gc => ({
          type: gc.isaMarksMasterId === 1 ? 'ISA 1'
              : gc.isaMarksMasterId === 2 ? 'ISA 2'
              : gc.isaMarksMasterId === 5 ? 'Assignment'
              : gc.isaMarksMasterId === 3 ? 'Final ISA'
              : `Assessment ${gc.isaMarksMasterId}`,
          marks:           gc.marks,
          totalMarks:      gc.totalMarks,
          isaMarksMasterId: gc.isaMarksMasterId,
          batchClassId:    gc.batchClassId, // use the batchClassId from the HTML
        }));
      } else {
        // Fallback: build from parsed marks with hardcoded IDs
        if (sub.marks.isa1?.score != null)
          assessments.push({ type: 'ISA 1',   marks: sub.marks.isa1.score,       totalMarks: sub.marks.isa1.max || 40,       isaMarksMasterId: 1 });
        if (sub.marks.isa2?.score != null)
          assessments.push({ type: 'ISA 2',   marks: sub.marks.isa2.score,       totalMarks: sub.marks.isa2.max || 40,       isaMarksMasterId: 2 });
        if (sub.marks.assignment?.score != null)
          assessments.push({ type: 'Assignment', marks: sub.marks.assignment.score, totalMarks: sub.marks.assignment.max || 10, isaMarksMasterId: 5 });
        if (sub.marks.finalIsa?.score != null)
          assessments.push({ type: 'Final ISA', marks: sub.marks.finalIsa.score,   totalMarks: 50,                             isaMarksMasterId: 3 });
      }

      if (assessments.length === 0) continue;

      // Fetch graph data for each available assessment
      const assessmentPercentiles = [];
      for (const a of assessments) {
        const graphData = await fetchISAGraph(
          req.session.pesuJar,
          req.session.csrf,
          req.session.finalUrl,
          {
            subjectId:        sub.subjectId,
            marks:            a.marks,
            totalMarks:       a.totalMarks,
            batchClassId:     a.batchClassId || semId, // prefer HTML-extracted ID
            isaMarksMasterId: a.isaMarksMasterId,
          }
        );

        if (graphData && graphData.seriesArray) {
          const pct = calculatePercentile(graphData.seriesArray, a.marks);
          if (pct) {
            assessmentPercentiles.push({
              type: a.type,
              percentile: pct.percentile,
              totalStudents: pct.totalStudents,
              marks: a.marks,
              maxMarks: a.totalMarks,
            });
          }
        }
      }

      if (assessmentPercentiles.length > 0) {
        // Average percentile across all assessments for this subject
        const avgPct = Math.round(
          assessmentPercentiles.reduce((s, p) => s + p.percentile, 0) / assessmentPercentiles.length
        );

        subjectPercentiles.push({
          courseCode: sub.courseCode,
          courseName: sub.courseName,
          credits,
          percentile: avgPct,
          assessments: assessmentPercentiles,
          totalStudents: assessmentPercentiles[0].totalStudents,
        });
      }
    }

    const overall = computeOverallPercentile(subjectPercentiles);

    const payload = {
      semId,
      semLabel: currentSem.semLabel,
      ...overall,
      fetchedAt: now,
    };

    req.session.percentileCache = payload;
    req.session.percentileFetchedAt = now;
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

    console.log(`[Percentile] Done: ${overall?.overallPercentile ?? 'N/A'}th percentile`);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    console.error('[Percentile] Error:', err.message);
    return res.status(500).json({ error: `Failed to compute percentile: ${err.message}` });
  }
});

module.exports = router;
