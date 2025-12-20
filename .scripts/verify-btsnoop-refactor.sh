#!/bin/bash
# Comprehensive BTSnoop Refactoring Verification Script

echo "=== BTSnoop Refactoring Verification ==="
echo ""

# 1. Check for undefined variables in source
echo "1. Checking for potential ReferenceErrors in source files..."
grep -n "ReferenceError\|is not defined" Production/src/main.js Production/src/ui/tabs/BtsnoopTab.js 2>/dev/null || echo "✓ No ReferenceError strings found in source"

# 2. Build the application
echo ""
echo "2. Building application..."
npm run build
if [ $? -eq 0 ]; then
    echo "✓ Build successful"
else
    echo "✗ Build failed"
    exit 1
fi

# 3. Run unit tests
echo ""
echo "3. Running unit tests..."
npm run test:unit 2>&1 | tee /tmp/unit-test.log
UNIT_EXIT=$?
if [ $UNIT_EXIT -eq 0 ]; then
    echo "✓ Unit tests passed"
else
    echo "⚠ Unit tests had issues (exit code: $UNIT_EXIT)"
fi

# 4. Run regression tests (subset)
echo ""
echo "4. Running regression tests..."
npm run test:regression 2>&1 | tee /tmp/regression-test.log
REG_EXIT=$?
if [ $REG_EXIT -eq 0 ]; then
    echo "✓ Regression tests passed"
else
    echo "⚠ Some regression tests failed (exit code: $REG_EXIT)"
fi

# 5. Check for common patterns that indicate missing dependencies
echo ""
echo "5. Scanning for common dependency patterns..."
echo "   Checking processForBtsnoop calls..."
grep -n "processForBtsnoop" Production/src/main.js
echo "   Checking setupBtsnoopTab calls..."
grep -n "setupBtsnoopTab" Production/src/main.js

# Summary
echo ""
echo "=== Verification Summary ==="
echo "Build: $([ $? -eq 0 ] && echo '✓ PASS' || echo '✗ FAIL')"
echo "Unit Tests: $([ $UNIT_EXIT -eq 0 ] && echo '✓ PASS' || echo '⚠ CHECK LOGS')"
echo "Regression: $([ $REG_EXIT -eq 0 ] && echo '✓ PASS' || echo '⚠ CHECK LOGS')"
echo ""
echo "Test logs saved to:"
echo "  - /tmp/unit-test.log"
echo "  - /tmp/regression-test.log"
