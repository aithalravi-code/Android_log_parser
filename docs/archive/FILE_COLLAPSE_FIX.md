# File Collapse Functionality Fix

## Issue
The user reported that the file collapse function (collapsing/expanding file sections in the log view) was non-functional.
Changes to the collapse state were not triggering a re-render of the log view.

## Root Cause
1. **State Tracking**: The `computeFilterStateHash` function, which determines if a re-filter is necessary, did not include `collapsedFileHeaders`. Therefore, toggling a header's collapse state did not change the hash, leading the `refreshActiveTab` function to skip re-filtering and re-rendering.
2. **Duplicate Logic**: The `applyMainFilters` function contained redundant logic that pushed the `currentHeader` again when a new meta line was encountered, potentially causing duplicate headers or confusion in the logic.

## Fix
1. Updated `computeFilterStateHash` in `main.js` to include `collapsed: Array.from(collapsedFileHeaders).sort()`. This ensures that any change to the set of collapsed headers invalidates the filter cache and triggers a refresh.
2. Removed the redundant `results.push(currentHeader)` logic from the `if (line.isMeta)` block in `applyMainFilters`. The header is correctly handled by the logic that pushes it effectively when the first matching line is found (for expanded files) or immediately (for collapsed files).

## Verification
- Run `npx playwright test tests/e2e/file_collapse.spec.js` passed successfully.
- Verified logic flow in `applyMainFilters` ensures headers are displayed correctly (hidden if empty/no matches, always visible if collapsed).
