# Automated Testing & Performance Monitoring Plan
## Android Log Parser Project

---

## 📋 Executive Summary

This document outlines a comprehensive automated testing strategy for the Android Log Parser project, including:
- **Unit Testing** for core parsing logic
- **Integration Testing** for worker communication and IndexedDB operations
- **End-to-End (E2E) Testing** for user workflows
- **Performance Monitoring** with execution time tracking
- **Continuous Improvement** through automated reporting

---

## 🎯 Testing Objectives

1. **Reliability**: Ensure all parsing logic handles edge cases correctly
2. **Performance**: Track and optimize execution times for large log files
3. **Regression Prevention**: Catch breaking changes before deployment
4. **User Experience**: Validate critical user workflows work seamlessly
5. **Continuous Improvement**: Build a feedback loop for performance optimization

---

## 🛠 Recommended Testing Stack

### 1. **Unit & Integration Testing: Vitest**
- **Why Vitest over Jest**: 
  - Native ESM support (modern JavaScript)
  - Faster execution with Vite's transformation pipeline
  - Built-in TypeScript support
  - Compatible with Jest API (easy migration path)
  - Better performance for large test suites

### 2. **E2E Testing: Playwright**
- **Why Playwright over Cypress**:
  - True cross-browser testing (Chromium, Firefox, WebKit)
  - Better handling of Web Workers and IndexedDB
  - Built-in parallel execution
  - Powerful debugging tools (Trace Viewer, Codegen)
  - Native support for file uploads and downloads
  - More suitable for complex web applications

### 3. **Performance Monitoring: Custom Solution + Lighthouse CI**
- **Custom Performance Tracker**: 
  - Extend existing `TimeTracker` in main.js
  - Export metrics to JSON for analysis
- **Lighthouse CI**: 
  - Automated performance audits
  - Track Core Web Vitals over time
  - Integration with CI/CD pipelines

### 4. **Reporting: Allure Report + Custom Dashboard**
- **Allure**: Industry-standard test reporting
- **Custom Dashboard**: Real-time performance metrics visualization

---

## 📦 Implementation Phases

### **Phase 1: Foundation Setup** (Week 1)

#### 1.1 Install Testing Dependencies
```bash
npm init -y  # Initialize package.json if not exists
npm install --save-dev vitest @vitest/ui
npm install --save-dev @playwright/test
npm install --save-dev @lighthouse-ci/cli
npm install --save-dev allure-commandline allure-playwright
```

#### 1.2 Project Structure
```
/home/rk/Documents/Android_log_parser (copy)/
├── tests/
│   ├── unit/
│   │   ├── parsers.test.js          # Log parsing logic
│   │   ├── filters.test.js          # Filter algorithms
│   │   ├── btsnoop.test.js          # BTSnoop parsing
│   │   └── ccc-decoder.test.js      # CCC protocol decoding
│   ├── integration/
│   │   ├── worker.test.js           # Web Worker communication
│   │   ├── indexeddb.test.js        # Database operations
│   │   └── virtual-scroll.test.js   # Virtual scrolling logic
│   ├── e2e/
│   │   ├── file-upload.spec.js      # File upload workflows
│   │   ├── filtering.spec.js        # Filter interactions
│   │   ├── tab-navigation.spec.js   # Tab switching
│   │   └── export.spec.js           # Excel export functionality
│   └── performance/
│       ├── large-file.perf.js       # Large file benchmarks
│       └── filter-speed.perf.js     # Filter performance tests
├── test-data/
│   ├── sample-logs/
│   │   ├── small.log                # ~1MB test file
│   │   ├── medium.log               # ~50MB test file
│   │   └── large.log                # ~200MB test file
│   └── expected-outputs/
│       └── parsed-results.json      # Expected parsing results
├── vitest.config.js
├── playwright.config.js
└── performance-tracker.js           # Enhanced performance monitoring
```

---

### **Phase 2: Unit Testing** (Week 2)

#### 2.1 Extract Testable Functions
Refactor `main.js` to export core functions:

```javascript
// Example: Extract log parsing logic
export function parseLogLine(line) {
    // Existing parsing logic
    const match = line.match(/^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.+?):\s+(.*)$/);
    if (!match) return null;
    
    return {
        timestamp: match[1],
        pid: match[2],
        tid: match[3],
        level: match[4],
        tag: match[5],
        message: match[6]
    };
}

export function filterLogsByLevel(logs, activeLevels) {
    return logs.filter(log => activeLevels.has(log.level));
}
```

#### 2.2 Sample Unit Test
```javascript
// tests/unit/parsers.test.js
import { describe, it, expect } from 'vitest';
import { parseLogLine, filterLogsByLevel } from '../../main.js';

describe('Log Parsing', () => {
    it('should parse a valid Android log line', () => {
        const line = '12-07 09:30:15.123  1234  5678 I MyTag: Test message';
        const result = parseLogLine(line);
        
        expect(result).toEqual({
            timestamp: '12-07 09:30:15.123',
            pid: '1234',
            tid: '5678',
            level: 'I',
            tag: 'MyTag',
            message: 'Test message'
        });
    });

    it('should return null for invalid log lines', () => {
        const result = parseLogLine('Invalid log line');
        expect(result).toBeNull();
    });

    it('should filter logs by level correctly', () => {
        const logs = [
            { level: 'E', message: 'Error' },
            { level: 'W', message: 'Warning' },
            { level: 'I', message: 'Info' }
        ];
        const filtered = filterLogsByLevel(logs, new Set(['E', 'W']));
        
        expect(filtered).toHaveLength(2);
        expect(filtered[0].level).toBe('E');
    });
});
```

---

### **Phase 3: Integration Testing** (Week 3)

#### 3.1 Web Worker Testing
```javascript
// tests/integration/worker.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Filter Worker', () => {
    let worker;

    beforeEach(() => {
        // Create worker from blob (same as main.js)
        const workerCode = `/* worker code */`;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        worker = new Worker(URL.createObjectURL(blob));
    });

    afterEach(() => {
        worker.terminate();
    });

    it('should filter logs based on keywords', async () => {
        const testLogs = [
            { originalText: 'Bluetooth connection established' },
            { originalText: 'WiFi scan completed' }
        ];

        const result = await new Promise((resolve) => {
            worker.postMessage({
                command: 'LOAD_DATA',
                payload: testLogs
            });

            worker.postMessage({
                command: 'FILTER',
                jobId: 1,
                payload: {
                    activeKeywords: ['Bluetooth'],
                    isAndLogic: false,
                    liveSearchQuery: '',
                    activeLogLevels: ['I'],
                    timeRange: {},
                    collapsedFileHeaders: [],
                    isTimeFilterActive: false
                }
            });

            worker.onmessage = (e) => {
                if (e.data.command === 'FILTER_COMPLETE') {
                    resolve(e.data.indices);
                }
            };
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(0);
    });
});
```

#### 3.2 IndexedDB Testing
```javascript
// tests/integration/indexeddb.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto'; // Mock IndexedDB for testing

describe('IndexedDB Operations', () => {
    beforeEach(async () => {
        // Clear database before each test
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
            indexedDB.deleteDatabase(db.name);
        }
    });

    it('should save and retrieve log data', async () => {
        const testData = { key: 'testKey', value: 'testValue' };
        
        // Assuming saveData and loadData are exported
        await saveData(testData.key, testData.value);
        const result = await loadData(testData.key);
        
        expect(result.value).toBe(testData.value);
    });
});
```

---

### **Phase 4: E2E Testing** (Week 4)

#### 4.1 File Upload Test
```javascript
// tests/e2e/file-upload.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('File Upload Workflow', () => {
    test('should upload and parse a log file', async ({ page }) => {
        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');

        // Upload test file
        const fileInput = page.locator('#file-input');
        await fileInput.setInputFiles(path.join(__dirname, '../test-data/sample-logs/small.log'));

        // Wait for processing
        await page.waitForSelector('#logContainer .log-line', { timeout: 10000 });

        // Verify logs are displayed
        const logLines = await page.locator('#logContainer .log-line').count();
        expect(logLines).toBeGreaterThan(0);

        // Verify file name is displayed
        const fileName = await page.locator('#current-file-display').textContent();
        expect(fileName).toContain('small.log');
    });

    test('should handle ZIP file upload', async ({ page }) => {
        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');

        const zipInput = page.locator('#zipInput');
        await zipInput.setInputFiles(path.join(__dirname, '../test-data/bugreport-test.zip'));

        // Wait for modal to appear
        await page.waitForSelector('#zipModal', { state: 'visible' });

        // Select files and load
        await page.click('#toggleAllFiles');
        await page.click('#loadSelectedBtn');

        // Wait for processing
        await page.waitForSelector('#logContainer .log-line', { timeout: 15000 });

        const logLines = await page.locator('#logContainer .log-line').count();
        expect(logLines).toBeGreaterThan(0);
    });
});
```

#### 4.2 Filtering Test
```javascript
// tests/e2e/filtering.spec.js
import { test, expect } from '@playwright/test';

test.describe('Log Filtering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');
        // Load test data
        await page.locator('#file-input').setInputFiles('./test-data/sample-logs/medium.log');
        await page.waitForSelector('#logContainer .log-line');
    });

    test('should filter by log level', async ({ page }) => {
        const initialCount = await page.locator('#logContainer .log-line').count();

        // Click Error level filter
        await page.click('[data-level="E"]');

        // Wait for filtering to complete
        await page.waitForTimeout(500);

        const filteredCount = await page.locator('#logContainer .log-line').count();
        expect(filteredCount).toBeLessThan(initialCount);

        // Verify only Error logs are shown
        const errorLogs = await page.locator('.log-line-E').count();
        expect(errorLogs).toBe(filteredCount);
    });

    test('should search with keywords', async ({ page }) => {
        await page.fill('#searchInput', 'Bluetooth');
        await page.press('#searchInput', 'Enter');

        await page.waitForTimeout(500);

        const visibleLogs = await page.locator('#logContainer .log-line').allTextContents();
        visibleLogs.forEach(log => {
            expect(log.toLowerCase()).toContain('bluetooth');
        });
    });
});
```

---

### **Phase 5: Performance Monitoring** (Week 5)

#### 5.1 Enhanced Performance Tracker
```javascript
// performance-tracker.js
export class PerformanceTracker {
    constructor() {
        this.metrics = [];
        this.thresholds = {
            fileLoad: 5000,      // 5 seconds
            filtering: 1000,     // 1 second
            rendering: 500,      // 500ms
            export: 3000         // 3 seconds
        };
    }

    startMeasure(name, category = 'general') {
        const id = `${category}-${name}-${Date.now()}`;
        performance.mark(`${id}-start`);
        return id;
    }

    endMeasure(id, metadata = {}) {
        performance.mark(`${id}-end`);
        const measure = performance.measure(id, `${id}-start`, `${id}-end`);
        
        const metric = {
            id,
            name: id.split('-')[1],
            category: id.split('-')[0],
            duration: measure.duration,
            timestamp: new Date().toISOString(),
            metadata
        };

        this.metrics.push(metric);
        this.checkThreshold(metric);
        
        return metric;
    }

    checkThreshold(metric) {
        const threshold = this.thresholds[metric.category];
        if (threshold && metric.duration > threshold) {
            console.warn(`⚠️ Performance Warning: ${metric.name} took ${metric.duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
        }
    }

    getReport() {
        const categories = {};
        
        this.metrics.forEach(metric => {
            if (!categories[metric.category]) {
                categories[metric.category] = {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    minDuration: Infinity,
                    measurements: []
                };
            }

            const cat = categories[metric.category];
            cat.count++;
            cat.totalDuration += metric.duration;
            cat.maxDuration = Math.max(cat.maxDuration, metric.duration);
            cat.minDuration = Math.min(cat.minDuration, metric.duration);
            cat.measurements.push(metric);
        });

        // Calculate averages
        Object.values(categories).forEach(cat => {
            cat.avgDuration = cat.totalDuration / cat.count;
        });

        return {
            summary: categories,
            allMetrics: this.metrics,
            generatedAt: new Date().toISOString()
        };
    }

    exportToJSON() {
        const report = this.getReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-report-${Date.now()}.json`;
        a.click();
    }

    reset() {
        this.metrics = [];
        performance.clearMarks();
        performance.clearMeasures();
    }
}

// Singleton instance
export const perfTracker = new PerformanceTracker();
```

#### 5.2 Integration with Existing Code
```javascript
// In main.js, replace TimeTracker with PerformanceTracker
import { perfTracker } from './performance-tracker.js';

// Example usage:
async function processLogFile(file) {
    const measureId = perfTracker.startMeasure('processLogFile', 'fileLoad');
    
    try {
        // Existing processing logic
        const result = await parseFile(file);
        
        perfTracker.endMeasure(measureId, {
            fileSize: file.size,
            fileName: file.name,
            lineCount: result.lines.length
        });
        
        return result;
    } catch (error) {
        perfTracker.endMeasure(measureId, { error: error.message });
        throw error;
    }
}
```

#### 5.3 Performance Test Suite
```javascript
// tests/performance/large-file.perf.js
import { test, expect } from '@playwright/test';

test.describe('Performance Benchmarks', () => {
    test('should load 100MB file within 10 seconds', async ({ page }) => {
        const startTime = Date.now();
        
        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');
        await page.locator('#file-input').setInputFiles('./test-data/sample-logs/large.log');
        await page.waitForSelector('#logContainer .log-line', { timeout: 15000 });
        
        const loadTime = Date.now() - startTime;
        expect(loadTime).toBeLessThan(10000);
        
        console.log(`✅ Large file loaded in ${loadTime}ms`);
    });

    test('should filter 1M lines within 2 seconds', async ({ page }) => {
        await page.goto('file:///home/rk/Documents/Android_log_parser (copy)/index.html');
        await page.locator('#file-input').setInputFiles('./test-data/sample-logs/large.log');
        await page.waitForSelector('#logContainer .log-line');

        const startTime = Date.now();
        await page.fill('#searchInput', 'ERROR');
        await page.press('#searchInput', 'Enter');
        await page.waitForTimeout(100); // Small delay for UI update
        
        const filterTime = Date.now() - startTime;
        expect(filterTime).toBeLessThan(2000);
        
        console.log(`✅ Filtering completed in ${filterTime}ms`);
    });
});
```

---

### **Phase 6: CI/CD Integration** (Week 6)

#### 6.1 GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Automated Testing

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  e2e-tests:
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
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run performance tests
        run: npm run test:perf
      
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
      
      - name: Upload performance report
        uses: actions/upload-artifact@v3
        with:
          name: performance-report
          path: performance-reports/
```

#### 6.2 Package.json Scripts
```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:e2e",
    "test:unit": "vitest run --coverage",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:perf": "playwright test tests/performance --reporter=json",
    "test:debug": "playwright test --debug",
    "report:allure": "allure generate allure-results --clean && allure open",
    "perf:export": "node scripts/export-performance-metrics.js"
  }
}
```

---

## 📊 Reporting & Continuous Improvement

### 1. **Automated Test Reports**
- **Allure Report**: Visual test execution reports with history
- **Playwright HTML Report**: Interactive E2E test results
- **Vitest Coverage Report**: Code coverage metrics

### 2. **Performance Dashboard**
Create a simple HTML dashboard to visualize performance trends:

```html
<!-- performance-dashboard.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Performance Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <h1>Android Log Parser - Performance Metrics</h1>
    
    <div>
        <canvas id="loadTimeChart"></canvas>
        <canvas id="filterTimeChart"></canvas>
        <canvas id="renderTimeChart"></canvas>
    </div>

    <script>
        // Load performance data from JSON exports
        fetch('./performance-reports/latest.json')
            .then(res => res.json())
            .then(data => {
                // Render charts with historical data
                renderCharts(data);
            });
    </script>
</body>
</html>
```

### 3. **Continuous Improvement Workflow**
1. **Baseline Establishment**: Run initial performance tests to establish baselines
2. **Automated Monitoring**: Every commit triggers performance tests
3. **Regression Detection**: Alert if performance degrades by >10%
4. **Optimization Tracking**: Document improvements in performance reports
5. **Weekly Reviews**: Analyze trends and identify optimization opportunities

---

## 🎯 Success Metrics

### Test Coverage Goals
- **Unit Tests**: >80% code coverage
- **Integration Tests**: All critical workflows covered
- **E2E Tests**: All user-facing features tested

### Performance Targets
| Operation | Target | Current | Status |
|-----------|--------|---------|--------|
| Load 10MB file | <2s | TBD | 🔄 |
| Load 100MB file | <10s | TBD | 🔄 |
| Filter 1M lines | <1s | TBD | 🔄 |
| Render 10K lines | <500ms | TBD | 🔄 |
| Export to Excel | <3s | TBD | 🔄 |

---

## 📅 Implementation Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Foundation | Testing infrastructure setup |
| 2 | Unit Tests | Core parsing logic tests |
| 3 | Integration | Worker & IndexedDB tests |
| 4 | E2E Tests | User workflow tests |
| 5 | Performance | Monitoring & benchmarks |
| 6 | CI/CD | Automated pipeline |

---

## 🔧 Maintenance & Evolution

### Regular Activities
- **Weekly**: Review test results and performance metrics
- **Monthly**: Update test data with real-world samples
- **Quarterly**: Evaluate and update testing tools
- **Annually**: Comprehensive testing strategy review

### Continuous Improvement Loop
1. **Measure**: Collect performance data
2. **Analyze**: Identify bottlenecks
3. **Optimize**: Implement improvements
4. **Validate**: Verify improvements with tests
5. **Document**: Update benchmarks and reports

---

## 📚 Resources & Documentation

### Testing Tools Documentation
- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Allure Report](https://docs.qameta.io/allure/)

### Performance Optimization Guides
- [Web.dev Performance](https://web.dev/performance/)
- [MDN Performance](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)

---

## 🚀 Next Steps

1. **Review this plan** with the team
2. **Set up development environment** with testing tools
3. **Create sample test data** (small, medium, large log files)
4. **Implement Phase 1** (Foundation Setup)
5. **Start with critical path testing** (file upload, parsing, filtering)
6. **Iterate and expand** test coverage progressively

---

*Last Updated: 2025-12-07*
*Version: 1.0*
