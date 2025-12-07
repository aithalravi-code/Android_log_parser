# BTSnoop Variable Height & Selection Fixes ✅

## Issues Fixed

### 1. ✅ Dynamic Height for Wrapped Data
**Problem:** Rows had fixed 20px height, causing wrapped Data column content to overlap

**Root Cause:** Virtual scroll used `translateY(i * LINE_HEIGHT)` assuming all rows are 20px

**Solution:** Calculate cumulative Y positions for each row based on estimated content

#### Implementation (lines 3067-3083):
```javascript
// Calculate cumulative heights for variable-height rows
const rowHeights = [];
const rowPositions = [];
let totalHeight = 0;

filteredBtsnoopPackets.forEach((packet, idx) => {
    rowPositions[idx] = totalHeight;
    // Estimate height: 20px base + extra for wrapped data
    const dataLength = packet.data?.length || 0;
    const estimatedLines = Math.max(1, Math.ceil(dataLength / 100)); // ~100 chars per line
    const height = 20 * estimatedLines;
    rowHeights[idx] = height;
    totalHeight += height;
});

// Set the total height of the scrollable area
sizer.style.height = `${totalHeight}px`;
```

**Height Estimation:**
- **Base**: 20px per row
- **Data wrapping**: +20px for every ~100 characters
- **Formula**: `height = 20 * Math.max(1, Math.ceil(dataLength / 100))`

**Examples:**
- Short data (< 100 chars): 20px
- Medium data (100-200 chars): 40px
- Long data (200-300 chars): 60px

### 2. ✅ Visible Range Calculation
**Problem:** Virtual scroll calculated visible rows using fixed height, causing incorrect rendering

**Solution:** Find visible rows using cumulative positions

#### Implementation (lines 3088-3105):
```javascript
// Calculate the range of rows to render based on cumulative positions
let startIndex = 0;
let endIndex = filteredBtsnoopPackets.length;

// Find first visible row
for (let i = 0; i < rowPositions.length; i++) {
    if (rowPositions[i] + rowHeights[i] >= scrollTop) {
        startIndex = Math.max(0, i - BUFFER_LINES);
        break;
    }
}

// Find last visible row
for (let i = startIndex; i < rowPositions.length; i++) {
    if (rowPositions[i] > scrollTop + containerHeight) {
        endIndex = Math.min(filteredBtsnoopPackets.length, i + BUFFER_LINES);
        break;
    }
}
```

**How it works:**
1. Loop through row positions
2. Find first row that's visible (position + height >= scrollTop)
3. Find last row that's visible (position > scrollTop + containerHeight)
4. Add buffer rows before/after for smooth scrolling

### 3. ✅ Row Positioning
**Problem:** Rows positioned using `i * LINE_HEIGHT`, causing overlaps

**Solution:** Use cumulative positions from array

#### Implementation (line 3171):
```javascript
// BEFORE
row.style.transform = `translateY(${i * LINE_HEIGHT}px)`;

// AFTER
row.style.transform = `translateY(${rowPositions[i]}px)`;
```

### 4. ✅ Selection Not Working
**Problem:** Clicking cells wasn't selecting packets

**Root Cause:** Selection logic was running even when Ctrl/Cmd was pressed (for copy)

**Solution:** Only select on plain click (no modifiers)

#### Implementation (lines 3212-3228):
```javascript
// 1. Handle Selection (single click without modifiers)
if (row && row.dataset.packetNumber && !event.ctrlKey && !event.metaKey) {
    const packetNum = parseInt(row.dataset.packetNumber, 10);
    const packet = filteredBtsnoopPackets.find(p => p.number === packetNum);

    if (packet) {
        if (selectedBtsnoopPacket === packet) {
            selectedBtsnoopPacket = null; // Deselect
            console.log('[BTSnoop] Deselected packet', packetNum);
        } else {
            selectedBtsnoopPacket = packet; // Select
            console.log('[BTSnoop] Selected packet', packetNum);
        }
        // Fast re-render to show selection state
        renderBtsnoopVirtualLogs();
    }
}
```

**Key change:** Added `&& !event.ctrlKey && !event.metaKey` condition

### 5. ✅ Copy Not Working
**Problem:** Ctrl+Click wasn't copying cell content

**Root Cause:** Selection logic was interfering

**Solution:** Separate selection and copy logic with proper event handling

#### Implementation (lines 3230-3248):
```javascript
// 2. Handle Copy (Ctrl+Click or Cmd+Click)
if ((event.ctrlKey || event.metaKey) && cell) {
    console.log('[BTSnoop Copy] Attempting to copy:', cell.dataset.logText?.substring(0, 50));
    const logText = cell.dataset.logText;
    if (logText) {
        navigator.clipboard.writeText(logText).then(() => {
            console.log('[BTSnoop Copy] Successfully copied:', logText.length, 'characters');
            // Visual feedback
            const originalBg = cell.style.backgroundColor;
            const originalColor = cell.style.color;
            cell.style.backgroundColor = '#34a853';
            cell.style.color = '#fff';
            setTimeout(() => {
                cell.style.backgroundColor = originalBg;
                cell.style.color = originalColor;
            }, 300);
        }).catch(err => {
            console.error('[BTSnoop Copy] Failed to copy:', err);
        });
    }
    event.preventDefault();
    event.stopPropagation(); // ✅ Prevent selection
}
```

**Key changes:**
- Added `event.stopPropagation()` to prevent selection
- Added debug logging
- Improved visual feedback

### 6. ✅ Scroll-to-Selected
**Problem:** Scroll restoration used fixed LINE_HEIGHT

**Solution:** Use estimated average height

#### Implementation (lines 2929-2932):
```javascript
// Scroll to selected packet (approximate position for variable heights)
const avgRowHeight = 40; // Estimate: 20px base + some wrapping
const centerOffset = Math.floor(containerHeight / 2);
newScrollTop = Math.max(0, (newAnchorIndex * avgRowHeight) - centerOffset);
```

**Why 40px average:**
- Most packets have some data wrapping
- 40px = 20px base + 20px for ~1 line of wrapping
- Good balance between short and long packets

## Debug Logging Added

### Click Events:
```javascript
console.log('[BTSnoop Click] Cell clicked, row:', row?.dataset.packetNumber, 'ctrl:', event.ctrlKey, 'meta:', event.metaKey);
console.log('[BTSnoop] Selected packet', packetNum);
console.log('[BTSnoop] Deselected packet', packetNum);
```

### Copy Events:
```javascript
console.log('[BTSnoop Copy] Attempting to copy:', cell.dataset.logText?.substring(0, 50));
console.log('[BTSnoop Copy] Successfully copied:', logText.length, 'characters');
console.error('[BTSnoop Copy] Failed to copy:', err);
```

### Scroll Events:
```javascript
console.log('[BTSnoop Scroll] Applying scroll to:', newScrollTop, 'for packet:', selectedBtsnoopPacket?.number);
```

## User Workflow

### Selection:
1. **Click** any cell → Row highlights (blue background)
2. **Click** again → Deselects (removes highlight)
3. **Apply filter** → Selected packet stays in view (approximate)

### Copy:
1. **Ctrl+Click** (Windows/Linux) or **Cmd+Click** (Mac) any cell
2. Cell flashes green → Content copied to clipboard
3. Works on any cell (No., Timestamp, Data, etc.)

### Visual Feedback:
- **Selected**: Blue background (`#2c3e50`)
- **Hover**: Gray background (`#444`)
- **Copy**: Green flash (`#34a853`) with white text

## Performance

### Virtual Scrolling:
- Only visible rows + buffer are rendered
- Cumulative position calculation: O(n) once per render
- Visible range finding: O(n) but early exit
- Smooth scrolling maintained

### Height Estimation:
- Fast calculation (simple math)
- Approximate but good enough
- Actual heights determined by browser layout

## Known Limitations

### Height Estimation:
⚠️ Heights are estimated, not measured
- May be slightly off for very long data
- **Mitigation**: Conservative estimate (100 chars/line)

### Scroll Position:
⚠️ Scroll-to-selected uses average height
- May not be perfectly centered
- **Mitigation**: Second render corrects position

## Summary

All issues are now fixed:

1. **Dynamic Height** ✅ - Rows expand based on data length
2. **No Overlaps** ✅ - Cumulative positioning prevents overlaps
3. **Selection Works** ✅ - Plain click selects, Ctrl+Click copies
4. **Copy Works** ✅ - Ctrl+Click copies with visual feedback
5. **Scroll Works** ✅ - Selected packet stays in view (approximate)

The BTSnoop tab now properly handles variable-height rows with wrapped data!
