import { test, expect } from '@playwright/test';
import { startCoverage, stopCoverage, saveCoverage } from '../helpers/coverage.js';

test.describe('Coverage Test', () => {
    let coverage = [];

    test.beforeEach(async ({ page }) => {
        await startCoverage(page);
    });

    test.afterEach(async ({ page }, testInfo) => {
        const testCoverage = await stopCoverage(page);
        coverage.push(...testCoverage);

        // Save coverage for this test
        if (testCoverage.length > 0) {
            await saveCoverage(testCoverage, testInfo.title);
            console.log(`✓ Collected coverage for: ${testInfo.title} (${testCoverage.length} files)`);
        }
    });

    test('should collect coverage during app initialization', async ({ page }) => {
        await page.goto('/log_parser.html');

        // Wait for app to load - use correct selector
        await page.waitForSelector('#logFilesInput', { timeout: 10000 });

        // Verify main elements exist
        await expect(page.locator('#logFilesInput')).toBeVisible();

        // Coverage will be collected in afterEach hook
    });

    test('should collect coverage during file upload', async ({ page }) => {
        await page.goto('/log_parser.html');

        // Create a small mock log file
        const mockLogContent = `--------- beginning of system
12-17 16:00:00.000  1000  1000 I TestTag : Test log line 1
12-17 16:00:01.000  1000  1000 D TestTag : Test log line 2
12-17 16:00:02.000  1000  1000 E TestTag : Test log line 3`;

        // Upload file - use correct ID
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from(mockLogContent)
        });

        // Wait for parsing
        await page.waitForTimeout(2000);

        // Verify logs appeared
        const logLines = page.locator('.log-line:not(.log-line-meta)');
        await expect(logLines.first()).toBeVisible({ timeout: 10000 });

        // Coverage will be collected in afterEach hook
    });
});
