/**
 * Middleware aggregator
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

function setupMiddleware(app) {
  // Security middleware
  app.use(helmet(config.security.helmet));
  
  // Compression middleware
  app.use(compression());
  
  // CORS middleware
  app.use(cors());
  
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Static file serving
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));
  
  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.path}`, {
        status: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent')
      });
    });
    
    next();
  });
  
  logger.info('Middleware setup completed');
}

// Cache headers middleware
function setCacheHeaders(req, res, next) {
  res.set({
    'Cache-Control': 'public, max-age=300', // 5 minutes
    'ETag': `"${Date.now()}"`,
  });
  next();
}

// Error handling middleware
function errorHandler(err, req, res, next) {
  logger.error(`Unhandled error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
}

// 404 handler
function notFoundHandler(req, res) {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
}

module.exports = {
  setupMiddleware,
  setCacheHeaders,
  errorHandler,
  notFoundHandler
};