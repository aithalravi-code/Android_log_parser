#!/usr/bin/env node

/**
 * Merge and analyze Playwright coverage data
 * Converts raw V8 coverage to Istanbul format for reporting
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const coverageDir = path.resolve(__dirname, '../TestReports/regression/coverage');

console.log('🔍 Analyzing Playwright E2E coverage...\n');

// Read all coverage files
const files = fs.readdirSync(coverageDir).filter(f => f.endsWith('.json'));

if (files.length === 0) {
    console.error('❌ No coverage files found in', coverageDir);
    process.exit(1);
}

console.log(`Found ${files.length} coverage files\n`);

// Merge all coverage data
const allCoverage = [];
for (const file of files) {
    const filePath = path.join(coverageDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    allCoverage.push(...data);
}

// Analyze coverage by file
const fileStats = new Map();

for (const entry of allCoverage) {
    const url = entry.url;

    // Skip non-source files
    if (url.includes('node_modules') || !url.includes('.js')) {
        continue;
    }

    // Extract file path from URL
    const match = url.match(/\/src\/(.+\.js)/);
    if (!match) {
        continue;
    }

    const filePath = match[1];

    if (!fileStats.has(filePath)) {
        fileStats.set(filePath, {
            path: filePath,
            totalBytes: 0,
            usedBytes: 0,
            ranges: []
        });
    }

    const stat = fileStats.get(filePath);

    // Calculate coverage
    for (const range of entry.ranges) {
        stat.totalBytes += range.end - range.start;
        if (range.count > 0) {
            stat.usedBytes += range.end - range.start;
        }
    }
}

// Sort by coverage percentage
const sortedStats = Array.from(fileStats.values())
    .map(stat => ({
        ...stat,
        coverage: stat.totalBytes > 0 ? (stat.usedBytes / stat.totalBytes * 100) : 0
    }))
    .sort((a, b) => b.coverage - a.coverage);

// Print results
console.log('📊 Coverage by File:\n');
console.log('─'.repeat(80));
console.log('File'.padEnd(50), 'Coverage');
console.log('─'.repeat(80));

for (const stat of sortedStats) {
    const pct = stat.coverage.toFixed(1).padStart(6);
    console.log(stat.path.padEnd(50), `${pct}%`);
}

console.log('─'.repeat(80));

// Calculate overall coverage
const totalBytes = sortedStats.reduce((sum, s) => sum + s.totalBytes, 0);
const usedBytes = sortedStats.reduce((sum, s) => sum + s.usedBytes, 0);
const overallCoverage = totalBytes > 0 ? (usedBytes / totalBytes * 100) : 0;

console.log('\n📈 Overall E2E Coverage:', overallCoverage.toFixed(2) + '%');
console.log(`   Total files covered: ${sortedStats.length}`);
console.log(`   Total bytes analyzed: ${totalBytes.toLocaleString()}`);
console.log(`   Bytes executed: ${usedBytes.toLocaleString()}\n`);

// Save summary
const summary = {
    timestamp: new Date().toISOString(),
    overall: overallCoverage,
    filesCount: sortedStats.length,
    totalBytes,
    usedBytes,
    files: sortedStats
};

const summaryPath = path.join(coverageDir, 'summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log('✅ Summary saved to:', summaryPath);
