import { test, expect } from '@playwright/test';

/**
 * This test suite uses the PRODUCTION BUILD to catch
 * issues that only appear in the built bundle
 */
test.describe('Production Build Verification', () => {
    test.beforeAll(async () => {
        // Note: Run `npm run build` before these tests
        console.log('Testing production build at: file:///.../Production/dist/log_parser.html');
    });

    test('production build should load without errors', async ({ page }) => {
        const consoleErrors = [];
        const pageErrors = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        page.on('pageerror', error => {
            pageErrors.push(error.message);
        });

        // Load production HTML file
        // Note: Update path based on your setup
        const prodPath = 'file://' + process.cwd() + '/Production/dist/log_parser.html';
        await page.goto(prodPath);

        // Wait for initialization
        await page.waitForTimeout(2000);

        // Log any errors found
        if (consoleErrors.length > 0) {
            console.log('Console Errors in Production Build:', consoleErrors);
        }
        if (pageErrors.length > 0) {
            console.log('Page Errors in Production Build:', pageErrors);
        }

        // Assert no errors
        expect(pageErrors, 'Production build should have no page errors').toEqual([]);
        expect(consoleErrors.filter(e => !e.includes('DevTools')),
            'Production build should have no console errors').toEqual([]);
    });

    test('production build should have working functionality', async ({ page }) => {
        const prodPath = 'file://' + process.cwd() + '/Production/dist/log_parser.html';
        await page.goto(prodPath);

        // Test basic functionality
        await expect(page.locator('#logFilesInput')).toBeVisible();

        // Verify state is accessible
        const hasState = await page.evaluate(() => typeof window._appState !== 'undefined');
        expect(hasState).toBe(true);
    });
});
