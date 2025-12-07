# Enhanced APDU Decoding (AUTH0, AUTH1, SELECT)

## Issue
The user requested more detailed decoding for specific APDU commands:
1.  **SELECT**: Identify the Digital Key Applet selection.
2.  **AUTH0 & AUTH1**: Decode the TLV structure within these commands and display descriptive tag names.

## Implementation
Updated `main.js`:
1.  **Tag Dictionary (`TAG_NAMES`):** Added mappings for standard CCC tags found in AUTH0/AUTH1 (e.g., `4D` Vehicle ID, `86` Endpoint ePK, `9E` Signature, `4E` Key Slot).
2.  **APDU Recognition (`APDU_COMMANDS`):** Added a map to identify commands by their CLA and INS bytes (e.g., `00A4` -> SELECT, `8080` -> AUTH0).
3.  **`decodePayload` Logic:**
    *   **SE Messages (0x0B/0x0C):** Now parses the APDU payload.
    *   **SELECT:** Checks the AID against the known CCC Digital Key AID.
    *   **AUTH0/AUTH1:** Strips the APDU header (CLA INS P1 P2 Lc) and passes the remaining data to the TLV parser.
    *   **Responses:** Separates the Status Word (SW) from the Response Data and parses any TLV data present.
4.  **`parseTLV` Enhancement:** Made the parser more robust with iteration limits and better length handling.

**Result:**
*   `00 A4 ...` -> "SELECT (Digital Key Applet)"
*   `80 80 ...` -> "AUTH0, Vehicle_Identifier: ..., Vehicle_ePK: ..."
*   responses with tags -> "Response: { Endpoint_ePK: ... } SW: Success (9000)"
