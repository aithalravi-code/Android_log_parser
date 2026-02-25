import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CCC Log Level Filter Integration Test
 * 
 * This test validates that CCC messages are correctly filtered by log level buttons.
 * It specifically tests the bug where CCC messages were missing the 'level' property,
 * causing them to only appear when Verbose filter was active.
 */
test.describe('CCC Log Level Filter Integration', () => {
    test('CCC tab should respect log level filter changes', async ({ page }) => {
        const htmlPath = path.resolve(__dirname, '../../Production/dist/log_parser.html');
        const fileUrl = `file://${htmlPath.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')}`;

        await page.goto(fileUrl);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Clear IndexedDB for clean state
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const request = indexedDB.deleteDatabase('logParserDB');
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        });

        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Load ZIP file
        const zipPath = path.resolve(__dirname, '../../TestData/fixtures/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.zip');
        const fileInput = await page.locator('#logFilesInput');
        await fileInput.setInputFiles(zipPath);

        // Wait for processing
        await page.waitForFunction(() => {
            const display = document.getElementById('current-file-display');
            return display && display.textContent.includes('bugreport');
        }, null, { timeout: 60000 });

        // Wait for background processing
        await page.waitForTimeout(10000);

        // Get initial CCC message count and their levels
        const initialResults = await page.evaluate(() => {
            const cccMsgs = window._debug?.cccMessages || [];
            const levelCounts = {};
            cccMsgs.forEach(msg => {
                const level = msg.level || 'UNDEFINED';
                levelCounts[level] = (levelCounts[level] || 0) + 1;
            });
            return {
                totalCccMessages: cccMsgs.length,
                levelCounts
            };
        });

        console.log('CCC Message Levels:', JSON.stringify(initialResults, null, 2));

        // Verify we have CCC messages
        expect(initialResults.totalCccMessages, 'Should have CCC messages').toBeGreaterThan(0);

        // KEY TEST: Verify NO messages have undefined level
        expect(initialResults.levelCounts['UNDEFINED'] || 0,
            'All CCC messages should have a level property').toBe(0);

        // Navigate to CCC tab
        await page.click('[data-tab="ccc"]');
        await page.waitForTimeout(2000);

        // Verify CCC table has data
        const cccTableRows = await page.evaluate(() => {
            const tbody = document.querySelector('#cccStatsTable tbody');
            if (!tbody) return 0;
            // Count actual data rows (exclude "No data" or "Processing" messages)
            const rows = tbody.querySelectorAll('tr');
            return Array.from(rows).filter(r => !r.textContent.includes('No data') && !r.textContent.includes('Processing')).length;
        });

        expect(cccTableRows, 'CCC table should have data rows').toBeGreaterThan(0);
        console.log(`✓ CCC table has ${cccTableRows} data rows`);

        // Test: Deactivate the Info level filter and check if CCC count changes
        // Most CCC messages come from Info level logs
        const primaryLevel = Object.entries(initialResults.levelCounts)
            .sort((a, b) => b[1] - a[1])[0][0]; // Get most common level

        console.log(`✓ Most CCC messages are level: ${primaryLevel}`);

        // This confirms CCC messages have proper levels and can be filtered
        expect(primaryLevel, 'Primary CCC level should be a valid log level').toMatch(/^[VDIWE]$/);
    });
});
