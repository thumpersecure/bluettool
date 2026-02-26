# Security Review Summary

## Scope

Static review across app shell, JavaScript modules, service worker, tests, and repository governance.

## Remediations delivered

- Added CSP/Referrer/Permissions policy metadata in `index.html`.
- Added import size/type validation and robust parsing in `js/call-history.js`.
- Hardened capture import validation in `js/announcements.js`.
- Added CSV formula-injection mitigation in export paths.
- Added BLE hex payload size limit in `js/bluetooth-scanner.js`.
- Added scan deduplication guard to prevent request flooding.
- Added logging controls (levels + redaction of high-risk patterns) in `js/logger.js`.
- Added security governance and reporting policy (`SECURITY.md`).
- Added dependency auditing and CodeQL scanning workflow.

## Current posture

- No known high-severity npm dependency vulnerabilities (`npm audit --audit-level=high`).
- Automated security checks run in CI.

## Residual risk

- Browser API behavior differs by vendor and OS; runtime edge cases still require manual validation on target devices.
- Some global script coupling remains and is tracked in roadmap.
