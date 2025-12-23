/**
 * Stats Table Clear Tests
 * Verify that device events table and accounts list are cleared on reset
 */

import { test, expect } from '@playwright/test';
import { uploadFile, waitForLogProcessing, clearAppState, switchTab, ensureSidebarExpanded } from '../helpers/test-utils.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Stats Table Clear and Device Events', () => {
    let mockLogPath;
    const tempDir = path.join(__dirname, `temp_stats_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

    test.beforeAll(async () => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        // Create a mock log file with device events
        mockLogPath = path.join(tempDir, 'device_events_test.log');
        const logContent = `
12-18 10:00:00.000  1234  5678 I SystemServer: Device booted
12-18 10:00:01.000  1234  5678 I KeyguardUpdateMonitor: Device policy: 1
12-18 10:00:02.000  1234  5678 I KeyguardUpdateMonitor: Device policy: 2
12-18 10:00:03.000  1234  5678 I DisplayPowerController: Brightness: 128
12-18 10:00:04.000  1234  5678 I Settings: Screen timeout: 30000
Account {name=user@example.com, type=com.google}
        `.trim();
        fs.writeFileSync(mockLogPath, logContent);
    });

    test.afterAll(async () => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test.beforeEach(async ({ page }) => {
        // Enable console logs for debugging
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('[Stats]') || msg.text().includes('[Device Events]')) {
                console.log(`[Browser Console] ${msg.text()}`);
            }
        });

        await page.goto('/log_parser.html');
        await clearAppState(page);
    });

    test('Clear & Reset button clears device events table', async ({ page }) => {
        // Upload file with device events
        await uploadFile(page, mockLogPath);
        await waitForLogProcessing(page, { timeout: 5000 });

        // Switch to Stats tab
        await switchTab(page, 'stats');
        await page.waitForTimeout(1000);

        // Verify device events table has content
        const deviceEventsTable = page.locator('#deviceEventsTable tbody');
        const rowsBefore = await deviceEventsTable.locator('tr').count();
        console.log(`Device events rows before clear: ${rowsBefore}`);

        // Should have at least some rows (policy changes, brightness, etc.)
        expect(rowsBefore).toBeGreaterThan(0);

        // Click Clear & Reset button
        page.on('dialog', dialog => dialog.accept());
        await ensureSidebarExpanded(page);
        await page.click('#clearStateBtn');
        await page.waitForTimeout(1000);

        // Switch back to Stats tab (in case we got redirected)
        await switchTab(page, 'stats');
        await page.waitForTimeout(500);

        // Verify device events table is cleared
        const rowsAfter = await deviceEventsTable.locator('tr').count();
        console.log(`Device events rows after clear: ${rowsAfter}`);

        // Table should be empty or show "No events" message
        if (rowsAfter > 0) {
            const text = await deviceEventsTable.textContent();
            expect(text).toContain('No specific device or setting events found');
        } else {
            expect(rowsAfter).toBe(0);
        }
    });

    test('Clear & Reset button clears accounts list', async ({ page }) => {
        // Upload file with accounts
        await uploadFile(page, mockLogPath);
        await waitForLogProcessing(page, { timeout: 5000 });

        // Switch to Stats tab
        await switchTab(page, 'stats');
        await page.waitForTimeout(1000);

        // Verify accounts list has content
        const accountsList = page.locator('#accountsList');
        const accountsText = await accountsList.textContent();
        console.log(`Accounts list before clear: ${accountsText}`);

        // Should have the account from the log
        expect(accountsText).toContain('user@example.com');

        // Click Clear & Reset button
        page.on('dialog', dialog => dialog.accept());
        await ensureSidebarExpanded(page);
        await page.click('#clearStateBtn');
        await page.waitForTimeout(1000);

        // Switch back to Stats tab
        await switchTab(page, 'stats');
        await page.waitForTimeout(500);

        // Verify accounts list is cleared
        const accountsAfter = await accountsList.textContent();
        console.log(`Accounts list after clear: "${accountsAfter}"`);

        // After clear, accounts list should be empty
        expect(accountsAfter.trim().length).toBe(0);
    });

    test('Clear & Reset button clears BTSnoop Connection Events table', async ({ page }) => {
        // Upload file with BTSnoop data
        await uploadFile(page, mockLogPath);
        await waitForLogProcessing(page, { timeout: 5000 });

        // Switch to Stats tab
        await switchTab(page, 'stats');
        await page.waitForTimeout(1000);

        // Verify BTSnoop Connection Events table exists and may have content
        const btsnoopTable = page.locator('#btsnoopConnectionEventsTable tbody');
        const rowsBefore = await btsnoopTable.locator('tr').count();
        console.log(`BTSnoop connection events rows before clear: ${rowsBefore}`);

        // Click Clear & Reset button
        page.on('dialog', dialog => dialog.accept());
        await ensureSidebarExpanded(page);
        await page.click('#clearStateBtn');
        await page.waitForTimeout(1000);

        // Switch back to Stats tab
        await switchTab(page, 'stats');
        await page.waitForTimeout(500);

        // Verify BTSnoop Connection Events table is cleared
        const rowsAfter = await btsnoopTable.locator('tr').count();
        console.log(`BTSnoop connection events rows after clear: ${rowsAfter}`);

        // Table should be empty or show "No connection events" message
        if (rowsAfter > 0) {
            const text = await btsnoopTable.textContent();
            expect(text).toContain('No connection events found');
        } else {
            expect(rowsAfter).toBe(0);
        }

    });

    test('Device events persist after tab switch', async ({ page }) => {
        // Upload file
        await uploadFile(page, mockLogPath);
        await waitForLogProcessing(page, { timeout: 5000 });

        // Switch to Stats tab and count rows
        await switchTab(page, 'stats');
        await page.waitForTimeout(1000);

        const deviceEventsTable = page.locator('#deviceEventsTable tbody');
        const rowsFirst = await deviceEventsTable.locator('tr').count();
        console.log(`Device events rows on first visit: ${rowsFirst}`);
        expect(rowsFirst).toBeGreaterThan(0);

        // Switch to Logs tab
        await switchTab(page, 'logs');
        await page.waitForTimeout(500);

        // Switch back to Stats tab
        await switchTab(page, 'stats');
        await page.waitForTimeout(1000);

        // Verify device events are still displayed
        const rowsSecond = await deviceEventsTable.locator('tr').count();
        console.log(`Device events rows on second visit: ${rowsSecond}`);

        // Rows should be the same
        expect(rowsSecond).toBe(rowsFirst);
    });

    test('Device events persist after page reload', async ({ page }) => {
        // Upload file
        await uploadFile(page, mockLogPath);
        await waitForLogProcessing(page, { timeout: 5000 });

        // Switch to Stats tab and count device events
        await switchTab(page, 'stats');
        await page.waitForTimeout(1000);

        const deviceEventsTable = page.locator('#deviceEventsTable tbody');
        const rowsBefore = await deviceEventsTable.locator('tr').count();
        console.log(`Device events rows before reload: ${rowsBefore}`);
        expect(rowsBefore).toBeGreaterThan(0);

        // Wait for IndexedDB save (debounced 250ms + buffer)
        await page.waitForTimeout(2000);

        // Reload page
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Wait for restoration

        // Switch to Stats tab
        await switchTab(page, 'stats');
        await page.waitForTimeout(1000);

        // Verify device events are restored
        const rowsAfter = await deviceEventsTable.locator('tr').count();
        console.log(`Device events rows after reload: ${rowsAfter}`);

        // Should have same number of rows
        expect(rowsAfter).toBe(rowsBefore);
    });

    test('Accounts list persists after page reload', async ({ page }) => {
        // Upload file
        await uploadFile(page, mockLogPath);
        await waitForLogProcessing(page, { timeout: 5000 });

        // Switch to Stats tab
        await switchTab(page, 'stats');
        await page.waitForTimeout(1000);

        // Get accounts list content
        const accountsList = page.locator('#accountsList');
        const accountsBefore = await accountsList.textContent();
        console.log(`Accounts before reload: ${accountsBefore}`);
        expect(accountsBefore).toContain('user@example.com');

        // Wait for IndexedDB save
        await page.waitForTimeout(2000);

        // Reload page
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        // Switch to Stats tab
        await switchTab(page, 'stats');
        await page.waitForTimeout(1000);

        // Verify accounts are restored
        const accountsAfter = await accountsList.textContent();
        console.log(`Accounts after reload: ${accountsAfter}`);

        expect(accountsAfter).toContain('user@example.com');
    });
});
