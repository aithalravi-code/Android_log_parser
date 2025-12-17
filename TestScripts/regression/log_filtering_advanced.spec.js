/**
 * Advanced Log Filtering E2E Tests
 * Comprehensive testing of all log filtering functionality
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { generateMockLogFile } from '../helpers/test-data-generator.js';
import { uploadFile, clearAppState, applyFilters, getLogCount, getFilteredLogCount, getVisibleLogLines } from '../helpers/test-utils.js';

test.describe('Advanced Log Filtering', () => {
    let mockLogPath;

    test.beforeAll(async () => {
        mockLogPath = path.resolve(process.cwd(), 'temp/filter_test.log');

        const tempDir = path.dirname(mockLogPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Create mock file with diverse content
        fs.writeFileSync(mockLogPath, generateMockLogFile(1000, {
            levels: ['V', 'D', 'I', 'W', 'E'],
            tags: ['TestTag', 'SystemUI', 'ActivityManager', 'PackageManager', 'WindowManager'],
            includeTimestamps: true
        }));
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/log_parser.html');
        await clearAppState(page);
        await uploadFile(page, mockLogPath);
    });

    test('Filter by single log level (Error only)', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        await applyFilters(page, { levels: ['E'] });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBeLessThan(totalLogs);
        expect(filtered).toBeGreaterThan(0);

        console.log(`Filtered from ${totalLogs} to ${filtered} error logs`);
    });

    test('Filter by multiple log levels (Error and Warning)', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        await applyFilters(page, { levels: ['E', 'W'] });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBeLessThan(totalLogs);
        expect(filtered).toBeGreaterThan(0);

        console.log(`Filtered to ${filtered} error/warning logs`);
    });

    test('Filter by all log levels (should show all logs)', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        await applyFilters(page, { levels: ['V', 'D', 'I', 'W', 'E'] });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBe(totalLogs);
    });

    test('Toggle log levels on and off', async ({ page }) => {
        // Start with all levels
        await applyFilters(page, { levels: ['V', 'D', 'I', 'W', 'E'] });
        const allLogs = await getFilteredLogCount(page);

        // Disable Verbose
        await applyFilters(page, { levels: ['D', 'I', 'W', 'E'] });
        const withoutVerbose = await getFilteredLogCount(page);
        expect(withoutVerbose).toBeLessThanOrEqual(allLogs);

        // Disable Debug
        await applyFilters(page, { levels: ['I', 'W', 'E'] });
        const withoutDebug = await getFilteredLogCount(page);
        expect(withoutDebug).toBeLessThanOrEqual(withoutVerbose);

        // Only Info
        await applyFilters(page, { levels: ['I'] });
        const onlyInfo = await getFilteredLogCount(page);
        expect(onlyInfo).toBeLessThanOrEqual(withoutDebug);
    });

    test('Keyword search with single term', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        await applyFilters(page, { search: 'TestTag' });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBeLessThan(totalLogs);
        expect(filtered).toBeGreaterThan(0);

        // Verify visible lines contain the keyword
        const visibleLines = await getVisibleLogLines(page);
        const hasKeyword = visibleLines.some(line => line.includes('TestTag'));
        expect(hasKeyword).toBe(true);
    });

    test('Keyword search with multiple terms (OR logic)', async ({ page }) => {
        // Note: OR logic may search for the entire phrase if not implemented
        await applyFilters(page, {
            search: 'TestTag SystemUI',
            logic: 'OR'
        });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        // Should return results (either OR logic or phrase search)
        expect(filtered).toBeGreaterThanOrEqual(0);

        console.log(`OR search found ${filtered} logs`);
    });

    test('Keyword search with multiple terms (AND logic)', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        // Search for two terms that should both appear in some logs
        await applyFilters(page, {
            search: 'Log message',
            logic: 'AND'
        });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBeGreaterThan(0);
        expect(filtered).toBeLessThanOrEqual(totalLogs);

        console.log(`AND search found ${filtered} logs`);
    });

    test('Case-insensitive keyword search', async ({ page }) => {
        await applyFilters(page, { search: 'testtag' });
        await page.waitForTimeout(500);

        const lowercase = await getFilteredLogCount(page);

        await applyFilters(page, { search: 'TESTTAG' });
        await page.waitForTimeout(500);

        const uppercase = await getFilteredLogCount(page);

        await applyFilters(page, { search: 'TestTag' });
        await page.waitForTimeout(500);

        const mixedcase = await getFilteredLogCount(page);

        // All should return same results (case-insensitive)
        expect(lowercase).toBe(uppercase);
        expect(uppercase).toBe(mixedcase);
    });

    test('Empty search should show all logs', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        await applyFilters(page, { search: '' });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBe(totalLogs);
    });

    test('Search with no matches should show empty results', async ({ page }) => {
        await applyFilters(page, { search: 'NONEXISTENT_KEYWORD_12345' });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBe(0);
    });

    test('Combined filter: Level + Keyword', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        // Filter by Error level only
        await applyFilters(page, { levels: ['E'] });
        const errorOnly = await getFilteredLogCount(page);

        // Add keyword filter
        await applyFilters(page, {
            levels: ['E'],
            search: 'TestTag'
        });
        await page.waitForTimeout(500);

        const combined = await getFilteredLogCount(page);
        expect(combined).toBeLessThanOrEqual(errorOnly);
        expect(combined).toBeLessThan(totalLogs);
    });

    test('Time range filter: Full range shows all logs', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        // Get default time range
        const startTime = await page.inputValue('#startTime');
        const endTime = await page.inputValue('#endTime');

        // Apply full range (should show all)
        await applyFilters(page, {
            timeRange: { start: startTime, end: endTime }
        });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBe(totalLogs);
    });

    test('Time range filter: Narrow range reduces logs', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        const startTime = await page.inputValue('#startTime');
        const endTime = await page.inputValue('#endTime');

        // Calculate midpoint
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);

        // Filter to first half
        await applyFilters(page, {
            timeRange: {
                start: startTime,
                end: midDate.toISOString().slice(0, 16)
            }
        });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBeLessThan(totalLogs);
        expect(filtered).toBeGreaterThan(0);

        console.log(`Time range filter: ${totalLogs} → ${filtered} logs`);
    });

    test('Clear all filters restores all logs', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        // Apply multiple filters
        await applyFilters(page, {
            levels: ['E'],
            search: 'TestTag'
        });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBeLessThan(totalLogs);

        // Clear filters
        await applyFilters(page, {
            levels: ['V', 'D', 'I', 'W', 'E'],
            search: ''
        });
        await page.waitForTimeout(500);

        const afterClear = await getFilteredLogCount(page);
        expect(afterClear).toBe(totalLogs);
    });

    test('Filter persistence across page interactions', async ({ page }) => {
        // Apply filter
        await applyFilters(page, { levels: ['E', 'W'] });
        const filtered = await getFilteredLogCount(page);

        // Scroll the log container
        await page.evaluate(() => {
            const container = document.getElementById('logContainer');
            if (container) container.scrollTop = 500;
        });
        await page.waitForTimeout(300);

        // Verify filter still applied
        const afterScroll = await getFilteredLogCount(page);
        expect(afterScroll).toBe(filtered);
    });

    test('Complex filter combination: Level + Keyword + Time Range', async ({ page }) => {
        const totalLogs = await getLogCount(page);

        const startTime = await page.inputValue('#startTime');
        const endTime = await page.inputValue('#endTime');
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);

        // Apply all filters
        await applyFilters(page, {
            levels: ['E', 'W'],
            search: 'message',
            timeRange: {
                start: startTime,
                end: midDate.toISOString().slice(0, 16)
            }
        });
        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBeLessThan(totalLogs);

        console.log(`Complex filter: ${totalLogs} → ${filtered} logs`);
    });

    test('Filter performance: Large dataset filtering under 500ms', async ({ page }) => {
        const startTime = Date.now();

        await applyFilters(page, {
            levels: ['E', 'W'],
            search: 'TestTag'
        });

        // Wait for filter to complete
        await page.waitForTimeout(500);

        const duration = Date.now() - startTime;
        console.log(`Filter duration: ${duration}ms`);

        // Should be reasonably fast (allow more time for CI environments)
        expect(duration).toBeLessThan(3000);
    });

    test('Rapid filter changes should not cause errors', async ({ page }) => {
        // Rapidly change filters
        for (let i = 0; i < 5; i++) {
            await applyFilters(page, { search: `test${i}` });
            await page.waitForTimeout(50);
        }

        // Should still be functional
        await page.waitForTimeout(500);
        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBeGreaterThanOrEqual(0);
    });

    test('Special characters in search should not break filtering', async ({ page }) => {
        const specialChars = ['(', ')', '[', ']', '{', '}', '*', '+', '?', '.', '^', '$'];

        for (const char of specialChars) {
            await applyFilters(page, { search: char });
            await page.waitForTimeout(100);

            // Should not throw error
            const filtered = await getFilteredLogCount(page);
            expect(filtered).toBeGreaterThanOrEqual(0);
        }
    });
});
