import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('File Collapsing', () => {
    test('should collapse and expand file sections when clicking headers', async ({ page }) => {
        await page.goto('log_parser.html');

        // Create mock files using buffers
        const file1Content = Array.from({ length: 50 }, (_, i) => `12-17 10:00:${String(i).padStart(2, '0')}.000 1000 1000 I Ref1: Log line ${i}\n`).join('');
        const file2Content = Array.from({ length: 50 }, (_, i) => `12-17 10:01:${String(i).padStart(2, '0')}.000 1000 1000 I Ref2: Log line ${i}\n`).join('');

        // Upload files
        await page.locator('#logFilesInput').setInputFiles([
            {
                name: 'file1.txt',
                mimeType: 'text/plain',
                buffer: Buffer.from(file1Content)
            },
            {
                name: 'file2.txt',
                mimeType: 'text/plain',
                buffer: Buffer.from(file2Content)
            }
        ]);

        // Wait for logs to render
        await page.waitForSelector('.log-line');

        // Verify headers exist
        // Note: Logic in processFiles adds headers with file names
        const header1 = page.locator('.log-line-meta').filter({ hasText: 'file1.txt' });
        const header2 = page.locator('.log-line-meta').filter({ hasText: 'file2.txt' });

        await expect(header1).toBeVisible();
        await expect(header2).toBeVisible();

        // Verify content lines are visible initially
        // "Log line 1" should be under file1
        // "Log line 2" should be under file2
        await expect(page.locator('text=Ref1').first()).toBeVisible();
        await expect(page.locator('text=Ref2').first()).toBeVisible();

        // 1. Click header 1 to collapse
        await header1.click({ force: true });

        // Short wait for re-render
        await page.waitForTimeout(100);

        // Verify "Log line 1" is HIDDEN (detached or hidden)
        await expect(page.locator('text=Ref1').first()).toBeHidden();

        // Verify header 1 text changed to [+] indicator (logic in renders usually changes [-] to [+])
        // The parser adds "[-] " prefix by default for expanded, "[+] " for collapsed.
        await expect(header1).toContainText('[+]');

        // Verify File 2 content is STILL visible
        await expect(page.locator('text=Ref2').first()).toBeVisible();

        // 2. Click header 1 to expand
        await header1.click();
        await page.waitForTimeout(100);

        // Verify "Log line 1" is VISIBLE
        await expect(page.locator('text=Ref1').first()).toBeVisible();
        await expect(header1).toContainText('[-]');

        // 3. Click header 2 to collapse
        await header2.click();
        await page.waitForTimeout(100);

        // Verify "Log line 2" is HIDDEN
        await expect(page.locator('text=Ref2').first()).toBeHidden();
        // Verify "Log line 1" is STILL visible
        await expect(page.locator('text=Ref1').first()).toBeVisible();
    });
});
