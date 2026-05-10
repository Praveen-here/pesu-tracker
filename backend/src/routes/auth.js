const express = require('express');
const router = express.Router();
const { fullLogin } = require('../services/pesuService');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { srn, password } = req.body;

  if (!srn || !password) {
    return res.status(400).json({ error: 'SRN and password are required.' });
  }

  try {
    console.log(`[Auth] Login attempt for SRN: ${srn.trim()}`);
    const { serializedJar, semId, attendance, csrf, name } = await fullLogin(srn.trim(), password);

    console.log(`[Auth] Login success — semId: ${semId}, subjects: ${attendance.length}, name: ${name}`);

    req.session.pesuJar = serializedJar;
    req.session.semId = semId;
    req.session.csrf = csrf;   // post-login CSRF for AJAX calls
    req.session.srn = srn.trim();
    req.session.name = name;
    req.session.attendance = attendance;
    req.session.fetchedAt = Date.now();
    req.session.finalUrl = `https://www.pesuacademy.com/Academy/s/studentProfilePESU`;

    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    return res.json({ ok: true, srn: srn.trim(), name });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);

    if (err.message.includes('Invalid SRN') || err.message.includes('Invalid SRN or password')) {
      return res.status(401).json({ error: 'Invalid SRN or password. Please try again.' });
    }
    if (err.message.includes('CSRF') || err.message.includes('extract')) {
      return res.status(502).json({ error: 'Could not reach PESU Academy. Try again shortly.' });
    }
    if (err.message.includes('semesters')) {
      return res.status(502).json({ error: 'Could not fetch semesters. Your session may have failed. Try again.' });
    }
    return res.status(500).json({ error: `Login failed: ${err.message}` });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.clearCookie('connect.sid');
    return res.json({ ok: true });
  });
});

// GET /api/auth/me — check if session is active
router.get('/me', (req, res) => {
  if (req.session && req.session.srn) {
    return res.json({ ok: true, srn: req.session.srn, name: req.session.name });
  }
  return res.status(401).json({ ok: false });
});

module.exports = router;
