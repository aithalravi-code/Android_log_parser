/**
 * Manual BTSnoop Scroll Restoration Test
 * 
 * Instructions:
 * 1. Load a BTSnoop file in the application
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Follow the prompts in the console
 */

(async function testBtsnoopScrollRestoration() {
    console.log('=== BTSnoop Scroll Restoration Test ===\n');

    // Helper function to wait
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Check if we're on the BTSnoop tab
    const btsnoopTab = document.querySelector('[data-tab="btsnoop"]');
    if (!btsnoopTab || !btsnoopTab.classList.contains('active')) {
        console.error('❌ Please navigate to the BTSnoop tab first!');
        return;
    }

    // Check if packets are loaded
    if (!window.filteredBtsnoopPackets || window.filteredBtsnoopPackets.length === 0) {
        console.error('❌ No BTSnoop packets loaded! Please load a BTSnoop file first.');
        return;
    }

    console.log(`✓ Total packets loaded: ${window.filteredBtsnoopPackets.length}`);

    // Step 1: Disable all filters except SMP
    console.log('\n--- Step 1: Disabling all filters except SMP ---');
    const filterButtons = document.querySelectorAll('.filter-icon[data-btsnoop-filter]');

    for (const button of filterButtons) {
        const filterType = button.getAttribute('data-btsnoop-filter');
        const isActive = button.classList.contains('active');

        if (filterType !== 'smp' && isActive) {
            button.click();
            await wait(100);
        }
    }

    await wait(500);
    console.log(`✓ SMP packets visible: ${window.filteredBtsnoopPackets.length}`);

    // Step 2: Select a packet in the middle
    console.log('\n--- Step 2: Selecting a packet ---');
    const middleIndex = Math.floor(window.filteredBtsnoopPackets.length / 2);
    const targetPacket = window.filteredBtsnoopPackets[middleIndex];
    const targetPacketNumber = targetPacket.number;

    console.log(`Target packet number: ${targetPacketNumber}`);
    console.log(`Target packet type: ${targetPacket.type}`);
    console.log(`Target packet summary: ${targetPacket.summary}`);

    // Find and click the packet row
    const packetRow = document.querySelector(`.btsnoop-row[data-packet-number="${targetPacketNumber}"]`);
    if (!packetRow) {
        console.error(`❌ Could not find row for packet #${targetPacketNumber}`);
        return;
    }

    packetRow.click();
    await wait(300);

    // Verify selection
    if (window.selectedBtsnoopPacket && window.selectedBtsnoopPacket.number === targetPacketNumber) {
        console.log(`✓ Packet #${targetPacketNumber} selected successfully`);
    } else {
        console.error(`❌ Packet selection failed!`);
        console.log(`Expected: ${targetPacketNumber}, Got: ${window.selectedBtsnoopPacket?.number}`);
        return;
    }

    // Get visible packets before filter change
    const getVisiblePackets = () => {
        const rows = document.querySelectorAll('.btsnoop-row');
        return Array.from(rows).map(row => parseInt(row.dataset.packetNumber, 10));
    };

    const visibleBefore = getVisiblePackets();
    console.log(`Visible packets before: [${visibleBefore.slice(0, 5).join(', ')}...${visibleBefore.slice(-3).join(', ')}]`);
    console.log(`Total visible: ${visibleBefore.length}`);

    // Step 3: Re-enable CMD filter
    console.log('\n--- Step 3: Re-enabling CMD filter ---');
    const cmdFilter = document.querySelector('.filter-icon[data-btsnoop-filter="cmd"]');
    if (!cmdFilter) {
        console.error('❌ CMD filter button not found!');
        return;
    }

    cmdFilter.click();
    await wait(800); // Wait for filtering and scroll restoration

    // Check results
    console.log('\n--- Results ---');
    const visibleAfter = getVisiblePackets();
    console.log(`Visible packets after: [${visibleAfter.slice(0, 5).join(', ')}...${visibleAfter.slice(-3).join(', ')}]`);
    console.log(`Total visible: ${visibleAfter.length}`);

    // CRITICAL CHECK 1: Is the target packet still visible?
    if (visibleAfter.includes(targetPacketNumber)) {
        console.log(`✅ SUCCESS: Packet #${targetPacketNumber} is still visible!`);
    } else {
        console.error(`❌ FAIL: Packet #${targetPacketNumber} is NOT visible!`);
        console.error(`This is the bug we need to fix!`);
    }

    // CRITICAL CHECK 2: Is the packet still selected?
    if (window.selectedBtsnoopPacket && window.selectedBtsnoopPacket.number === targetPacketNumber) {
        console.log(`✅ SUCCESS: Packet #${targetPacketNumber} is still selected!`);
    } else {
        console.error(`❌ FAIL: Selection lost!`);
        console.error(`Expected: ${targetPacketNumber}, Got: ${window.selectedBtsnoopPacket?.number}`);
    }

    // CRITICAL CHECK 3: Is the packet centered?
    const container = document.getElementById('btsnoopLogContainer');
    const row = document.querySelector(`.btsnoop-row[data-packet-number="${targetPacketNumber}"]`);

    if (container && row) {
        const containerRect = container.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();

        const containerCenter = containerRect.top + containerRect.height / 2;
        const rowCenter = rowRect.top + rowRect.height / 2;
        const distance = Math.abs(containerCenter - rowCenter);
        const tolerance = containerRect.height * 0.3; // 30% tolerance

        console.log(`\nCentering check:`);
        console.log(`  Container center: ${containerCenter.toFixed(2)}`);
        console.log(`  Row center: ${rowCenter.toFixed(2)}`);
        console.log(`  Distance: ${distance.toFixed(2)}`);
        console.log(`  Tolerance: ${tolerance.toFixed(2)}`);

        if (distance <= tolerance) {
            console.log(`✅ SUCCESS: Packet is centered (within tolerance)!`);
        } else {
            console.error(`❌ FAIL: Packet is NOT centered!`);
        }
    }

    // Step 4: Re-enable EVT filter
    console.log('\n--- Step 4: Re-enabling EVT filter ---');
    const evtFilter = document.querySelector('.filter-icon[data-btsnoop-filter="evt"]');
    if (evtFilter) {
        evtFilter.click();
        await wait(800);

        const visibleAfterEvt = getVisiblePackets();
        console.log(`Visible packets after EVT: [${visibleAfterEvt.slice(0, 5).join(', ')}...${visibleAfterEvt.slice(-3).join(', ')}]`);

        if (visibleAfterEvt.includes(targetPacketNumber)) {
            console.log(`✅ SUCCESS: Packet #${targetPacketNumber} still visible after EVT!`);
        } else {
            console.error(`❌ FAIL: Packet #${targetPacketNumber} NOT visible after EVT!`);
        }
    }

    console.log('\n=== Test Complete ===');
    console.log(`\nTarget packet: #${targetPacketNumber}`);
    console.log(`Check the viewport to verify the packet is visible and centered.`);

})();
