/**
 * Coverage helpers for Playwright E2E tests
 * Collects JavaScript code coverage during test execution
 */

export async function startCoverage(page) {
    try {
        await page.coverage.startJSCoverage({
            resetOnNavigation: false,
            reportAnonymousScripts: true
        });
    } catch (error) {
        console.warn('[Coverage] Failed to start JS coverage:', error.message);
    }
}

export async function stopCoverage(page) {
    try {
        const jsCoverage = await page.coverage.stopJSCoverage();
        return jsCoverage;
    } catch (error) {
        console.warn('[Coverage] Failed to stop JS coverage:', error.message);
        return [];
    }
}

/**
 * Save coverage data to a file
 */
export async function saveCoverage(coverage, testName) {
    const fs = await import('fs');
    const path = await import('path');

    const coverageDir = path.resolve(process.cwd(), 'TestReports/regression/coverage');

    // Create directory if it doesn't exist
    if (!fs.existsSync(coverageDir)) {
        fs.mkdirSync(coverageDir, { recursive: true });
    }

    // Save coverage for this test
    const fileName = `${testName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    const filePath = path.join(coverageDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(coverage, null, 2));

    return filePath;
}
