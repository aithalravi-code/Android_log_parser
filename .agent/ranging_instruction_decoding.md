# Ranging Instruction (0x03) Decoding

## Issue
The user noted that `031100020302` corresponds to "Ranging Instruction" with "MID level".
This is an `RKE_System_Event` (0x11) with:
*   Indicator: `03`
*   Value: `02` (Medium)

## Fix
Updated `decodePayload` in `main.js` to handle `indicator === '03'`:
*   Decodes as `Ranging Instruction`.
*   Maps value `02` to `Medium`.
*   Assumes `01`=Low, `03`=High based on standard conventions (though only 02 was confirmed).

**Result:**
`031100020302` -> "Ranging Instruction (Level: Medium)"
