# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and follows Semantic Versioning.

## [Unreleased]

### Added

- Production CI/CD workflows for quality, security, and release automation
- ESLint + Prettier + Vitest toolchain with coverage thresholds
- Dependabot configuration, issue templates, and PR template
- Runtime configuration module (`js/config.js`) and `.env.example`
- Governance docs: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE`
- Unit test suite for core logic modules (`call-history`, `macros`, `vulnerability`, `voice-commands`)
- Environment validation script (`scripts/validate-env.js`)

### Changed

- Hardened import parsing and validation in `call-history.js` and `announcements.js`
- Added CSV formula-injection protections in exports
- Added scan deduplication and hex payload limits in `bluetooth-scanner.js`
- Improved `Logger` with configurable levels and redaction helpers
- Parallelized all-device light actions in `app.js`
- Strengthened service worker caching strategy and offline fallbacks
- Updated README to production-grade documentation and onboarding flow

### Security

- Added CSP/Referrer/Permissions policy meta headers
- Added automated dependency audits and CodeQL static analysis workflow
