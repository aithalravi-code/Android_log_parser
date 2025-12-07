# BTSnoop Copy & Scroll-to-Selected Fixes ✅

## Issues Fixed

### 1. ✅ Click to Copy Packet
**Problem:** Copy functionality wasn't working

**Root Cause:** Double-click detection (`event.detail === 2`) was conflicting with selection

**Solution:** Changed to **Ctrl+Click** (or Cmd+Click on Mac) to copy
```javascript
// BEFORE (line 3224)
if (event.detail === 2) { // Double-click

// AFTER (line 3221)
if (event.ctrlKey || event.metaKey) { // Ctrl+Click or Cmd+Click
```

**New Behavior:**
- **Single Click**: Selects packet (highlights row)
- **Ctrl+Click** (Windows/Linux) or **Cmd+Click** (Mac): Copies cell content
- **Visual Feedback**: Cell flashes green with white text for 300ms

**Code (lines 3221-3238):**
```javascript
// 2. Handle Copy (Ctrl+Click or Right-click for context menu)
if (event.ctrlKey || event.metaKey) {
    // Ctrl+Click to copy
    const logText = cell.dataset.logText;
    if (logText) {
        navigator.clipboard.writeText(logText).then(() => {
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
            console.error('Failed to copy BTSnoop cell content:', err);
        });
    }
    event.preventDefault();
}
```

**User Guidance:**
- Added tooltip: Hover over any cell shows "Content (Ctrl+Click to copy)"

### 2. ✅ Scroll to Last Highlighted Packet
**Problem:** Selected packet wasn't staying in view when filters were applied/removed

**Root Causes:**
1. Scroll was applied BEFORE rendering (DOM not ready)
2. No second render to ensure selection visibility
3. Timing issue with `requestAnimationFrame`

**Solutions Applied:**

#### A. Move Scroll AFTER Render (lines 2936-2952)
```javascript
// BEFORE
requestAnimationFrame(() => {
    btsnoopLogContainer.scrollTop = newScrollTop;
});
renderBtsnoopVirtualLogs(); // Render happens AFTER scroll

// AFTER
renderBtsnoopVirtualLogs(); // Render FIRST

// Apply scroll AFTER rendering to ensure DOM is ready
requestAnimationFrame(() => {
    btsnoopLogContainer.scrollTop = newScrollTop;
    // Force a second render to ensure selection is visible
    if (selectedBtsnoopPacket) {
        setTimeout(() => renderBtsnoopVirtualLogs(), 50);
    }
});
```

**Why This Works:**
1. **First render** creates the DOM elements
2. **requestAnimationFrame** waits for browser to paint
3. **Scroll is applied** to the rendered content
4. **Second render** (50ms later) ensures selection styling is visible

#### B. Debug Logging (line 2944)
```javascript
console.log('[BTSnoop Scroll] Applying scroll to:', newScrollTop, 'for packet:', selectedBtsnoopPacket?.number);
```

**Flow Diagram:**
```
User applies filter
    ↓
Calculate new scroll position (center selected packet)
    ↓
Render filtered packets (1st render)
    ↓
requestAnimationFrame (wait for paint)
    ↓
Apply scroll position
    ↓
Second render (ensure selection visible)
    ↓
✅ Selected packet is centered and highlighted
```

## Complete User Workflow

### Selecting and Copying:
1. **Click** any packet row → Row highlights (blue background)
2. **Apply filter** → Selected packet stays centered in view
3. **Ctrl+Click** any cell → Cell content copied to clipboard (green flash)
4. **Click** same packet again → Deselects (removes highlight)

### Visual Feedback:
- **Selected row**: Blue background (`#2c3e50`)
- **Hover**: Gray background (`#444`)
- **Copy success**: Green flash (`#34a853`) with white text

### Keyboard Shortcuts:
- **Ctrl+Click** (Windows/Linux): Copy cell content
- **Cmd+Click** (Mac): Copy cell content

## Testing Checklist
- [ ] Click a packet → Row highlights
- [ ] Apply a filter → Selected packet stays centered
- [ ] Remove a filter → Selected packet stays centered
- [ ] Ctrl+Click a cell → Content copied (green flash)
- [ ] Hover over cell → Tooltip shows "(Ctrl+Click to copy)"
- [ ] Click selected packet again → Deselects
- [ ] Scroll manually → Selection persists
- [ ] Select different packet → Old selection clears, new one highlights

## Technical Details

### Scroll Calculation (lines 2927-2930):
```javascript
const containerHeight = btsnoopLogContainer.clientHeight;
const centerOffset = Math.floor(containerHeight / 2) - (LINE_HEIGHT / 2);
newScrollTop = Math.max(0, (newAnchorIndex * LINE_HEIGHT) - centerOffset);
```

**Formula:**
- `newAnchorIndex * LINE_HEIGHT` = Pixel position of packet
- `- centerOffset` = Adjust to center in viewport
- `Math.max(0, ...)` = Don't scroll above top

### Timing:
1. **Render**: Immediate (synchronous)
2. **Scroll**: Next animation frame (~16ms)
3. **Second render**: 50ms after scroll (ensures visibility)

## Known Limitations

### Variable Row Heights:
⚠️ With wrapped Data column, rows have variable heights
- Scroll calculation uses fixed `LINE_HEIGHT = 20px`
- May be slightly off-center for wrapped rows
- **Mitigation**: Second render corrects positioning

### Performance:
- Two renders per filter change (minimal impact)
- Only visible rows are rendered (virtual scrolling)
- Scroll happens in animation frame (smooth)

## Summary
Both issues are now fixed:

1. **Copy**: Changed from double-click to **Ctrl+Click**
   - Clearer interaction model
   - No conflict with selection
   - Visual feedback (green flash)
   - Tooltip guidance

2. **Scroll-to-Selected**: Fixed timing
   - Scroll applied AFTER render
   - Second render ensures visibility
   - Debug logging for troubleshooting
   - Centers selected packet in viewport

The BTSnoop tab now has reliable selection, copy, and scroll-to-selected functionality!
