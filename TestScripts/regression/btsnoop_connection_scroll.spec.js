import { test, expect } from '@playwright/test';

test.describe('BTSnoop Connection Events Scroll Restoration', () => {
    test('should restore scroll position and selection after filtering', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes for file upload

        // Capture console logs FIRST
        const consoleLogs = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push(text);
            console.log(`[BROWSER]: ${text}`);
        });

        // Navigate to localhost dev server
        await page.goto('http://localhost:5173/');
        await page.waitForLoadState('networkidle');

        // Upload test file
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles('TestData/fixtures/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.zip');

        // Wait for file processing - look for BTSnoop processing completion
        console.log('Waiting for file to process...');
        await page.waitForTimeout(25000); // BTSnoop processing takes time

        // Navigate to Stats tab
        console.log('Clicking Stats tab...');
        await page.click('button[data-tab="stats"]');
        await page.waitForTimeout(2000);

        // Find BTSnoop Connection Events table
        const table = page.locator('#btsnoopConnectionEventsTable');
        await expect(table).toBeVisible({ timeout: 10000 });

        // Get all rows (excluding header)
        const rows = table.locator('tbody tr');
        const rowCount = await rows.count();

        console.log(`Found ${rowCount} connection event rows`);

        if (rowCount === 0) {
            throw new Error('No connection events found in table!');
        }

        // Click the 5th row to select it (if exists)
        const rowIndex = Math.min(4, rowCount - 1);
        const targetRow = rows.nth(rowIndex);

        console.log(`Clicking row ${rowIndex}...`);
        await targetRow.click();
        await page.waitForTimeout(500);

        // Verify row is selected
        const hasSelectedClass = await targetRow.evaluate(el => el.classList.contains('selected'));
        expect(hasSelectedClass).toBeTruthy();

        // Get the row ID
        const rowId = await targetRow.getAttribute('data-row-id');
        console.log(`Selected row with ID: ${rowId}`);

        // Trigger re-render by clicking the table header to sort
        console.log('Triggering sort to force re-render...');
        const headers = table.locator('thead th');
        if (await headers.count() > 1) {
            await headers.nth(1).click(); // Click timestamp header to sort
            await page.waitForTimeout(1000);
        }

        // After re-render, check if selection is restored
        console.log('Checking if selection restored...');
        const restoredRow = table.locator(`tr[data-row-id="${rowId}"]`);

        // Verify row still exists
        await expect(restoredRow).toBeVisible({ timeout: 2000 });

        // Verify row still has selected class
        const stillSelected = await restoredRow.evaluate(el => el.classList.contains('selected'));

        // Check console for scroll restoration message
        const hasRestoreLog = consoleLogs.some(log =>
            log.includes('Restored selection') && log.includes('btsnoopConnectionEventsTable')
        );

        console.log('\n=== TEST RESULTS ===');
        console.log(`Row still selected: ${stillSelected}`);
        console.log(`Restore log found: ${hasRestoreLog}`);
        console.log(`Total console logs captured: ${consoleLogs.length}`);
        console.log('\n=== ALL CONSOLE LOGS ===');
        consoleLogs.forEach((log, i) => console.log(`${i + 1}. ${log}`));

        // ASSERTIONS
        expect(stillSelected, 'Row should still have selected class after re-render').toBeTruthy();
        expect(hasRestoreLog, 'Console should show scroll restoration message').toBeTruthy();
    });
});
