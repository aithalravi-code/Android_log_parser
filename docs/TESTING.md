# Testing Guide

Complete guide for running and writing tests for Android Log Parser.

## Overview

The project uses a **dual testing strategy**:
- **Unit Tests** (Vitest) - Fast, isolated tests for business logic
- **E2E Tests** (Playwright) - Browser-based integration tests

## Running Tests

### All Tests
```bash
npm run test
```
Runs both unit and E2E tests sequentially.

### Unit Tests Only
```bash
npm run test:unit
```
- Framework: Vitest
- Environment: jsdom
- Speed: Fast (~5 seconds)
- Coverage: Business logic, state, utils

### E2E Tests Only
```bash
npm run test:regression
```
- Framework: Playwright
- Browsers: Chromium, Firefox, Safari
- Speed: Slower (~2 minutes)
- Coverage: UI, workflows, integration

### With Coverage
```bash
npm run coverage
```
Generates HTML coverage report in `TestReports/unit/coverage/`.

### Watch Mode
```bash
npm run test:unit -- --watch
```
Re-runs tests on file changes.

## Coverage Reports

### Viewing Reports

**Unit test coverage**:
```bash
npm run test:unit
open TestReports/unit/coverage/index.html
```

**E2E coverage** (if collected):
```bash
node .scripts/analyze-e2e-coverage.js
```

### Current Metrics
- **Functions**: 72.36% ✅
- **Lines**: 40.92% (unit) + ~30% (E2E) = ~70%
- **Statements**: 40.92%
- **Branches**: ~50%

### Thresholds
```javascript
{
    lines: 50,
    functions: 70,
    branches: 50,
    statements: 50
}
```

## Writing Unit Tests

### Test File Structure

```javascript
// TestScripts/unit/myModule.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MyClass } from '../../Production/src/utils/myModule.js'

describe('MyClass', () => {
    let instance
    
    beforeEach(() => {
        instance = new MyClass()
    })
    
    afterEach(() => {
        instance = null
    })
    
    describe('myMethod', () => {
        it('should return correct value', () => {
            const result = instance.myMethod('input')
            expect(result).toBe('expected')
        })
        
        it('should handle edge case', () => {
            const result = instance.myMethod(null)
            expect(result).toBeNull()
        })
    })
})
```

### Testing State

```javascript
import { describe, it, expect } from 'vitest'
import { AppState } from '../../Production/src/core/state/AppState.js'

describe('AppState', () => {
    it('should update and notify subscribers', () => {
        const appState = new AppState()
        let notified = false
        
        appState.subscribe(() => {
            notified = true
        })
        
        appState.filter.setKeywords(['test'])
        
        expect(notified).toBe(true)
        expect(appState.getSnapshot().filter.keywords).toEqual(['test'])
    })
})
```

### Testing Workers

```javascript
import { describe, it, expect } from 'vitest'

describe('Filter Worker', () => {
    it('should filter logs correctly', async () => {
        const { runFilter } = await import(
            '../../Production/src/infra/workers/filter.worker.js'
        )
        
        const lines = [
            { message: 'error occurred' },
            { message: 'success' }
        ]
        const config = { activeKeywords: ['error'] }
        
        const filtered = runFilter(lines, config)
        
        expect(filtered).toHaveLength(1)
    })
})
```

### Mocking

**Mock DOM elements**:
```javascript
beforeEach(() => {
    document.body.innerHTML = `
        <div id="container"></div>
        <input id="input">
    `
})
```

**Mock console**:
```javascript
it('should log message', () => {
    const spy = vi.spyOn(console, 'log')
    
    myFunction()
    
    expect(spy).toHaveBeenCalledWith('expected message')
    spy.mockRestore()
})
```

**Mock fetch**:
```javascript
global.fetch = vi.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({ data: 'test' }),
    })
)
```

## Writing E2E Tests

### Test File Structure

```javascript
// TestScripts/regression/myFeature.spec.js
import { test, expect } from '@playwright/test'

test.describe('My Feature', () => {
    test('should work correctly', async ({ page }) => {
        // Navigate
        await page.goto('/log_parser.html')
        
        // Interact
        await page.locator('#button').click()
        
        // Assert
        await expect(page.locator('#result')).toHaveText('Success')
    })
})
```

### Common Patterns

**File upload**:
```javascript
test('should upload file', async ({ page }) => {
    await page.goto('/log_parser.html')
    
    const fileInput = page.locator('#logFilesInput')
    await fileInput.setInputFiles('TestData/sample.log')
    
    await expect(page.locator('.log-line').first()).toBeVisible()
})
```

**Filtering**:
```javascript
test('should filter by level', async ({ page }) => {
    await page.goto('/log_parser.html')
    
    // Upload file first
    await page.locator('#logFilesInput').setInputFiles('TestData/sample.log')
    await page.waitForSelector('.log-line')
    
    // Toggle error level
    await page.locator('[data-level="E"]').click()
    
    // Verify only errors shown
    const errorLines = await page.locator('.log-line-E').count()
    expect(errorLines).toBeGreaterThan(0)
})
```

**Waiting for elements**:
```javascript
// Wait for selector
await page.waitForSelector('#element', { timeout: 5000 })

// Wait for text
await expect(page.locator('#status')).toHaveText('Ready')

// Custom wait
await page.waitForFunction(() => {
    return window._appState.log.lines.length > 0
})
```

### E2E Coverage Collection

Add coverage hooks to E2E tests:

```javascript
import { startCoverage, stopCoverage, saveCoverage } from '../helpers/coverage.js'

test.beforeEach(async ({ page }) => {
    await startCoverage(page)
})

test.afterEach(async ({ page }, testInfo) => {
    const coverage = await stopCoverage(page)
    await saveCoverage(coverage, testInfo.title)
})
```

## Test Data

### Creating Test Files

**Sample log file**:
```
--------- beginning of system
12-17 16:00:00.000  1000  1000 I TestTag : Info message
12-17 16:00:01.000  1000  1000 E TestTag : Error message
12-17 16:00:02.000  1000  1000 W TestTag : Warning message
```

**BTSnoop sample**:
Place binary `.cfa` files in `TestData/btsnoop/`.

### Test Data Location
```
TestData/
├── logs/           # Sample log files
├── btsnoop/        # BTSnoop captures
├── bugreports/     # ZIP archives
└── expected/       # Expected outputs
```

## Best Practices

### Unit Tests

✅ **DO**:
- Test one thing per test
- Use descriptive test names
- Test edge cases (null, empty, large)
- Mock external dependencies
- Keep tests independent

❌ **DON'T**:
- Test implementation details
- Share state between tests
- Make assertions in `beforeEach`
- Test third-party libraries
- Write flaky tests

### E2E Tests

✅ **DO**:
- Test user workflows
- Use real data when possible
- Wait for elements properly
- Clean up after tests
- Test critical paths

❌ **DON'T**:
- Test every permutation
- Depend on test order
- Use hardcoded waits
- Share page instances
- Test internal functions

## Debugging Tests

### Unit Tests

**Run single test**:
```bash
npm run test:unit -- myModule.test.js
```

**Debug in browser**:
```bash
npm run test:unit -- --ui
```
Opens Vitest UI in browser.

**Inspect failures**:
```javascript
it('should work', () => {
    console.log('Debug value:', value)
    expect(value).toBe(expected)
})
```

### E2E Tests

**Run headed mode** (see browser):
```bash
npx playwright test --headed
```

**Debug mode**:
```bash
npx playwright test --debug
```
Opens Playwright Inspector.

**Single test**:
```bash
npx playwright test myFeature.spec.js
```

**Screenshots on failure**:
Screenshots automatically saved to `.config/TestReports/regression/artifacts/`.

**Video recording**:
Videos saved on failure (enabled by default).

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run test:unit
      - run: npx playwright install --with-deps
      - run: npm run test:regression
      
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: TestReports/
```

## Coverage Goals

### Per Module
- **State management**: 100%
- **Utils**: 100%
- **Workers**: 80%+
- **UI tabs**: 60%+ (E2E covers rest)
- **Main.js**: Excluded (pure UI setup)

### Overall
- **Functions**: ≥70% (required)
- **Lines**: ≥50% (goal)
- **Statements**: ≥50% (goal)

## Troubleshooting

### Tests Timing Out
- Increase timeout in test file
- Check for async issues
- Verify selectors are correct

### Flaky E2E Tests
- Add explicit waits
- Don't use `waitForTimeout`
- Check for race conditions

### Coverage Not Updating
```bash
rm -rf TestReports/
npm run coverage
```

### Worker Tests Failing
- Ensure worker has no imports from main thread
- Check worker file syntax
- Verify message format

## Performance Testing

### Benchmark Example

```javascript
test('should parse quickly', () => {
    const start = performance.now()
    
    parseLogs(largeLogArray)
    
    const duration = performance.now() - start
    expect(duration).toBeLessThan(1000) // 1 second
})
```

### Load Testing

```javascript
test('should handle large file', async ({ page }) => {
    const lines = Array(100000).fill('12-17 16:00:00.000 1000 1000 I Tag : Message')
    const file = lines.join('\n')
    
    await page.locator('#logFilesInput').setInputFiles({
        name: 'large.log',
        mimeType: 'text/plain',
        buffer: Buffer.from(file)
    })
    
    await expect(page.locator('.log-line').first()).toBeVisible({ timeout: 30000 })
})
```

---

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).
For contributing, see [CONTRIBUTING.md](../CONTRIBUTING.md).
