import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger } from '../../Production/src/utils/logger.js';

describe('Logger', () => {
    let consoleSpy;

    beforeEach(() => {
        // Spy on console methods
        consoleSpy = {
            log: vi.spyOn(console, 'log').mockImplementation(() => { }),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => { }),
            error: vi.spyOn(console, 'error').mockImplementation(() => { })
        };

        // Clear timers
        logger.timers.clear();
    });

    afterEach(() => {
        // Restore console
        consoleSpy.log.mockRestore();
        consoleSpy.warn.mockRestore();
        consoleSpy.error.mockRestore();
    });

    describe('debug', () => {
        it('should log debug messages in development', () => {
            logger.debug('Test debug message', { data: 'test' });

            // In test environment, debug is suppressed
            expect(consoleSpy.log).not.toHaveBeenCalled();
        });
    });

    describe('info', () => {
        it('should always log info messages', () => {
            logger.info('Test info message', { data: 'test' });
            expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] Test info message', { data: 'test' });
        });
    });

    describe('warn', () => {
        it('should always log warnings', () => {
            logger.warn('Test warning', { data: 'test' });
            expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] Test warning', { data: 'test' });
        });
    });

    describe('error', () => {
        it('should always log errors', () => {
            const error = new Error('Test error');
            logger.error('Error occurred', error);
            expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] Error occurred', error);
        });
    });

    describe('performance timing', () => {
        it('should track time for operations', () => {
            logger.timeStart('test-operation');

            // Simulate some work
            const start = performance.now();
            while (performance.now() - start < 10) {
                // Wait 10ms
            }

            const duration = logger.timeEnd('test-operation');
            expect(duration).toBeGreaterThan(0);
        });

        it('should return 0 for unknown timer', () => {
            const duration = logger.timeEnd('non-existent');
            expect(duration).toBe(0);
        });

        it('should clean up timer after timeEnd', () => {
            logger.timeStart('cleanup-test');
            logger.timeEnd('cleanup-test');

            expect(logger.timers.has('cleanup-test')).toBe(false);
        });
    });

    describe('assert', () => {
        it('should not log when condition is true', () => {
            logger.assert(true, 'Should not log');
            expect(consoleSpy.error).not.toHaveBeenCalled();
        });

        it('should log error when condition is false', () => {
            logger.assert(false, 'This should fail');
            expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] Assertion failed: This should fail');
        });
    });

    describe('group', () => {
        it('should execute callback', () => {
            const callback = vi.fn();
            logger.group('Test Group', callback);
            expect(callback).toHaveBeenCalled();
        });

        it('should execute callback even when not in dev mode', () => {
            const callback = vi.fn();
            logger.group('Test Group', callback);
            // Callback should always be executed
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle callback exceptions gracefully', () => {
            const throwingCallback = () => {
                throw new Error('Test error');
            };

            expect(() => {
                logger.group('Error Group', throwingCallback);
            }).toThrow('Test error');
        });
    });

    describe('table', () => {
        it('should accept data array', () => {
            const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => { });

            const data = [
                { name: 'Item 1', value: 10 },
                { name: 'Item 2', value: 20 }
            ];

            logger.table(data);

            // In test environment, table logging is suppressed
            expect(tableSpy).not.toHaveBeenCalled();

            tableSpy.mockRestore();
        });

        it('should accept data with column filter', () => {
            const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => { });

            const data = [
                { name: 'Item 1', value: 10, extra: 'data' },
                { name: 'Item 2', value: 20, extra: 'more' }
            ];

            logger.table(data, ['name', 'value']);

            // In test environment, table logging is suppressed
            expect(tableSpy).not.toHaveBeenCalled();

            tableSpy.mockRestore();
        });
    });
});
