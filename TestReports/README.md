# Test Reports

This directory contains test execution reports and results.

## Structure

```
TestReports/
├── unit/          # Unit test reports (not tracked)
├── regression/    # Regression test reports (not tracked)
├── performance/   # Performance test reports (not tracked)
└── summary/       # Summary reports (tracked in Git)
```

## Git Tracking

- **Tracked**: Only `summary/` directory with aggregated reports
- **Not Tracked**: Detailed reports in `unit/`, `regression/`, `performance/`

## Summary Reports

The `summary/` directory contains:
- Latest test run summaries
- Historical trends
- Key metrics and statistics
- Links to detailed reports (in CI/CD)

## Viewing Reports

**Unit Test Coverage:**
```bash
npx vite preview --outDir TestReports/unit/coverage
```

**Playwright Reports:**
```bash
npx playwright show-report TestReports/regression/playwright-report
```
