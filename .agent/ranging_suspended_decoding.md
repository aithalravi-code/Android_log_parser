# Ranging Suspended Event Decoding

## Issue
The user identified `031100020207` as a "Ranging Suspended" sub-event.
This falls under the `RKE_System_Event` (0x11) category.

## Fix
Updated `decodePayload` in `main.js` to handle specific indicators within the 0x11 subtype:
*   **Indicator 0x02:** Decoded as "Ranging Suspended". The remaining byte (e.g., `07`) is displayed as the Reason Code.
*   **Indicator 0x05:** Decoded as "Ble_OOB_Connection" (MAC Address), based on previous analysis.
*   **Other Indicators:** Fallback to generic TLV decoding (e.g., for `0x04` RKE Status).

**Result:**
`031100020207` -> "Ranging Suspended (Reason: 0x07)"
