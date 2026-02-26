# BlueTTool Architecture

## High-level model

BlueTTool is a static, no-build Progressive Web App with modular JavaScript files loaded directly in `index.html`.

```text
UI (index.html + css/style.css)
  -> app.js (orchestration + event wiring)
    -> feature modules (bluetooth, audio, replay, vulnerability, macros, sharing, voice)
      -> browser APIs (Web Bluetooth, Web Serial, Web Audio, Web Share, SpeechRecognition)
```

## Module boundaries

- `js/config.js`  
  Runtime configuration normalization and defaults.

- `js/logger.js`  
  Structured in-app log store and log rendering.

- `js/bluetooth-scanner.js`  
  BLE scan/connect/read/write/notify core service.

- `js/serial-bluetooth.js`  
  Classic BT serial support for Chrome/Web Serial.

- `js/announcements.js`  
  Capture/import/export/replay profile logic.

- `js/vulnerability.js`  
  GATT-oriented risk assessment engine.

- `js/advanced.js`  
  Agentic single-device and multi-device orchestration.

- `js/audio-player.js`  
  DTMF generation/playback controls.

- `js/macros.js`  
  Local macro persistence and execution semantics.

- `js/voice-commands.js`  
  Speech command parsing and action mapping.

- `js/sharing.js`  
  AirDrop/native share actions with graceful fallback.

## State model

Primary runtime state is intentionally module-local:

- Device/session state: `bluetooth-scanner.js`
- Captures: `announcements.js`
- Macros: `macros.js` (localStorage)
- UI/app state: `app.js`

## Security boundaries

- Input constraints for import handlers
- Hex payload length constraints for BLE writes
- CSV output sanitization for spreadsheet consumers
- CSP/Referrer/Permissions policy metadata in app shell

## Current design limitations

- `app.js` remains a large orchestration file and should be split further.
- Modules communicate through globals (script-tag architecture), which is simple but tightly coupled.

Phased refactoring plan: [docs/ROADMAP.md](ROADMAP.md).
