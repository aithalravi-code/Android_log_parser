#!/usr/bin/env node
// Post-Refactoring Verification Script
// Automatically checks for missing function imports after module extraction

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainJsPath = path.join(__dirname, '../Production/src/main.js');

console.log('🔍 Post-Refactoring Verification\n');
console.log('Checking for potentially missing function imports...\n');

// Read main.js
const content = fs.readFileSync(mainJsPath, 'utf8');

// Extract all imports
const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
const imports = new Map();
let match;

while ((match = importRegex.exec(content)) !== null) {
    const functions = match[1].split(',').map(f => f.trim());
    const module = match[2];
    functions.forEach(fn => imports.set(fn, module));
}

console.log(`✓ Found ${imports.size} imported functions\n`);

// Find all function calls (excluding function definitions)
const functionCallRegex = /\b([a-z][a-zA-Z0-9]*)\s*\(/g;
const functionCalls = new Set();
const lines = content.split('\n');

lines.forEach((line, idx) => {
    // Skip function definitions
    if (line.trim().startsWith('function ') || line.trim().startsWith('async function ')) {
        return;
    }

    let callMatch;
    while ((callMatch = functionCallRegex.exec(line)) !== null) {
        const funcName = callMatch[1];
        // Filter out common keywords and built-ins
        if (!['if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'typeof', 'instanceof'].includes(funcName)) {
            functionCalls.add(funcName);
        }
    }
});

console.log(`✓ Found ${functionCalls.size} function calls\n`);

// Check for potentially missing imports
const potentiallyMissing = [];
const statsModuleFunctions = [
    'renderStats', 'processForDashboardStats', 'renderDashboardStats',
    'renderAppVersions', 'renderCpuPlot', 'renderTemperaturePlot', 'renderBatteryPlot',
    'setupStatsTab'
];

statsModuleFunctions.forEach(fn => {
    if (functionCalls.has(fn) && !imports.has(fn)) {
        potentiallyMissing.push(fn);
    }
});

if (potentiallyMissing.length > 0) {
    console.log('❌ POTENTIAL ISSUES FOUND:\n');
    potentiallyMissing.forEach(fn => {
        console.log(`   - ${fn}() is called but not imported`);

        // Show where it's called
        try {
            const result = execSync(`grep -n "${fn}(" ${mainJsPath}`, { encoding: 'utf8' });
            const calls = result.trim().split('\n').slice(0, 3); // Show first 3 occurrences
            calls.forEach(call => {
                const [lineNum, ...rest] = call.split(':');
                console.log(`     Line ${lineNum}: ${rest.join(':').trim().substring(0, 60)}...`);
            });
        } catch (e) {
            // grep returns non-zero if no matches
        }
        console.log('');
    });

    console.log('⚠️  Please verify these functions are either:');
    console.log('   1. Imported from the correct module, OR');
    console.log('   2. Defined locally in main.js\n');
    process.exit(1);
} else {
    console.log('✅ All stats module functions appear to be properly imported!\n');

    // Show what's imported
    console.log('Imported from StatsTab.js:');
    statsModuleFunctions.forEach(fn => {
        if (imports.has(fn)) {
            console.log(`   ✓ ${fn}`);
        }
    });
    console.log('');
    process.exit(0);
}
