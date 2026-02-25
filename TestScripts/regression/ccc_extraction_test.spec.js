import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFixturePath } from '../helpers/test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('CCC Extraction Verification', () => {
    test('should extract CCC messages from bugreport', async ({ page }) => {
        // Use production build
        const htmlPath = path.resolve(__dirname, '../../Production/dist/log_parser.html');
        const fileUrl = `file://${htmlPath.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')}`;

        // Capture console logs
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(text);
            if (text.includes('CCC') || text.includes('ccc')) {
                console.log('BROWSER:', text);
            }
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

        // Load ZIP file (uses mock-data in CI, real fixtures locally)
        const zipPath = getFixturePath('bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.zip');
        const fileInput = await page.locator('#logFilesInput');
        await fileInput.setInputFiles(zipPath);

        // Wait for processing
        await page.waitForFunction(() => {
            const display = document.getElementById('current-file-display');
            return display && display.textContent.includes('bugreport');
        }, null, { timeout: 60000 });

        // Wait for background processing
        await page.waitForTimeout(10000);

        // Get CCC data
        const results = await page.evaluate(() => {
            const messages = window._debug?.cccMessages || [];
            return {
                cccMessagesCount: messages.length,
                cccMessagesArray: messages,
                hasCccTab: !!window.CccTab,
                sampleCccMessage: messages.length > 0 ? {
                    timestamp: messages[0].timestamp,
                    direction: messages[0].direction,
                    type: messages[0].type,
                    level: messages[0].level,  // Include level for validation
                    lineNumber: messages[0].lineNumber  // Include lineNumber for validation
                } : null
            };
        });

        console.log('CCC Results:', JSON.stringify(results, null, 2));
        console.log('\n=== CCC CONSOLE MESSAGES ===');
        consoleMessages.filter(m => m.toLowerCase().includes('ccc')).forEach(m => console.log(m));
        console.log('=== END CONSOLE ===\n');

        // Assertions - Contract validation for CCC message properties
        expect(results.cccMessagesCount, 'Should have CCC messages').toBeGreaterThan(0);
        console.log(`✓ Found ${results.cccMessagesCount} CCC messages`);

        // Validate required properties exist (prevents bug where level was missing)
        expect(results.sampleCccMessage, 'Sample CCC message should exist').not.toBeNull();
        expect(results.sampleCccMessage.timestamp, 'CCC message should have timestamp').toBeTruthy();
        expect(results.sampleCccMessage.timestamp, 'Timestamp should not be N/A').not.toBe('N/A');
        expect(results.sampleCccMessage).toHaveProperty('level');
        expect(results.sampleCccMessage.level, 'Level should be a valid log level').toMatch(/^[VDIWE]$/);
        console.log(`✓ CCC messages have required properties (timestamp, level, type)`);
    });
});
