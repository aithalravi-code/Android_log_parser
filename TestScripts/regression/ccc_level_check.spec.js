import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('CCC Message Log Levels', () => {
    test('should show what log levels CCC messages have', async ({ page }) => {
        const htmlPath = path.resolve(__dirname, '../../Production/dist/log_parser.html');
        const fileUrl = `file://${htmlPath.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')}`;

        await page.goto(fileUrl);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Clear IndexedDB
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

        // Wait a bit for CCC extraction
        await page.waitForTimeout(10000);

        // Get CCC message log levels
        const results = await page.evaluate(() => {
            const cccMsgs = window._debug?.cccMessages || [];

            const levelCounts = {};
            cccMsgs.forEach(msg => {
                const level = msg.level || 'NONE';
                levelCounts[level] = (levelCounts[level] || 0) + 1;
            });

            return {
                totalCccMessages: cccMsgs.length,
                levelCounts,
                sample: cccMsgs.slice(0, 5).map(m => ({ level: m.level, timestamp: m.timestamp, type: m.type }))
            };
        });

        console.log('CCC Message Levels:', JSON.stringify(results, null, 2));

        expect(results.totalCccMessages, 'Should have CCC messages').toBeGreaterThan(0);

        // Validate that NO messages have undefined level (regression test for worker.js bug)
        expect(results.levelCounts['NONE'] || 0, 'No CCC messages should have undefined level').toBe(0);

        // Validate at least some messages have a valid log level
        const validLevels = ['V', 'D', 'I', 'W', 'E'];
        const hasValidLevels = validLevels.some(l => results.levelCounts[l] > 0);
        expect(hasValidLevels, 'CCC messages should have valid log levels').toBe(true);
    });
});
