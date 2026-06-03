import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { globalClerkMiddleware, requireClerkAuth } from './middleware/auth.js';
import logger from './utils/logger.js';

import patientsRouter      from './routes/patients.js';
import analyticsRouter     from './routes/analytics.js';
import appointmentRoutes   from './routes/appointmentRoutes.js';

const app  = express();
const PORT = process.env.PORT || 3000;


// helmet() sets HTTP security headers on every response:
//   - Strict-Transport-Security (HSTS)
//   - X-Frame-Options: DENY
//   - X-Content-Type-Options: nosniff
//   - Content-Security-Policy
app.use(helmet());

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.use(globalClerkMiddleware());

// Read endpoints — 100 requests per minute per IP
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', message: 'Rate limit exceeded. Try again in a minute.' },
});

// Write endpoints (create/update patient records) — 20 per minute per IP
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', message: 'Write rate limit exceeded. Try again in a minute.' },
});


app.get('/health', readLimiter, async (req, res) => {
  const health = {
    status:     'healthy',
    database:   'connected',
    ml_service: 'reachable',
    timestamp:  new Date().toISOString(),
  };

  // Check database with a lightweight query
  try {
    const { query } = await import('./config/database.js');
    await query('SELECT 1');
  } catch {
    health.database = 'error';
    health.status   = 'critical';
  }

  // Check ML service reachability
  try {
    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    const response = await fetch(`${ML_SERVICE_URL}/`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
      health.ml_service = 'unreachable';
      if (health.status === 'healthy') health.status = 'degraded';
    }
  } catch {
    health.ml_service = 'unreachable';
    if (health.status === 'healthy') health.status = 'degraded';
  }

  // Return 200 even when degraded — the frontend reads the status field.
  // Return 503 only when critical (database is down).
  const httpStatus = health.status === 'critical' ? 503 : 200;
  return res.status(httpStatus).json(health);
});

app.use('/api/patients', readLimiter, requireClerkAuth, patientsRouter);
app.use('/api/analytics',    readLimiter, requireClerkAuth, analyticsRouter);
app.use('/api/appointments', readLimiter, requireClerkAuth, appointmentRoutes);

// 404 handler 
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', message: `Route ${req.method} ${req.path} does not exist.` });
});

//Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: 'An unexpected error occurred.' });
});

app.listen(PORT, () => {
  logger.info(`Diacify backend running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

export default app;