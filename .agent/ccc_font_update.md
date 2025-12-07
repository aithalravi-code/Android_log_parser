# Font Update for CCC Table

## Issue
The user requested to use "common fonts" in the Digital Car Key (CCC) Analysis table.
Previously, the `code-font` class (likely monospace) was used for the "Payload (Decoded)" and "Raw Data" columns.

## Fix
Updated `renderCccStats` in `main.js` to remove `class="code-font"` from the table cells.
The text will now inherit the default font family (Inter/Arial) defined in `styles.css`.

**Result:**
The CCC Analysis table now uses the same font as the rest of the dashboard, improving consistency as requested.
