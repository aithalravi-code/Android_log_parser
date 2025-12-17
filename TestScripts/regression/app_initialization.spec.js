import { test, expect } from '@playwright/test';

test.describe('App Initialization', () => {
    test('should initialize without console errors', async ({ page }) => {
        const consoleErrors = [];
        const consoleWarnings = [];

        // Listen for console messages
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
            if (msg.type() === 'warning') {
                consoleWarnings.push(msg.text());
            }
        });

        // Listen for page errors
        const pageErrors = [];
        page.on('pageerror', error => {
            pageErrors.push(error.message);
        });

        // Navigate to app
        await page.goto('/');

        // Wait for app to initialize
        await page.waitForSelector('#app', { timeout: 5000 });

        // Give it a moment to fully initialize
        await page.waitForTimeout(1000);

        // Check for errors
        console.log('Console Errors:', consoleErrors);
        console.log('Page Errors:', pageErrors);
        console.log('Console Warnings:', consoleWarnings);

        // Assert no critical errors
        expect(pageErrors, 'Should have no page errors during initialization').toEqual([]);

        // Filter out known acceptable console errors (if any)
        const criticalErrors = consoleErrors.filter(err => {
            // Filter out non-critical errors if needed
            return !err.includes('Failed to load resource'); // Example filter
        });

        expect(criticalErrors, 'Should have no critical console errors').toEqual([]);
    });

    test('should load main UI elements', async ({ page }) => {
        await page.goto('/');

        // Verify key elements loaded
        await expect(page.locator('#fileInput')).toBeVisible();
        await expect(page.locator('#tabs')).toBeVisible();
        await expect(page.locator('#logsTab')).toBeVisible();
    });

    test('should have working state debugging', async ({ page }) => {
        await page.goto('/');

        // Verify appState is accessible
        const hasAppState = await page.evaluate(() => {
            return typeof window._appState !== 'undefined';
        });

        expect(hasAppState, 'window._appState should be defined').toBe(true);

        // Verify getSnapshot works
        const snapshot = await page.evaluate(() => {
            return window._appState.getSnapshot();
        });

        expect(snapshot).toBeDefined();
        expect(snapshot).toHaveProperty('log');
        expect(snapshot).toHaveProperty('filter');
        expect(snapshot).toHaveProperty('ui');
    });
});
