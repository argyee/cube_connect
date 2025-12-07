import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import DailyRotateFile from 'winston-daily-rotate-file';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDevelopment = process.env.NODE_ENV !== 'production';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

// Define colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  trace: 'cyan'
};

winston.addColors(colors);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `[${timestamp}] ${level}: ${message} ${metaStr}`;
  })
);

// File format (no colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Transports
const transports = [
  // Console transport - always enabled (Docker log driver or terminal)
  new winston.transports.Console({
    format: consoleFormat,
    level: isDevelopment ? 'debug' : 'info'
  })
];

// In development only, also log to file for inspection
if (isDevelopment) {
  transports.push(
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs/dev-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: '20m',
      maxDays: '7d',
      utc: false
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  levels,
  level: isDevelopment ? 'debug' : 'info',
  defaultMeta: { service: 'cube-connect-server' },
  transports
});

export default logger;
