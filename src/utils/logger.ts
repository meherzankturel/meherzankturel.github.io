/**
 * Production-safe logger utility
 *
 * Only logs in development mode (__DEV__ is true).
 * In production builds, logging is disabled to:
 * - Improve performance
 * - Prevent sensitive data leakage
 * - Meet App Store requirements
 */

const isDev = __DEV__;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },

  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },

  error: (...args: any[]) => {
    // Always log errors, but in production you might want to
    // send them to a crash reporting service instead
    if (isDev) {
      console.error(...args);
    }
    // TODO: In production, send to crash reporting service (Sentry, Crashlytics, etc.)
  },

  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },

  debug: (...args: any[]) => {
    if (isDev) console.debug(...args);
  },
};

export default logger;
