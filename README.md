# BlueTTool

**Bluetooth scanner and testing tool** — BLE (Web Bluetooth) and Classic Bluetooth (Web Serial) support. Mobile-first web app designed to run in **Bluefy** on iOS.

> **Personal use only.** This tool is strictly for testing, learning about, and managing your own Bluetooth devices. It is not intended for unauthorized access, disruption of devices you do not own, or any activity that violates applicable laws. Use responsibly for education, personal convenience, and authorized security testing only.

## Live App

**[https://thumpersecure.github.io/bluettool/](https://thumpersecure.github.io/bluettool/)**

Open this URL in the **Bluefy** browser on your iPhone.

## How to Use

1. Install **[Bluefy](https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055)** from the App Store (required for Web Bluetooth on iOS)
2. Open the live app URL in Bluefy
3. **Add to Home Screen** — see [Save to Home Screen with Bluefy](#save-to-home-screen-with-bluefy) below
4. Start scanning for BLE devices or connect Classic Bluetooth devices (Chrome 117+)

## Save to Home Screen with Bluefy

To save BlueTTool to your iPhone home screen for quick access:

1. Open the app in **Bluefy**
2. Tap the **Share** button (square with arrow) in Bluefy's toolbar
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** to confirm

The app will open like a native app from your home screen. The in-app Scanner tab also includes step-by-step instructions.

## Features

### Scan (BLE)
- Discover nearby BLE devices via the Web Bluetooth API
- Filter by device name prefix or service UUID
- Accept-all scan mode for broad discovery
- Device names shown prominently alongside browser-generated IDs
- Browser compatibility checker

### Classic Bluetooth (Chrome 117+)
- Connect to paired Bluetooth Classic devices via Web Serial API
- Supports RFCOMM/SPP (Serial Port Profile)
- Use "Connect Classic BT Device" in the Scanner tab on Chrome 117+

### Devices
- View all discovered devices with names, IDs, connection status, service/characteristic counts, and timestamps
- Connect to any device and enumerate its full GATT profile
- Read, write, and subscribe to individual characteristics
- Capture device profile snapshots directly from the detail panel
- Export discovered device list as CSV

### Call History
- **Import** call history from CSV or JSON files
- **Export** to CSV for backup
- Supports formats: `date,number,duration,type` (CSV) or JSON array
- To get call history from your iPhone: use a call history backup app, then import the exported file

### Audio Test Tools
- **Play DTMF Tones** — live-generated fax/DTMF tone sequence via Web Audio API
- **Play Audio File** — plays the included WAV file of fax machine / DTMF tones (falls back to live DTMF if file missing)
- **Stop All Audio** — instantly stops any playing audio
- **Silence All** — stops audio AND disconnects all BLE devices (silences Bluetooth speakers)

### Share via AirDrop
- **Share DTMF Audio File** — send the fax tones WAV via iOS share sheet / AirDrop
- **Share Random Hearts** — send a burst of random heart emojis
- **Share App Link** — share the BlueTTool URL

### Agentic Auto-Discovery (Advanced)
Automated BLE discovery pipeline that runs each phase sequentially:
1. **Scan** — broad BLE scan to find nearby devices
2. **Connect** — establish GATT connection
3. **Enumerate** — discover all services and characteristics
4. **Read** — read all accessible characteristic values
5. **Capture** — snapshot the full device profile
6. **Analyze** — report findings, surface areas, and recommendations

Real-time status feed shows each step as it executes.

### Log
- Timestamped activity log for every operation
- Copy full log to clipboard for reporting

## Disclaimer

**This tool is provided for educational purposes, personal device management, and authorized security testing only.**

- Only use BlueTTool with devices you own or have explicit permission to test
- Do not use this tool to access, disrupt, or interfere with devices belonging to others
- The authors are not responsible for misuse of this tool
- Comply with all applicable local, state, and federal laws regarding Bluetooth and wireless communications
- The "Stop Music" / "Silence All" feature is designed for managing your own Bluetooth speakers

## Tech Stack

- Vanilla HTML/CSS/JS — no build step, no dependencies
- Web Bluetooth API (BLE GATT)
- Web Serial API (Classic Bluetooth, Chrome 117+)
- Web Audio API (DTMF tone generation)
- Web Share API (AirDrop / native sharing)
- PWA manifest with SVG icons
- Optimized for Bluefy browser on iOS

## Project Structure

```
bluettool/
├── index.html              # Main app shell
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── css/
│   └── style.css           # Dark theme, mobile-first styles
├── js/
│   ├── logger.js           # Centralized activity logger
│   ├── call-history.js     # Call history import/export
│   ├── bluetooth-scanner.js # Web Bluetooth (BLE) engine
│   ├── serial-bluetooth.js # Classic Bluetooth (Web Serial)
│   ├── announcements.js    # Capture & replay module
│   ├── audio-player.js     # DTMF/fax tone audio player
│   ├── vulnerability.js    # GATT security assessment
│   ├── advanced.js        # Agentic auto-discovery engine
│   ├── sharing.js         # AirDrop / Web Share module
│   └── app.js             # Main controller wiring UI to modules
├── audio/
│   └── dtmf-fax-tones.wav  # Pre-generated DTMF/fax tones (run scripts/generate-dtmf-wav.js to regenerate)
├── scripts/
│   └── generate-dtmf-wav.js # Generate audio file
└── icons/
    ├── icon-180.svg        # Apple touch icon
    ├── icon-192.svg        # PWA icon
    └── icon-512.svg        # PWA icon large
```

## Limitations

- **Bluefy required on iOS** — Safari does not support Web Bluetooth
- **No passive scanning** — each scan requires user interaction with the browser's device chooser
- **Device IDs are browser-generated** — real MAC addresses are hidden by the browser for privacy
- **BLE via Web Bluetooth** — BLE devices use GATT; Classic Bluetooth uses Web Serial (Chrome 117+)
- **No raw advertisement access** — capture/replay works at the GATT characteristic level
- **AirDrop sharing** — requires iOS and depends on Web Share API support in Bluefy
- **Call history** — import only; no direct sync from iPhone (requires third-party export)

## Known Issues & Fixes

| Issue | Status |
|-------|--------|
| Missing audio file (404) | Fixed — `audio/dtmf-fax-tones.wav` generated by script; fallback to live DTMF if missing |
| Scan failures show no toast | Fixed — toasts now shown on cancel/error |
| Share actions show no feedback | Fixed — success/error toasts added |
| Deprecated `substr` | Fixed — replaced with `substring` |
| Logger `escapeHtml` undefined | Fixed — null/undefined guard added |
| Agent results TypeError | Fixed — defensive array checks in `renderAgentResults` |
| Confirm dialog no overlay dismiss | Fixed — click overlay to dismiss |
| Null reference risks | Fixed — optional chaining on DOM elements |

## Deployment

For GitHub Pages or similar deployment, use the **default branch** for the repo (e.g. configure Pages to deploy from the default branch rather than hardcoding `main`).

## License

MIT
