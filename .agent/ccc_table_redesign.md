# CCC Table Redesign

## Issue
The user requested that the "sessions in the stats page" (CCC Analysis table) use the same table format and fonts as the BTSnoop analysis for design consistency.

## Fix
1.  **Created `.ccc-table` CSS class:**
    *   Added to `styles.css`.
    *   Mimics the visual style of BTSnoop tables: dark background (`#2C2C2C`/`#333`), light text (`#e0e0e0`), specific padding, and borders.
    *   Uses the standard 'Inter' font.
2.  **Updated `renderCccStats` in `main.js`:**
    *   Changed the table class from `highlight-table` to `ccc-table`.
    *   Updated the "Raw Data" column text color to `#999` (lighter gray) to be readable on the dark background.

**Result:**
The CCC Analysis table now visually matches the BTSnoop table schema, providing a consistent dark-themed look for protocol analysis.
