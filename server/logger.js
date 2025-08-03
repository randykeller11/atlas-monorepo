import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
);

// Define transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.simple()
    ),
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    format
  }),
  
  // File transport for combined logs
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/combined.log'),
    format
  })
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Helper functions for structured logging
export const logAIRequest = (sessionId, data) => {
  logger.info('AI Request', {
    sessionId,
    type: 'ai_request',
    ...data
  });
};

export const logAIResponse = (sessionId, data) => {
  logger.info('AI Response', {
    sessionId,
    type: 'ai_response',
    ...data
  });
};

export const logTemplateUsage = (sessionId, templateName, version) => {
  logger.info('Template Usage', {
    sessionId,
    type: 'template_usage',
    templateName,
    templateVersion: version
  });
};

export const logAssessmentProgress = (sessionId, data) => {
  logger.info('Assessment Progress', {
    sessionId,
    type: 'assessment_progress',
    ...data
  });
};

export const logPersonaAnalysis = (sessionId, data) => {
  logger.info('Persona Analysis', {
    sessionId,
    type: 'persona_analysis',
    ...data
  });
};

export const logSummarization = (sessionId, data) => {
  logger.info('Context Summarization', {
    sessionId,
    type: 'summarization',
    ...data
  });
};

export const logError = (sessionId, error, context = {}) => {
  logger.error('Application Error', {
    sessionId,
    type: 'error',
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack
    },
    context
  });
};

export const logSessionActivity = (sessionId, action, data = {}) => {
  logger.info('Session Activity', {
    sessionId,
    type: 'session_activity',
    action,
    ...data
  });
};

export default logger;
