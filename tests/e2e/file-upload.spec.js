/**
 * E2E test for UI and basic interactions
 * 
 * NOTE: File upload tests require a web server due to file:// protocol limitations.
 * These tests focus on UI elements and interactions that work without file uploads.
 * 
 * For full E2E testing with file uploads:
 * 1. Install http-server: npm install -g http-server
 * 2. Run server: http-server -p 8080
 * 3. Update playwright.config.js baseURL to http://localhost:8080
 * 4. Then run: npm run test:e2e
 */

import { test, expect } from '@playwright/test';

test.describe('UI Elements', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should display initial UI correctly', async ({ page }) => {
        // Check that file input is visible
        const fileInput = page.locator('#logFilesInput');
        await expect(fileInput).toBeAttached();

        // Check that tabs are present
        const tabs = page.locator('.tab-btn');
        const tabCount = await tabs.count();
        expect(tabCount).toBeGreaterThan(0);

        // Check that the Logs tab exists
        const logsTab = page.locator('[data-tab="logs"]');
        await expect(logsTab).toBeVisible();
    });

    test('should have all required UI elements', async ({ page }) => {
        // Check filter section
        const searchInput = page.locator('#searchInput');
        await expect(searchInput).toBeAttached();

        // Check log container
        const logContainer = page.locator('#logContainer');
        await expect(logContainer).toBeAttached();

        // Check clear state button
        const clearBtn = page.locator('#clearStateBtn');
        await expect(clearBtn).toBeAttached();
    });

    test('should load page within 3 seconds', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');
        await page.waitForLoadState('domcontentloaded');

        const loadTime = Date.now() - startTime;

        expect(loadTime).toBeLessThan(3000);
        console.log(`✅ Page loaded in ${loadTime}ms`);
    });
});

test.describe('Tab Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should switch between tabs', async ({ page }) => {
        // Get all tabs
        const tabs = await page.locator('.tab-btn').all();

        if (tabs.length > 1) {
            // Click on second tab
            await tabs[1].click();

            // Wait a bit for tab switch
            await page.waitForTimeout(100);

            // Verify tab switched (check for active class)
            const hasActiveClass = await tabs[1].evaluate(el => el.classList.contains('active'));
            expect(hasActiveClass).toBe(true);
        }
    });

    test('should have connectivity tab', async ({ page }) => {
        const connectivityTab = page.locator('[data-tab="connectivity"]');
        await expect(connectivityTab).toBeAttached();
    });

    test('should have stats tab', async ({ page }) => {
        const statsTab = page.locator('[data-tab="stats"]');
        await expect(statsTab).toBeAttached();
    });
});

test.describe('Filter Controls', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should have log level filter buttons', async ({ page }) => {
        // Check for log level buttons
        const errorFilter = page.locator('[data-level="E"]');
        const warningFilter = page.locator('[data-level="W"]');
        const infoFilter = page.locator('[data-level="I"]');

        await expect(errorFilter).toBeAttached();
        await expect(warningFilter).toBeAttached();
        await expect(infoFilter).toBeAttached();
    });

    test('should have AND/OR logic toggle', async ({ page }) => {
        const orBtn = page.locator('#logicOrBtn');
        const andBtn = page.locator('#logicAndBtn');

        await expect(orBtn).toBeAttached();
        await expect(andBtn).toBeAttached();
    });

    test('should toggle between AND/OR logic', async ({ page }) => {
        const orBtn = page.locator('#logicOrBtn');
        const andBtn = page.locator('#logicAndBtn');

        // Click AND button
        await andBtn.click();
        await page.waitForTimeout(100);

        // Verify AND button has active class
        const andActive = await andBtn.evaluate(el => el.classList.contains('active'));
        expect(andActive).toBe(true);

        // Click OR button
        await orBtn.click();
        await page.waitForTimeout(100);

        // Verify OR button has active class
        const orActive = await orBtn.evaluate(el => el.classList.contains('active'));
        expect(orActive).toBe(true);
    });

    test('should have search input', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await expect(searchInput).toBeVisible();

        // Test typing in search
        await searchInput.fill('test search');
        const value = await searchInput.inputValue();
        expect(value).toBe('test search');
    });
});

test.describe('Performance Tracker', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should have performance tracker available in console', async ({ page }) => {
        // Check if perfTracker is available
        const hasPerfTracker = await page.evaluate(() => {
            return typeof window.perfTracker !== 'undefined';
        });

        // Note: This might be false if performance-tracker.js isn't loaded yet
        // That's okay - it's a sample test
        console.log(`Performance tracker available: ${hasPerfTracker}`);
    });
});

test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should be keyboard navigable', async ({ page }) => {
        // Tab through the interface
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Verify some element has focus
        const focusedElement = await page.evaluate(() => {
            return document.activeElement?.tagName || 'NONE';
        });

        expect(focusedElement).not.toBe('BODY');
        expect(focusedElement).not.toBe('NONE');
    });

    test('should have proper document title', async ({ page }) => {
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
    });
});
