import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';

test.describe('BTSnoop Collapsible Headers', () => {
    const tempDir = path.resolve(process.cwd(), 'temp_test_data');

    test.beforeAll(async () => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    test.afterAll(async () => {
        // Cleanup
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('Should display collapsible file headers for multiple BTSnoop logs', async ({ page }) => {
        await page.goto('index.html');
        await page.waitForLoadState('networkidle');

        page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

        // 1. Create a valid BTSnoop Log file (Header only is enough for parsing to accept it?)
        // Worker checks magic 'btsnoop\0'.
        // Header: 8 bytes magic + 4 bytes version + 4 bytes datalink = 16 bytes.
        const header = Buffer.from([
            0x62, 0x74, 0x73, 0x6e, 0x6f, 0x6f, 0x70, 0x00, // btsnoop\0
            0x00, 0x00, 0x00, 0x01, // Version 1
            0x00, 0x00, 0x03, 0xea  // ID 1002
        ]);

        // SMP Packet (CID 0x0006)
        // Header: 24 bytes (included length, etc from btsnoop)
        // Actually, let's just make a valid HCI ACL packet with L2CAP CID 0x0006.
        // We need the BTSnoop Packet Header (24 bytes) + HCI Data.

        // Helper to create a packet
        const createPacket = (timestampMicro, data) => {
            const buf = Buffer.alloc(24 + data.length);
            buf.writeUInt32BE(data.length, 0); // Original Length
            buf.writeUInt32BE(data.length, 4); // Included Length
            buf.writeUInt32BE(0, 8); // Flags (Host->Controller)
            buf.writeUInt32BE(0, 12); // Cumulative Drops
            // Timestamp (BigInt) - 0x00dcddb30f2f8000n offset
            const ts = BigInt(timestampMicro) + 0x00dcddb30f2f8000n;
            buf.writeBigUInt64BE(ts, 16);
            Buffer.from(data).copy(buf, 24);
            return buf;
        };

        // SMP Pairing Request (Code 0x01)
        // HCI ACL (4 bytes) + L2CAP (4 bytes) + SMP (1 byte) + Data
        // Handle: 0x0001, PB: 0, BC: 0 -> 0x01, 0x00
        // L2CAP Len: ...
        const smpData = Buffer.from([
            0x01, 0x00, 0x06, 0x00, // HCI ACL Handle 1, Len 6
            0x02, 0x00, 0x06, 0x00, // L2CAP Len 2, CID 0x0006 (SMP)
            0x01, 0x00             // SMP Pairing Req
        ]);

        const packet1 = createPacket(1000, smpData);
        const packet2 = createPacket(2000, smpData);

        // Create JSZip instance and add files in folders
        const zip = new JSZip();
        zip.file('device1/btsnoop_hci.log', Buffer.concat([header, packet1]));
        zip.file('device2/btsnoop_hci.log', Buffer.concat([header, packet2]));


        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        const zipPath = path.join(tempDir, 'test_logs.zip');
        fs.writeFileSync(zipPath, zipContent);

        // 2. Upload ZIP file
        console.log('Uploading created ZIP file...');
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles(zipPath);

        // 3. Wait for processing
        // We expect the progress bar to appear and then disappear.
        // Or wait for the BTSnoop indicator/tab to be ready?
        // Since we know "Logs" tab gets processed first, wait for "Parsing files..." to be gone.
        await expect(page.locator('#progressBar').first()).toBeHidden({ timeout: 60000 });

        // Give it a small buffer for state updates
        await page.waitForTimeout(1000);

        // 4. Switch to BTSnoop Tab
        console.log('Switching to BTSnoop tab...');
        const btsnoopTab = page.locator('[data-tab="btsnoop"]');
        await btsnoopTab.click();

        // 5. Verify Headers Exist
        // We expect 2 headers: file1_hci.log and file2_hci.log
        const headers = page.locator('.btsnoop-file-header');
        await expect(headers.first()).toBeVisible({ timeout: 10000 });

        const headerCount = await headers.count();
        console.log(`Found ${headerCount} file headers.`);
        expect(headerCount).toBe(2);

        const texts = await headers.allTextContents();
        console.log('Header texts:', texts);
        // Both headers will say 'btsnoop_hci.log' because the app currently displays basenames.
        expect(texts.filter(t => t.includes('btsnoop_hci.log')).length).toBe(2);

        // 6. Test SMP Filter
        const filterInput = page.locator('#btsnoopFilterSummary'); // Wait, default 'Type' filter?
        // Let's filter by "SMP" in the global text or specific column?
        // User said "I filter for SMP". Probably the "Type" column?
        // Our parser might not identify it as SMP type without full parsing logic, but let's try.
        // Actually, my parser uses L2CAP CID to deduce type. CID 0x0006 -> SMP.
        // So Type column should say "ACL Data" but Info might say "SMP"?
        // Wait, main.js has `const L2CAP_CIDS = { ... 0x0006: 'SMP' }`.

        // Let's TYPE "SMP" into the Summary filter input (index 5) or Data?
        // Actually, let's type into the GLOBAL filter to be sure, or just check if rows exist.

        // 7. Test Collapse
        const firstHeader = headers.first();

        // DEBUG: Check computed style before click
        const displayBefore = await firstHeader.evaluate(el => window.getComputedStyle(el.parentElement).display);
        console.log('Header Row Display (Before):', displayBefore);

        await firstHeader.click();
        expect(await firstHeader.textContent()).toContain('▶');

        // DEBUG: Check computed style after click
        const displayAfter = await firstHeader.evaluate(el => window.getComputedStyle(el.parentElement).display);
        console.log('Header Row Display (After):', displayAfter);

        // Verify content below is hidden (by checking presence of next header immediately after?)
        // The virtual scroll should re-render.
        // We expect the next row to be the second header (since file 1 is collapsed, and data hidden).
        // Wait for potential re-render
        await page.waitForTimeout(500);

        const allHeaders = await page.locator('.btsnoop-file-header').allTextContents();
        console.log('All Headers Visible:', allHeaders);
        expect(allHeaders.length).toBeGreaterThanOrEqual(2);

        // DEBUG: Dump the HTML of the viewport to see what is actually rendered
        const viewportHtml = await page.locator('#btsnoopLogViewport').innerHTML();
        console.log('Viewport HTML:', viewportHtml);

        // Verify the second header is effectively the second row
        // Check if the second header text is present in the viewport HTML
        expect(viewportHtml).toContain('device2/btsnoop_hci.log');

        await firstHeader.click();
        expect(await firstHeader.textContent()).toContain('▼');


        // 9. Test Toggle Collapse/Expand Button
        console.log('Testing Toggle Collapse/Expand...');
        const toggleBtn = page.locator('#btsnoopToggleCollapseBtn');

        await expect(toggleBtn).toBeVisible();
        await expect(toggleBtn).toHaveText('⊟'); // Initially "Collapse All"

        // Click to Collapse All
        await toggleBtn.click();
        await page.waitForTimeout(500);

        const allHeadersCollapsed = await page.locator('.btsnoop-file-header').allTextContents();
        console.log('Headers after Collapse All:', allHeadersCollapsed);
        expect(allHeadersCollapsed.every(h => h.includes('▶'))).toBeTruthy();
        await expect(toggleBtn).toHaveText('⊞'); // Should flip to "Expand All"

        // Click to Expand All
        await toggleBtn.click();
        await page.waitForTimeout(500);

        const allHeadersExpanded = await page.locator('.btsnoop-file-header').allTextContents();
        console.log('Headers after Expand All:', allHeadersExpanded);
        expect(allHeadersExpanded.every(h => h.includes('▼'))).toBeTruthy();
        await expect(toggleBtn).toHaveText('⊟'); // Should flip back to "Collapse All"

    });
});
