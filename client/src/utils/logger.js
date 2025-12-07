// Lightweight client logger for browser environments
// Controlled by `VITE_CLIENT_LOG_LEVEL` (error|warn|info|debug). Default: info in dev, warn in prod
const LEVELS = ['error', 'warn', 'info', 'debug'];

const envLevel = (import.meta.env.VITE_CLIENT_LOG_LEVEL || '').toLowerCase();
const defaultLevel = import.meta.env.MODE === 'development' ? 'debug' : 'warn';
const LEVEL = LEVELS.includes(envLevel) ? envLevel : defaultLevel;

const shouldLog = (level) => LEVELS.indexOf(level) <= LEVELS.indexOf(LEVEL);

const logger = {
  error: (msg, meta) => {
    if (shouldLog('error')) console.error(msg, meta || '');
  },
  warn: (msg, meta) => {
    if (shouldLog('warn')) console.warn(msg, meta || '');
  },
  info: (msg, meta) => {
    if (shouldLog('info')) console.info(msg, meta || '');
  },
  debug: (msg, meta) => {
    if (shouldLog('debug')) console.debug(msg, meta || '');
  }
};

export default logger;
