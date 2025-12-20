# BTSnoop Live Scroll Restoration Implementation

## Overview
Implemented a robust scroll restoration mechanism for the BTSnoop tab that preserves the user's scroll position when filters are applied, similar to how the main logs tab works.

## How It Works

### 1. **Anchor Tracking**
- Added a global variable `btsnoopAnchorPacketNumber` to track which packet should remain visible after filtering
- The anchor is determined by priority:
  1. **Selected packet** (if user clicked on a packet)
  2. **Top visible packet** (the packet currently at the top of the viewport)
  3. **null** (no anchor, scroll to top)

### 2. **Three-Step Process**

#### Step 1: Capture Anchor (Before Filtering)
When `renderBtsnoopPackets()` is called:
- If no anchor is set and the user has scrolled down, find the top visible packet using binary search
- Store its packet number as the anchor
- If a packet is selected, always use it as the anchor

```javascript
if (!btsnoopAnchorPacketNumber && btsnoopLogContainer && btsnoopLogContainer.scrollTop > 0) {
    // Binary search to find top visible packet
    const scrollTop = btsnoopLogContainer.scrollTop;
    let topVisibleIndex = 0;
    // ... binary search logic ...
    btsnoopAnchorPacketNumber = filteredBtsnoopPackets[topVisibleIndex].number;
}
```

#### Step 2: Calculate Target Scroll Position (After Filtering)
After filtering packets:
- Find the anchor packet in the new filtered list
- Calculate its new scroll position using pre-calculated row positions
- If anchor packet was filtered out, clear the anchor

```javascript
if (btsnoopAnchorPacketNumber !== null) {
    const anchorIndex = filteredBtsnoopPackets.findIndex(p => p.number === btsnoopAnchorPacketNumber);
    if (anchorIndex !== -1) {
        targetScrollTop = btsnoopRowPositions[anchorIndex];
    }
}
```

#### Step 3: Restore Scroll Position (After Rendering)
After rendering the virtual list:
- Set the container's scrollTop to the calculated position
- This keeps the anchor packet in the same visual position

```javascript
if (targetScrollTop !== null && btsnoopLogContainer) {
    btsnoopLogContainer.scrollTop = targetScrollTop;
}
```

### 3. **Anchor Clearing**
The anchor is automatically cleared in these scenarios:

1. **Manual Scrolling**: When user scrolls manually, the anchor is cleared after 100ms (debounced)
   - This prevents interference with normal scrolling
   - Allows scroll restoration to work only when filters change

2. **Packet Selection**: When user clicks a packet, the anchor is updated to that packet
   - Selecting a packet: `btsnoopAnchorPacketNumber = packet.number`
   - Deselecting a packet: `btsnoopAnchorPacketNumber = null`

3. **Filtered Out**: If the anchor packet is filtered out, the anchor is cleared

## Benefits

1. **Smooth User Experience**: Users don't lose their place when applying filters
2. **Predictable Behavior**: The scroll position is preserved consistently
3. **Performance**: Uses binary search for O(log N) lookup of visible packets
4. **Non-Intrusive**: Only activates when filters change, not during normal scrolling

## Testing

To test the scroll restoration:

1. Load a BTSnoop file with many packets (1000+)
2. Scroll down to the middle of the list
3. Apply a filter (e.g., filter by "HCI Command")
4. **Expected**: The scroll position should remain approximately the same relative to the visible packets
5. Scroll manually
6. Apply another filter
7. **Expected**: The new scroll position should be preserved

## Code Changes

### Files Modified
- `main.js`: Added scroll restoration logic to BTSnoop rendering

### Key Variables
- `btsnoopAnchorPacketNumber`: Stores the packet number to restore scroll to
- `window.btsnoopAnchorClearTimer`: Debounce timer for clearing anchor on manual scroll

### Key Functions Modified
- `renderBtsnoopPackets()`: Added anchor capture and scroll restoration logic
- `setupBtsnoopTab()`: Added anchor clearing on manual scroll
- `handleViewportInteraction()`: Added anchor updates on packet selection

## Future Improvements

1. **Smooth Scrolling**: Add smooth scroll animation when restoring position
2. **Visual Indicator**: Show a brief indicator when scroll position is restored
3. **Persistence**: Save scroll position to IndexedDB for session restoration
4. **Smart Anchoring**: Use multiple anchor points for better accuracy with variable-height rows
