# Ranging Session RS Bitmarks Decoding

## Issue
The user specified that the `Ranging_Session_RS` (0x04) message decoding was incorrect/generic.
They requested specific fields: `Slot_BitMask`, `SYNC_Code_Index_BitMask`, `Selected_UWB_Channel`, and `Hopping_Config_Bitmask`.

## Fix
*   Updated `decodePayload` for `Ranging_Session_RS` (0x04).
*   Payload (after 2-byte Length) is now parsed as:
    *   **Slot_BitMask**: 1 byte.
    *   **SYNC_Code_Index_BitMask**: 4 bytes.
    *   **Hopping_Config_Bitmask**: 1 byte.
    *   **Selected_UWB_Channel**: 1 byte.
*   This structure (7 data bytes, 14 hex chars) replaces the previous generic decoding.

**Result:**
The Ranging Session Response now clearly displays the negotiated UWB configuration bitmasks.
