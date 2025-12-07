# BTSnoop Scroll Restoration - Testing Guide

## Test Setup

1. **Start the application**:
   ```bash
   cd "/home/rk/Documents/Android_log_parser (copy)"
   python3 -m http.server 8080
   ```

2. **Open in browser**: Navigate to `http://localhost:8080`

3. **Load test data**: You'll need a BTSnoop file with at least 500+ packets for meaningful testing

## Test Cases

### Test 1: Basic Scroll Restoration with Filters

**Objective**: Verify that scroll position is maintained when applying filters

**Steps**:
1. Load a BTSnoop file (drag and drop or use file picker)
2. Navigate to the BTSnoop tab
3. Scroll down to approximately packet #500 (middle of the list)
4. Note the packet numbers visible in the viewport
5. Apply a filter in one of the column filter inputs (e.g., type "HCI" in the Type column)
6. **Expected Result**: The scroll position should be maintained - you should still see similar packet numbers in the viewport

**Console Logs to Check**:
```
[BTSnoop Scroll] Captured anchor packet: 500
[BTSnoop Scroll] Will restore to packet 500 at position 10000
[BTSnoop Scroll] Restored scroll to 10000
```

### Test 2: Scroll Restoration with Layer Filters

**Objective**: Verify scroll restoration works with layer filter buttons (CMD, EVT, ACL, etc.)

**Steps**:
1. Load a BTSnoop file
2. Scroll down to packet #300
3. Click on a layer filter button (e.g., disable "ACL" packets)
4. **Expected Result**: Scroll position should be maintained relative to visible packets
5. Re-enable the filter
6. **Expected Result**: Scroll should return to approximately the same position

**Console Logs to Check**:
```
[BTSnoop Scroll] Captured anchor packet: 300
[BTSnoop Scroll] Will restore to packet 300 at position 6000
```

### Test 3: Manual Scrolling Clears Anchor

**Objective**: Verify that manual scrolling doesn't interfere with normal behavior

**Steps**:
1. Load a BTSnoop file
2. Scroll down to packet #400
3. Apply a filter (anchor is set)
4. Manually scroll up to packet #100
5. Wait 200ms (for debounce)
6. Apply another filter
7. **Expected Result**: The new scroll position (packet #100) should be maintained, not the old one

**Console Logs to Check**:
```
[BTSnoop Scroll] Captured anchor packet: 400  (first filter)
[BTSnoop Scroll] Restored scroll to 8000
(user scrolls manually)
[BTSnoop Scroll] Captured anchor packet: 100  (second filter - new anchor)
[BTSnoop Scroll] Restored scroll to 2000
```

### Test 4: Packet Selection Updates Anchor

**Objective**: Verify that selecting a packet updates the anchor

**Steps**:
1. Load a BTSnoop file
2. Scroll down and click on packet #250 to select it
3. Apply a filter
4. **Expected Result**: Packet #250 should remain visible and centered in the viewport

**Console Logs to Check**:
```
[Interaction] Selected BTSnoop Packet: 250
[BTSnoop Scroll] Captured anchor packet: 250
[BTSnoop Scroll] Will restore to packet 250 at position 5000
```

### Test 5: Anchor Cleared When Packet Filtered Out

**Objective**: Verify behavior when the anchor packet is filtered out

**Steps**:
1. Load a BTSnoop file
2. Scroll to packet #300 (ensure it's an HCI Command)
3. Apply a filter that excludes HCI Commands (uncheck "CMD" layer filter)
4. **Expected Result**: Scroll should reset to top or to the first visible packet

**Console Logs to Check**:
```
[BTSnoop Scroll] Captured anchor packet: 300
[BTSnoop Scroll] Anchor packet 300 not found in filtered results
```

### Test 6: Deselecting Packet Clears Anchor

**Objective**: Verify that deselecting a packet clears the anchor

**Steps**:
1. Load a BTSnoop file
2. Click on packet #200 to select it
3. Click on the same packet again to deselect
4. Apply a filter
5. **Expected Result**: Scroll should use the top visible packet as anchor, not packet #200

**Console Logs to Check**:
```
[Interaction] Selected BTSnoop Packet: 200
[Interaction] Selected BTSnoop Packet: None
(anchor should be cleared)
```

### Test 7: Rapid Filter Changes

**Objective**: Verify stability with rapid filter changes

**Steps**:
1. Load a BTSnoop file
2. Scroll to middle of list
3. Rapidly type in a column filter input (e.g., "HCI", then "CMD", then "EVT")
4. **Expected Result**: No jumpy scrolling, smooth transitions, final scroll position should be stable

**Console Logs to Check**:
- Should see multiple anchor captures and restorations
- No errors or undefined values

### Test 8: Large Dataset Performance

**Objective**: Verify performance with large datasets (5000+ packets)

**Steps**:
1. Load a large BTSnoop file (5000+ packets)
2. Scroll to packet #2500
3. Apply a filter
4. **Expected Result**: Scroll restoration should complete within 100ms, no lag

**Console Logs to Check**:
```
[BTSnoop Scroll] Captured anchor packet: 2500
[Perf] BTSnoop Filtering: XX.XX ms (should be < 100ms)
```

### Test 9: Selection Persistence When Filtered Out

**Objective**: Verify that selection persists when a packet is temporarily filtered out

**Steps**:
1. Load a BTSnoop file
2. Select packet #500 (click on it to highlight)
3. Disable a filter that causes packet #500 to be hidden (e.g., uncheck "CMD" if it's a command packet)
4. **Expected Result**: Packet #500 is no longer visible, but selection is preserved in memory
5. Re-enable the filter
6. **Expected Result**: Packet #500 automatically scrolls into view and is still highlighted

**Console Logs to Check**:
```
[Interaction] Selected BTSnoop Packet: 500
[BTSnoop Scroll] Selected packet 500 is still filtered out
(after re-enabling filter)
[BTSnoop Scroll] Selected packet 500 is now visible, scrolling to it
[BTSnoop Scroll] Restored scroll to 10000
```

### Test 10: Multiple Filter Toggles with Selection

**Objective**: Verify selection survives multiple filter changes

**Steps**:
1. Load a BTSnoop file
2. Select packet #400
3. Disable filter A (packet #400 hidden)
4. Disable filter B (packet #400 still hidden)
5. Re-enable filter A (packet #400 still hidden)
6. Re-enable filter B (packet #400 now visible)
7. **Expected Result**: Packet #400 is highlighted and scrolled to after step 6

**Console Logs to Check**:
```
[Interaction] Selected BTSnoop Packet: 400
[BTSnoop Scroll] Selected packet 400 is still filtered out (multiple times)
[BTSnoop Scroll] Selected packet 400 is now visible, scrolling to it
```

### Test 11: Selection Override

**Objective**: Verify that selecting a new packet clears the old selection

**Steps**:
1. Load a BTSnoop file
2. Select packet #300
3. Disable a filter (packet #300 hidden)
4. Re-enable the filter (packet #300 visible again)
5. Click on packet #200 to select it
6. **Expected Result**: Packet #200 is now selected and highlighted, packet #300 is no longer highlighted

**Console Logs to Check**:
```
[Interaction] Selected BTSnoop Packet: 300
[BTSnoop Scroll] Selected packet 300 is now visible, scrolling to it
[Interaction] Selected BTSnoop Packet: 200
```

## Debugging Tips

### Enable Console Logging
All scroll restoration operations are logged with the prefix `[BTSnoop Scroll]`. Open browser DevTools (F12) and filter console by "BTSnoop Scroll" to see detailed logs.

### Check Anchor State
You can inspect the current anchor state in the console:
```javascript
console.log('Current anchor:', btsnoopAnchorPacketNumber);
console.log('Selected packet:', selectedBtsnoopPacket);
```

### Verify Row Positions
Check if row positions are calculated correctly:
```javascript
console.log('Row positions:', btsnoopRowPositions);
console.log('Total height:', btsnoopTotalHeight);
```

### Monitor Scroll Events
Add a temporary listener to monitor scroll events:
```javascript
btsnoopLogContainer.addEventListener('scroll', () => {
    console.log('Scroll position:', btsnoopLogContainer.scrollTop);
});
```

## Known Limitations

1. **Variable Row Heights**: The scroll restoration uses pre-calculated row positions. If row heights change significantly (e.g., very long data fields), the restoration might be slightly off.

2. **Debounce Timing**: The anchor clear timer is set to 100ms. Very rapid scrolling might not clear the anchor immediately.

3. **Binary Search Accuracy**: The binary search finds the approximate top visible packet. With variable row heights, it might be off by 1-2 rows.

## Success Criteria

✅ Scroll position is maintained when applying filters  
✅ Manual scrolling doesn't interfere with normal behavior  
✅ Selecting a packet updates the anchor correctly  
✅ Anchor is cleared when packet is filtered out  
✅ **Selection persists when packet is temporarily filtered out**  
✅ **Selected packet auto-scrolls into view when re-enabled**  
✅ **Selecting a new packet clears the old selection**  
✅ No performance degradation with large datasets  
✅ No console errors or warnings  
✅ Smooth user experience with no jumpy scrolling  

### Debugging Tips: Scroll Clamping (Jumping to Top)

**Symptom**: When enabling a filter that adds many packets (e.g., SMP -> CMD), the view jumps to packet #42 or near the top, even though `targetScrollTop` log says 100,000+.

**Cause**: The browser clamped the scroll position because it didn't update the container's `scrollHeight` before applying the scroll.

**Verification**:
check valid layout update in `main.js`:
```javascript
const _ = btsnoopLogContainer.scrollHeight; // Force reflow
btsnoopLogContainer.scrollTop = targetScrollTop;
```
If you see this code, the fix is applied.

## Reporting Issues

If you encounter issues, please provide:
1. Browser console logs (filter by "BTSnoop Scroll")
2. Steps to reproduce
3. Expected vs actual behavior
4. BTSnoop file size (number of packets)
5. Browser version and OS
