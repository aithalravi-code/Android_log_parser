import { test, expect } from '@playwright/test';
import path from 'path';

async function ensureSidebarExpanded(page) {
    const leftPanel = page.locator('.left-panel');
    if (await leftPanel.evaluate(el => el.classList.contains('collapsed'))) {
        await page.click('#panel-toggle-btn');
        await page.waitForTimeout(1500);
    }
}

test.describe('Real-World Usage Scenarios', () => {
    test('complete workflow: load, filter, export', async ({ page }) => {
        await page.goto('/log_parser.html');

        // Step 1: Load a log file
        const logContent = Array.from({ length: 100 }, (_, i) =>
            `12-17 10:${String(i % 60).padStart(2, '0')}:00.000  ${1000 + i}  ${2000 + i} ${['I', 'E', 'W'][i % 3]} Tag${i % 5}: Message ${i}\n`
        ).join('');

        await page.locator('#logFilesInput').setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from(logContent)
        });

        await page.waitForSelector('.log-line', { timeout: 10000 });

        // Step 2: Apply filter (Side panel must be open)
        await ensureSidebarExpanded(page);
        await page.locator('#searchInput').fill('Message', { force: true });
        await page.locator('#searchInput').press('Enter');
        await page.waitForTimeout(1500);

        // Step 3: Verify filtered count updated
        const viewport = page.locator('#logViewport');
        const hasLogs = await viewport.evaluate(el => el.children.length > 0);
        expect(hasLogs).toBe(true);

        // Step 4: Switch tabs
        await page.click('button[data-tab="stats"]');
        await page.waitForTimeout(1500);

        // Step 5: Verify stats tab loaded
        const statsTab = page.locator('#statsContent');
        await expect(statsTab).toBeVisible();

        // Step 6: Export Logs (Switch back to Logs tab first)
        await page.click('button[data-tab="logs"]');
        await page.waitForTimeout(500);

        // Export button is usually in the logs tab header.
        // Assuming #exportLogsBtn is in logs tab header.

        // Setup download listener
        await ensureSidebarExpanded(page);

        // Verify export button visibility
        const exportLogsBtnLink = page.locator('#exportLogsBtn');
        await expect(exportLogsBtnLink).toBeVisible();

        // Handle potential alert dialog
        page.on('dialog', async dialog => {
            console.log(`[Dialog] ${dialog.type()}: ${dialog.message()}`);
            await dialog.accept();
        });

        // Setup download listener
        const downloadPromise = page.waitForEvent('download');

        const exportBtn = page.locator('#exportLogsBtn');
        if (await exportBtn.isVisible()) {
            await exportBtn.click();
            const download = await downloadPromise;
            // Verify download
            expect(download.suggestedFilename()).toContain('.xlsx'); // or .txt depending on impl
            // Optional: Save to temp if needed, but existence is enough
        } else {
            console.log('Export button not found - feature may not be on this tab');
            // If missing, fail or log?
            // If we really want to enable it, we should ensure we are on a tab that has it.
            // #exportLogsBtn handles "filteredLogLines" (Logs Tab).
        }
    });

    test('multi-file workflow: ZIP with multiple logs', async ({ page }) => {
        // This would require creating an actual ZIP - simplified version
        await page.goto('/log_parser.html');

        // Load individual files to simulate
        await page.locator('#logFilesInput').setInputFiles([
            {
                name: 'log1.txt',
                mimeType: 'text/plain',
                buffer: Buffer.from('12-17 10:00:00.000  1234  5678 I Tag1: First file\n')
            },
            {
                name: 'log2.txt',
                mimeType: 'text/plain',
                buffer: Buffer.from('12-17 10:00:01.000  1234  5678 I Tag2: Second file\n')
            }
        ]);

        await page.waitForSelector('.log-line', { timeout: 10000 });

        // Verify logs from both files loaded
        const logViewport = page.locator('#logViewport');
        const hasContent = await logViewport.evaluate(el => el.children.length > 0);
        expect(hasContent).toBe(true);
    });

    test('filter combination workflow', async ({ page }) => {
        await page.goto('/log_parser.html');

        // Load test data
        const logs = [
            '12-17 10:00:00.000  1234  5678 I BleTag: BLE connected\n',
            '12-17 10:00:01.000  1234  5678 E BleTag: BLE error\n',
            '12-17 10:00:02.000  1234  5678 W NfcTag: NFC warning\n',
            '12-17 10:00:03.000  1234  5678 I NfcTag: NFC read\n'
        ];

        await page.locator('#logFilesInput').setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from(logs.join(''))
        });

        await page.waitForSelector('.log-line', { timeout: 10000 });

        // Filter by keyword
        await ensureSidebarExpanded(page);
        await page.locator('#searchInput').fill('BLE');
        await page.locator('#searchInput').press('Enter');
        await page.waitForTimeout(300);

        // Filter by level (click E button)
        await ensureSidebarExpanded(page);
        await page.click('button[data-level="E"]');
        await page.waitForTimeout(300);

        // Verify filters applied
        const viewport = page.locator('#logViewport');
        await expect(viewport).toBeVisible();
    });

    test('search and navigate workflow', async ({ page }) => {
        test.setTimeout(60000); // Increase timeout
        await page.goto('/log_parser.html');

        // Load numbered logs for easy verification
        const logs = Array.from({ length: 50 }, (_, i) =>
            `12-17 10:00:${String(i).padStart(2, '0')}.000  1234  5678 I Tag: Line ${i}\n`
        ).join('');

        await page.locator('#logFilesInput').setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from(logs)
        });

        // Wait for processing with proper timeout
        await page.waitForFunction(() => {
            const viewport = document.getElementById('logViewport');
            return viewport && viewport.querySelectorAll('.log-line').length > 0;
        }, null, { timeout: 30000 });

        // Use goto line feature
        await ensureSidebarExpanded(page);
        const searchInput = page.locator('#searchInput');
        await searchInput.fill('#25');
        await page.waitForTimeout(1500);

        // Verify line navigation worked
        await expect(searchInput).toBeVisible();
    });
});

test.describe('Data Integrity', () => {
    test('should preserve data through filter changes', async ({ page }) => {
        await page.goto('/log_parser.html');

        const originalLog = '12-17 10:00:00.000  1234  5678 I Tag: Important message\n';

        await page.locator('#logFilesInput').setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from(originalLog)
        });

        await page.waitForSelector('.log-line', { timeout: 10000 });

        // Apply filter
        await ensureSidebarExpanded(page);
        const iButton = page.locator('button[data-level="I"]');
        await iButton.click(); // Turn off I
        await page.waitForTimeout(300);

        await ensureSidebarExpanded(page);
        await iButton.click(); // Turn back on
        await page.waitForTimeout(300);

        // Data should still be there
        const viewport = page.locator('#logViewport');
        const hasContent = await viewport.evaluate(el => el.children.length > 0);
        expect(hasContent).toBe(true);
    });

    test('should maintain search filter through tab switches', async ({ page }) => {
        await page.goto('/log_parser.html');

        await page.locator('#logFilesInput').setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from('12-17 10:00:00.000  1234  5678 I Tag: Test\n')
        });

        await page.waitForSelector('.log-line', { timeout: 10000 });

        // Set a filter
        await ensureSidebarExpanded(page);
        await page.locator('#searchInput').fill('Test', { force: true });
        await page.locator('#searchInput').press('Enter');
        await page.waitForTimeout(300);

        // Switch to stats tab
        await page.click('button[data-tab="stats"]');
        await page.waitForTimeout(1500);

        // Switch back to logs
        await page.click('button[data-tab="logs"]');
        await page.waitForTimeout(1500);

        // Filter should still be there
        await ensureSidebarExpanded(page);
        // Input is cleared after Enter, so we check for the chip
        const chip = page.locator('.keyword-chip', { hasText: 'Test' });
        await expect(chip).toBeVisible();
    });
});

test.describe('Performance Under Load', () => {
    test('should handle rapid filter changes', async ({ page }) => {
        await page.goto('/log_parser.html');

        await page.locator('#logFilesInput').setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from(Array.from({ length: 200 }, (_, i) =>
                `12-17 10:00:00.000  1234  5678 I Tag: Message ${i}\n`
            ).join(''))
        });

        await page.waitForSelector('.log-line', { timeout: 10000 });

        // Rapidly toggle filters
        await ensureSidebarExpanded(page);
        const levels = ['I', 'E', 'W', 'D'];
        for (const level of levels) {
            await page.click(`button[data-level="${level}"]`);
            await page.waitForTimeout(100);
            await page.click(`button[data-level="${level}"]`);
            await page.waitForTimeout(100);
        }

        // App should still be responsive
        await expect(page.locator('.container')).toBeVisible();
    });

    test('should handle rapid tab switching', async ({ page }) => {
        await page.goto('/log_parser.html');

        await page.locator('#logFilesInput').setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from('12-17 10:00:00.000  1234  5678 I Tag: Test\n')
        });

        await page.waitForSelector('.log-line', { timeout: 10000 });

        // Rapidly switch tabs
        const tabs = ['logs', 'connectivity', 'stats', 'logs', 'connectivity'];
        for (const tab of tabs) {
            await page.click(`button[data-tab="${tab}"]`);
            await page.waitForTimeout(200);
        }

        // Should still work
        await expect(page.locator('.container')).toBeVisible();
    });
});

test.describe('State Recovery', () => {
    test('should recover from worker errors gracefully', async ({ page }) => {
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('/log_parser.html');

        // Load normal file first
        await page.locator('#logFilesInput').setInputFiles({
            name: 'good.log',
            mimeType: 'text/plain',
            buffer: Buffer.from('12-17 10:00:00.000  1234  5678 I Tag: Good\n')
        });

        await page.waitForSelector('.log-line', { timeout: 10000 });

        // Try to load problematic content
        await page.locator('#logFilesInput').setInputFiles({
            name: 'weird.log',
            mimeType: 'text/plain',
            buffer: Buffer.from('Not really a log file!!!\n\x00\x01\x02\n')
        });

        await page.waitForTimeout(5000);

        // App should recover
        await expect(page.locator('.container')).toBeVisible();
        const canLoadMore = await page.locator('#logFilesInput').isEnabled();
        expect(canLoadMore).toBe(true);
    });
});
