const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('BTSnoop Scroll Restoration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080');
        await page.waitForLoadState('networkidle');
    });

    test('should maintain selected packet position when toggling filters', async ({ page }) => {
        // Upload a BTSnoop file
        const fileInput = page.locator('#file-input');
        const testFile = path.join(__dirname, '../test-data/btsnoop_hci.log');

        await fileInput.setInputFiles(testFile);

        // Wait for processing
        await page.waitForTimeout(2000);

        // Navigate to BTSnoop tab
        const btsnoopTab = page.locator('[data-tab="btsnoop"]');
        await btsnoopTab.click();
        await page.waitForTimeout(1000);

        // Wait for packets to load
        await page.waitForSelector('.btsnoop-row', { timeout: 10000 });

        // Get total packet count
        const totalPackets = await page.evaluate(() => {
            return window.filteredBtsnoopPackets ? window.filteredBtsnoopPackets.length : 0;
        });

        console.log(`Total packets loaded: ${totalPackets}`);
        expect(totalPackets).toBeGreaterThan(0);

        // Disable all filters except SMP
        const filterButtons = page.locator('.filter-icon[data-btsnoop-filter]');
        const filterCount = await filterButtons.count();

        for (let i = 0; i < filterCount; i++) {
            const button = filterButtons.nth(i);
            const filterType = await button.getAttribute('data-btsnoop-filter');
            const isActive = await button.evaluate(el => el.classList.contains('active'));

            // Disable all except SMP
            if (filterType !== 'smp' && isActive) {
                await button.click();
                await page.waitForTimeout(300);
            }
        }

        // Wait for filtering to complete
        await page.waitForTimeout(500);

        // Get filtered packet count
        const smpPacketCount = await page.evaluate(() => {
            return window.filteredBtsnoopPackets ? window.filteredBtsnoopPackets.length : 0;
        });

        console.log(`SMP packets visible: ${smpPacketCount}`);

        // Find and select a packet in the middle of the list
        const targetPacketNumber = await page.evaluate(() => {
            if (!window.filteredBtsnoopPackets || window.filteredBtsnoopPackets.length === 0) {
                return null;
            }
            const middleIndex = Math.floor(window.filteredBtsnoopPackets.length / 2);
            return window.filteredBtsnoopPackets[middleIndex].number;
        });

        console.log(`Target packet number: ${targetPacketNumber}`);
        expect(targetPacketNumber).not.toBeNull();

        // Click on the packet to select it
        const packetRow = page.locator(`.btsnoop-row[data-packet-number="${targetPacketNumber}"]`).first();
        await packetRow.click();
        await page.waitForTimeout(300);

        // Verify packet is selected
        const isSelected = await page.evaluate((packetNum) => {
            return window.selectedBtsnoopPacket && window.selectedBtsnoopPacket.number === packetNum;
        }, targetPacketNumber);

        console.log(`Packet ${targetPacketNumber} selected: ${isSelected}`);
        expect(isSelected).toBe(true);

        // Get the visible packet numbers before enabling filter
        const visiblePacketsBefore = await page.evaluate(() => {
            const rows = document.querySelectorAll('.btsnoop-row');
            return Array.from(rows).map(row => parseInt(row.dataset.packetNumber, 10));
        });

        console.log(`Visible packets before filter change: ${visiblePacketsBefore.slice(0, 5).join(', ')}...`);

        // Re-enable CMD filter
        const cmdFilter = page.locator('.filter-icon[data-btsnoop-filter="cmd"]');
        await cmdFilter.click();
        await page.waitForTimeout(500);

        // Get the visible packet numbers after enabling filter
        const visiblePacketsAfter = await page.evaluate(() => {
            const rows = document.querySelectorAll('.btsnoop-row');
            return Array.from(rows).map(row => parseInt(row.dataset.packetNumber, 10));
        });

        console.log(`Visible packets after filter change: ${visiblePacketsAfter.slice(0, 5).join(', ')}...`);

        // CRITICAL CHECK: The target packet should still be visible
        expect(visiblePacketsAfter).toContain(targetPacketNumber);

        // Verify the selected packet is still selected
        const stillSelected = await page.evaluate((packetNum) => {
            return window.selectedBtsnoopPacket && window.selectedBtsnoopPacket.number === packetNum;
        }, targetPacketNumber);

        console.log(`Packet ${targetPacketNumber} still selected: ${stillSelected}`);
        expect(stillSelected).toBe(true);

        // Check if the packet is approximately centered in the viewport
        const isCentered = await page.evaluate((packetNum) => {
            const container = document.getElementById('btsnoopLogContainer');
            if (!container) return false;

            const row = document.querySelector(`.btsnoop-row[data-packet-number="${packetNum}"]`);
            if (!row) return false;

            const containerRect = container.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();

            const containerCenter = containerRect.top + containerRect.height / 2;
            const rowCenter = rowRect.top + rowRect.height / 2;

            // Allow 20% tolerance for "centered"
            const tolerance = containerRect.height * 0.2;
            const distance = Math.abs(containerCenter - rowCenter);

            console.log(`Container center: ${containerCenter}, Row center: ${rowCenter}, Distance: ${distance}, Tolerance: ${tolerance}`);

            return distance <= tolerance;
        }, targetPacketNumber);

        console.log(`Packet ${targetPacketNumber} is centered: ${isCentered}`);
        expect(isCentered).toBe(true);

        // Re-enable EVT filter and check again
        const evtFilter = page.locator('.filter-icon[data-btsnoop-filter="evt"]');
        await evtFilter.click();
        await page.waitForTimeout(500);

        const visiblePacketsAfterEvt = await page.evaluate(() => {
            const rows = document.querySelectorAll('.btsnoop-row');
            return Array.from(rows).map(row => parseInt(row.dataset.packetNumber, 10));
        });

        console.log(`Visible packets after EVT filter: ${visiblePacketsAfterEvt.slice(0, 5).join(', ')}...`);

        // Target packet should STILL be visible
        expect(visiblePacketsAfterEvt).toContain(targetPacketNumber);

        // And still selected
        const stillSelectedAfterEvt = await page.evaluate((packetNum) => {
            return window.selectedBtsnoopPacket && window.selectedBtsnoopPacket.number === packetNum;
        }, targetPacketNumber);

        console.log(`Packet ${targetPacketNumber} still selected after EVT: ${stillSelectedAfterEvt}`);
        expect(stillSelectedAfterEvt).toBe(true);
    });

    test('should handle specific packet #5712 case', async ({ page }) => {
        // Upload a BTSnoop file
        const fileInput = page.locator('#file-input');
        const testFile = path.join(__dirname, '../test-data/btsnoop_hci.log');

        await fileInput.setInputFiles(testFile);
        await page.waitForTimeout(2000);

        // Navigate to BTSnoop tab
        const btsnoopTab = page.locator('[data-tab="btsnoop"]');
        await btsnoopTab.click();
        await page.waitForTimeout(1000);

        await page.waitForSelector('.btsnoop-row', { timeout: 10000 });

        // Check if packet #5712 exists
        const packet5712Exists = await page.evaluate(() => {
            if (!window.btsnoopPackets) return false;
            return window.btsnoopPackets.some(p => p.number === 5712);
        });

        if (!packet5712Exists) {
            console.log('Packet #5712 does not exist in this file, skipping test');
            test.skip();
            return;
        }

        // Disable all filters except SMP
        const filterButtons = page.locator('.filter-icon[data-btsnoop-filter]');
        const filterCount = await filterButtons.count();

        for (let i = 0; i < filterCount; i++) {
            const button = filterButtons.nth(i);
            const filterType = await button.getAttribute('data-btsnoop-filter');
            const isActive = await button.evaluate(el => el.classList.contains('active'));

            if (filterType !== 'smp' && isActive) {
                await button.click();
                await page.waitForTimeout(300);
            }
        }

        await page.waitForTimeout(500);

        // Select packet #5712
        const packet5712Row = page.locator('.btsnoop-row[data-packet-number="5712"]').first();
        await packet5712Row.click();
        await page.waitForTimeout(300);

        // Enable CMD filter
        const cmdFilter = page.locator('.filter-icon[data-btsnoop-filter="cmd"]');
        await cmdFilter.click();
        await page.waitForTimeout(500);

        // Check visible packets
        const visiblePackets = await page.evaluate(() => {
            const rows = document.querySelectorAll('.btsnoop-row');
            return Array.from(rows).map(row => parseInt(row.dataset.packetNumber, 10));
        });

        console.log(`Visible packets: ${visiblePackets.slice(0, 10).join(', ')}...`);

        // CRITICAL: Packet #5712 should be visible, NOT packet #42
        expect(visiblePackets).toContain(5712);
        expect(visiblePackets[0]).not.toBe(42); // Should not jump to packet #42

        // Verify packet #5712 is still selected
        const isSelected = await page.evaluate(() => {
            return window.selectedBtsnoopPacket && window.selectedBtsnoopPacket.number === 5712;
        });

        expect(isSelected).toBe(true);
    });
});
