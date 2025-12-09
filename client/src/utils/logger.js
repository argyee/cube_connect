// Lightweight client logger for browser environments
// Controlled by `VITE_CLIENT_LOG_LEVEL` (error|warn|info|debug). Default: debug in dev, warn in prod
const LEVELS = ['error', 'warn', 'info', 'debug'];

const envLevel = (import.meta.env.VITE_CLIENT_LOG_LEVEL || '').toLowerCase();
const defaultLevel = import.meta.env.MODE === 'development' ? 'debug' : 'warn';
const LEVEL = LEVELS.includes(envLevel) ? envLevel : defaultLevel;

const shouldLog = (level) => LEVELS.indexOf(level) <= LEVELS.indexOf(LEVEL);

// Color codes for different log levels (CSS for browser console)
const COLORS = {
  error: 'color: #ef4444; font-weight: bold',    // Red
  warn: 'color: #f59e0b; font-weight: bold',     // Orange/Amber
  info: 'color: #3b82f6; font-weight: normal',   // Blue
  debug: 'color: #6b7280; font-weight: normal'   // Gray
};

const MODULE_COLOR = 'color: #8b5cf6; font-weight: bold'; // Purple for module names

// Format with color codes for browser console
const formatColored = (level, module) => {
  return [
    `%c[${level.toUpperCase()}]%c %c[${module}]%c`,
    COLORS[level],
    'color: inherit',
    MODULE_COLOR,
    'color: inherit'
  ];
};

const logger = {
  error: (module, msg, meta) => {
    if (shouldLog('error')) {
      const [format, ...styles] = formatColored('error', module);
      console.error(`${format} ${msg}`, ...styles, meta || '');
    }
  },
  warn: (module, msg, meta) => {
    if (shouldLog('warn')) {
      const [format, ...styles] = formatColored('warn', module);
      console.warn(`${format} ${msg}`, ...styles, meta || '');
    }
  },
  info: (module, msg, meta) => {
    if (shouldLog('info')) {
      const [format, ...styles] = formatColored('info', module);
      console.info(`${format} ${msg}`, ...styles, meta || '');
    }
  },
  debug: (module, msg, meta) => {
    if (shouldLog('debug')) {
      const [format, ...styles] = formatColored('debug', module);
      console.debug(`${format} ${msg}`, ...styles, meta || '');
    }
  }
};

export default logger;
