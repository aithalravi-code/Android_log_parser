# Comprehensive E2E Test Suite

This directory contains a comprehensive end-to-end test suite for the Android Log Parser application, covering all major features, user workflows, performance benchmarks, and edge cases.

## 📋 Test Coverage

### Core Workflow Tests
- **complete_workflows.spec.js** - Complete user journeys from upload to export
  - File upload workflows (single and multi-file)
  - Filter → Export workflows
  - State persistence across reloads
  - Multi-tab navigation
  - Clear state functionality

### Feature-Specific Tests

#### Log Filtering
- **log_filtering_advanced.spec.js** - Comprehensive filtering functionality
  - Log level filtering (single and multiple)
  - Keyword search (AND/OR logic)
  - Time range filtering
  - Combined filters
  - Case-insensitive search
  - Special character handling

#### Performance
- **performance_comprehensive.spec.js** - Performance benchmarks
  - Page load time (< 3s)
  - File parsing (10MB in < 30s, 50MB in < 60s)
  - Filter performance (< 500ms for 100k+ logs)
  - Tab switching (< 300ms)
  - Virtual scroll performance
  - Memory usage monitoring
  - Concurrent operations

#### Error Handling
- **error_handling.spec.js** - Error scenarios and edge cases
  - Empty file handling
  - Malformed log lines
  - Very long lines (> 10KB)
  - Special characters and XSS prevention
  - Invalid filter inputs
  - Corrupted UTF-8 sequences
  - Browser navigation handling

#### State Management
- **state_persistence.spec.js** - IndexedDB and state persistence
  - Data restoration after reload
  - Active tab persistence
  - Multi-session handling
  - Large dataset persistence
  - Concurrent tab data sharing
  - Corrupted DB handling

#### Accessibility
- **accessibility_comprehensive.spec.js** - Accessibility compliance
  - Keyboard navigation
  - Tab order and focus management
  - ARIA attributes
  - Focus indicators
  - Button accessible names
  - Form label associations
  - Color contrast
  - Heading hierarchy

#### Integration
- **integration_comprehensive.spec.js** - Complex multi-feature workflows
  - Real-world bugreport analysis
  - Multi-file analysis
  - Complex filter combinations
  - Concurrent operations
  - Export workflows
  - Cross-feature integration
  - Data integrity verification

## 🛠️ Test Utilities

### Test Data Generator (`helpers/test-data-generator.js`)
Programmatically generate mock test data:
- `generateMockLogFile(lineCount, options)` - Create mock logcat files
- `generateMockBTSnoopFile(packetCount)` - Create mock BTSnoop data
- `generateMockCCCLogs(messageCount)` - Create mock CCC messages
- `generateMockConnectivityLogs(lineCount)` - Create connectivity logs
- `generateLargeMockLogFile(sizeInMB)` - Create large files for performance testing

### Test Utilities (`helpers/test-utils.js`)
Common helper functions:
- `uploadFile(page, filePath)` - Upload file and wait for processing
- `clearAppState(page)` - Clear IndexedDB and reset app
- `applyFilters(page, filters)` - Apply filter configuration
- `switchTab(page, tabName)` - Switch tabs and wait for render
- `getLogCount(page)` - Get total log line count
- `getFilteredLogCount(page)` - Get filtered log count
- `measurePerformance(page, action)` - Measure action duration
- `getMemoryUsage(page)` - Get memory usage stats
- `scrollVirtualList(page, selector, position)` - Scroll virtual list

## 🚀 Running Tests

### Run All Tests
```bash
npm run test:regression
```

### Run Specific Test File
```bash
npx playwright test TestScripts/regression/complete_workflows.spec.js
```

### Run with UI Mode (for debugging)
```bash
npx playwright test --ui
```

### Run on Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run Tests in Headed Mode
```bash
npx playwright test --headed
```

### Run with Debug Mode
```bash
npx playwright test --debug
```

## 📊 Test Reports

After running tests, reports are generated in:
- **HTML Report**: `TestReports/regression/playwright-report/`
- **JSON Results**: `TestReports/regression/e2e-results.json`
- **JUnit XML**: `TestReports/regression/e2e-results.xml`
- **Allure Results**: `TestReports/regression/allure-results/`

### View HTML Report
```bash
npx playwright show-report TestReports/regression/playwright-report
```

## 📈 Performance Benchmarks

The test suite includes specific performance benchmarks:

| Metric | Target | Test File |
|--------|--------|-----------|
| Page load | < 3s | performance_comprehensive.spec.js |
| Parse 10MB file | < 30s | performance_comprehensive.spec.js |
| Parse 50MB file | < 60s | performance_comprehensive.spec.js |
| Filter 100k+ logs | < 500ms | performance_comprehensive.spec.js |
| Tab switching | < 300ms | performance_comprehensive.spec.js |
| Memory usage | < 500MB | performance_comprehensive.spec.js |

## 🧪 Test Data

Tests use a combination of:
1. **Generated mock data** - Created programmatically via test-data-generator.js
2. **Fixture files** - Real test files in `TestData/fixtures/`
3. **Temporary files** - Created in `temp/` directory during test execution

## 🔍 Debugging Tests

### Enable Verbose Logging
```bash
DEBUG=pw:api npx playwright test
```

### Take Screenshots on Failure
Screenshots are automatically captured on test failure and saved to `TestReports/regression/artifacts/`

### Record Video
Videos are recorded for failed tests and saved to `TestReports/regression/artifacts/`

### Use Playwright Inspector
```bash
npx playwright test --debug
```

## ✅ Test Best Practices

1. **Isolation** - Each test is independent and cleans up after itself
2. **Timeouts** - Appropriate timeouts set for long-running operations
3. **Waiting** - Proper waits for async operations (no arbitrary timeouts)
4. **Assertions** - Clear, descriptive assertions with helpful messages
5. **Cleanup** - Temporary files and state cleaned up in afterEach/afterAll
6. **Parallelization** - Tests can run in parallel safely

## 🐛 Common Issues

### Tests Timing Out
- Increase timeout for specific tests: `test.setTimeout(60000)`
- Check if dev server is running on port 5173
- Verify test data files exist

### Flaky Tests
- Check for race conditions in async operations
- Ensure proper waiting for elements/state
- Verify test isolation (no shared state)

### File Upload Issues
- Ensure file paths are absolute
- Check file exists before upload
- Verify temp directory has write permissions

## 📝 Adding New Tests

1. Create new `.spec.js` file in `TestScripts/regression/`
2. Import required utilities from `helpers/`
3. Follow existing test patterns
4. Add appropriate timeouts for long operations
5. Clean up test data in afterEach/afterAll
6. Run tests locally before committing

Example:
```javascript
import { test, expect } from '@playwright/test';
import { uploadFile, clearAppState } from '../helpers/test-utils.js';

test.describe('My New Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/log_parser.html');
        await clearAppState(page);
    });

    test('should do something', async ({ page }) => {
        // Your test code here
    });
});
```

## 🎯 Coverage Goals

- **Feature Coverage**: 100% of major features
- **User Workflows**: All common user journeys
- **Browser Coverage**: Chromium, Firefox, WebKit
- **Error Scenarios**: All critical error paths
- **Performance**: All key performance metrics

## 📚 Related Documentation

- [Playwright Documentation](https://playwright.dev/)
- [Testing Guide](../../docs/TESTING.md)
- [Contributing Guide](../../CONTRIBUTING.md)

---

**Total Test Files**: 8 comprehensive test suites
**Total Test Cases**: 150+ individual tests
**Estimated Run Time**: 10-15 minutes (all browsers, parallel execution)
