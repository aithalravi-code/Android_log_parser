# Automated Testing - Quick Start Guide

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd "/home/rk/Documents/Android_log_parser (copy)"

# Initialize npm (if package.json doesn't exist yet)
npm install

# Install Playwright browsers
npm run install:browsers
```

### 2. Run Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run unit tests in watch mode (for development)
npm run test:unit:watch

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI (interactive mode)
npm run test:e2e:ui

# Run performance tests
npm run test:perf
```

### 3. View Reports

```bash
# View test coverage report
npm run coverage

# View Playwright HTML report
npm run report:playwright

# Generate and view Allure report
npm run report:allure
```

---

## 📁 Project Structure

```
/home/rk/Documents/Android_log_parser (copy)/
├── tests/
│   ├── unit/              # Unit tests
│   │   └── parsers.test.js
│   ├── integration/       # Integration tests
│   ├── e2e/              # End-to-end tests
│   │   └── file-upload.spec.js
│   ├── performance/      # Performance tests
│   └── setup.js          # Test configuration
├── test-data/
│   ├── sample-logs/      # Test log files
│   └── expected-outputs/ # Expected results
├── performance-tracker.js # Performance monitoring
├── vitest.config.js      # Vitest configuration
├── playwright.config.js  # Playwright configuration
└── package.json          # Dependencies and scripts
```

---

## 🧪 Writing Tests

### Unit Test Example

```javascript
// tests/unit/my-feature.test.js
import { describe, it, expect } from 'vitest';

describe('My Feature', () => {
  it('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expectedValue);
  });
});
```

### E2E Test Example

```javascript
// tests/e2e/my-workflow.spec.js
import { test, expect } from '@playwright/test';

test('should complete workflow', async ({ page }) => {
  await page.goto('file:///path/to/index.html');
  await page.click('#myButton');
  await expect(page.locator('#result')).toBeVisible();
});
```

---

## 📊 Performance Monitoring

### Using the Performance Tracker

```javascript
// In your code (main.js)
import { perfTracker } from './performance-tracker.js';

// Start measuring
const id = perfTracker.startMeasure('parseFile', 'fileLoad', {
  fileSize: file.size
});

// Do work...
await parseFile(file);

// End measuring
perfTracker.endMeasure(id, {
  linesProcessed: result.length
});

// Export report
perfTracker.exportToJSON();

// View summary in console
console.log(perfTracker.getSummary());
```

### Console Commands

Open browser console and use:

```javascript
// View current stats
window.perfTracker.getCurrentStats()

// Get detailed report
window.perfTracker.getReport()

// Export to JSON
window.perfTracker.exportToJSON()

// Export to CSV
window.perfTracker.exportToCSV()

// Enable auto-export every 5 minutes
window.perfTracker.enableAutoExport(300000)

// Reset all metrics
window.perfTracker.reset()
```

---

## 🔧 Configuration

### Vitest (Unit Tests)

Edit `vitest.config.js` to customize:
- Test environment
- Coverage thresholds
- Test patterns
- Reporters

### Playwright (E2E Tests)

Edit `playwright.config.js` to customize:
- Browsers to test
- Viewport sizes
- Timeouts
- Screenshots/videos
- Parallel execution

---

## 📈 Continuous Integration

### GitHub Actions

Create `.github/workflows/test.yml`:

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
      - run: npm ci
      - run: npm run install:browsers
      - run: npm test
      - uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: |
            coverage/
            playwright-report/
            test-results/
```

---

## 🎯 Best Practices

### 1. Test Naming
- Use descriptive names: `should parse valid log line`
- Follow pattern: `should [expected behavior] when [condition]`

### 2. Test Organization
- One test file per source file
- Group related tests with `describe()`
- Use `beforeEach()` for setup

### 3. Performance Testing
- Set realistic thresholds
- Test with production-like data
- Monitor trends over time

### 4. E2E Testing
- Test critical user paths first
- Use data-testid attributes for stable selectors
- Keep tests independent

---

## 🐛 Debugging

### Debug Unit Tests

```bash
# Run specific test file
npx vitest run tests/unit/parsers.test.js

# Run in watch mode with UI
npm run test:unit:ui
```

### Debug E2E Tests

```bash
# Run in headed mode (see browser)
npm run test:e2e:headed

# Run in debug mode (step through)
npm run test:e2e:debug

# Run specific test
npx playwright test tests/e2e/file-upload.spec.js
```

### Debug Performance Issues

```javascript
// Add detailed logging
const id = perfTracker.startMeasure('operation', 'category');
console.time('operation');

// Your code here

console.timeEnd('operation');
perfTracker.endMeasure(id);
```

---

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Performance Monitoring Guide](https://web.dev/performance/)

---

## 🆘 Common Issues

### Issue: Tests fail with "Worker is not defined"
**Solution**: Check that `tests/setup.js` is properly configured with Worker mock

### Issue: E2E tests timeout
**Solution**: Increase timeout in `playwright.config.js` or use `test.setTimeout(60000)`

### Issue: Coverage reports not generated
**Solution**: Ensure `@vitest/coverage-v8` is installed: `npm install --save-dev @vitest/coverage-v8`

### Issue: Performance tracker not available
**Solution**: Import it in your HTML: `<script type="module" src="performance-tracker.js"></script>`

---

## 🎉 Next Steps

1. ✅ Install dependencies
2. ✅ Run existing tests
3. ✅ Add tests for new features
4. ✅ Set up CI/CD pipeline
5. ✅ Monitor performance metrics
6. ✅ Iterate and improve

---

*Last Updated: 2025-12-07*
