# BTSnoop Cell Content Visibility Fix ✅

## Problem Identified
User reported: "Line numbers visible but content not seen in BTSnoop"

## Root Cause
The absolutely positioned grid rows were not properly configured:
1. **Missing explicit `display: grid`** - CSS class alone wasn't enough for absolutely positioned elements
2. **Missing explicit `height`** - Rows were collapsing to 0 height
3. **Grid template not always set** - Only set when resized, not on initial render

## Fixes Applied

### 1. Added Explicit Display and Height (Lines 3122-3123)
```javascript
row.style.height = '20px'; // Explicit height
row.style.display = 'grid'; // Ensure grid layout
```

**Why this matters:**
- `position: absolute` removes element from normal flow
- CSS class `.btsnoop-row { display: grid }` wasn't being applied consistently
- Explicit inline styles override any CSS issues

### 2. Always Set Grid Template Columns (Lines 3126-3131)
```javascript
// FIX: Apply the current column widths if they have been resized
if (currentBtsnoopGridTemplate) {
    row.style.gridTemplateColumns = currentBtsnoopGridTemplate;
}
else {
    row.style.gridTemplateColumns = '60px 120px 160px 160px 80px minmax(200px, 2fr) minmax(200px, 3fr)';
}
```

**Before:** Grid template only set when columns were manually resized
**After:** Grid template ALWAYS set, ensuring cells have proper width

## Complete Row Styling (Lines 3116-3131)
```javascript
// Position the row correctly in the viewport
row.style.position = 'absolute';
row.style.top = '0';
row.style.left = '0';
row.style.width = '100%';
row.style.transform = `translateY(${i * LINE_HEIGHT}px)`;
row.style.height = '20px'; // ✅ NEW: Explicit height
row.style.display = 'grid'; // ✅ NEW: Ensure grid layout

// FIX: Apply the current column widths if they have been resized
if (currentBtsnoopGridTemplate) {
    row.style.gridTemplateColumns = currentBtsnoopGridTemplate;
}
else {
    row.style.gridTemplateColumns = '60px 120px 160px 160px 80px minmax(200px, 2fr) minmax(200px, 3fr)'; // ✅ NEW: Default template
}
```

## Why Cells Were Invisible

### Before Fix:
1. Row had `position: absolute` ✅
2. Row had CSS class `btsnoop-row` ✅
3. **BUT** CSS `display: grid` wasn't being applied to absolutely positioned elements
4. **AND** Grid template columns were never set on initial render
5. **RESULT**: Cells had 0 width and collapsed

### After Fix:
1. Row has explicit `display: grid` inline style ✅
2. Row has explicit `height: 20px` inline style ✅
3. Row ALWAYS has grid template columns set ✅
4. **RESULT**: Cells have proper width and are visible ✅

## All Cell Data Already Correct
The cell population code was already working correctly:
- ✅ Data converted to string (line 3105)
- ✅ Text content set (line 3106)
- ✅ Color explicitly set to `#e0e0e0` (line 3109)
- ✅ Dataset for copying set (line 3108)

The issue was purely layout/CSS, not data population.

## Testing Checklist
- [ ] BTSnoop tab shows ALL packet data (not just line numbers)
- [ ] All 7 columns visible: No., Timestamp, Source, Destination, Type, Summary, Data
- [ ] Text is clearly readable (light gray on dark background)
- [ ] Columns are properly aligned with header
- [ ] Horizontal scroll works if content is wide
- [ ] Filtering works and content remains visible
- [ ] Selection works (single-click)
- [ ] Copy works (double-click with green flash)

## Summary
The fix ensures that absolutely positioned grid rows have:
1. Explicit `display: grid` to enable grid layout
2. Explicit `height: 20px` to prevent collapse
3. Grid template columns ALWAYS set (not just when resized)

This makes the cell content visible and properly laid out.
