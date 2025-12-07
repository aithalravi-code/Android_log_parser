# BTSnoop Scroll Fix: Forced Layout Update

## Symptom
When expanding the filtered list (e.g., SMP -> CMD+SMP), the view jumps to the top (e.g., packet #42) instead of maintaining the selected packet (e.g., #5712).

## Root Cause
**Scroll Height Clamping**: 
1. The list expands significantly (e.g., 2000px height -> 200,000px height).
2. We update the `sizer` height in the DOM.
3. We immediately try to set `scrollTop` to a large value (e.g., 114,000px).
4. The browser **has not yet recalculated the layout**, so it thinks the container is still 2000px high.
5. The browser **clamps** `scrollTop` to the maximum valid for the *old* height (approx 2000px).
6. Result: We scroll to the top area (packet #42), effectively ignoring our target text.

## Solution
**Force Layout Update (Reflow)**:
By reading `scrollHeight` immediately before setting `scrollTop`, we force the browser to recalculate the layout synchronously. This ensures `scrollTop` respects the *new* list height.

## Code Change
In `main.js`:

```javascript
requestAnimationFrame(() => {
    // FORCE LAYOUT UPDATE: Read scrollHeight to ensure the new sizer height is applied
    const _ = btsnoopLogContainer.scrollHeight; // <--- Critical line

    isProgrammaticBtsnoopScroll = true;
    btsnoopLogContainer.scrollTop = targetScrollTop;
    // ...
});
```

## Verification
- Select packet #5712 (SMP)
- Enable CMD (list grows massive)
- View should jump to #5712 (114,000px), not get stuck at top.

## Why this happened now?
Because we are switching from a very small list (SMP only) to a very large list (CMD+SMP). Previously, filters might not have caused such drastic height changes, or the race condition masked it.
