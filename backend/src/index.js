require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { buildSessionMiddleware } = require('./middleware/session');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const resultsRoutes = require('./routes/results');

const app = express();
const PORT = process.env.PORT || 5000;

async function startServer() {
  // Security headers
  app.use(helmet());

  // CORS — allow Next.js frontend
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Redis-backed session
  const sessionMiddleware = await buildSessionMiddleware();
  app.use(sessionMiddleware);

  // Health check
  app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/results', resultsRoutes);

  // 404 catch
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // Global error handler
  app.use((err, req, res, _next) => {
    console.error('[Server Error]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`\n🚀 PESU Attendance Backend running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
