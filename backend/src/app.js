const express = require('express');
const path = require('path');
const cors = require('cors');
const { query } = require('./db');
const authRoutes = require('./routes/auth.routes');
const farmRoutes = require('./routes/farm.routes');
const auditRoutes = require('./routes/audit.routes');
const cropRecordRoutes = require('./routes/cropRecord.routes');
const schemeRoutes = require('./routes/scheme.routes');
const recommendationRoutes = require('./routes/recommendation.routes');
const mlRoutes = require('./routes/ml.routes');
const sustainabilityScoreRoutes = require('./routes/sustainabilityScore.routes');
const geographyRoutes = require('./routes/geography.routes');
const groundwaterHeatmapRoutes = require('./routes/groundwaterHeatmap.routes');
const groundwaterAssessmentRoutes = require('./routes/groundwaterAssessment.routes');
const agricultureRoutes = require('./routes/agriculture.routes');
const referenceRoutes = require('./routes/reference.routes');

const app = express();

// The React dashboard runs on Vite during local development.  Keep the
// browser boundary explicit instead of allowing credentials from every origin.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // No Origin is normal for same-origin requests, curl, and server-to-server calls.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static developer demo dashboard
app.use(express.static(path.join(__dirname, '../frontend')));

// Keep the deployment health check public and register it before the generic
// `/api` routers, whose router-level authentication otherwise captures it.
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await query('SELECT NOW()');
    res.status(200).json({
      status: 'ok',
      message: 'API is running',
      database: {
        status: 'connected',
        serverTime: dbResult.rows[0].now
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'API is running but database is unreachable',
      error: error.message
    });
  }
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/geography', geographyRoutes);
app.use('/api/agriculture', agricultureRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api', sustainabilityScoreRoutes);
app.use('/api/groundwater', groundwaterHeatmapRoutes);
app.use('/api/groundwater-assessments', groundwaterAssessmentRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api', cropRecordRoutes);
app.use('/api', recommendationRoutes);
app.use('/api/ml', mlRoutes);

module.exports = app;

