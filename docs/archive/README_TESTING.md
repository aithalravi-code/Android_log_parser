# 🧪 Automated Testing Framework - Complete Guide

![Testing Architecture](/.gemini/antigravity/brain/39fb38ad-46e7-46c1-9b0b-27da5a63c167/testing_architecture_diagram_1765080655128.png)

---

## 📚 Documentation Index

This testing framework includes comprehensive documentation:

1. **[TESTING_SUMMARY.md](./TESTING_SUMMARY.md)** - Executive summary and overview
2. **[TESTING_PLAN.md](./TESTING_PLAN.md)** - Detailed 6-week implementation plan
3. **[TESTING_QUICKSTART.md](./TESTING_QUICKSTART.md)** - Quick start guide
4. **This file** - Complete reference guide

---

## 🎯 What This Framework Provides

### ✅ Automated Testing
- **Unit Tests** - Test individual functions and modules
- **Integration Tests** - Test component interactions
- **E2E Tests** - Test complete user workflows
- **Performance Tests** - Benchmark critical operations

### ✅ Performance Monitoring
- **Real-time Tracking** - Monitor execution times
- **Memory Profiling** - Track heap usage
- **Statistical Analysis** - P50, P90, P95, P99 metrics
- **Automated Reporting** - Export to JSON/CSV

### ✅ Continuous Improvement
- **Baseline Tracking** - Compare against benchmarks
- **Regression Detection** - Alert on performance degradation
- **Trend Analysis** - Track improvements over time
- **CI/CD Integration** - Automated testing pipeline

---

## 🚀 Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
cd "/home/rk/Documents/Android_log_parser (copy)"

# Install all testing dependencies
npm install

# Install Playwright browsers
npm run install:browsers
```

### 2. Run Your First Test

```bash
# Run all tests
npm test

# Or run specific test suites
npm run test:unit      # Unit tests only
npm run test:e2e       # E2E tests only
```

### 3. View Results

```bash
# View coverage report
npm run coverage

# View Playwright report
npm run report:playwright
```

---

## 📁 Project Structure

```
/home/rk/Documents/Android_log_parser (copy)/
│
├── 📄 Documentation
│   ├── TESTING_SUMMARY.md          # Executive summary
│   ├── TESTING_PLAN.md             # Implementation plan
│   ├── TESTING_QUICKSTART.md       # Quick start guide
│   └── README_TESTING.md           # This file
│
├── 🧪 Tests
│   ├── tests/
│   │   ├── unit/                   # Unit tests
│   │   │   └── parsers.test.js     # Sample unit tests
│   │   ├── integration/            # Integration tests
│   │   ├── e2e/                    # End-to-end tests
│   │   │   └── file-upload.spec.js # Sample E2E tests
│   │   ├── performance/            # Performance tests
│   │   └── setup.js                # Test configuration
│   │
│   └── test-data/
│       ├── sample-logs/            # Test log files
│       └── expected-outputs/       # Expected results
│
├── ⚙️ Configuration
│   ├── vitest.config.js            # Vitest configuration
│   ├── playwright.config.js        # Playwright configuration
│   └── package.json                # Dependencies & scripts
│
├── 📊 Performance Monitoring
│   └── performance-tracker.js      # Performance tracker module
│
└── 🔧 Utilities
    └── scripts/                    # Helper scripts
```

---

## 🛠 Testing Tools

### 1. Vitest (Unit & Integration Tests)

**Why Vitest?**
- ⚡ Extremely fast execution
- 🔄 Native ESM support
- 📊 Built-in coverage reporting
- 🎨 Interactive UI mode
- 🔧 Jest-compatible API

**Key Features:**
```javascript
// Example unit test
import { describe, it, expect } from 'vitest';

describe('Log Parser', () => {
  it('should parse valid log lines', () => {
    const result = parseLogLine('12-07 09:30:15.123  1234  5678 I Tag: Message');
    expect(result.level).toBe('I');
  });
});
```

**Commands:**
```bash
npm run test:unit          # Run unit tests
npm run test:unit:watch    # Watch mode
npm run test:unit:ui       # Interactive UI
npm run coverage           # Generate coverage report
```

---

### 2. Playwright (E2E Tests)

**Why Playwright?**
- 🌐 Cross-browser testing (Chrome, Firefox, Safari)
- 🎬 Video recording of failures
- 📸 Screenshot on error
- 🔍 Powerful debugging tools
- ⚡ Parallel execution

**Key Features:**
```javascript
// Example E2E test
import { test, expect } from '@playwright/test';

test('should upload log file', async ({ page }) => {
  await page.goto('file:///path/to/index.html');
  await page.setInputFiles('#file-input', 'test.log');
  await expect(page.locator('.log-line')).toBeVisible();
});
```

**Commands:**
```bash
npm run test:e2e           # Run E2E tests
npm run test:e2e:ui        # Interactive mode
npm run test:e2e:headed    # See browser
npm run test:e2e:debug     # Debug mode
```

---

### 3. Performance Tracker (Custom Solution)

**Why Custom Tracker?**
- 🎯 Tailored to your needs
- 📦 No external dependencies
- 🔧 Full control over metrics
- 📊 Rich statistical analysis

**Key Features:**
```javascript
// Example usage
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
```

**Console Commands:**
```javascript
// In browser console
window.perfTracker.getCurrentStats()
window.perfTracker.getSummary()
window.perfTracker.exportToJSON()
window.perfTracker.enableAutoExport(300000) // Every 5 min
```

---

## 📊 Performance Monitoring

### Metrics Tracked

| Category | Metrics | Threshold |
|----------|---------|-----------|
| **File Loading** | Time to parse, Memory usage | <5s for 100MB |
| **Filtering** | Filter execution time | <1s for 1M lines |
| **Rendering** | Virtual scroll performance | <500ms |
| **Export** | Excel generation time | <3s |
| **Worker Comm** | Message passing latency | <100ms |
| **DB Operations** | IndexedDB read/write | <200ms |

### Statistical Analysis

The performance tracker provides:
- **Average** - Mean execution time
- **Min/Max** - Best and worst case
- **Percentiles** - P50, P90, P95, P99
- **Memory** - Heap usage tracking
- **Trends** - Historical comparison

### Automated Reporting

```javascript
// Enable auto-export every 5 minutes
perfTracker.enableAutoExport(300000);

// Manual export
perfTracker.exportToJSON();  // JSON format
perfTracker.exportToCSV();   // CSV format

// Console summary
console.log(perfTracker.getSummary());
```

---

## 🧪 Writing Tests

### Unit Test Template

```javascript
// tests/unit/my-feature.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from '../../main.js';

describe('My Feature', () => {
  let testData;

  beforeEach(() => {
    // Setup before each test
    testData = createTestData();
  });

  it('should handle valid input', () => {
    const result = myFunction(testData);
    expect(result).toBeDefined();
    expect(result.status).toBe('success');
  });

  it('should handle invalid input', () => {
    const result = myFunction(null);
    expect(result).toBeNull();
  });

  it('should meet performance requirements', () => {
    const start = performance.now();
    myFunction(testData);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // 100ms threshold
  });
});
```

### E2E Test Template

```javascript
// tests/e2e/my-workflow.spec.js
import { test, expect } from '@playwright/test';

test.describe('My Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('file:///path/to/index.html');
  });

  test('should complete workflow successfully', async ({ page }) => {
    // Step 1: Upload file
    await page.setInputFiles('#file-input', 'test-data/sample.log');
    
    // Step 2: Wait for processing
    await page.waitForSelector('.log-line', { timeout: 10000 });
    
    // Step 3: Apply filter
    await page.fill('#searchInput', 'ERROR');
    await page.press('#searchInput', 'Enter');
    
    // Step 4: Verify results
    const errorLogs = await page.locator('.log-line-E').count();
    expect(errorLogs).toBeGreaterThan(0);
    
    // Step 5: Export
    await page.click('#exportBtn');
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('.xlsx');
  });
});
```

### Performance Test Template

```javascript
// tests/performance/my-operation.perf.js
import { test, expect } from '@playwright/test';

test('should complete operation within threshold', async ({ page }) => {
  await page.goto('file:///path/to/index.html');
  
  // Measure operation time
  const startTime = Date.now();
  
  // Perform operation
  await page.setInputFiles('#file-input', 'test-data/large.log');
  await page.waitForSelector('.log-line');
  
  const duration = Date.now() - startTime;
  
  // Assert performance
  expect(duration).toBeLessThan(5000); // 5 second threshold
  
  console.log(`✅ Operation completed in ${duration}ms`);
});
```

---

## 📈 Continuous Integration

### GitHub Actions Setup

Create `.github/workflows/test.yml`:

```yaml
name: Automated Testing

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npm run install:browsers
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
      
      - name: Upload test reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: |
            coverage/
            playwright-report/
            test-results/
```

---

## 🎯 Best Practices

### 1. Test Organization
```
✅ DO: Group related tests with describe()
✅ DO: Use descriptive test names
✅ DO: Keep tests independent
✅ DO: Use beforeEach() for setup

❌ DON'T: Share state between tests
❌ DON'T: Test implementation details
❌ DON'T: Write flaky tests
```

### 2. Test Naming
```javascript
// ✅ Good
it('should parse valid Android log line')
it('should return null for invalid input')
it('should filter logs by level correctly')

// ❌ Bad
it('test1')
it('parsing')
it('works')
```

### 3. Performance Testing
```javascript
// ✅ Good - Set realistic thresholds
expect(duration).toBeLessThan(1000); // 1 second

// ✅ Good - Test with production-like data
const largeLogs = generateLogs(100000);

// ❌ Bad - Unrealistic threshold
expect(duration).toBeLessThan(1); // 1ms is too strict
```

### 4. E2E Testing
```javascript
// ✅ Good - Use data-testid
await page.click('[data-testid="submit-button"]');

// ✅ Good - Wait for conditions
await page.waitForSelector('.result', { state: 'visible' });

// ❌ Bad - Fragile selectors
await page.click('body > div > div > button:nth-child(3)');

// ❌ Bad - Arbitrary waits
await page.waitForTimeout(5000);
```

---

## 🐛 Debugging

### Debug Unit Tests

```bash
# Run specific test file
npx vitest run tests/unit/parsers.test.js

# Run in watch mode
npm run test:unit:watch

# Run with UI
npm run test:unit:ui

# Run with coverage
npm run coverage
```

### Debug E2E Tests

```bash
# Run in headed mode (see browser)
npm run test:e2e:headed

# Run in debug mode (step through)
npm run test:e2e:debug

# Run specific test
npx playwright test tests/e2e/file-upload.spec.js

# Generate trace
npx playwright test --trace on
```

### Debug Performance Issues

```javascript
// Add detailed logging
const id = perfTracker.startMeasure('operation', 'category');
console.time('operation');

// Your code here
console.log('Step 1 complete');
// More code
console.log('Step 2 complete');

console.timeEnd('operation');
perfTracker.endMeasure(id);

// View detailed report
console.log(perfTracker.getReport());
```

---

## 📊 Reporting

### Test Reports

**Vitest Coverage Report:**
```bash
npm run coverage
# Opens: coverage/index.html
```

**Playwright HTML Report:**
```bash
npm run report:playwright
# Opens: playwright-report/index.html
```

**Allure Report:**
```bash
npm run report:allure
# Opens: allure-report/index.html
```

### Performance Reports

**JSON Export:**
```javascript
perfTracker.exportToJSON();
// Downloads: performance-report-YYYY-MM-DD.json
```

**CSV Export:**
```javascript
perfTracker.exportToCSV();
// Downloads: performance-report-YYYY-MM-DD.csv
```

**Console Summary:**
```javascript
console.log(perfTracker.getSummary());
```

---

## 🔧 Configuration

### Vitest Configuration

Edit `vitest.config.js`:

```javascript
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 70,      // Adjust as needed
        functions: 70,
        branches: 65,
        statements: 70
      }
    },
    testTimeout: 10000,  // Adjust timeout
    threads: true,       // Parallel execution
    maxThreads: 4        // Number of threads
  }
});
```

### Playwright Configuration

Edit `playwright.config.js`:

```javascript
export default defineConfig({
  timeout: 30000,        // Test timeout
  retries: 2,            // Retry failed tests
  workers: 4,            // Parallel workers
  
  use: {
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry'
  }
});
```

---

## 🆘 Troubleshooting

### Common Issues

**Issue: Tests fail with "Worker is not defined"**
```javascript
// Solution: Add to tests/setup.js
global.Worker = class MockWorker {
  constructor() {}
  postMessage() {}
  terminate() {}
};
```

**Issue: E2E tests timeout**
```javascript
// Solution: Increase timeout
test.setTimeout(60000); // 60 seconds
```

**Issue: Coverage reports not generated**
```bash
# Solution: Install coverage provider
npm install --save-dev @vitest/coverage-v8
```

**Issue: Playwright browsers not found**
```bash
# Solution: Reinstall browsers
npm run install:browsers
```

---

## 📚 Additional Resources

### Official Documentation
- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

### Performance Optimization
- [Web.dev Performance](https://web.dev/performance/)
- [MDN Performance](https://developer.mozilla.org/en-US/docs/Web/Performance)

### CI/CD Integration
- [GitHub Actions](https://docs.github.com/en/actions)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

---

## 🎉 Success Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Browsers installed (`npm run install:browsers`)
- [ ] Unit tests passing (`npm run test:unit`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] Coverage >70% (`npm run coverage`)
- [ ] Performance tracker integrated
- [ ] CI/CD pipeline configured
- [ ] Documentation reviewed

---

## 🚀 Next Steps

1. **Start Testing**
   ```bash
   npm test
   ```

2. **Add Your Tests**
   - Create test files in `tests/unit/`
   - Create E2E scenarios in `tests/e2e/`

3. **Monitor Performance**
   - Integrate performance tracker
   - Set up auto-export
   - Review metrics regularly

4. **Continuous Improvement**
   - Track trends over time
   - Optimize bottlenecks
   - Celebrate improvements!

---

**Questions? Check:**
- [TESTING_QUICKSTART.md](./TESTING_QUICKSTART.md) - Quick reference
- [TESTING_PLAN.md](./TESTING_PLAN.md) - Detailed plan
- [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) - Executive summary

---

*Last Updated: 2025-12-07*  
*Version: 1.0*  
*Status: Production Ready* ✅
