import globals from "globals";
import pluginJs from "@eslint/js";

export default [
    {
        ignores: [
            "**/node_modules/**",
            "**/.config/**",
            "**/dist/**",
            "**/out/**",
            "**/TestReports/**",
            "**/*.min.js",
            "Production/src/jszip.min.js"
        ]
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                // Manual globals for Test/Playwright check if 'globals' has them, otherwise define:
                describe: "readonly",
                it: "readonly",
                test: "readonly",
                expect: "readonly",
                beforeAll: "readonly",
                afterAll: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
                vi: "readonly",
                XLSX: "readonly"
            },
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module"
            }
        }
    },
    pluginJs.configs.recommended,
    {
        rules: {
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
            "no-undef": "error"
        }
    },
    {
        files: ["**/*.test.js", "**/*.spec.js", "**/TestScripts/**/*.js"],
        rules: {
            "no-unused-vars": "off", // Disable unused vars for tests to reduce noise
            "no-undef": "off"        // Often false positives in test scripts with implicit globals
        }
    }
];
