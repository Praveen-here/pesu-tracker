const express = require('express');
const router = express.Router();
const { refreshAttendance } = require('../services/pesuService');

// Auth guard middleware
function requireAuth(req, res, next) {
  if (!req.session || !req.session.srn) {
    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  }
  next();
}

// GET /api/attendance
// Returns cached attendance or re-fetches if stale (>10 min)
router.get('/', requireAuth, async (req, res) => {
  try {
    const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    const isStale = !req.session.fetchedAt || now - req.session.fetchedAt > CACHE_TTL;

    if (!isStale && req.session.attendance && req.session.attendance.length > 0) {
      return res.json({
        attendance: req.session.attendance,
        semId: req.session.semId,
        srn: req.session.srn,
        cached: true,
        fetchedAt: req.session.fetchedAt,
      });
    }

    // Re-fetch from PESU
    const attendance = await refreshAttendance(req.session.pesuJar, req.session.semId, req.session.csrf);

    req.session.attendance = attendance;
    req.session.fetchedAt = now;
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    return res.json({
      attendance,
      semId: req.session.semId,
      srn: req.session.srn,
      cached: false,
      fetchedAt: now,
    });
  } catch (err) {
    console.error('[Attendance] Fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch attendance. Please log in again.' });
  }
});

// POST /api/attendance/refresh — force a fresh fetch
router.post('/refresh', requireAuth, async (req, res) => {
  try {
    const attendance = await refreshAttendance(req.session.pesuJar, req.session.semId, req.session.csrf);
    req.session.attendance = attendance;
    req.session.fetchedAt = Date.now();
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );
    return res.json({ attendance, cached: false, fetchedAt: req.session.fetchedAt });
  } catch (err) {
    console.error('[Attendance] Refresh error:', err.message);
    return res.status(500).json({ error: 'Failed to refresh attendance.' });
  }
});

module.exports = router;
