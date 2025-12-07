# Visual Enhancements & Deselect_SE Handling

## Issues
1.  **Deselect_SE Decoding**: Identifying `031100020100` as `Deselect_SE`.
2.  **Table Readability**: User requested splitting the "Subtype / Message ID" into separate columns and visually highlighting parameter-value pairs.

## Fix
1.  **Decoding Logic**:
    *   Added logic in `decodePayload` for DK Event Category `01` to map Code `00` to `Deselect_SE`.
2.  **Visual Styling**:
    *   Added CSS classes `.ccc-pair`, `.ccc-param`, and `.ccc-value`.
    *   Implemented `formatParam` helper to wrap parameters in these styles.
    *   Updated `parseTLV` and `decodePayload` to use `formatParam`, creating a consistent "pill-like" appearance for data pairs.
3.  **Table Structure**:
    *   Updated `renderCccStats` to split the "Subtype / Message ID" column into:
        *   **Message**: The descriptive name (e.g., "Ranging_Session_RQ").
        *   **ID**: The hex ID (e.g., "0x03").
    *   Renamed table headers for clarity.

**Result:**
The CCC Analysis table is now more readable with distinct columns for message type/name/ID and visually distinct parameter/value pairs in the payload column.
