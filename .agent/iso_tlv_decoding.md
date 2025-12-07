# ISO 7816-4 TLV Decoding for CCC

## Issue
The user provided specific CCC payloads containing ISO 7816-4 APDU structures (Tags `7F74`, `7F72`) related to RKE/Vehicle Status.
These were wrapped in a DK Event Notification (Type 0x03) with Subtype 0x11.

## Analysis
*   **Subtype 0x11:** Identified as a container for RKE System Events (or similar status updates).
*   **Payload Structure:** `[Indicator (1 byte)] [BER-TLV Data...]`
*   **Tags:**
    *   `7F74`: Get_Function_Status
    *   `7F72`: Function_Status_Response
    *   `30`: Sequence
    *   `A0`: Status_Object
    *   `80`: Function_ID (e.g., 0001 = Central Locking)
    *   `83`: Status (e.g., 00 = Locked)
    *   `86`: Function_ID_List

## Implementation
Updated `renderCccStats` in `main.js`:
1.  **Renamed** Subtype 0x11 to "RKE_System_Event".
2.  **Implemented `parseTLV`:** A simple recursive BER-TLV parser that handles nested constructed tags.
3.  **Updated `decodePayload`:** Uses `parseTLV` for Subtype 0x11 messages after stripping the indicator byte.

**Result:**
Complex nested TLV structures are now expanded into readable text, showing Function IDs and Status values.
