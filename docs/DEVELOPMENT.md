# Development Guide

## Prerequisites

- Node.js 20+
- npm 10+
- Bluefy (iOS) and/or Chrome 117+ for manual validation

## Setup

```bash
npm ci
npm run validate:env
```

## Main commands

```bash
npm run lint
npm run format:check
npm test
npm run security:audit
```

## Test strategy

BlueTTool currently uses two test layers:

1. **Legacy regression suite** (`tests/test.js`)  
   Verifies project structure and major feature wiring.

2. **Unit tests (Vitest)** (`tests/unit/*.test.js`)  
   Validates core logic with deterministic inputs and mocks.

Coverage is enforced in CI for configured core logic modules.

## Local manual smoke checks

1. Open app in Bluefy or Chrome.
2. Validate scan flow.
3. Connect/disconnect a test device.
4. Verify Replay and Tools flows render and behave without errors.
5. Check Log tab for clear, structured entries.

## File map

- `index.html`: app shell, tab layout, script order
- `sw.js`: service worker and cache strategy
- `js/*.js`: module logic
- `tests/`: automated tests
- `.github/workflows/`: CI/CD definitions
