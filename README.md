# BlueTTool

**Bluetooth Low Energy (BLE) scanner and vulnerability testing tool** — a mobile-first web app built for GitHub Pages.

> Designed for testing legacy and vintage Bluetooth devices in your own collection.

## Live App

**[https://thumpersecure.github.io/bluettool/](https://thumpersecure.github.io/bluettool/)**

## Features

### Scan
- Discover nearby BLE devices via the Web Bluetooth API
- Filter by device name prefix or service UUID
- Accept-all scan mode for broad discovery
- Browser compatibility checker with recommendations

### Devices
- View all discovered devices with IDs, connection status, and timestamps
- Connect to any device and enumerate its full GATT profile
- Read, write, and subscribe to individual characteristics
- Export discovered device list as CSV

### Announce (Capture & Mimic)
- **Capture** — snapshot all readable GATT characteristic values from a connected device
- **Replay** — write previously captured values back to a device for vulnerability testing
- Export captured profiles as JSON for offline analysis

### Log
- Timestamped activity log for every operation (scan, connect, read, write, notify, errors)
- Copy full log to clipboard for reporting

### Rick Roll
- Automatically plays Rick Astley on YouTube when a device connection succeeds
- Because every good vulnerability test deserves a payload

## iPhone Usage

Safari does **not** support the Web Bluetooth API. To run BlueTTool on iPhone:

1. Install **[Bluefy](https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055)** from the App Store
2. Open the live app URL in Bluefy
3. Add to Home Screen for a native app-like experience (PWA support included)

On **Android** and **Desktop**, Chrome works natively.

## Tech Stack

- Vanilla HTML/CSS/JS — no build step, no dependencies
- Web Bluetooth API (BLE GATT)
- PWA manifest with SVG icons
- iPhone-optimized dark UI with safe-area support

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
│   ├── rickroll.js         # Rick Roll trigger
│   └── app.js              # Main controller wiring UI to modules
└── icons/
    ├── icon-180.svg        # Apple touch icon
    ├── icon-192.svg        # PWA icon
    └── icon-512.svg        # PWA icon large
```

## Limitations

The Web Bluetooth API has browser-enforced restrictions:

- **No passive scanning** — each scan requires user interaction with the browser's device chooser
- **Device IDs are browser-generated** — real MAC addresses are hidden by the browser for privacy
- **BLE only** — Bluetooth Classic devices are not accessible via Web Bluetooth
- **No raw advertisement access** — capture/replay works at the GATT characteristic level, not raw BLE advertisements

For lower-level Bluetooth testing, consider tools like [Ubertooth](https://github.com/greatscottgadgets/ubertooth) or [btlejack](https://github.com/virtualabs/btlejack).

## License

MIT
