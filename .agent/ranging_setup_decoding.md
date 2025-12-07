# Ranging Session Setup Decoding (0x05, 0x06)

## Issue
The user reported that `Ranging_Session_Setup_RQ` (and RS) substructures were not being decoded.

## Fix
Implemented detailed payload decoding for UWB Ranging Service (Type 0x02):
1.  **Ranging_Session_Setup_RQ (Subtype 0x05)**:
    *   Parameters: `Session_RAN_Multiplier` (1), `SYNC_Code_Index` (Bitmap 4 bytes), `Selected_Hopping_Config_Bitmask` (1).
    *   Displays as: `RAN_Multiplier: ..., SYNC_Bitmap: 0x..., Hop_Bitmask: 0x...`
2.  **Ranging_Session_Setup_RS (Subtype 0x06)**:
    *   Parameters: `STS_Index0` (4), `UWB_Time0` (8), `HOP_Mode_Key` (4), `SYNC_Code_Index` (1).
    *   Displays as: `STS_Index0: ..., UWB_Time0: ..., HOP_Key: ..., SYNC_Index: ...`
3.  **Ranging_Recovery_RS (Subtype 0x0A)**:
    *   Parameters: `STS_Index0` (4), `UWB_Time0` (8).
    *   Added for completeness.

**Result:**
Messages 0x05 and 0x06 are now fully decoded with their constituent parameters shown.
