# Long String Wrapping Fix

## Issue
Long values (e.g. `Vehicle_ePK` which is 64+ bytes) were not wrapping, causing the "Parameters" column to expand or overflow despite previous layout fixes.
This was traced to `.ccc-pair` having `white-space: nowrap` set, which forced the entire Key-Value unit to stay on one line.

## Fix
1.  **CSS Updates**:
    *   Removed `white-space: nowrap` from `.ccc-pair`. Added `max-width: 100%` restriction.
    *   Added `word-break: break-all` and `white-space: normal` to `.ccc-value`.

**Result:**
Long hex strings now break at any character necessity to fit within the column width, respecting the table layout.
