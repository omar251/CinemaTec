/**
 * Centralized logging utility
 */

class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    
    this.currentLevel = process.env.LOG_LEVEL || 'INFO';
  }

  _log(level, message, meta = {}) {
    if (this.levels[level] <= this.levels[this.currentLevel]) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        message,
        ...meta
      };

      const output = `[${level}] ${timestamp} - ${message}`;
      
      switch (level) {
        case 'ERROR':
          console.error(output, meta);
          break;
        case 'WARN':
          console.warn(output, meta);
          break;
        case 'INFO':
          console.log(output, meta);
          break;
        case 'DEBUG':
          console.debug(output, meta);
          break;
      }
    }
  }

  error(message, meta = {}) {
    this._log('ERROR', message, meta);
  }

  warn(message, meta = {}) {
    this._log('WARN', message, meta);
  }

  info(message, meta = {}) {
    this._log('INFO', message, meta);
  }

  debug(message, meta = {}) {
    this._log('DEBUG', message, meta);
  }

  // Performance logging
  time(label) {
    console.time(label);
  }

  timeEnd(label) {
    console.timeEnd(label);
  }
}

module.exports = new Logger();