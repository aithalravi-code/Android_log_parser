# Padding Handling Enhancement

## Issue
The user noticed `Tag_00` appearing in the output, likely repeated ("do publish once not more") in `Vehicle Status` or similar messages.
In BER-TLV encoding, bytes `00` and `FF` are often used as inter-tag padding and should be skipped by the parser, not interpreted as tags.

## Fix
*   Updated `parseTLV` loop to check the next byte before parsing.
*   If the byte is `00` or `FF`, the parser advances the index by 2 chars (1 byte) and continues to the next iteration, effectively skipping the padding.

**Result:**
`Tag_00` entries (and potential `Tag_FF` entries) will no longer appear in the decoded parameter list.
