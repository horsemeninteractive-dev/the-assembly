import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  // In development, default to 'debug' for visibility. 
  // In production, default to 'info' to manage log ingestion volume.
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  formatters: {
    // Map pino levels to Google Cloud Logging severity levels
    level: (label) => {
      return { severity: label.toUpperCase() };
    },
  },
  // Use ISO-8601 timestamps for better compatibility with logging backends
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive fields to prevent accidental exposure of user credentials in logs
  redact: {
    paths: [
      'password', 
      'token', 
      '*.token', 
      '*.password',
      'email',
      '*.email',
      'body.password',
      'body.token'
    ],
    remove: true
  }
});
