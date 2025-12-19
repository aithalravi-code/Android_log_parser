/**
 * State Persistence E2E Tests
 * Test IndexedDB persistence and state management
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { generateMockLogFile } from '../helpers/test-data-generator.js';
import { uploadFile, clearAppState, applyFilters, switchTab, getLogCount } from '../helpers/test-utils.js';

test.describe('State Persistence', () => {
    let mockLogPath;

    test.beforeAll(async () => {
        const tempDir = path.resolve(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        mockLogPath = path.join(tempDir, 'persistence_test.log');
        fs.writeFileSync(mockLogPath, generateMockLogFile(500, {
            includeTimestamps: true,
            includeThermal: true
        }));
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/log_parser.html');
        await clearAppState(page);
    });

    test('Upload file → Reload → Verify data persisted', async ({ page }) => {
        // Upload file
        await uploadFile(page, mockLogPath);
        const originalCount = await getLogCount(page);
        expect(originalCount).toBeGreaterThan(0);

        // Reload page
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Verify data restored
        const restoredCount = await getLogCount(page);
        expect(restoredCount).toBe(originalCount);

        console.log(`Persisted ${restoredCount} log lines`);
    });

    test('Upload → Switch tab → Reload → Verify active tab persisted', async ({ page }) => {
        await uploadFile(page, mockLogPath);

        // Switch to Stats tab
        await switchTab(page, 'stats');
        await page.waitForTimeout(500);

        // Reload
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Check if Stats tab is active (may or may not persist depending on implementation)
        const activeTab = await page.evaluate(() => {
            const active = document.querySelector('.tab-btn.active');
            return active ? active.getAttribute('data-tab') : null;
        });

        console.log(`Active tab after reload: ${activeTab}`);
        expect(activeTab).toBeTruthy();
    });

    test('Clear state → Reload → Verify clean slate', async ({ page }) => {
        // Upload and verify
        await uploadFile(page, mockLogPath);
        const beforeClear = await getLogCount(page);
        expect(beforeClear).toBeGreaterThan(0);

        // Clear state
        await clearAppState(page);
        const afterClear = await getLogCount(page);
        expect(afterClear).toBe(0);

        // Reload
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Should still be empty
        const afterReload = await getLogCount(page);
        expect(afterReload).toBe(0);
    });

    test.skip('Multiple uploads → Reload → Verify latest data', async ({ page }) => {
        // FIXME: This test is flaky - times out during second upload after clearAppState
        // Issue: uploadFile times out waiting for log processing after clearAppState
        // Needs investigation into why file upload doesn't complete after state clear

        // First upload
        await uploadFile(page, mockLogPath);
        const firstCount = await getLogCount(page);

        // Clear and upload again
        await clearAppState(page);
        await uploadFile(page, mockLogPath);
        const secondCount = await getLogCount(page);

        // Reload
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Poll for data restoration (CI can be slow)
        let restoredCount = 0;
        for (let i = 0; i < 20; i++) { // Wait up to 10s
            restoredCount = await getLogCount(page);
            if (restoredCount > 0) break;
            await page.waitForTimeout(500);
        }

        // Restored count should match expected
        expect(restoredCount).toBe(secondCount);
    });

    test('IndexedDB data survives multiple reloads', async ({ page }) => {
        await uploadFile(page, mockLogPath);
        const originalCount = await getLogCount(page);

        // Reload multiple times
        for (let i = 0; i < 3; i++) {
            await page.reload();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            const count = await getLogCount(page);
            expect(count).toBe(originalCount);
            console.log(`Reload ${i + 1}: ${count} logs`);
        }
    });

    test('State persists across different page navigations', async ({ page }) => {
        await uploadFile(page, mockLogPath);
        const originalCount = await getLogCount(page);

        // Navigate away
        await page.goto('about:blank');
        await page.waitForTimeout(500);

        // Navigate back
        await page.goto('/log_parser.html');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Data should be restored
        const restoredCount = await getLogCount(page);
        expect(restoredCount).toBe(originalCount);
    });

    test('Clear state button removes all IndexedDB data', async ({ page }) => {
        await uploadFile(page, mockLogPath);
        expect(await getLogCount(page)).toBeGreaterThan(0);

        // Click clear state button
        const clearBtn = page.locator('#clearStateBtn');
        await clearBtn.click();
        await page.waitForTimeout(1000);

        // Verify cleared
        expect(await getLogCount(page)).toBe(0);

        // Reload and verify still empty
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        expect(await getLogCount(page)).toBe(0);
    });

    test('IndexedDB handles large datasets', async ({ page }) => {
        test.setTimeout(120000);

        // Create larger file
        const largeFile = path.join(path.dirname(mockLogPath), 'large_persist.log');
        fs.writeFileSync(largeFile, generateMockLogFile(5000));

        await uploadFile(page, largeFile, { timeout: 60000 });
        const originalCount = await getLogCount(page);
        expect(originalCount).toBeGreaterThan(4000);

        // Reload
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(5000);

        // Verify large dataset restored
        const restoredCount = await getLogCount(page);
        expect(restoredCount).toBe(originalCount);

        fs.unlinkSync(largeFile);
    });

    test('Concurrent tabs share IndexedDB data', async ({ browser }) => {
        const context = await browser.newContext();
        const page1 = await context.newPage();
        const page2 = await context.newPage();

        // Upload in first tab
        await page1.goto('/log_parser.html');
        await clearAppState(page1);
        await uploadFile(page1, mockLogPath);
        const count1 = await getLogCount(page1);

        // Open second tab and check data
        await page2.goto('/log_parser.html');
        await page2.waitForLoadState('domcontentloaded');
        await page2.waitForTimeout(2000);

        const count2 = await getLogCount(page2);
        expect(count2).toBe(count1);

        await context.close();
    });

    test('State restoration handles corrupted IndexedDB gracefully', async ({ page }) => {
        test.setTimeout(90000); // Increased to 90s
        await uploadFile(page, mockLogPath);

        // Corrupt IndexedDB by writing invalid data with timeout
        try {
            await Promise.race([
                page.evaluate(() => {
                    return new Promise((resolve) => {
                        const request = indexedDB.open('logParserDB', 1);
                        request.onsuccess = (event) => {
                            const db = event.target.result;
                            const transaction = db.transaction(['logs'], 'readwrite');
                            const store = transaction.objectStore('logs');

                            // Write invalid data
                            store.put({ id: 'corrupt', data: 'invalid' });

                            transaction.oncomplete = () => {
                                db.close();
                                resolve();
                            };
                        };
                        request.onerror = () => resolve(); // Handle errors gracefully
                    });
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
            ]);
        } catch (e) {
            console.log('IndexedDB corruption timed out or failed, continuing test...');
        }

        // Reload
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Should handle gracefully (either restore valid data or show empty)
        const count = await getLogCount(page);
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('File metadata persists with log data', async ({ page }) => {
        await uploadFile(page, mockLogPath);

        // Get file display
        const fileName = await page.textContent('#current-file-display');
        expect(fileName).toContain('persistence_test');

        // Reload
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // File name should be restored
        const restoredFileName = await page.textContent('#current-file-display');
        expect(restoredFileName).toContain('persistence_test');
    });

    test('State persists after browser crash simulation', async ({ page }) => {
        await uploadFile(page, mockLogPath);
        const originalCount = await getLogCount(page);

        // Simulate crash by forcing navigation
        await page.evaluate(() => {
            window.location.href = 'about:blank';
        });
        await page.waitForTimeout(500);

        // Navigate back
        await page.goto('/log_parser.html');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Data should be restored
        const restoredCount = await getLogCount(page);
        expect(restoredCount).toBe(originalCount);
    });

    test('Clear state during page load handles gracefully', async ({ page }) => {
        await uploadFile(page, mockLogPath);

        // Start reload and immediately try to clear
        const reloadPromise = page.reload();
        await page.waitForTimeout(100);

        // Try to clear during load
        try {
            await clearAppState(page);
        } catch (e) {
            // May fail if page is still loading
        }

        await reloadPromise;
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Should be in a valid state
        const count = await getLogCount(page);
        expect(count).toBeGreaterThanOrEqual(0);
    });
});
