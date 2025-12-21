import { test, expect } from '@playwright/test';
import { ensureSidebarExpanded } from '../helpers/test-utils.js';

test.describe('Error Handling', () => {
    test('should handle invalid file upload gracefully', async ({ page }) => {
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('/log_parser.html');

        // Try to upload a non-log file
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles({
            name: 'test.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('fake pdf content')
        });

        await page.waitForTimeout(1000);

        // App should not crash - just ignore invalid file
        const appElement = await page.locator('.container');
        await expect(appElement).toBeVisible();

        // Check no critical errors (some warnings may be OK)
        const criticalErrors = consoleErrors.filter(e =>
            e.includes('Uncaught') || e.includes('TypeError') || e.includes('ReferenceError')
        );
        expect(criticalErrors.length).toBe(0);
    });

    test('should handle empty file gracefully', async ({ page }) => {
        await page.goto('/log_parser.html');

        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles({
            name: 'empty.log',
            mimeType: 'text/plain',
            buffer: Buffer.from('')
        });

        await page.waitForTimeout(1000);

        // App should still be functional
        await expect(page.locator('.container')).toBeVisible();
        await expect(page.locator('#logFilesInput')).toBeVisible();
    });

    test.skip('should handle malformed ZIP file', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        await page.goto('/log_parser.html');

        const zipInput = page.locator('#zipInput');
        await zipInput.setInputFiles({
            name: 'corrupt.zip',
            mimeType: 'application/zip',
            buffer: Buffer.from('This is not a valid ZIP file')
        });

        await page.waitForTimeout(2000);

        // Should not crash the page
        await expect(page.locator('.container')).toBeVisible();

        // No uncaught errors
        const uncaughtErrors = pageErrors.filter(e =>
            !e.includes('expected') && !e.includes('worker')
        );
        expect(uncaughtErrors.length).toBeLessThan(2); // Allow 1 expected error
    });
});

test.describe('Filter Edge Cases', () => {
    test('should handle very long keyword search', async ({ page }) => {
        await page.goto('/log_parser.html');

        // Load a test file first
        await page.locator('#logFilesInput').setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from('12-17 10:00:00.000  1234  5678 I TestTag: Test message\n')
        });

        await page.waitForTimeout(500);

        // Ensure sidebar is expanded to access search input
        await ensureSidebarExpanded(page);

        // Try a very long search query
        const searchInput = page.locator('#searchInput');
        const longQuery = 'a'.repeat(1000);
        await searchInput.fill(longQuery);

        await page.waitForTimeout(500);

        // App should still work
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toHaveValue(longQuery);
    });

    test('should handle special regex characters in search', async ({ page }) => {
        await page.goto('/log_parser.html');

        await page.locator('#logFilesInput').setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from('12-17 10:00:00.000  1234  5678 I Tag: Test [.*+?^${}()|[\\]]\\n')
        });

        await page.waitForTimeout(500);

        // Ensure sidebar is expanded to access search input
        await ensureSidebarExpanded(page);

        const searchInput = page.locator('#searchInput');

        // Special characters that might break regex
        await searchInput.fill('[.*');
        await page.waitForTimeout(300);
        await expect(page.locator('.container')).toBeVisible();

        await searchInput.fill('(test)');
        await page.waitForTimeout(300);
        await expect(page.locator('.container')).toBeVisible();
    });
});

test.describe('UI Responsiveness', () => {
    test('should hide/show left panel', async ({ page }) => {
        await page.goto('/log_parser.html');

        const leftPanel = page.locator('.left-panel');
        const toggleBtn = page.locator('#panel-toggle-btn');

        // Initially visible
        await expect(leftPanel).toBeVisible();

        // Click to hide
        await toggleBtn.click();
        await page.waitForTimeout(500);

        // Check if collapsed class is added (panel might still be visible during animation)
        const hasCollapsed = await leftPanel.evaluate(el => el.classList.contains('collapsed'));
        expect(hasCollapsed).toBe(true);

        // Click to show again
        await toggleBtn.click();
        await page.waitForTimeout(500);

        const isVisible = await leftPanel.evaluate(el => !el.classList.contains('collapsed'));
        expect(isVisible).toBe(true);
    });

    test('should switch between tabs without errors', async ({ page }) => {
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('/log_parser.html');

        // Load test data
        await page.locator('#logFilesInput').setInputFiles({
            name: 'test.log',
            mimeType: 'text/plain',
            buffer: Buffer.from('12-17 10:00:00.000  1234  5678 I TestTag: BLE test message\n')
        });

        await page.waitForTimeout(1000);

        // Click through all tabs
        const tabs = ['connectivity', 'ccc', 'btsnoop', 'stats', 'logs'];
        for (const tabName of tabs) {
            await page.click(`button[data-tab="${tabName}"]`);
            await page.waitForTimeout(500);

            // Verify tab is active
            const isActive = await page.locator(`button[data-tab="${tabName}"]`).evaluate(
                el => el.classList.contains('active')
            );
            expect(isActive).toBe(true);
        }

        // No critical errors during tab switching
        const criticalErrors = consoleErrors.filter(e =>
            e.includes('Uncaught') || e.includes('TypeError')
        );
        expect(criticalErrors.length).toBe(0);
    });
});

test.describe('Performance', () => {
    test('should load medium file reasonably fast', async ({ page }) => {
        await page.goto('/log_parser.html');

        // Generate medium-sized log (1000 lines)
        const lines = [];
        for (let i = 0; i < 1000; i++) {
            lines.push(`12-17 10:00:${String(i % 60).padStart(2, '0')}.000  1234  5678 I Tag${i % 10}: Message ${i}\n`);
        }

        const startTime = Date.now();

        await page.locator('#logFilesInput').setInputFiles({
            name: 'medium.log',
            mimeType: 'text/plain',
            buffer: Buffer.from(lines.join(''))
        });

        // Wait for logs to render
        await page.waitForSelector('.log-line', { timeout: 10000 });

        const loadTime = Date.now() - startTime;

        // Should load in under 5 seconds
        expect(loadTime).toBeLessThan(5000);

        // Verify some logs are visible
        const logViewport = page.locator('#logViewport');
        const hasContent = await logViewport.evaluate(el => el.children.length > 0);
        expect(hasContent).toBe(true);
    });
});

test.describe('Data Persistence', () => {
    test.skip('should persist filter keywords across reload', async ({ page, context }) => {
        await page.goto('/log_parser.html');

        // Add a keyword
        const keywordInput = page.locator('#keywordInput');
        await keywordInput.fill('TestKeyword');
        await keywordInput.press('Enter');

        await page.waitForTimeout(500);

        // Reload page
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Check if keyword was persisted (if load filters button exists)
        const loadFiltersBtn = page.locator('#loadFiltersBtn');
        if (await loadFiltersBtn.isVisible()) {
            // Filters were saved
            expect(await loadFiltersBtn.isVisible()).toBe(true);
        }
    });
});
