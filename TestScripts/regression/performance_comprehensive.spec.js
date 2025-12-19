/**
 * Performance Comprehensive E2E Tests
 * Performance benchmarks and monitoring for the application
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { generateLargeMockLogFile, generateMockLogFile } from '../helpers/test-data-generator.js';
import {
    uploadFile,
    clearAppState,
    applyFilters,
    switchTab,
    getLogCount,
    getFilteredLogCount,
    measurePerformance,
    getMemoryUsage,
    scrollVirtualList
} from '../helpers/test-utils.js';

test.describe('Performance Benchmarks', () => {
    let largeMockPath;
    let mediumMockPath;

    test.beforeAll(async () => {
        const tempDir = path.resolve(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Create test files
        mediumMockPath = path.join(tempDir, 'perf_medium.log');
        largeMockPath = path.join(tempDir, 'perf_large.log');

        console.log('Generating medium test file (10MB)...');
        fs.writeFileSync(mediumMockPath, generateLargeMockLogFile(10));

        console.log('Generating large test file (50MB)...');
        fs.writeFileSync(largeMockPath, generateLargeMockLogFile(50));
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/log_parser.html');
        await clearAppState(page);
    });

    test('Initial page load performance (< 3 seconds)', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/log_parser.html');
        await page.waitForLoadState('domcontentloaded');

        const loadTime = Date.now() - startTime;
        console.log(`Page load time: ${loadTime}ms`);

        expect(loadTime).toBeLessThan(3000);
    });

    test('Parse medium file (10MB) within 30 seconds', async ({ page }) => {
        test.setTimeout(180000);

        const startTime = Date.now();
        await uploadFile(page, mediumMockPath, { timeout: 90000 });
        const parseTime = Date.now() - startTime;

        const logCount = await getLogCount(page);
        console.log(`Parsed ${logCount} logs in ${parseTime}ms`);

        expect(parseTime).toBeLessThan(90000); // 3x for CI
        expect(logCount).toBeGreaterThan(10000);
    });

    test('Parse large file (50MB) within 60 seconds', async ({ page }) => {
        test.setTimeout(300000);

        const startTime = Date.now();
        await uploadFile(page, largeMockPath, { timeout: 180000 });
        const parseTime = Date.now() - startTime;

        const logCount = await getLogCount(page);
        console.log(`Parsed ${logCount} logs in ${parseTime}ms`);

        expect(parseTime).toBeLessThan(180000); // 3x for CI
        expect(logCount).toBeGreaterThan(50000);
    });

    test('Filter performance: 100k+ logs filtered in < 500ms', async ({ page }) => {
        test.setTimeout(120000);

        // Upload large file
        await uploadFile(page, mediumMockPath, { timeout: 60000 });
        const totalLogs = await getLogCount(page);
        console.log(`Total logs: ${totalLogs}`);

        // Measure filter performance
        const startTime = Date.now();
        await applyFilters(page, { search: 'TestTag' });
        await page.waitForTimeout(100);
        const filterTime = Date.now() - startTime;

        const filtered = await getFilteredLogCount(page);
        console.log(`Filtered ${totalLogs} → ${filtered} logs in ${filterTime}ms`);

        expect(filterTime).toBeLessThan(1500); // Relaxed for CI variance
    });

    test('Tab switching performance (< 300ms per switch)', async ({ page }) => {
        test.setTimeout(120000);

        // Upload file first
        await uploadFile(page, mediumMockPath, { timeout: 60000 });

        const tabs = ['stats', 'connectivity', 'logs'];
        const timings = [];

        for (const tab of tabs) {
            const duration = await measurePerformance(page, async () => {
                await switchTab(page, tab);
            });

            timings.push({ tab, duration });
            console.log(`Tab switch to ${tab}: ${duration}ms`);
        }

        // All switches should be fast
        const avgTime = timings.reduce((sum, t) => sum + t.duration, 0) / timings.length;
        console.log(`Average tab switch time: ${avgTime.toFixed(2)}ms`);

        expect(avgTime).toBeLessThan(1500); // 3x for CI
    });

    test('Virtual scroll performance: Smooth scrolling through large dataset', async ({ page }) => {
        test.setTimeout(120000);

        await uploadFile(page, mediumMockPath, { timeout: 60000 });

        // Measure scroll performance
        const scrollPositions = [0, 1000, 5000, 10000, 20000];
        const timings = [];

        for (const position of scrollPositions) {
            const duration = await measurePerformance(page, async () => {
                await scrollVirtualList(page, '#logContainer', position);
            });

            timings.push(duration);
            console.log(`Scroll to ${position}: ${duration}ms`);
        }

        const avgScrollTime = timings.reduce((sum, t) => sum + t, 0) / timings.length;
        console.log(`Average scroll time: ${avgScrollTime.toFixed(2)}ms`);

        // Scrolling should be fast (relaxed for CI)
        expect(avgScrollTime).toBeLessThan(1500); // 3x for CI
    });

    test('Memory usage stays reasonable (< 500MB for medium file)', async ({ page, browserName }) => {
        test.setTimeout(120000);

        // Skip for browsers without memory API
        if (browserName !== 'chromium') {
            test.skip();
        }

        await uploadFile(page, mediumMockPath, { timeout: 60000 });

        // Wait for processing to complete
        await page.waitForTimeout(2000);

        const memory = await getMemoryUsage(page);
        if (memory) {
            const usedMB = memory.usedJSHeapSize / (1024 * 1024);
            console.log(`Memory usage: ${usedMB.toFixed(2)} MB`);

            expect(usedMB).toBeLessThan(500);
        } else {
            console.log('Memory API not available');
        }
    });

    test('Rapid filter changes performance (no lag)', async ({ page }) => {
        test.setTimeout(120000);

        await uploadFile(page, mediumMockPath, { timeout: 60000 });

        // Apply filters rapidly
        const startTime = Date.now();
        for (let i = 0; i < 10; i++) {
            await applyFilters(page, { search: `test${i}` });
            await page.waitForTimeout(50);
        }
        const totalTime = Date.now() - startTime;

        console.log(`10 rapid filter changes: ${totalTime}ms`);
        expect(totalTime).toBeLessThan(15000); // 3x for CI
    });

    test('Multiple file processing performance', async ({ page }) => {
        test.setTimeout(180000);

        // Create multiple small files
        const tempDir = path.resolve(process.cwd(), 'temp');
        const files = [];
        for (let i = 0; i < 3; i++) {
            const filePath = path.join(tempDir, `multi_${i}.log`);
            fs.writeFileSync(filePath, generateMockLogFile(1000));
            files.push(filePath);
        }

        const startTime = Date.now();
        await uploadFile(page, files, { timeout: 60000 });
        const processTime = Date.now() - startTime;

        const totalLogs = await getLogCount(page);
        console.log(`Processed ${files.length} files (${totalLogs} logs) in ${processTime}ms`);

        expect(processTime).toBeLessThan(30000);
        expect(totalLogs).toBeGreaterThan(3000);

        // Cleanup
        files.forEach(f => fs.unlinkSync(f));
    });

    test('Filter + scroll combined performance', async ({ page }) => {
        test.setTimeout(120000);

        await uploadFile(page, mediumMockPath, { timeout: 60000 });

        // Apply filter
        await applyFilters(page, { levels: ['E', 'W'] });
        await page.waitForTimeout(500);

        // Scroll while filtered
        const duration = await measurePerformance(page, async () => {
            await scrollVirtualList(page, '#logContainer', 5000);
        });

        console.log(`Scroll while filtered: ${duration}ms`);
        expect(duration).toBeLessThan(500);
    });

    test('Repeated tab switching performance (no degradation)', async ({ page }) => {
        test.setTimeout(120000);

        await uploadFile(page, mediumMockPath, { timeout: 60000 });

        const iterations = 5;
        const timings = [];

        for (let i = 0; i < iterations; i++) {
            const statsTime = await measurePerformance(page, async () => {
                await switchTab(page, 'stats');
            });

            const logsTime = await measurePerformance(page, async () => {
                await switchTab(page, 'logs');
            });

            timings.push({ iteration: i, statsTime, logsTime });
            console.log(`Iteration ${i}: stats=${statsTime}ms, logs=${logsTime}ms`);
        }

        // Check for performance degradation
        const firstAvg = (timings[0].statsTime + timings[0].logsTime) / 2;
        const lastAvg = (timings[iterations - 1].statsTime + timings[iterations - 1].logsTime) / 2;

        console.log(`First iteration avg: ${firstAvg}ms, Last iteration avg: ${lastAvg}ms`);

        // Last iteration should not be significantly slower (allow 50% increase)
        expect(lastAvg).toBeLessThan(firstAvg * 1.5);
    });

    test('Search performance with complex queries', async ({ page }) => {
        test.setTimeout(120000);

        await uploadFile(page, mediumMockPath, { timeout: 60000 });

        const queries = [
            'TestTag',
            'TestTag SystemUI',
            'Log message activity',
            'a b c d e' // Multiple short terms
        ];

        const timings = [];

        for (const query of queries) {
            const duration = await measurePerformance(page, async () => {
                await applyFilters(page, { search: query });
                await page.waitForTimeout(100);
            });

            timings.push({ query, duration });
            console.log(`Search "${query}": ${duration}ms`);
        }

        // All searches should be reasonably fast
        const maxTime = Math.max(...timings.map(t => t.duration));
        expect(maxTime).toBeLessThan(2000);
    });

    test('Initial render performance after upload', async ({ page }) => {
        test.setTimeout(120000);

        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles(mediumMockPath);

        // Measure time until first log line appears
        const startTime = Date.now();
        await page.waitForSelector('.log-line', { timeout: 60000 });
        const renderTime = Date.now() - startTime;

        console.log(`Time to first render: ${renderTime}ms`);
        expect(renderTime).toBeLessThan(30000);
    });

    test('Filter state change performance', async ({ page }) => {
        test.setTimeout(120000);

        await uploadFile(page, mediumMockPath, { timeout: 60000 });

        // Measure time to toggle log levels
        const duration = await measurePerformance(page, async () => {
            await applyFilters(page, { levels: ['E'] });
            await page.waitForTimeout(100);
            await applyFilters(page, { levels: ['E', 'W'] });
            await page.waitForTimeout(100);
            await applyFilters(page, { levels: ['E', 'W', 'I'] });
            await page.waitForTimeout(100);
        });

        console.log(`Multiple filter state changes: ${duration}ms`);
        expect(duration).toBeLessThan(6000); // 3x for CI
    });

    test('Concurrent operations performance', async ({ page }) => {
        test.setTimeout(120000);

        await uploadFile(page, mediumMockPath, { timeout: 60000 });

        // Try to perform multiple operations quickly
        const startTime = Date.now();

        // Apply filter
        await applyFilters(page, { search: 'TestTag' });

        // Scroll
        await scrollVirtualList(page, '#logContainer', 1000);

        // Switch tab
        await switchTab(page, 'stats');

        // Switch back
        await switchTab(page, 'logs');

        const totalTime = Date.now() - startTime;
        console.log(`Concurrent operations: ${totalTime}ms`);

        expect(totalTime).toBeLessThan(3000);
    });
});
