# CCC Table Layout Refinement

## Issues
1.  **Wrapping**: Text wrapping was not working despite `white-space: normal` because table layout was auto (default).
2.  **Column Structure**: User requested splitting the "Message ID" concept into:
    *   **Message Type** (Service Category).
    *   **Message** (Specific Message Name/ID).
    *   **Parameters** (Decoded Payload).

## Fix
1.  **CSS**:
    *   Set `table-layout: fixed` on `.ccc-table`. This forces the table to respect defined column widths and allows `word-wrap` to function correctly for long strings.
    *   Set `overflow-wrap: break-word` globally for standard table cells.
2.  **Columns**:
    *   **Time**: Fixed `140px`.
    *   **Dir**: Fixed `60px`.
    *   **Message Type**: Width `16%`. Displays the high-level category (e.g. "UWB Ranging Service").
    *   **Message**: Width `20%`. Displays the specific message (e.g. "Ranging_Session_RQ (0x03)").
    *   **Parameters**: Auto width (takes remaining space). Wraps decoded content.
    *   **Raw Data**: Width `14%`.

**Result:**
The table now strictly adheres to a fixed layout, ensuring long parameter strings wrap to new lines instead of expanding the table. The "Message" vs "Type" distinction is clearer.
