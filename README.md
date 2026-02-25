# BlueTTool

**Bluetooth Low Energy (BLE) scanner and testing tool** — a mobile-first web app designed to run in **Bluefy** on iOS.

> **Personal use only.** This tool is strictly for testing, learning about, and managing your own Bluetooth devices. It is not intended for unauthorized access, disruption of devices you do not own, or any activity that violates applicable laws. Use responsibly for education, personal convenience, and authorized security testing only.

## Live App

**[https://thumpersecure.github.io/bluettool/](https://thumpersecure.github.io/bluettool/)**

Open this URL in the **Bluefy** browser on your iPhone.

## How to Use

1. Install **[Bluefy](https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055)** from the App Store (required for Web Bluetooth on iOS)
2. Open the live app URL in Bluefy
3. Add to Home Screen for a native app-like experience (PWA)
4. Start scanning for your BLE devices

## Features

### Scan
- Discover nearby BLE devices via the Web Bluetooth API
- Filter by device name prefix or service UUID
- Accept-all scan mode for broad discovery
- Device names shown prominently alongside browser-generated IDs
- Browser compatibility checker

### Devices
- View all discovered devices with names, IDs, connection status, service/characteristic counts, and timestamps
- Connect to any device and enumerate its full GATT profile
- Read, write, and subscribe to individual characteristics
- Capture device profile snapshots directly from the detail panel
- Export discovered device list as CSV

### Audio Test Tools
- **Play DTMF Tones** — live-generated fax/DTMF tone sequence via Web Audio API
- **Play Audio File** — plays the included WAV file of fax machine / DTMF tones
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
- Web Audio API (DTMF tone generation)
- Web Share API (AirDrop / native sharing)
- PWA manifest with SVG icons
- Optimized for Bluefy browser on iOS

## Project Structure

```
bluettool/
├── index.html              # Main app shell
├── manifest.json           # PWA manifest
├── css/
│   └── style.css           # Dark theme, mobile-first styles
├── js/
│   ├── logger.js           # Centralized activity logger
│   ├── bluetooth-scanner.js # Web Bluetooth scanning engine
│   ├── announcements.js    # Capture & replay module
│   ├── audio-player.js     # DTMF/fax tone audio player
│   ├── advanced.js         # Agentic auto-discovery engine
│   ├── sharing.js          # AirDrop / Web Share module
│   └── app.js              # Main controller wiring UI to modules
├── audio/
│   └── dtmf-fax-tones.wav  # Pre-generated DTMF/fax tones audio
└── icons/
    ├── icon-180.svg        # Apple touch icon
    ├── icon-192.svg        # PWA icon
    └── icon-512.svg        # PWA icon large
```

## Limitations

The Web Bluetooth API has browser-enforced restrictions:

- **Bluefy required on iOS** — Safari does not support Web Bluetooth
- **No passive scanning** — each scan requires user interaction with the browser's device chooser
- **Device IDs are browser-generated** — real MAC addresses are hidden by the browser for privacy
- **BLE only** — Bluetooth Classic devices are not accessible via Web Bluetooth
- **No raw advertisement access** — capture/replay works at the GATT characteristic level
- **AirDrop sharing** — requires iOS and depends on Web Share API support in Bluefy

## License

MIT
