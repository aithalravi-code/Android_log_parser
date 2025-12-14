import { describe, it, expect } from 'vitest';
import { getColorForPid } from '../../Production/src/ui/colors.js';

describe('Colors Utils', () => {
    describe('getColorForPid', () => {
        it('should return default color for empty PID', () => {
            expect(getColorForPid(null)).toBe('#E0E0E0');
            expect(getColorForPid(undefined)).toBe('#E0E0E0');
            expect(getColorForPid('')).toBe('#E0E0E0');
        });

        it('should return consistent colors for same PID', () => {
            const color1 = getColorForPid(1001);
            const color2 = getColorForPid(1001);
            expect(color1).toBe(color2);
            expect(color1).toMatch(/^#[0-9A-F]{6}$/i);
        });

        it('should return different colors for different PIDs (likely)', () => {
            const color1 = getColorForPid(1001);
            const color2 = getColorForPid(1002);
            // It's possible they match due to modulo, but unlikely for sequential small numbers with 10 colors
            // 1001 % 10 = 1, 1002 % 10 = 2.
            expect(color1).not.toBe(color2);
        });

        it('should cycle through colors', () => {
            const colors = new Set();
            // Start from 1 because 0 is falsy and returns default color
            for (let i = 1; i <= 20; i++) {
                colors.add(getColorForPid(i));
            }
            // There are 10 colors defined in source
            expect(colors.size).toBeLessThanOrEqual(10);
        });

        it('should handle string PIDs', () => {
            const color = getColorForPid('1234');
            expect(color).toMatch(/^#[0-9A-F]{6}$/i);
        });
    });
});
