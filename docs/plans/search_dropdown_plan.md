# Implementation Plan: Scrollable Search Suggestion Dropdown

## 1. Objective
Improve the "Keyword Search" suggestion UI to prevent it from disturbing the main layout when there are many matches. The goal is to create a compact, scrollable dropdown list that floats above other content.

## 2. Current State
- **HTML**: `<div id="autocompleteSuggestions" class="autocomplete-suggestions"></div>` exists in `index.html` inside `.search-section`.
- **CSS**: Currently appears to be missing specific styling (based on search checks), likely causing it to render as a normal block element that pushes down subsequent content.
- **JS**: `main.js` limits suggestions to 10 items (`.slice(0, 10)`).

## 3. Proposed Changes

### 3.1. Styling (CSS)
We will add specific styles to `styles.css` for `.autocomplete-suggestions` and `.suggestion-item`:
- **Positioning**: `absolute` to float over content.
- **Layout**: `max-height` with `overflow-y: auto` to enable scrolling.
- **Visuals**: Background color, border, shadow (elevation), z-index to ensure it sits on top.
- **Mobile**: Ensure it works on smaller screens (width adjustment).

### 3.2. Logic (JS)
- **Remove Limitation**: Increase or remove the `.slice(0, 10)` limit in `main.js` since we now have scroll capabilities.
- **Behavior**: Ensure clicking outside closes it (already implemented).

## 4. Implementation Details

### CSS (`styles.css`)
```css
.search-section {
    position: relative; /* Ensure dropdown is positioned relative to this container */
    /* ... existing styles ... */
}

.autocomplete-suggestions {
    position: absolute;
    top: 100%; /* Right below the input */
    left: 0;
    right: 0;
    max-height: 200px; /* specific height constraint */
    overflow-y: auto; /* Enable vertical scroll */
    background-color: #1e1e1e; /* Dark mode bg */
    border: 1px solid #444;
    border-radius: 0 0 6px 6px;
    z-index: 1000;
    display: none; /* Hidden by default */
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
}

.suggestion-item {
    padding: 8px 12px;
    cursor: pointer;
    color: #e0e0e0;
    border-bottom: 1px solid #333;
}

.suggestion-item:last-child {
    border-bottom: none;
}

.suggestion-item:hover {
    background-color: #2c3e50; /* Highlight color */
}
```

### JS (`main.js`)
- Locate the search input event listener.
- Change `.slice(0, 10)` to `.slice(0, 100)` or remove it to allow more matches.

## 5. Verification Plan
1.  **Manual Test**: Type "a" (or common letter) into the search box.
2.  **Verify**:
    - List appears *over* the content below it (doesn't push "Time Range" section down).
    - List has a scrollbar if results > ~6 items.
    - Selecting an item works as before.
