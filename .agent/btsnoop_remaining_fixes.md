# BTSnoop Rendering Fix

## Issue
BTSnoop tab shows only line numbers, no cell content is visible.

## Root Causes Found

1. **Cell data might not be converting to string properly** - Fixed by explicit String() conversion
2. **Text color might be invisible** - Need to add explicit `style.color = '#e0e0e0'`
3. **Copy functionality needs to be double-click** - Changed to double-click to avoid conflict with selection

## Changes Already Applied

### 1. String Conversion (✅ DONE)
In `renderBtsnoopVirtualLogs()` around line 3104:
```javascript
const dataStr = (cellData[j] !== undefined && cellData[j] !== null) ? String(cellData[j]) : '';
cells[j].textContent = dataStr;
```

### 2. Scroll to Center Selected (✅ DONE)
Around line 2922:
```javascript
const centerOffset = Math.floor(containerHeight / 2) - (LINE_HEIGHT / 2);
newScrollTop = Math.max(0, (newAnchorIndex * LINE_HEIGHT) - centerOffset);
```

### 3. Double-Click to Copy (✅ DONE)
Around line 3176:
```javascript
if (event.detail === 2) { // Double-click
    // Copy logic with visual feedback
}
```

## Changes STILL NEEDED

### Add Explicit Text Color
Need to add this line when creating cells (around line 3079):
```javascript
cell.style.color = '#e0e0e0'; // Explicit text color for visibility
```

And also when populating cells (around line 3107):
```javascript
cells[j].style.color = '#e0e0e0'; // Ensure color is set on recycled cells too
```

## Manual Fix Instructions

1. Open `/home/rk/Documents/Android_log_parser (copy)/main.js`
2. Find line ~3079 where cells are created:
   ```javascript
   const cell = document.createElement('div');
   cell.className = 'btsnoop-cell';
   ```
   Add after it:
   ```javascript
   cell.style.color = '#e0e0e0';
   ```

3. Find line ~3107 in the cell population loop:
   ```javascript
   cells[j].dataset.logText = dataStr;
   ```
   Add after it:
   ```javascript
   cells[j].style.color = '#e0e0e0';
   ```

## Testing Checklist
- [ ] BTSnoop tab shows packet data (not just numbers)
- [ ] Single-click selects a packet
- [ ] Double-click copies cell content
- [ ] Selected packet stays centered when filtering
- [ ] Text is clearly visible (light gray on dark background)
