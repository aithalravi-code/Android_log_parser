# Table Column Expansion & Message Extraction

## Issues
User requested:
1.  **Column Separation**: Split "Message" into "Message Category" (Service), "Message Type" (Subtype), and "Message" (Specific Content like AUTH0).
2.  **Parameter Isolation**: Move parameters to their own column.
3.  **Wrapping**: Ensure parameters wrap correctly to avoid overflowing into Raw Data.

## Fix
1.  **`decodePayload` Refactor**:
    *   Updated function to return an object `{ innerMsg: string, params: string }`.
    *   `innerMsg` captures specific commands (e.g., `AUTH0`, `SELECT`, `RKE Request`).
    *   `params` captures the payload data (formatted with `formatParam`).
2.  **Table Columns**:
    *   **Message Category**: High-level Service (e.g., "Secure Element").
    *   **Message Type**: Message Subtype (e.g., "DK_APDU_RQ").
    *   **Message**: Specific Command/Interaction (e.g., "AUTH0").
    *   **Parameters**: Decoded payload data.
    *   **Raw Data**: Hex string.
3.  **Styling**:
    *   Applied `overflow-wrap: anywhere` and `word-break: break-all` to the Parameters column to force wrapping of long hex strings.

**Result:**
The table now provides a granular breakdown of message hierarchy and handles long data strings gracefully.
