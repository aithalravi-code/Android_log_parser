# New Feature Development Workflow

This document outlines the standard operating procedure for handling new feature requests in the Android Log Parser project. We follow a strict **"Document First, Code Later"** philosophy to ensure clarity, quality, and maintainability.

## 1. Brainstorming & Requirements Analysis
Before writing a single line of code, we must fully understand the "What" and the "Why".

- **Deconstruct the Request**: Break down the user's request into specific, actionable requirements.
- **User Stories**: Define who the user is, what they want to do, and why.
  - *Format*: "As a [role], I want to [action] so that [benefit]."
- **Visualisation**: If the feature involves UI, sketch or describe the expected interface changes.
- **Input/Output Definition**: clearly define what inputs the feature takes (e.g., specific log formats, user clicks) and what output it produces (e.g., filtered view, calculated statistic, exported file).

## 2. Constraints & Feasibility
Identify factors that limit or influence the implementation.

- **Technical Constraints**:
  - **Serverless / Client-Side Only**: The project strives to be entirely serverless. All processing must happen in the browser. No backend services or API calls for data processing unless explicitly authorized.
  - Browser limitations (memory usage for large logs).
  - Performance impacts (O(n) vs O(n^2) operations).
  - Compatibility (does this work with existing log formats?).
- **Dependencies**: Does this require new libraries or tools? (Minimize external dependencies).
- **Architecture**: How does this fit into the existing MVC/Event-driven structure? Does it require refactoring existing code?

## 3. Implementation Roadmap
Create a step-by-step plan. This serves as a checklist during development.

1.  **Phase 1: Foundation**: Data structure changes, utility functions, parsing logic updates.
2.  **Phase 2: Core Logic**: The "business logic" of the feature.
3.  **Phase 3: UI/UX**: Visual components, event listeners, and user feedback.
4.  **Phase 4: Integration**: Wiring it all together.

## 4. Testability Strategy
Define how we will verify the feature works and doesn't break existing functionality.

- **Unit Tests**: Which specific functions need tests? (e.g., regex parsers, calculation logic).
- **Integration Tests**: How do components interact? (e.g., does clicking the button trigger the correct filter?).
- **Manual Verification**: Specific steps a human should take to verify the feature (e.g., "Load file X, click button Y, verify Z appears").
- **Regression**: What existing features might be affected? (e.g., if changing the parser, does it break legacy log support?).

### Critical Testing Requirements for Refactoring

> [!CAUTION]
> **MANDATORY FOR ALL REFACTORING**: You MUST test file upload (ZIP and individual files) after ANY code extraction or module changes. This is NON-NEGOTIABLE.

When refactoring existing code (e.g., extracting modules, changing data structures):

#### 1. Automated Verification (BEFORE manual testing)

**Search for ALL references to extracted functions**:
```bash
# Example: If extracting renderStats, search for ALL calls
grep -n "renderStats(" Production/src/main.js
grep -n "processForDashboardStats(" Production/src/main.js
```

**Verify imports are complete**:
- Check that EVERY function call found in grep is either:
  - Imported from the new module, OR
  - Still defined in main.js (if intentionally kept)

#### 2. Critical Path Testing (MANDATORY)

Test these paths IN ORDER after every refactoring change:

1. **Page Load** (Basic)
   - [ ] Navigate to `http://localhost:5173/`
   - [ ] Check console for errors
   - [ ] Verify page renders

2. **File Upload** (CRITICAL - Most bugs appear here)
   - [ ] Upload a ZIP file
   - [ ] Upload individual log files
   - [ ] Check console for errors during processing
   - [ ] Verify stats display correctly
   - [ ] Verify logs render

3. **Tab Switching**
   - [ ] Switch to each tab (Logs, Connectivity, BTSnoop, CCC, Stats)
   - [ ] Verify no console errors
   - [ ] Verify content renders

4. **Filtering**
   - [ ] Test keyword search
   - [ ] Test log level filters
   - [ ] Test time range filters

5. **Export Functions**
   - [ ] Test Excel export for each tab

6. **State Persistence**
   - [ ] Reload page
   - [ ] Verify data persists from IndexedDB

#### 3. Why File Upload Testing is Critical

**Lesson Learned**: Page load testing is NOT sufficient because:
- Page load only initializes the UI
- File upload triggers data processing pipelines
- Many functions are ONLY called during file processing
- Example: `renderStats()` is called in `processFiles()`, not just in tab switching

#### 4. Automated Grep Checklist

Before marking refactoring as complete, run these commands:

```bash
# Find all function calls that might be missing
grep -n "render.*(" Production/src/main.js | grep -v "function render"
grep -n "process.*(" Production/src/main.js | grep -v "function process"

# Verify all are either imported or defined locally
```

**Example Checklist for Module Extraction**:
- [ ] Used `grep` to find ALL references to extracted functions
- [ ] Verified ALL references are imported or still defined
- [ ] Tested page load
- [ ] **Tested file upload (ZIP)**
- [ ] **Tested file upload (individual files)**
- [ ] Tested filtering with keywords
- [ ] Checked browser console for errors
- [ ] Verified no regression in existing features

## 5. Documentation (Pre-Coding)
**Mandatory**: specific documentation artifacts must be created *before* coding begins.

- **Implementation Plan**: A markdown file in `docs/plans/` detailing the above points.
- **Interface Definitions**: pseudo-code for new classes or major functions.
- **Test Plan**: A list of test cases to be automated or manually run.

---

## Example Workflow

**Request**: "Add a feature to highlight errors in red."

1.  **Brainstorm**: User wants quick visual identification of 'ERROR' level logs.
2.  **Constraints**: Must be fast; shouldn't slow down scrolling. Must handle thousands of lines.CSS vs JS?
3.  **Roadmap**: 
    1.  Update CSS with `.log-error` class. 
    2.  Update `LogParser` to tag lines with level. 
    3.  Update `VirtualLogView` to apply class.
4.  **Testability**: Unit test parser for 'E' tag detection. Visual check of red lines. 
5.  **Docs**: Update `styles.css` comments, add entry to `feature-list.md`.
