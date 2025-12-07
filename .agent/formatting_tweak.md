# Formatting Tweak: Remove Braces from APDU Response

## Issue
The user pointed out "why flower brackets" in `Response:{ Protocol_Version:0100 }SW:Success (9000)`.
These braces were explicitly added in the `decodePayload` function for `DK_APDU_RS` messages to wrap the parsed TLV content.

## Fix
*   Removed the `{` and `}` delimiters from the `formatParam` call in `DK_APDU_RS` decoding logic.
*   The output format is now `Response: <TLV_Content> SW: <Status>` instead of `Response: { <TLV_Content> } SW: <Status>`.

**Result:**
Cleaner output without unnecessary delimiters for the top-level APDU response data.
