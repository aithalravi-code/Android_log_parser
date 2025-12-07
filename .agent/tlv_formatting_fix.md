# Nested TLV Formatting Fix

## Issue
The user reported that `Function_Status_Response` data was displayed as a single long line using curly braces `{}` and `Sequence:{...}`, which caused column overflow and poor readability.

## Fix
1.  **Refactored `parseTLV`**:
    *   Removed logic that wrapped nested structures in `{ }`.
    *   Updated to return HTML using `<div>` blocks (`.tlv-block`) instead of inline strings.
    *   Implemented recursive indentation using a new `.tlv-indent` class.
    *   Simple Leaf nodes (e.g. `Function_ID`) are also wrapped in `.tlv-block` to force vertical stacking.
2.  **CSS**:
    *   Added `.tlv-block` for vertical spacing.
    *   Added `.tlv-indent` for left border and padding to visually group nested items.

**Result:**
Complex TLV structures now render as an indented tree, making them easy to read within the "Parameters" column without horizontal scrolling issues.
