import { test, expect } from '@playwright/test';

test.describe('CCC Tab Stress Test', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/log_parser.html');
        await page.waitForLoadState('networkidle');

        // Wait for CccTab to be available (it's loaded lazily or needs to be ensured)
        // Since it's a module, we might need to trigger something to load it, 
        // or just wait if it's bundled in index.js now.
        // Given the build, it's likely a separate chunk.

        // Let's force load by clicking the tab first?
        // Or if exposed on window, we just wait for window.CccTab to exist?
        // It might not exist until the module executes.
    });

    test('should handle large CCC dataset without hanging', async ({ page }) => {
        test.setTimeout(60000); // 1 minute timeout

        // Ensure CccTab is loaded - try switching to it
        await page.click('button[data-tab="ccc"]');
        await page.waitForTimeout(1000);

        console.log('Injecting large CCC dataset...');

        // Inject large dataset via window.CccTab.setup
        await page.evaluate(async () => {
            const total = 5000; // 5000 messages
            const mockData = Array(total).fill(0).map((_, idx) => ({
                type: 0x01,
                subtype: 0x0B,
                payload: "3004A0028300" + (idx % 255).toString(16).padStart(2, '0'),
                timestamp: "00:00:00." + idx.toString().padStart(6, '0'),
                direction: idx % 2 === 0 ? 'Sending' : 'Receiving',
                fullHex: "010B3004A0028300"
            }));

            if (window.CccTab && window.CccTab.setup) {
                console.log("Calling CccTab.setup...");
                await window.CccTab.setup(mockData, new Map());
            } else {
                throw new Error("window.CccTab is not available");
            }
        });

        // Click CCC tab again to be sure (rendering might happen automatically from setup)
        // await page.click('button[data-tab="ccc"]');

        console.log('Waiting for table to populate...');

        // Wait for at least one row to appear
        const firstRow = page.locator('#cccStatsTable tbody tr').first();
        await expect(firstRow).toBeVisible({ timeout: 10000 });

        // Ensure it's not the "Processing" row eventually
        await expect(page.locator('#cccStatsTable tbody tr td').first()).not.toContainText('Processing', { timeout: 30000 });

        // Wait a bit for rendering to progress
        await page.waitForTimeout(2000);

        const rowCount = await page.locator('#cccStatsTable tbody tr').count();
        console.log(`Rendered ${rowCount} rows so far.`);

        expect(rowCount).toBeGreaterThan(50); // Should have rendered at least the first chunk

        // Verify responsiveness - try to click a filter
        const filterInput = page.locator('input[data-col="0"]');
        await expect(filterInput).toBeVisible();
        await filterInput.fill('00:00:00.001'); // Filter for specific timestamp
        await page.waitForTimeout(1000); // Wait for debounce/filter

        // It should filter down
        const filteredCount = await page.locator('#cccStatsTable tbody tr').count();
        console.log(`Filtered count: ${filteredCount}`);
        expect(filteredCount).toBeLessThan(rowCount);
        expect(filteredCount).toBeGreaterThan(0);

        console.log('Test completed successfully, browser remained responsive.');
    });
});
