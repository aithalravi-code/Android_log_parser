# BTSnoop Scroll Position Calculation Fix

## Critical Issue Found

**Problem**: When selecting packet #5712 and enabling CMD filter, the view jumped to packet #42 instead of staying on #5712.

**Root Cause**: There were **TWO conflicting scroll restoration mechanisms**:

1. **In `renderBtsnoopPackets()`**: Calculated the correct scroll position and set it
2. **In `renderBtsnoopVirtualLogs()`**: Had its own scroll logic that would override the first one

These two were fighting each other, causing incorrect scroll positions.

## Solution

### 1. Removed Duplicate Scroll Logic

**Removed from `renderBtsnoopVirtualLogs()`** (lines 5030-5046):
```javascript
// REMOVED - This was causing conflicts
if (selectedBtsnoopPacket) {
    const targetIndex = filteredBtsnoopPackets.findIndex(p => p.number === selectedBtsnoopPacket.number);
    if (targetIndex !== -1) {
        // ... scroll logic ...
        container.scrollTop = targetScroll; // This was overriding our correct scroll!
    }
}
```

**Now**: All scroll restoration is handled in ONE place: `renderBtsnoopPackets()`

### 2. Added requestAnimationFrame

**Problem**: Setting `scrollTop` immediately after rendering might happen before the DOM updates complete.

**Solution**: Wrap scroll restoration in `requestAnimationFrame`:

```javascript
// Step 3: Restore scroll position AFTER rendering
// Use requestAnimationFrame to ensure DOM has been updated before scrolling
if (targetScrollTop !== null && btsnoopLogContainer) {
    requestAnimationFrame(() => {
        btsnoopLogContainer.scrollTop = targetScrollTop;
        console.log('[BTSnoop Scroll] Centered selected packet in viewport at scroll position', targetScrollTop);
    });
}
```

This ensures the scroll happens AFTER the browser has finished rendering the new DOM.

## How It Works Now

### Single Source of Truth

```
User Action: Enable CMD filter
    ↓
renderBtsnoopPackets() called
    ↓
1. Find selected packet #5712 in filtered list
    ↓
2. Calculate its position: btsnoopRowPositions[index]
    ↓
3. Calculate center offset: (viewportHeight / 2) - (packetHeight / 2)
    ↓
4. Calculate target scroll: position - centerOffset
    ↓
5. Render virtual logs (renderBtsnoopVirtualLogs)
    ↓
6. requestAnimationFrame(() => {
       container.scrollTop = targetScrollTop  ← ONLY scroll happens here
   })
    ↓
Result: Packet #5712 is centered in viewport ✓
```

### No More Conflicts

**Before Fix**:
```
renderBtsnoopPackets(): scrollTop = 114240 (correct for #5712)
    ↓
renderBtsnoopVirtualLogs(): scrollTop = 840 (incorrect, for #42)
    ↓
Result: Shows packet #42 ✗
```

**After Fix**:
```
renderBtsnoopPackets(): scrollTop = 114240 (correct for #5712)
    ↓
renderBtsnoopVirtualLogs(): (no scroll logic, just renders)
    ↓
requestAnimationFrame(): scrollTop = 114240 (applied after render)
    ↓
Result: Shows packet #5712 ✓
```

## Testing

### Test Case: Packet #5712 Selection

1. Load BTSnoop file
2. Disable all filters except SMP
3. Select packet #5712
4. Enable CMD filter
5. **Expected**: View stays on packet #5712, centered
6. **Console Log**: 
   ```
   [BTSnoop Scroll] Selected packet 5712 is visible, centering at position 114240
   [BTSnoop Scroll] Centered selected packet in viewport at scroll position 114240
   ```

### Verification

Open browser console and check:
- Should see exactly ONE scroll log per filter change
- The packet number in the log should match your selected packet
- The scroll position should be consistent

## Key Changes

### File: `main.js`

1. **Line 5030-5046**: Removed duplicate scroll logic from `renderBtsnoopVirtualLogs()`
2. **Line 4868-4878**: Wrapped scroll restoration in `requestAnimationFrame()`

### Benefits

✅ **Accurate Scrolling**: Scroll position now correctly centers the selected packet  
✅ **No Conflicts**: Only one place manages scroll position  
✅ **Timing Fixed**: requestAnimationFrame ensures DOM is ready  
✅ **Predictable**: Same behavior every time  

## Console Logs

### Correct Behavior
```
[BTSnoop Scroll] Selected packet 5712 is visible, centering at position 114240
[BTSnoop Scroll] Centered selected packet in viewport at scroll position 114240
```

### What to Watch For

❌ **Bad**: Multiple scroll logs for the same filter change
❌ **Bad**: Scroll position doesn't match selected packet
❌ **Bad**: View jumps to a different packet

✅ **Good**: Single scroll log per filter change
✅ **Good**: Scroll position matches selected packet
✅ **Good**: View stays on selected packet

## Edge Cases Handled

1. **Large packet numbers** (e.g., #5712): Correctly calculates position
2. **Small packet numbers** (e.g., #42): Correctly calculates position
3. **Variable row heights**: Uses pre-calculated positions
4. **Multiple filter changes**: Consistent behavior each time

## Related Issues Fixed

- Scroll jumping to wrong packet
- Inconsistent scroll behavior
- Race conditions between rendering and scrolling
- Duplicate scroll logic conflicts

---

**Status**: ✅ Fixed  
**Date**: 2025-12-07  
**Severity**: Critical - Core functionality  
**Impact**: High - Affects all scroll restoration scenarios
