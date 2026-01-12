/**
 * Conditional logger that only outputs in development mode
 * Prevents console spam in production builds
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Debug logs - only shown in development
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Info logs - only shown in development
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Warning logs - shown in all environments
   */
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },

  /**
   * Error logs - shown in all environments
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  /**
   * Performance timing helper
   */
  time: (label: string) => {
    if (isDev) {
      console.time(label);
    }
  },

  /**
   * End performance timing
   */
  timeEnd: (label: string) => {
    if (isDev) {
      console.timeEnd(label);
    }
  },
};

// For backwards compatibility - can be used as drop-in replacement
export default logger;
