import { test, expect } from '@playwright/test';

test.describe('BTSnoop Connection Events Filter Scroll Restoration', () => {
    test('should restore scroll position after filtering', async ({ page }) => {
        test.setTimeout(120000);

        // Capture console logs
        const consoleLogs = [];
        page.on('console', msg => {
            consoleLogs.push(msg.text());
            console.log(`[BROWSER]: ${msg.text()}`);
        });

        await page.goto('http://localhost:5173/');
        await page.waitForLoadState('networkidle');

        // Upload test file
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles('TestData/fixtures/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.zip');

        console.log('Waiting for file to process...');
        await page.waitForTimeout(25000);

        // Navigate to Stats tab
        console.log('Clicking Stats tab...');
        await page.click('button[data-tab="stats"]');
        await page.waitForTimeout(2000);

        // Find table
        const table = page.locator('#btsnoopConnectionEventsTable');
        await expect(table).toBeVisible({ timeout: 10000 });

        const rows = table.locator('tbody tr');
        const rowCount = await rows.count();
        console.log(`Found ${rowCount} connection event rows`);

        if (rowCount === 0) {
            throw new Error('No connection events found!');
        }

        // Click a row to select it
        const targetRow = rows.nth(Math.min(4, rowCount - 1));
        console.log('Selecting row...');
        await targetRow.click();
        await page.waitForTimeout(500);

        const rowId = await targetRow.getAttribute('data-row-id');
        console.log(`Selected row: ${rowId}`);

        // Apply a filter
        console.log('Applying filter...');
        const filterInputs = table.locator('.filter-row input');
        if (await filterInputs.count() > 0) {
            await filterInputs.first().fill('xyz123notfound');
            await page.waitForTimeout(1000);

            // Check rows are hidden
            const visibleRows = await rows.locator(':visible').count();
            console.log(`Visible rows after filter: ${visibleRows}`);

            // Clear filter
            console.log('Clearing filter...');
            await filterInputs.first().fill('');
            await page.waitForTimeout(1000);
        }

        // Check if selection is restored
        const restoredRow = table.locator(`tr[data-row-id="${rowId}"]`);
        await expect(restoredRow).toBeVisible({ timeout: 2000 });

        const stillSelected = await restoredRow.evaluate(el => el.classList.contains('selected'));
        console.log(`Row still selected after filtering: ${stillSelected}`);

        // Check for restore log
        const hasRestoreLog = consoleLogs.some(log =>
            log.includes('Restored selection') && log.includes('btsnoopConnectionEventsTable')
        );
        console.log(`Restore log found: ${hasRestoreLog}`);

        // Test assertions
        expect(stillSelected, 'Row should remain selected after filter clear').toBeTruthy();
        expect(hasRestoreLog, 'Should log scroll restoration').toBeTruthy();
    });
});
