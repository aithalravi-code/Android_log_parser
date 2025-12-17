/**
 * Logger Utility
 * Provides structured logging with automatic debug log removal in production
 * 
 * Usage:
 *   import { logger } from './utils/logger.js';
 *   
 *   logger.debug('Debug message', data);     // Stripped in production
 *   logger.info('Info message', data);       // Always shown
 *   logger.warn('Warning', data);            // Always shown
 *   logger.error('Error occurred', error);   // Always shown
 *   logger.perf('Task completed', 123);      // Stripped in production, shows timing
 */

class Logger {
    constructor() {
        this.isDev = import.meta.env.DEV;
        this.isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

        // Performance timing storage
        this.timers = new Map();
    }

    /**
     * Debug logging - only in development
     * Automatically stripped in production builds
     */
    debug(message, ...args) {
        if (this.isDev && !this.isTest) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }

    /**
     * Info logging - always shown
     */
    info(message, ...args) {
        console.log(`[INFO] ${message}`, ...args);
    }

    /**
     * Warning logging - always shown
     */
    warn(message, ...args) {
        console.warn(`[WARN] ${message}`, ...args);
    }

    /**
     * Error logging - always shown
     */
    error(message, ...args) {
        console.error(`[ERROR] ${message}`, ...args);
    }

    /**
     * Performance logging - only in development
     * Logs execution time in milliseconds
     */
    perf(message, durationMs) {
        if (this.isDev && !this.isTest) {
            console.log(`[PERF] ${message}: ${durationMs.toFixed(2)}ms`);
        }
    }

    /**
     * Start performance timer
     */
    timeStart(label) {
        this.timers.set(label, performance.now());
    }

    /**
     * End performance timer and log result
     */
    timeEnd(label) {
        const start = this.timers.get(label);
        if (start) {
            const duration = performance.now() - start;
            this.perf(label, duration);
            this.timers.delete(label);
            return duration;
        }
        return 0;
    }

    /**
     * Worker-specific logging (for web workers)
     */
    worker(message, ...args) {
        if (this.isDev && !this.isTest) {
            console.log(`[Worker] ${message}`, ...args);
        }
    }

    /**
     * Filter-specific logging
     */
    filter(message, ...args) {
        if (this.isDev && !this.isTest) {
            console.log(`[Filter] ${message}`, ...args);
        }
    }

    /**
     * UI-specific logging
     */
    ui(message, ...args) {
        if (this.isDev && !this.isTest) {
            console.log(`[UI] ${message}`, ...args);
        }
    }

    /**
     * Group logging (collapsible in console)
     */
    group(label, callback) {
        if (this.isDev && !this.isTest) {
            console.group(label);
            try {
                callback();
            } finally {
                console.groupEnd();
            }
        } else if (callback) {
            callback();
        }
    }

    /**
     * Table logging for data structures
     */
    table(data, columns) {
        if (this.isDev && !this.isTest) {
            console.table(data, columns);
        }
    }

    /**
     * Assert logging
     */
    assert(condition, message) {
        if (!condition) {
            this.error(`Assertion failed: ${message}`);
        }
    }
}

// Singleton instance
export const logger = new Logger();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window._logger = logger;
}
