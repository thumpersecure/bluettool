# Contributing to BlueTTool

Thanks for helping improve BlueTTool.

## Development workflow

1. Create a focused branch from `main`.
2. Make minimal, reviewable changes.
3. Run local quality checks:

   ```bash
   npm run validate:env
   npm run lint
   npm run format:check
   npm test
   ```

4. Update docs/tests for behavior changes.
5. Open a pull request using the PR template.

## Commit style

Conventional Commits are required (validated in CI):

- `feat:`
- `fix:`
- `docs:`
- `test:`
- `refactor:`
- `chore:`

## Coding standards

- Preserve core functionality; harden behavior safely.
- Prefer explicit error handling over silent failures.
- Keep logic deterministic and testable.
- Avoid `console.log`; use `Logger`.
- Validate all user/file inputs before processing.

## Test expectations

- New logic must include or update automated tests.
- Keep unit tests deterministic (no real network/Bluetooth dependencies).
- Maintain >=90% coverage for the configured core logic scope.

## Security

Do not disclose vulnerabilities publicly. Follow [SECURITY.md](SECURITY.md).
