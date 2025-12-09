# .config - Configuration Files

This directory contains all project configuration files organized by type.

## Structure

```
.config/
├── build/        # Build configurations (Vite, etc.)
├── test/         # Test configurations (Vitest, Playwright)
├── lint/         # Linting & formatting configs
└── env/          # Environment templates
```

## Configurations

### Build (`build/`)
- `vite.config.js` - Development build config
- `vite.config.prod.js` - Production build config (if needed)

### Test (`test/`)
- `vitest.config.js` - Unit test configuration
- `playwright.config.js` - E2E test configuration

### Lint (`lint/`)
- `.eslintrc.js` - ESLint configuration
- `.prettierrc` - Prettier configuration

### Environment (`env/`)
- `.env.example` - Environment variable template
- `.env.template` - Environment template for different environments

## Usage

Configurations are referenced in `package.json` scripts:
```json
{
  "scripts": {
    "dev": "vite -c .config/build/vite.config.js",
    "test:unit": "vitest -c .config/test/vitest.config.js"
  }
}
```
