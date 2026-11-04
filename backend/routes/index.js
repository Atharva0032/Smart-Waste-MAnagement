/**
 * API router index.
 * Mounts every feature router and exposes a health probe used by Render.
 *
 * Full surface: /api/{auth,complaints,admin,workers,notifications,ai}
 */
const express = require('express');
const mongoose = require('mongoose');

const authRoutes = require('./authRoutes');
const complaintRoutes = require('./complaintRoutes');
const adminRoutes = require('./adminRoutes');
const workerRoutes = require('./workerRoutes');
const notificationRoutes = require('./notificationRoutes');
const aiRoutes = require('./aiRoutes');
const env = require('../config/env');
const { getClassifierInfo } = require('../utils/wasteClassifier');

const router = express.Router();

/** Simple liveness + readiness probe. */
router.get('/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    service: 'smart-waste-management-api',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    database: states[mongoose.connection.readyState] || 'unknown',
    ai: getClassifierInfo(),
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/complaints', complaintRoutes);
router.use('/admin', adminRoutes);
router.use('/workers', workerRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ai', aiRoutes);

module.exports = router;
