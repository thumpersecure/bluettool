# Production Hardening Roadmap

This repository is now significantly hardened, but a few structural limitations remain due the no-build, script-tag architecture.

## Identified limitations

1. **Large orchestration surface in `js/app.js`**  
   The file still combines UI rendering, event wiring, and cross-module coordination.

2. **Global coupling between modules**  
   Modules interact via shared globals rather than explicit dependency injection.

3. **Browser API dependence in core flows**  
   Some behavior remains difficult to unit test without extensive mocking.

## Phased refactoring plan

### Phase 1 (short term)

- Extract pure utility helpers from `app.js` into dedicated modules.
- Expand unit tests around imported/exported helpers.
- Continue hardening input validation and defensive error handling.

### Phase 2 (medium term)

- Introduce lightweight service/view separation:
  - `services/` for side-effectful modules
  - `ui/` for rendering helpers
  - `state/` for localStorage/session abstractions
- Reduce direct DOM mutation strings in favor of helper builders.

### Phase 3 (long term)

- Optionally move to ESM with explicit imports while keeping static hosting.
- Add browser integration tests (Playwright) for high-value user journeys.
- Adopt stricter typed contracts (JSDoc typedefs or TypeScript migration).

## Non-goals

- Rewriting in a different language/framework.
- Removing existing user-facing capabilities.
