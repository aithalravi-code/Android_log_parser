import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('BTSnoop Timestamp Sorting Test', async ({ page }) => {
    // Navigate to app
    const appPath = path.join(__dirname, '../../Production/dist/index.html');
    await page.goto(`file://${appPath}`);

    // Load test data
    console.log('\n📁 Loading test data...');
    const testFilePath = path.join(__dirname, '../../TestData/fixtures/dumpState_S918BXXS8DYG5_202509231248.zip');

    const fileBuffer = await fs.readFile(testFilePath);
    const base64Data = fileBuffer.toString('base64');

    await page.evaluate(async ({ base64, filename }) => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/zip' });
        const file = new File([blob], filename, { type: 'application/zip' });

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        const input = document.getElementById('zipInput');
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { base64: base64Data, filename: 'dumpState_S918BXXS8DYG5_202509231248.zip' });

    // Wait for data to load
    await page.waitForFunction(
        () => document.querySelector('#cccStatsTable tbody tr') !== null,
        { timeout: 30000 }
    );
    console.log('✅ Data loaded\n');

    // Go to BTSnoop tab
    await page.click('button:has-text("BTSnoop")');
    await page.waitForTimeout(2000); // Wait for packets to render

    // Scroll down to get a wider variety of timestamps
    await page.evaluate(() => {
        const container = document.querySelector('[data-container="btsnoop"]');
        if (container) container.scrollTop = 50000;
    });
    await page.waitForTimeout(1000);

    // Get 10 timestamps from middle of data
    const timestampsBefore = await page.evaluate(() => {
        const rows = document.querySelectorAll('.btsnoop-row');
        return Array.from(rows).slice(0, 10).map(row => {
            const cells = row.querySelectorAll('.btsnoop-cell');
            return cells[1] ? cells[1].textContent.trim() : 'N/A';
        });
    });

    console.log('📋 First 10 timestamps BEFORE sort:');
    timestampsBefore.forEach((ts, i) => console.log(`  ${i + 1}. ${ts}`));

    // Click timestamp header to sort DESCENDING (opposite of current)
    const currentHeader = await page.locator('.btsnoop-header-cell').nth(1);
    await currentHeader.click();
    await page.waitForTimeout(2000);

    // Scroll back to top
    await page.evaluate(() => {
        const container = document.querySelector('[data-container="btsnoop"]');
        if (container) container.scrollTop = 0;
    });
    await page.waitForTimeout(1000);

    // Get timestamps from top after sort
    const timestampsAfter = await page.evaluate(() => {
        const rows = document.querySelectorAll('.btsnoop-row');
        return Array.from(rows).slice(0, 10).map(row => {
            const cells = row.querySelectorAll('.btsnoop-cell');
            return cells[1] ? cells[1].textContent.trim() : 'N/A';
        });
    });

    console.log('\n📋 First 10 timestamps AFTER sort:');
    timestampsAfter.forEach((ts, i) => console.log(`  ${i + 1}. ${ts}`));

    // Check if first timestamp is different
    const firstChanged = timestampsBefore[0] !== timestampsAfter[0];
    console.log(`\n${firstChanged ? '✅' : '❌'} First timestamp ${firstChanged ? 'CHANGED' : 'DID NOT CHANGE'}`);
    console.log(`  Before: ${timestampsBefore[0]}`);
    console.log(`  After: ${timestampsAfter[0]}`);

    expect(firstChanged).toBe(true);
});
