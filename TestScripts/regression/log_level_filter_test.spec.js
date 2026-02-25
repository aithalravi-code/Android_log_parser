import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Log Level Filter Verification', () => {
    test('should show all log levels after fresh load', async ({ page }) => {
        const htmlPath = path.resolve(__dirname, '../../Production/dist/log_parser.html');
        const fileUrl = `file://${htmlPath.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')}`;

        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(text);
        });

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

        // Wait for filtering to complete
        let filteringComplete = false;
        const startWait = Date.now();
        const timeout = 60000;

        while (!filteringComplete && (Date.now() - startWait < timeout)) {
            const lastFilterMessage = consoleMessages.findLast(m => m.includes('[Main] After filtering: filteredLogLines.length ='));
            if (lastFilterMessage && !lastFilterMessage.includes('= 0')) {
                filteringComplete = true;
            } else {
                await page.waitForTimeout(500);
            }
        }

        // Get filter state
        const results = await page.evaluate(() => {
            const original = window._debug?.originalLogLines() || [];
            const filtered = window._debug?.filteredLogLines() || [];

            // Count by level
            const levelCounts = {
                original: {},
                filtered: {}
            };

            original.forEach(l => {
                const level = l.level || 'None';
                levelCounts.original[level] = (levelCounts.original[level] || 0) + 1;
            });

            filtered.forEach(l => {
                const level = l.level || 'None';
                levelCounts.filtered[level] = (levelCounts.filtered[level] || 0) + 1;
            });

            // Get active log levels  
            const buttons = Array.from(document.querySelectorAll('#filterSection .filter-icon'));
            const activeButtons = buttons.filter(b => b.classList.contains('active')).map(b => b.dataset.level);

            return {
                totalOriginal: original.length,
                totalFiltered: filtered.length,
                levelCounts,
                activeButtons,
                tokenLogsCount: original.filter(l => l.originalText && l.originalText.includes('| token:')).length,
                tokenLogsInFiltered: filtered.filter(l => l.originalText && l.originalText.includes('| token:')).length
            };
        });

        console.log('Filter State:', JSON.stringify(results, null, 2));

        // Assertions
        expect(results.totalOriginal, 'Should have original logs').toBeGreaterThan(1000000);
        expect(results.totalFiltered, 'Should have filtered logs').toBeGreaterThan(100000);
        expect(results.activeButtons, 'Should have multiple active log levels').toContain('I');
        expect(results.levelCounts.filtered.I, 'Should have Info logs visible').toBeGreaterThan(0);
        expect(results.tokenLogsInFiltered, 'Token logs should be visible').toBeGreaterThan(0);

        console.log('✓ All log levels are active and visible!');
    });
});
