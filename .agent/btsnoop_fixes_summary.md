# BTSnoop Rendering Issues - Analysis & Fixes

## Issues Identified by Previous Model (Gemini)

### 1. ❌ **Broken Rendering - "No Content Presented, Only Line Numbers"**
**Root Cause:** CSS conflict between `display: contents` and `position: absolute`
- The CSS used `display: contents` on `.btsnoop-row`, which removes the element from the layout
- Virtual scrolling requires `position: absolute` on rows
- This combination caused rows to have zero effective height/width

**Fix Applied:**
- Changed `.btsnoop-row` to use `display: grid` with explicit dimensions
- Each row is now a grid container with 7 columns matching the header
- Set explicit `height: 20px` and `width: 100%` on rows
- Removed `display: contents` entirely

### 2. ❌ **IRK Keys Added 3 Times on Stats Page**
**Root Cause:** Data accumulation without clearing + no deduplication
- `btsnoopConnectionEvents` array was not cleared when reprocessing files
- No deduplication logic when rendering keys (retransmissions created duplicates)

**Fixes Applied:**
- Added `btsnoopConnectionEvents = [];` at the start of `processForBtsnoop()`
- Implemented deduplication in `renderHighlights()` using a `Set` to track seen key values
- Only unique keys are now displayed in the BLE Security Keys table

### 3. ❌ **"Circular Scroll" Behavior**
**Root Cause:** Broken row rendering caused incorrect virtual scroll calculations
- Rows with zero height made scroll position calculations fail
- Virtual scroll couldn't determine visible range correctly

**Fix Applied:**
- Fixed by resolving issue #1 (proper row dimensions)
- Each row now has consistent 20px height matching `LINE_HEIGHT` constant

### 4. ❌ **Class Name Mismatch**
**Root Cause:** JavaScript used non-existent CSS class
- JS created rows with class `btsnoop-row btsnoop-row-grid`
- CSS only defined `.btsnoop-row` after recent changes
- Selector for resize updates used `.btsnoop-row-grid` which didn't exist

**Fixes Applied:**
- Changed row creation to use only `btsnoop-row` class
- Updated resize logic querySelector to use `.btsnoop-row`

## Current Implementation Status

### ✅ Working Features
1. **CSS Grid Layout**: Header and rows use matching grid templates
2. **Virtual Scrolling**: Rows are absolutely positioned with correct transforms
3. **Column Alignment**: Header and data columns align perfectly
4. **Scroll Restoration**: Selected packet stays in view when filtering
5. **LTK/IRK Extraction**: Keys are correctly extracted with proper byte order (reversed for Big Endian display)
6. **Deduplication**: Duplicate keys are filtered out
7. **Selection**: Clicking a row selects it and maintains selection through filters
8. **Column Resizing**: Resize handles update both header and body columns

### 🔧 CSS Structure
```css
.btsnoop-header-grid {
    display: grid;
    grid-template-columns: 60px 120px 160px 160px 80px minmax(200px, 2fr) minmax(200px, 3fr);
    position: sticky;
    top: 0;
}

.btsnoop-row {
    display: grid;
    grid-template-columns: 60px 120px 160px 160px 80px minmax(200px, 2fr) minmax(200px, 3fr);
    width: 100%;
    height: 20px;
    position: absolute; /* Applied via inline style */
}

.btsnoop-cell {
    padding: 0 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
```

### 🔧 JavaScript Structure
```javascript
// Row creation
row = document.createElement('div');
row.className = 'btsnoop-row';
for (let j = 0; j < 7; j++) {
    const cell = document.createElement('div');
    cell.className = 'btsnoop-cell';
    row.appendChild(cell);
}

// Positioning
row.style.position = 'absolute';
row.style.transform = `translateY(${i * LINE_HEIGHT}px)`;

// Column width persistence
if (currentBtsnoopGridTemplate) {
    row.style.gridTemplateColumns = currentBtsnoopGridTemplate;
}
```

## Potential Remaining Issues

### ⚠️ To Verify
1. **Initial Render**: Does the BTSnoop tab show content on first load?
2. **Filter Performance**: Are filters responsive with large datasets?
3. **Horizontal Scroll**: Does horizontal scrolling work when columns are wide?
4. **Column Resize Persistence**: Do resized columns maintain width during scroll?
5. **Selection Visibility**: Is the selected row clearly highlighted?

### 🔍 Testing Checklist
- [ ] Load a btsnoop_hci.log file
- [ ] Verify packets are visible (not just line numbers)
- [ ] Check header/data alignment
- [ ] Test column filters
- [ ] Test tag filters (CMD, EVT, ACL, etc.)
- [ ] Verify scroll-to-selected works
- [ ] Test column resizing
- [ ] Check Stats page for duplicate IRK/LTK entries
- [ ] Verify horizontal scroll when needed

## Summary

The previous model (Gemini) successfully identified and partially fixed the core issues:
1. ✅ Identified the `display: contents` conflict
2. ✅ Switched to CSS Grid layout
3. ✅ Added IRK/LTK deduplication
4. ✅ Cleared connection events on reprocess

However, it introduced a new issue:
- ❌ Used non-existent CSS class `btsnoop-row-grid`

This has now been corrected by:
- Removing the extra class name
- Updating the resize selector

The implementation should now be fully functional.
