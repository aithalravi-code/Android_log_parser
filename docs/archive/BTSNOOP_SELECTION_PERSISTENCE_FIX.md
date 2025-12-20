# BTSnoop Selection Persistence Fix

## Issue Description

**Problem**: When a user selected a packet in the BTSnoop tab and then disabled a filter (causing the packet to be filtered out), the selection was lost when they re-enabled the filter. The user had to manually re-select the packet.

**Expected Behavior**: The selection should persist even when the packet is temporarily filtered out. When the filter is re-enabled and the packet becomes visible again, it should automatically scroll to the selected packet and highlight it.

## Root Cause

The scroll restoration logic was clearing both the `btsnoopAnchorPacketNumber` (used for scroll position) AND the `selectedBtsnoopPacket` (used for highlighting) when a packet was filtered out. This caused the selection to be lost.

## Solution

### Key Changes

1. **Separate Anchor from Selection**
   - `btsnoopAnchorPacketNumber`: Used ONLY for scroll restoration
   - `selectedBtsnoopPacket`: Used ONLY for visual selection highlighting
   - These are now managed independently

2. **Preserve Selection When Filtered Out**
   - When a selected packet is filtered out, we clear the anchor but NOT the selection
   - The selection persists in memory even when the packet is not visible

3. **Auto-Scroll on Re-Appearance**
   - When filters are changed and a selected packet becomes visible again, we automatically:
     - Scroll to the selected packet
     - Update the anchor to match the selection
     - Highlight the packet

## Code Changes

### Location: `main.js` - `renderBtsnoopPackets()` function

#### Before (Problematic Code)
```javascript
if (anchorIndex !== -1) {
    targetScrollTop = btsnoopRowPositions[anchorIndex];
} else {
    // Anchor packet filtered out, clear it
    btsnoopAnchorPacketNumber = null;
    // BUG: This was also clearing selectedBtsnoopPacket somewhere
}
```

#### After (Fixed Code)
```javascript
// Special case: If we have a selected packet, check if it's now visible after filtering
if (selectedBtsnoopPacket) {
    const selectedIndex = filteredBtsnoopPackets.findIndex(p => p.number === selectedBtsnoopPacket.number);
    if (selectedIndex !== -1 && btsnoopRowPositions[selectedIndex] !== undefined) {
        // Selected packet is now visible! Scroll to it and update anchor
        targetScrollTop = btsnoopRowPositions[selectedIndex];
        btsnoopAnchorPacketNumber = selectedBtsnoopPacket.number;
        console.log('[BTSnoop Scroll] Selected packet', selectedBtsnoopPacket.number, 'is now visible, scrolling to it');
    } else {
        // Selected packet is still filtered out, keep the selection but don't scroll
        console.log('[BTSnoop Scroll] Selected packet', selectedBtsnoopPacket.number, 'is still filtered out');
    }
}
// Otherwise, use the regular anchor logic
else if (btsnoopAnchorPacketNumber !== null) {
    const anchorIndex = filteredBtsnoopPackets.findIndex(p => p.number === btsnoopAnchorPacketNumber);
    if (anchorIndex !== -1 && btsnoopRowPositions[anchorIndex] !== undefined) {
        targetScrollTop = btsnoopRowPositions[anchorIndex];
    } else {
        // Anchor packet filtered out
        // Clear the anchor for scroll restoration, but DON'T clear selectedBtsnoopPacket
        btsnoopAnchorPacketNumber = null;
        // Note: We intentionally do NOT clear selectedBtsnoopPacket here
    }
}
```

## Behavior Flow

### Scenario 1: Disable Filter (Hide Selected Packet)
1. User selects packet #500
2. User disables a filter that hides packet #500
3. **Result**: 
   - `selectedBtsnoopPacket` = packet #500 (PRESERVED)
   - `btsnoopAnchorPacketNumber` = null (cleared)
   - Packet #500 is not visible but selection is remembered

### Scenario 2: Re-Enable Filter (Show Selected Packet)
1. User re-enables the filter
2. Packet #500 becomes visible again
3. **Result**:
   - System detects selected packet is now visible
   - Scrolls to packet #500
   - Updates `btsnoopAnchorPacketNumber` = 500
   - Packet #500 is highlighted and centered in viewport

### Scenario 3: Select Different Packet
1. User clicks on packet #300
2. **Result**:
   - `selectedBtsnoopPacket` = packet #300
   - `btsnoopAnchorPacketNumber` = 300
   - Previous selection is cleared

### Scenario 4: Deselect Packet
1. User clicks on the selected packet again (toggle off)
2. **Result**:
   - `selectedBtsnoopPacket` = null
   - `btsnoopAnchorPacketNumber` = null
   - No selection, normal scroll behavior

## Testing

### Test Case 1: Selection Persistence
1. Load a BTSnoop file
2. Select packet #500
3. Disable a filter that hides packet #500
4. **Expected**: Packet #500 is no longer visible, but selection is preserved
5. Re-enable the filter
6. **Expected**: Packet #500 is visible, highlighted, and scrolled to

### Test Case 2: Multiple Filter Changes
1. Select packet #400
2. Disable filter A (packet #400 hidden)
3. Disable filter B (packet #400 still hidden)
4. Re-enable filter A (packet #400 still hidden)
5. Re-enable filter B (packet #400 now visible)
6. **Expected**: Packet #400 is highlighted and scrolled to

### Test Case 3: Selection Override
1. Select packet #300
2. Disable a filter (packet #300 hidden)
3. Re-enable the filter
4. Click on packet #200
5. **Expected**: Packet #200 is now selected, packet #300 is no longer highlighted

## Console Logs

When testing, you should see logs like:

```
// When packet is filtered out
[BTSnoop Scroll] Selected packet 500 is still filtered out

// When packet becomes visible again
[BTSnoop Scroll] Selected packet 500 is now visible, scrolling to it
[BTSnoop Scroll] Restored scroll to 10000
```

## Benefits

✅ **Better UX**: Users don't lose their selection when toggling filters  
✅ **Intuitive**: Selection persists until user explicitly selects another packet  
✅ **Auto-Scroll**: Selected packet automatically comes into view when filters change  
✅ **Consistent**: Behavior matches user expectations from other applications  

## Edge Cases Handled

1. **Packet permanently filtered out**: Selection persists in memory, no scroll action
2. **Multiple filter changes**: Selection survives multiple filter toggles
3. **Manual deselection**: Clicking the same packet toggles selection off
4. **New selection**: Clicking a different packet clears the old selection
5. **Manual scrolling**: Anchor is cleared but selection persists

## Related Files

- `main.js`: Core implementation
- `BTSNOOP_SCROLL_RESTORATION.md`: Original scroll restoration documentation
- `BTSNOOP_SCROLL_TEST_GUIDE.md`: Testing guide (should be updated with new test cases)

## Future Improvements

1. **Visual Indicator**: Show a message when a selected packet is filtered out (e.g., "Selected packet #500 is hidden by current filters")
2. **Selection Count**: Show how many selected packets are currently visible vs. hidden
3. **Multi-Selection**: Allow selecting multiple packets and preserve all selections
4. **Selection History**: Remember last N selections for quick navigation

---

**Status**: ✅ Fixed and tested  
**Version**: Updated 2025-12-07  
**Impact**: High - Significantly improves user experience
