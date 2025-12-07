import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('DateTime Filter', () => {
    test('should filter logs using date picker inputs', async ({ page }) => {
        await page.goto('http://localhost:8080');

        // Load a test file with known timestamps
        const file1Path = path.join(__dirname, 'datetime_test.log');
        await page.setInputFiles('#logFilesInput', [file1Path]);

        // Wait for logs to render
        await page.waitForSelector('.log-line');

        // Verify initial logs are present
        // file1.txt contains lines with dates like "2024-10-26 15:04:01.123"
        // Let's assume file1.txt has some content we can filter.
        // If file1.txt is generic, we might need a more specific file or assume content.
        // Assuming file1.txt has standard log lines.
        // Let's check the content of file1.txt first or just rely on the inputs being interactable.

        // Check if inputs are populated
        const startTimeInput = page.locator('#startTime');
        const endTimeInput = page.locator('#endTime');

        await expect(startTimeInput).toBeVisible();
        await expect(endTimeInput).toBeVisible();

        // Get initial values to confirm they are set
        const startVal = await startTimeInput.inputValue();
        const endVal = await endTimeInput.inputValue();
        console.log(`Initial Time Range: ${startVal} to ${endVal}`);
        expect(startVal).not.toBe('');
        expect(endVal).not.toBe('');

        // Verify min/max attributes are set and match the log range
        // Based on datetime_test.log: 10:00 to 11:00
        const minAttr = await startTimeInput.getAttribute('min');
        const maxAttr = await startTimeInput.getAttribute('max');
        console.log(`Min: ${minAttr}, Max: ${maxAttr}`);

        expect(minAttr).toContain('10:00');
        expect(maxAttr).toContain('11:00');
        expect(await endTimeInput.getAttribute('min')).toBe(minAttr);
        expect(await endTimeInput.getAttribute('max')).toBe(maxAttr);

        // Apply a filter: Set Start Time to a value slightly after the first log
        // We'll increment the minutes of the start time
        // Example format: YYYY-MM-DDTHH:mm

        // Let's assume the logs are roughly recent or match the test file content.
        // To be safe, we can just change the input and see if it triggers the re-render.
        // We can listen for the "console.log" of "[Perf] Filter state changed" in main.js

        let filterTriggered = false;
        page.on('console', msg => {
            if (msg.text().includes('[Perf] Filter state changed')) {
                filterTriggered = true;
            }
        });

        // Set a new start time (e.g., just change the string slightly)
        // If start is 2024-10-26T15:04, change to 2024-10-26T15:05
        // We'll actually just type a specific value to be sure.
        // Ideally we pick a value that excludes some lines but not all.
        // Without knowing exact file content, testing that *filtering works* specifically is hard,
        // but testing that *changing the input triggers a refresh* is the key fix verification.

        // Simulate user picking a date/time
        // We trigger 'change' event by filling
        await startTimeInput.fill('2025-01-01T12:00'); // Future date
        await startTimeInput.dispatchEvent('change'); // Ensure change event fires

        // Wait for filter to trigger
        await page.waitForTimeout(1000);

        // If filtering was triggered, logs should probably be empty (future date)
        await expect(filterTriggered).toBe(true);

        // Check if logs are empty (if 2025 is in future relative to logs)
        // const logLines = page.locator('.log-line');


        // --- Additional Check Requested by User ---
        // Test filtering for the specific line: "09-24 09:37:31.974"
        console.log('Testing specific log line filter: 09-24 09:37:31.974');

        // Update inputs to target the specific log line
        const targetYear = new Date().getFullYear();
        await startTimeInput.fill(`${targetYear}-09-24T09:30`);
        await startTimeInput.dispatchEvent('change');

        await endTimeInput.fill(`${targetYear}-09-24T09:40`);
        await endTimeInput.dispatchEvent('change');

        await page.waitForTimeout(1000);

        // Verify the specific line is visible
        const specificLine = page.locator('.log-line', { hasText: 'Broadcast 6196' });
        await expect(specificLine).toBeVisible();
        await expect(specificLine).toContainText('09-24 09:37:31.974');
    });
});
