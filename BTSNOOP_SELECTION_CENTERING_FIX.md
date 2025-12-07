# BTSnoop Selection Centering - Final Fix

## Issue Description

**User Scenario**: 
1. User disables all filters except SMP
2. User selects one SMP packet
3. User re-enables other filters one by one
4. **Problem**: The selected SMP packet was not staying centered in view as filters were re-enabled

**Root Cause**: The scroll restoration was only scrolling to the TOP of the selected packet, not centering it in the viewport. This made it difficult to see the context around the selected packet.

## Solution

### Key Change: Always Center Selected Packets

When a packet is selected and filters change:
1. **Find the selected packet** in the filtered list
2. **Calculate its position** using pre-calculated row positions
3. **Calculate the center offset** based on viewport height
4. **Scroll to center** the packet in the middle of the viewport

### Code Implementation

```javascript
// Special case: If we have a selected packet, ALWAYS scroll to it when filters change
if (selectedBtsnoopPacket) {
    const selectedIndex = filteredBtsnoopPackets.findIndex(p => p.number === selectedBtsnoopPacket.number);
    if (selectedIndex !== -1 && btsnoopRowPositions[selectedIndex] !== undefined) {
        // Selected packet is visible! Center it in the viewport
        const selectedPosition = btsnoopRowPositions[selectedIndex];
        const containerHeight = btsnoopLogContainer ? btsnoopLogContainer.clientHeight : 600;
        
        // Calculate height of the selected packet
        const nextPos = btsnoopRowPositions[selectedIndex + 1];
        const selectedHeight = nextPos ? (nextPos - selectedPosition) : 20;
        
        // Center the packet in the viewport
        const centerOffset = Math.floor(containerHeight / 2) - (selectedHeight / 2);
        targetScrollTop = Math.max(0, selectedPosition - centerOffset);
        
        console.log('[BTSnoop Scroll] Selected packet', selectedBtsnoopPacket.number, 'is visible, centering at position', targetScrollTop);
    }
}
```

## Behavior

### Before Fix
```
Viewport:
┌─────────────────┐
│ Packet #500     │ ← Selected packet at top
│ Packet #501     │
│ Packet #502     │
│ Packet #503     │
│ Packet #504     │
│ Packet #505     │
└─────────────────┘
```

### After Fix
```
Viewport:
┌─────────────────┐
│ Packet #497     │
│ Packet #498     │
│ Packet #499     │
│ Packet #500     │ ← Selected packet CENTERED
│ Packet #501     │
│ Packet #502     │
│ Packet #503     │
└─────────────────┘
```

## User Workflow

1. **Disable all filters except SMP**
   - Only SMP packets visible
   
2. **Select an SMP packet** (e.g., packet #500)
   - Packet #500 is highlighted and centered
   
3. **Re-enable CMD filter**
   - CMD packets now visible
   - Packet #500 stays centered
   - You can see CMD packets before and after packet #500
   
4. **Re-enable EVT filter**
   - EVT packets now visible
   - Packet #500 STILL stays centered
   - You can see the full context around packet #500

5. **Re-enable ACL filter**
   - ACL packets now visible
   - Packet #500 STILL stays centered
   - Complete context visible

## Console Logs

When this is working correctly, you'll see:

```
[BTSnoop Scroll] Selected packet 500 is visible, centering at position 9800
[BTSnoop Scroll] Centered selected packet in viewport at scroll position 9800
```

Every time you toggle a filter, the selected packet will be re-centered.

## Testing

### Quick Test
1. Load a BTSnoop file
2. Click on filter buttons to disable all except SMP
3. Select any SMP packet
4. Re-enable filters one by one (CMD, EVT, ACL, etc.)
5. **Expected**: The selected SMP packet stays centered in the viewport throughout

### Detailed Test
1. Load a BTSnoop file with 1000+ packets
2. Disable all filters except SMP (should have ~50 SMP packets)
3. Select SMP packet #500
4. Note the packets visible above and below #500
5. Re-enable CMD filter
6. **Expected**: Packet #500 is still centered, CMD packets now visible around it
7. Re-enable EVT filter
8. **Expected**: Packet #500 is still centered, EVT packets now visible around it
9. Continue with other filters
10. **Expected**: Packet #500 always stays centered

## Benefits

✅ **Context Visibility**: User can see what happens before and after the selected packet  
✅ **Consistent Position**: Selected packet doesn't jump around when filters change  
✅ **Better UX**: Matches user expectations from other tools (Wireshark, etc.)  
✅ **Debugging Aid**: Makes it easier to understand packet sequences  

## Edge Cases

1. **Selected packet at start of list**: Centers as much as possible (may not be perfectly centered)
2. **Selected packet at end of list**: Centers as much as possible (may not be perfectly centered)
3. **Very tall packets**: Centers based on packet height, not just top position
4. **Small viewport**: Still centers, but with less context visible

## Related Changes

- `btsnoopAnchorPacketNumber`: Always updated to match selected packet
- `shouldCenterSelected`: Flag to distinguish centering from regular scroll restoration
- Console logs: More descriptive to show centering vs. regular restoration

---

**Status**: ✅ Fixed  
**Date**: 2025-12-07  
**Impact**: Critical - Core UX improvement for BTSnoop analysis
