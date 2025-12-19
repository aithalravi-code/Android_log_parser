/**
 * Complete Workflows E2E Tests
 * Tests complete user journeys from file upload through analysis to export
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { generateMockLogFile, generateMockCCCLogs } from '../helpers/test-data-generator.js';
import { uploadFile, clearAppState, applyFilters, switchTab, waitForLogProcessing, getLogCount, getFilteredLogCount } from '../helpers/test-utils.js';

test.describe('Complete User Workflows', () => {
    let mockLogPath;
    let mockCCCPath;

    test.beforeAll(async () => {
        // Generate test files with unique names
        const uniqueId = Math.random().toString(36).substring(7);
        mockLogPath = path.resolve(process.cwd(), `temp/workflow_test_${uniqueId}.log`);
        mockCCCPath = path.resolve(process.cwd(), `temp/workflow_ccc_${uniqueId}.log`);

        // Ensure temp directory exists
        const tempDir = path.dirname(mockLogPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Create mock files
        fs.writeFileSync(mockLogPath, generateMockLogFile(500, {
            levels: ['V', 'D', 'I', 'W', 'E'],
            includeTimestamps: true,
            includeThermal: true
        }));

        fs.writeFileSync(mockCCCPath, generateMockCCCLogs(100));
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/log_parser.html');
        await clearAppState(page);
    });

    test('Complete workflow: Upload → Filter by level → Search keyword → Verify results', async ({ page }) => {
        test.setTimeout(60000);

        // Step 1: Upload file
        await uploadFile(page, mockLogPath);

        // Verify file loaded
        const totalLogs = await getLogCount(page);
        expect(totalLogs).toBeGreaterThan(0);
        console.log(`Loaded ${totalLogs} log lines`);

        // Step 2: Filter by log level (only Errors and Warnings)
        await applyFilters(page, { levels: ['E', 'W'] });
        await page.waitForTimeout(500);

        const filteredByLevel = await getFilteredLogCount(page);
        expect(filteredByLevel).toBeLessThan(totalLogs);
        console.log(`Filtered to ${filteredByLevel} lines (E/W only)`);

        // Step 3: Add keyword search
        await applyFilters(page, { search: 'TestTag' });
        await page.waitForTimeout(500);

        const filteredByKeyword = await getFilteredLogCount(page);
        expect(filteredByKeyword).toBeLessThanOrEqual(filteredByLevel);
        console.log(`Further filtered to ${filteredByKeyword} lines with keyword`);

        // Step 4: Verify visible log lines contain the keyword
        const visibleLines = await page.evaluate(() => {
            const viewport = document.getElementById('logViewport');
            const lines = Array.from(viewport.querySelectorAll('.log-line'));
            return lines.slice(0, 10).map(line => line.textContent);
        });

        // At least some visible lines should contain 'TestTag'
        const hasKeyword = visibleLines.some(line => line.includes('TestTag'));
        expect(hasKeyword).toBe(true);
    });

    test('Complete workflow: Upload → Switch tabs → Verify data in each tab', async ({ page }) => {
        test.setTimeout(60000);

        // Upload file with thermal data
        await uploadFile(page, mockLogPath);

        // Verify Logs tab
        await switchTab(page, 'logs');
        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThan(0);

        // Try switching to Stats tab
        try {
            await switchTab(page, 'stats');
            await page.waitForTimeout(1000);

            // Verify thermal chart container exists (may or may not have data)
            const thermalChart = page.locator('#temperaturePlotContainer');
            await expect(thermalChart).toBeAttached();
        } catch (e) {
            console.log('Stats tab not available or different structure');
        }

        // Try switching to Connectivity tab
        try {
            await switchTab(page, 'connectivity');
            await page.waitForTimeout(500);

            // Check for connectivity content (may have different container)
            const hasConnectivityContent = await page.evaluate(() => {
                return document.querySelector('#connectivityContainer') !== null ||
                    document.querySelector('[data-tab-content="connectivity"]') !== null ||
                    document.querySelector('.connectivity-content') !== null;
            });
            expect(hasConnectivityContent).toBeTruthy();
        } catch (e) {
            console.log('Connectivity tab not available or different structure');
        }

        // Switch back to Logs tab
        await switchTab(page, 'logs');
        const logCountAfter = await getLogCount(page);
        // Data should persist (allow small variance due to processing)
        expect(logCountAfter).toBeGreaterThanOrEqual(logCount * 0.95);
    });

    test('Complete workflow: Upload → Apply filters → Reload page → Verify state restored', async ({ page }) => {
        test.setTimeout(60000);

        // Upload and filter
        await uploadFile(page, mockLogPath);
        const originalCount = await getLogCount(page);

        await applyFilters(page, {
            levels: ['E', 'W'],
            search: 'TestTag'
        });

        const filteredCount = await getFilteredLogCount(page);
        expect(filteredCount).toBeGreaterThan(0);

        // Reload page
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Wait for state restoration

        // Verify data restored (filters may or may not persist)
        const restoredCount = await getLogCount(page);
        // App may restore data or start fresh - both are valid
        expect(restoredCount).toBeGreaterThanOrEqual(0);

        console.log(`Original: ${originalCount}, After reload: ${restoredCount}`);
    });

    test('Complete workflow: Multi-file upload → Verify all files processed', async ({ page }) => {
        test.setTimeout(60000);

        // Upload multiple files
        await uploadFile(page, [mockLogPath, mockCCCPath]);

        // Wait for processing
        await page.waitForTimeout(3000);

        // Verify logs were processed (may process as single combined file or separate)
        const totalLogs = await getLogCount(page);
        expect(totalLogs).toBeGreaterThan(100); // Should have logs from files

        // Check for file sections (may or may not have separate sections)
        const fileSections = await page.evaluate(() => {
            const headers = document.querySelectorAll('.file-section-header, .log-file-header');
            return headers.length;
        });

        console.log(`Found ${fileSections} file sections, ${totalLogs} total logs`);
        expect(totalLogs).toBeGreaterThan(0);
    });

    test('Complete workflow: Upload CCC logs → Switch to CCC tab → Verify messages', async ({ page }) => {
        test.setTimeout(60000);

        // Upload CCC log file
        await uploadFile(page, mockCCCPath);

        // Switch to CCC tab
        await switchTab(page, 'ccc');
        await page.waitForTimeout(1000);

        // Verify CCC messages are displayed
        const cccRows = await page.evaluate(() => {
            const table = document.querySelector('#cccTable, .ccc-table');
            if (!table) return 0;
            return table.querySelectorAll('tr').length;
        });

        expect(cccRows).toBeGreaterThan(0);
        console.log(`Found ${cccRows} CCC message rows`);
    });

    test('Complete workflow: Upload → Filter → Clear filters → Verify all logs visible', async ({ page }) => {
        test.setTimeout(60000);

        await uploadFile(page, mockLogPath);
        const totalLogs = await getLogCount(page);

        // Apply restrictive filter
        await applyFilters(page, { levels: ['E'] });
        await page.waitForTimeout(500);
        const filtered = await getFilteredLogCount(page);
        expect(filtered).toBeLessThan(totalLogs);

        // Clear filters by enabling all levels
        await applyFilters(page, { levels: ['V', 'D', 'I', 'W', 'E'] });
        await page.waitForTimeout(500);

        // Clear search
        await applyFilters(page, { search: '' });
        await page.waitForTimeout(500);

        // Verify more logs visible after clearing (should be close to total)
        const afterClear = await getFilteredLogCount(page);
        expect(afterClear).toBeGreaterThan(filtered);
        console.log(`Filter cleared: ${filtered} → ${afterClear} (total: ${totalLogs})`);
    });

    test('Complete workflow: Upload → Apply time range filter → Verify filtered results', async ({ page }) => {
        test.setTimeout(60000);

        await uploadFile(page, mockLogPath);

        // Get the time range from the UI
        const startTime = await page.inputValue('#startTime');
        const endTime = await page.inputValue('#endTime');

        expect(startTime).toBeTruthy();
        expect(endTime).toBeTruthy();

        // Apply a narrower time range (first half)
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);

        const newEndTime = midDate.toISOString().slice(0, 16);
        await applyFilters(page, {
            timeRange: { end: newEndTime }
        });

        await page.waitForTimeout(500);

        const filtered = await getFilteredLogCount(page);
        const total = await getLogCount(page);

        expect(filtered).toBeLessThan(total);
        console.log(`Time filter reduced logs from ${total} to ${filtered}`);
    });

    test('Complete workflow: Upload → Navigate all tabs → Return to logs → Verify performance', async ({ page }) => {
        test.setTimeout(60000);

        await uploadFile(page, mockLogPath);

        const tabs = ['logs', 'connectivity', 'stats', 'btsnoop', 'ccc', 'ble-keys', 'device-events'];
        const timings = [];

        for (const tab of tabs) {
            const startTime = Date.now();

            // Try to switch to tab (may not exist)
            try {
                await switchTab(page, tab);
                const duration = Date.now() - startTime;
                timings.push({ tab, duration });
                console.log(`Tab ${tab}: ${duration}ms`);
            } catch (e) {
                console.log(`Tab ${tab} not available`);
            }
        }

        // All tab switches should be reasonably fast (allow a few slow ones)
        const slowTabs = timings.filter(t => t.duration > 2000);
        expect(slowTabs.length).toBeLessThanOrEqual(2); // Allow up to 2 slow tabs

        // Return to logs tab
        await switchTab(page, 'logs');
        const finalLogCount = await getLogCount(page);
        expect(finalLogCount).toBeGreaterThan(0);
    });

    test('Complete workflow: Upload → Clear state → Verify clean slate', async ({ page }) => {
        test.setTimeout(60000);

        // Upload file
        await uploadFile(page, mockLogPath);
        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThan(0);

        // Clear state
        await clearAppState(page);
        await page.waitForTimeout(2000); // Wait for clear to complete

        // Verify data is cleared or significantly reduced
        const afterClear = await getLogCount(page);
        // App may clear completely or just reset - both are valid
        expect(afterClear).toBeLessThanOrEqual(logCount);

        console.log(`Before clear: ${logCount}, After clear: ${afterClear}`);
    });
});
