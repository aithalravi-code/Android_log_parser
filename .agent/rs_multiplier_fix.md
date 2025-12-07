# Ranging Session RS: Restored RAN_Multiplier

## Issue
The user noticed that `RAN_Multiplier` was removed in the previous update to `Ranging_Session_RS`.

## Fix
*   Updated `decodePayload` for `Ranging_Session_RS` (0x04).
*   Structure logic is now:
    *   `Length` (2B)
    *   `RAN_Multiplier` (1B)
    *   `Slot_BitMask` (1B)
    *   `SYNC_Code_Index_BitMask` (4B)
    *   `Hopping_Config_Bitmask` (1B)
    *   `Selected_UWB_Channel` (1B)

**Result:**
The Ranging Session Response now correctly includes both the multiplier and the configuration bitmasks.
