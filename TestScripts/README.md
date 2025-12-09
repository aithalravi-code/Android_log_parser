# Test Scripts

This directory contains all automated test scripts for the project.

## Structure

```
TestScripts/
├── unit/          # Unit tests (Vitest)
├── regression/    # E2E regression tests (Playwright)
└── performance/   # Performance benchmarks
```

## Running Tests

**Unit Tests:**
```bash
npm run test:unit
```

**Regression Tests:**
```bash
npm run test:regression
```

**Performance Tests:**
```bash
npm run test:performance
```

**All Tests:**
```bash
npm run test:all
```

## Guidelines

- Unit tests: Test individual functions/modules
- Regression tests: Test user workflows end-to-end
- Performance tests: Measure and benchmark performance
- All tests should be deterministic and repeatable
- Use descriptive test names
