import { test, expect } from '@playwright/test';

test('BTSnoop Scroll Restoration on Filter Clear', async ({ page }) => {
    // 1. Load Page
    await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');
    await page.waitForLoadState('domcontentloaded');

    // 2. Inject Mock BTSnoop Data via window._debug
    await page.evaluate(async () => {
        const packets = Array.from({ length: 200 }, (_, i) => ({
            number: i + 1,
            timestamp: `10:00:00.${(i).toString().padStart(3, '0')}`,
            source: i % 2 === 0 ? 'Host' : 'Controller',
            destination: i % 2 === 0 ? 'Controller' : 'Host',
            type: 'ACL Data',
            summary: `Packet ${i + 1}`,
            data: '00 00',
            tags: ['acl']
        }));

        window._debug.btsnoopPackets = packets;
        window._debug.isBtsnoopProcessed = true;

        // Helper to delay
        const delay = ms => new Promise(res => setTimeout(res, ms));

        // Initial setup
        await window._debug.setupBtsnoopTab();
    });

    // 3. Switch to BTSnoop Tab
    await page.click('[data-tab="btsnoop"]');
    await page.waitForTimeout(500);

    // 4. Apply Filter 'Host'
    const filterInput = page.locator('input[data-column="2"]');
    await filterInput.waitFor({ state: 'visible', timeout: 10000 });
    await filterInput.fill('Host');
    await page.waitForTimeout(500);

    // 5. Select Packet 101 (Source Host, index 100)
    // We force selection via _debug to avoid complex scrolling interactions in test
    await page.evaluate(() => {
        const packet101 = window._debug.btsnoopPackets.find(p => p.number === 101);
        window._debug.selectedBtsnoopPacket = packet101;
        // Trigger render to update selection state internally
        window._debug.renderBtsnoopPackets();
    });
    await page.waitForTimeout(500);

    // 6. Clear Filter
    await page.fill('input[data-column="2"]', '');
    await page.waitForTimeout(1000); // Wait for debounce + render + scroll

    // 7. Verify Scroll Position
    // Packet 101 is at index 100.
    // Height per row = 20px.
    // Expected ScrollTop = 100 * 20 = 2000.
    // Centering logic might apply: target - (viewport/2) + 10.

    // Let's get actual scrollTop
    const scrollTop = await page.evaluate(() => {
        return document.getElementById('btsnoopLogContainer').scrollTop;
    });

    const viewportHeight = await page.evaluate(() => {
        return document.getElementById('btsnoopLogContainer').clientHeight;
    });

    // Expected position (centered)
    // If packet 101 is at Y=2000.
    // Centered = 2000 - (viewportHeight/2) + 10.
    // Assuming viewport ~600px -> 2000 - 300 = 1700.

    const packetTop = 100 * 20;
    const expectedTop = Math.max(0, packetTop - (viewportHeight / 2) + 10);

    console.log(`ScrollTop: ${scrollTop}, Expected (approx): ${expectedTop}`);

    // Allow margin of error (e.g. +/- 50px)
    expect(Math.abs(scrollTop - expectedTop)).toBeLessThan(50);
});
