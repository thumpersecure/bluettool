# Release Notes Draft

## BlueTTool 1.1.0 (proposed)

### Highlights

- Production hardening across architecture, security, testing, and documentation.
- New CI/CD quality gates with linting, formatting, unit tests, coverage, and security scanning.
- Stronger input validation and safer import/export paths.
- Better logging controls and reliability protections.

### Improvements

- Added runtime config layer (`js/config.js`) and environment validation tooling.
- Added governance and contributor docs for long-term maintenance.
- Added issue/PR templates and Dependabot automation.
- Added semantic-release workflow for repeatable releases.
- Improved performance for bulk light actions via parallel dispatch.

### Security

- CSV formula-injection mitigation.
- Import size/type checks for JSON/CSV processing.
- Bound hex payload sizes for BLE write operations.
- CSP/Referrer/Permissions policy headers in app shell.

### Testing

- Legacy regression suite retained.
- New Vitest unit tests added.
- Coverage enforced for core logic scope.

### Compatibility

- No intentional breaking changes to core user flows.
- Bluefy iOS + Chrome behavior preserved.

### Version bump recommendation

- **Minor** (`1.0.0` -> `1.1.0`) due additive features and production hardening with no intended breaking API changes.
