# Secure Element (SE) APDU Decoding

## Issue
The user provided examples of SE messages (Type 0x01) containing APDU commands and responses.
*   `010c...`: Response (DK_APDU_RS)
*   `010b...`: Request (DK_APDU_RQ)
*   `803C`: Control Flow
*   `8080`: AUTH0

## Implementation
Updated `renderCccStats` in `main.js`:
1.  **Added `SE_MSGS`:** Mapped `0x0B` to `DK_APDU_RQ` and `0x0C` to `DK_APDU_RS`.
2.  **Updated `decodePayload`:** Added logic for Type 0x01.
    *   Skips the 2-byte Length field.
    *   Identifies `803C` as "Control Flow".
    *   Identifies `8080` as "AUTH0".
    *   Identifies `9000` as "Success".
    *   Displays raw APDU data for other cases.

**Result:**
*   `010c00029000` -> "Success (9000)"
*   `010b0004803c0100` -> "Control Flow (803C), Data: 0100"
*   `010b00698080...` -> "AUTH0 (8080), Data: ..."
