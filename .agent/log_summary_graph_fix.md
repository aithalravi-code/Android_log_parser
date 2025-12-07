# Log Summary Graph Fix

## Issue
The user reported that the "Log Summary graph" was broken.
This likely referred to the error distribution bar chart in the Log Summary card.

## Fix
Updated `renderStats` in `main.js`:
1.  **Added `width: 100%`** to the chart container to ensure it fills the card.
2.  **Added `maxVal === 0` check:** Displays "No log data available" if there are no logs, preventing a broken/empty graph.
3.  **Improved styling:** Added border radius to bars, adjusted width to 80% of flex item, and improved label styling.

**Result:**
The error distribution graph should now render correctly and look better, or show a helpful message if no data is present.
