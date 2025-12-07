# CCC Table Column & Layout Updates

## Issues
The user requested changes to the table layout:
1.  **ID Column**: Should contain the Text ID (Name), defaulting to Number (Hex) only if unknown.
2.  **Width & Wrapping**: Columns should adjust width dynamically and allow wrapping to prevent excessive scrolling/truncation.
3.  **Layout**: Merged separate "Message" and "ID" columns back into a single "Message ID" column formatted as `Name (Hex)`.

## Fix
1.  **Column Consolidation**:
    *   Merged "Message" and "ID" into **Message ID**.
    *   Content format: `<Name> (<Hex>)` (e.g., `Ranging_Session_RQ (0x03)`).
2.  **Dynamic Sizing**:
    *   Replaced fixed `width` on `<th>` elements with `min-width` to allow browser auto-sizing logic to work.
3.  **Text Wrapping**:
    *   Added `white-space: normal` and `word-wrap: break-word` to the "Message ID" and "Payload" columns.
    *   This ensures long message names or payload strings wrap to the next line instead of expanding the table width indefinitely.

**Result:**
The table now presents a cleaner, strictly formatted view where text descriptions are the primary identifier, with hex codes strictly as secondary context, and the layout adapts better to content length.
