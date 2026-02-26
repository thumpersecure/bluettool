# BlueTTool

Production-hardened Bluetooth testing PWA for iOS (Bluefy) and Chrome desktop/mobile.

## Why BlueTTool

BlueTTool provides a practical UI for BLE scanning, GATT inspection, test-tone playback, controlled replay, and guided **Agentic** discovery workflows. The app is intentionally dependency-light (vanilla HTML/CSS/JS, no build step) to keep deployment simple and auditable.

> **Personal use only.** This tool is provided for **educational purposes**, personal device management, and authorized security testing.

## Quick start (under 1 minute)

1. Install **Bluefy** on iPhone (or use Chrome 117+ on desktop).
2. Open: <https://thumpersecure.github.io/bluettool/>
3. Tap **Scan** and select a BLE device.
4. Use **Tools**, **Replay**, and **Macros** for validation workflows.

## Core capabilities

- BLE scan/connect/enumerate (Web Bluetooth)
- Classic Bluetooth serial (Web Serial, Chrome 117+)
- Characteristic read/write/notify controls
- Capture and **Replay** of GATT snapshots
- **Tools** tab for DTMF audio, smart-light controls, and **Silence** operations
- AirDrop sharing for audio and links
- Voice command shortcuts
- Multi-device and single-device **Agentic** discovery pipelines

## Platform compatibility

| Feature                 | Bluefy (iOS) | Chrome 117+ | Safari |
| ----------------------- | ------------ | ----------- | ------ |
| BLE (Web Bluetooth)     | Yes          | Yes         | No     |
| Classic BT (Web Serial) | No           | Yes         | No     |

See [RECOMMENDATIONS.md](RECOMMENDATIONS.md) for detailed usage guidance.

## Runtime configuration

BlueTTool supports environment-based runtime overrides through:

- `.env.example` (tooling/deployment reference)
- optional `window.__BLUETTOOL_CONFIG__` object in `index.html` hosting context

Supported values:

- `appUrl`
- `logLevel` (`debug`, `info`, `warn`, `error`)
- `enableTelemetry`
- `maxImportBytes`

## Local development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
npm ci
npm run validate:env
```

### Quality commands

```bash
npm run lint
npm run format:check
npm test
npm run security:audit
```

### Serve locally

Any static server works, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Architecture

See:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)

## Security posture

- Input-size bounds on import handlers
- JSON/CSV validation hardening
- CSV export formula-injection mitigation
- CSP / referrer / permissions policy headers in app shell
- npm audit + CodeQL + Dependabot in CI

Disclosure process: [SECURITY.md](SECURITY.md)

## CI/CD and release process

- PR/push quality workflow: lint + format + tests + coverage
- Security workflow: dependency audit + CodeQL
- Automated release pipeline via semantic-release (main branch)

See `.github/workflows/`.

## Troubleshooting

### BLE scan does not open picker

- Ensure HTTPS or localhost.
- Confirm Bluetooth permission is allowed.
- On iOS, use **Bluefy** (Safari does not support Web Bluetooth).

### Classic Bluetooth button is disabled

- Expected in Bluefy/Safari.
- Use Chrome 117+ for Web Serial-based classic BT.

### Import fails

- Verify file is CSV or JSON.
- Ensure file size is below configured `maxImportBytes`.

### Audio sharing fallback happened

- If native share is unavailable, BlueTTool falls back to download/clipboard flows.

## Documentation and governance

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)
- [CHANGELOG.md](CHANGELOG.md)
- [RELEASE_NOTES_DRAFT.md](RELEASE_NOTES_DRAFT.md)

## Legal notice

Do not use BlueTTool for unauthorized access, disruption, or monitoring of devices you do not own or explicitly control. You are solely responsible for lawful use.

## License

[MIT](LICENSE)
