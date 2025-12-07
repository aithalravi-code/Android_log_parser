# Correction for Indicator 0x05

## Issue
The user pointed out that `03110006057f74028600` was incorrectly decoded as "BLE OOB Connection".
The payload actually contains a `7F74` (Get Function Status) message.
`05` is an indicator, and the rest is TLV data.

## Fix
Removed the special case for `indicator === '05'` in `main.js`.
The generic `parseTLV` function will now handle the payload, correctly identifying and displaying the `7F74` tag and its contents.

**Result:**
`03110006057f74028600` -> "Ind: 0x05, Get_Function_Status: { Function_ID_List: , }"
