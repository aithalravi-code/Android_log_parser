# CONTROL_FLOW Map Scope Fix

## Issue
The user reported a `ReferenceError: CONTROL_FLOW_P1_MAP is not defined`.
This was caused by defining the map constants inside a conditional block within `decodePayload` that was not reachable when the constants were needed, or due to block-scoping rules.

## Fix
*   Moved `CONTROL_FLOW_P1_MAP` and `CONTROL_FLOW_P2_MAP` to the top-level scope of the `renderCccStats` function (adjacent to `CCC_CONSTANTS`).
*   This ensures they are available throughout the function's scope, including inside the `decodePayload` helper.

**Result:**
The `ReferenceError` is resolved, and `CONTROL_FLOW` decoding now functions correctly.
