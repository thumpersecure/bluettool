# BlueTTool — Bluetooth Compatibility & Recommendations

This document explains which Bluetooth features work in which browsers and what users can do on different platforms.

## Feature Matrix

| Feature                     | Bluefy (iOS)     | Chrome 117+ (Android/Desktop) | Safari           |
| --------------------------- | ---------------- | ----------------------------- | ---------------- |
| **BLE (Web Bluetooth)**     | ✅ Full support  | ✅ Full support               | ❌ Not supported |
| **Classic BT (Web Serial)** | ❌ Not supported | ✅ RFCOMM/SPP                 | ❌ Not supported |

## What Works Where

### BLE (Bluetooth Low Energy)

- **Web Bluetooth API** — scan, connect, enumerate GATT services/characteristics
- **Works in:** Bluefy, Chrome, WebBLE
- **Primary target:** Bluefy on iPhone (iOS has no Web Bluetooth in Safari)

### Classic Bluetooth

- **Web Serial API** — connect to paired Bluetooth Classic devices (RFCOMM/SPP)
- **Works in:** Chrome 117+ only
- **Not in:** Bluefy, Safari, or older Chrome

---

## Recommendations by Platform

### (a) iPhone / Bluefy Users

**What you CAN do:**

- ✅ Scan for BLE devices
- ✅ Connect to BLE devices and enumerate GATT
- ✅ Read, write, subscribe to BLE characteristics
- ✅ Run agentic discovery, vulnerability assessment
- ✅ Audio tools (DTMF, share via AirDrop)
- ✅ Call history import/export

**What you CANNOT do:**

- ❌ Classic Bluetooth (RFCOMM/SPP) — Web Serial is not available in Bluefy

**Workaround for Classic BT on iPhone:**

- Use a computer with Chrome 117+ to connect to Classic BT devices
- Or use a native iOS app that supports Classic Bluetooth serial

### (b) Chrome 117+ Users (Android, Windows, Mac, Linux)

**What you CAN do:**

- ✅ Everything BLE (same as Bluefy)
- ✅ Classic Bluetooth — connect to paired RFCOMM/SPP devices via "Connect Classic BT Device"

**Best for:** Full feature set including serial/Classic BT peripherals

### (c) Safari Users (iOS/macOS)

**What you CAN do:**

- ❌ No Web Bluetooth — BLE scanning does not work
- ❌ No Web Serial — Classic BT does not work

**Workaround:**

- **On iPhone:** Install [Bluefy](https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055) from the App Store
- **On Mac:** Use Chrome for BLE and Classic BT

---

## Summary

| Platform     | BLE    | Classic BT  | Recommended Browser        |
| ------------ | ------ | ----------- | -------------------------- |
| iPhone       | Bluefy | —           | Bluefy                     |
| Android      | Chrome | Chrome 117+ | Chrome                     |
| Desktop      | Chrome | Chrome 117+ | Chrome                     |
| Safari (any) | —      | —           | Use Bluefy (iOS) or Chrome |

---

## In-App Messaging

The app applies **graceful degradation**:

- **In Bluefy:** The Classic BT button is disabled and a message explains: _"Classic BT requires Chrome 117+ — not available in Bluefy/Safari."_
- **In Chrome 117+:** Both BLE and Classic BT buttons are enabled.
- **Browser Compatibility card:** Shows a feature matrix of what works in the current browser.

No broken buttons — unsupported features are clearly disabled with explanatory text.
