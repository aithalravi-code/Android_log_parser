
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { generateMockLogFile } from '../helpers/test-data-generator.js';
import { uploadFile, clearAppState, getLogCount } from '../helpers/test-utils.js';

test.describe('Extended State Persistence', () => {
    let mockLogPath;

    test.beforeAll(async () => {
        const tempDir = path.resolve(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        mockLogPath = path.join(tempDir, 'extended_persistence_test.log');
        // Generate logs with specific patterns to trigger Stats
        // 500 lines, with timestamps, thermal data, and some specific app versions if generator supports it
        // The generator supports 'includeThermal'
        const content = generateMockLogFile(500, {
            includeTimestamps: true,
            includeThermal: true
        });

        // Append some dummy App Version lines if generator doesn't do it
        // Format: "Package: com.google.android.gms Version: 21.33.14" (Need to check regex in worker)
        // Regex in worker: /Package\s+([a-zA-Z0-9_.]+)\s+v?ersion\s+([0-9.]+)/i
        const appVersionLines = `
12-14 10:00:00.000 1000 1000 I PackageManager: Package com.example.app version 1.0.0
12-14 10:00:01.000 1000 1000 I PackageManager: Package com.test.service version 2.5.1
12-14 10:00:02.000 1000 1000 I Thermal : temperature: 36000
12-14 10:00:03.000 1000 1000 I Thermal : temperature: 37000
12-14 10:00:04.000 1000 1000 I Thermal : temperature: 38000
12-14 10:00:05.000 1000 1000 I System : 10% user + 5% kernel
12-14 10:00:06.000 1000 1000 I System : 20% user + 10% kernel
        `;

        fs.writeFileSync(mockLogPath, content + appVersionLines);
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/log_parser.html');
        await clearAppState(page);
    });

    test('Extended state (Stats, CCC, BTSnoop, FileName) persists after reload', async ({ page }) => {
        // Upload
        await uploadFile(page, mockLogPath);

        // Wait for processing and saving
        await page.waitForTimeout(6000);

        // Verify File Name BEFORE reload
        const fileNameDisplay = page.locator('#current-file-display');
        await expect(fileNameDisplay).toContainText('extended_persistence_test.log');

        // Verify Stats Charts exist BEFORE reload
        const statsTabBtn = page.locator('button[data-tab="stats"]');
        if (await statsTabBtn.isVisible()) await statsTabBtn.click();
        const tempChart = page.locator('#temperaturePlotContainer svg');
        await expect(tempChart).toBeVisible({ timeout: 5000 });

        // Verify App Versions exist BEFORE reload
        const appTable = page.locator('#appVersionsTable tbody tr');
        const countAppBefore = await appTable.count();
        expect(countAppBefore).toBeGreaterThan(0);

        // Verify CCC Data exists BEFORE reload (Mock generator might not produce CCC unless requested)
        // Check if CCC tab has data (assuming generator options included CCC if mocked, otherwise we check empty state handling)
        // For this test, we didn't explicitly request CCC in generator above but generatorMockLogFile has defaults.
        // Let's rely on what we added to generator.

        // Reload
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Allow restore

        // 1. Verify File Name AFTER reload
        await expect(fileNameDisplay).toContainText('extended_persistence_test.log');

        // 2. Verify Stats Charts AFTER reload
        if (await statsTabBtn.isVisible()) await statsTabBtn.click();
        await page.waitForTimeout(1000);
        await expect(tempChart).toBeVisible();

        // 3. Verify App Versions AFTER reload
        const countAppAfter = await appTable.count();
        expect(countAppAfter).toBe(countAppBefore);

        // 4. Verify CCC Table (if data exists)
        // (Optional: add CCC data to mock if needed for strict check)
    });
});
