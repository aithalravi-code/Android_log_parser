import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('BTSnoop Scroll Restoration Reproduction', () => {
    test.beforeEach(async ({ page }) => {
        // Capture console logs
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            // Filter out some noise if needed, but keeping all is safer for debugging
            console.log(`[Browser Console] ${type}: ${text}`);
        });

        // Go to the app
        await page.goto('index.html');
        await page.waitForLoadState('networkidle');
    });

    test('Reproduce scroll jumping issue when changing filters with selected packet', async ({ page }) => {
        // 1. Prepare File Path
        const relativePath = 'TestData/fixtures/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57/FS/data/misc/bluetooth/logs/btsnoop_hci.log';
        const absolutePath = path.resolve(process.cwd(), relativePath);

        if (!fs.existsSync(absolutePath)) {
            test.skip(`Test file not found at ${absolutePath}`);
            return;
        }

        // 2. Upload File
        console.log('Uploading file...');
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles(absolutePath);

        // 3. Wait for file loading to complete
        // We wait for the "Data loaded" log message which indicates processFiles is done (for text logs)
        // or just wait for the progress bar to complete if it was a zip.
        // Since we are uploading a binary log, the text worker returns 0 lines, but this signals 
        // that processFiles() has reached the end of its main logic.
        await new Promise(resolve => {
            const listener = msg => {
                if (msg.text().includes('Data loaded:')) {
                    page.off('console', listener);
                    resolve();
                }
            };
            page.on('console', listener);
        });

        // Small buffer to ensure fileTasks is fully populated and yielded
        await page.waitForTimeout(500);

        // 4. Click BTSnoop tab to trigger processing
        const btsnoopTab = page.locator('[data-tab="btsnoop"]');
        await expect(btsnoopTab).toBeVisible();
        await btsnoopTab.click();

        // 4. Wait for processing to complete (data loaded and rendered)
        // Check for visible rows directly since window.filteredBtsnoopPackets might not be exposed
        await page.waitForSelector('.btsnoop-row', { state: 'visible', timeout: 60000 });
        const rowCount = await page.locator('.btsnoop-row').count();
        expect(rowCount).toBeGreaterThan(0);

        // Wait for rows to render
        await page.waitForSelector('.btsnoop-row', { state: 'visible', timeout: 10000 });

        // 4. Disable all filters except SMP
        // We'll click "CMD", "EVT", "ACL", "SCO", "ISO" to disable them if they are active.
        // Assuming default is all active.
        const filtersToDisable = ['cmd', 'evt', 'acl', 'sco', 'iso'];

        for (const type of filtersToDisable) {
            const filterBtn = page.locator(`.filter-icon[data-btsnoop-filter="${type}"]`);
            if (await filterBtn.isVisible() && await filterBtn.evaluate(el => el.classList.contains('active'))) {
                await filterBtn.click();
                // small wait to ensure filters apply?
                await page.waitForTimeout(100);
            }
        }

        // Check we are in SMP only mode
        // Let's pick a visible packet.
        const visibleRows = page.locator('.btsnoop-row');
        const count = await visibleRows.count();
        expect(count).toBeGreaterThan(0);

        // 5. Select a packet (e.g., the 5th one to ensure it's somewhat stable)
        const packetToSelect = visibleRows.nth(Math.min(count - 1, 10));
        const packetNumber = await packetToSelect.getAttribute('data-packet-number');
        console.log(`Selecting packet number: ${packetNumber}`);

        await packetToSelect.click();

        // Verify selection
        await expect(packetToSelect).toHaveClass(/selected/);

        // 6. Enable CMD filter
        console.log('Enabling CMD filter...');
        const cmdFilter = page.locator('.filter-icon[data-btsnoop-filter="cmd"]');
        await cmdFilter.click();

        // Wait for render
        await page.waitForTimeout(500); // Allow scroll restoration animation/logic to finish

        // 7. Verify the selected packet is STILL visible in the viewport
        const packetLocator = page.locator(`.btsnoop-row[data-packet-number="${packetNumber}"]`);

        // Debugging: Print current state
        const debugState = await page.evaluate(async (pNum) => {
            const container = document.querySelector('#btsnoopLogContainer');
            const row = document.querySelector(`.btsnoop-row[data-packet-number="${pNum}"]`);

            // Get all currently visible packet numbers
            const visibleRows = Array.from(document.querySelectorAll('.btsnoop-row'));
            const visibleNumbers = visibleRows.map(r => r.getAttribute('data-packet-number'));

            return {
                scrollTop: container ? container.scrollTop : 'null',
                scrollHeight: container ? container.scrollHeight : 'null',
                containerHeight: container ? container.clientHeight : 'null',
                rowTop: row ? row.offsetTop : 'N/A (row not in DOM)',
                targetPacket: pNum,
                visiblePacketCount: visibleRows.length,
                visiblePacketRange: visibleNumbers.length > 0 ? `${visibleNumbers[0]} - ${visibleNumbers[visibleNumbers.length - 1]}` : 'None'
            };
        }, packetNumber);

        console.log('---------------------------------------------------');
        console.log('DEBUG STATE AFTER FILTER:');
        console.log(`Target Packet: ${debugState.targetPacket}`);
        console.log(`ScrollTop: ${debugState.scrollTop}`);
        console.log(`ScrollHeight: ${debugState.scrollHeight}`);
        console.log(`Row Top: ${debugState.rowTop}`);
        console.log(`Visible Range: ${debugState.visiblePacketRange}`);
        console.log('---------------------------------------------------');

        // Check if attached
        await expect(packetLocator).toBeAttached();

        // Check availability in viewport
        // We can check bounding box intersection with viewport container
        const container = page.locator('#btsnoopLogContainer');

        const isVisible = await page.evaluate(async ({ packetNum, containerSelector }) => {
            const container = document.querySelector(containerSelector);
            const row = document.querySelector(`.btsnoop-row[data-packet-number="${packetNum}"]`);
            if (!container || !row) return false;

            const cRect = container.getBoundingClientRect();
            const rRect = row.getBoundingClientRect();

            // Check if row is within container's vertical bounds
            const isInside = (rRect.top >= cRect.top) && (rRect.bottom <= cRect.bottom);
            const isPartiallyInside = (rRect.top < cRect.bottom) && (rRect.bottom > cRect.top);

            return isPartiallyInside;
        }, { packetNum: packetNumber, containerSelector: '#btsnoopLogContainer' });

        console.log(`Packet ${packetNumber} is visible: ${isVisible}`);

        // Also log the scrollTop and expected position if possible
        const debugInfo = await page.evaluate(({ packetNum }) => {
            const container = document.querySelector('#btsnoopLogContainer');
            const row = document.querySelector(`.btsnoop-row[data-packet-number="${packetNum}"]`);
            return {
                scrollTop: container.scrollTop,
                rowTop: row ? row.offsetTop : 'N/A'
            }
        }, { packetNum: packetNumber });
        console.log('Debug Info:', debugInfo);

        expect(isVisible).toBe(true);
    });
});
