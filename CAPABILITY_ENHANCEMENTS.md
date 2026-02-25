# BlueTTool — 5 Major Capability Enhancements

## Evaluation Summary

| # | Enhancement | Feasibility | Effort | Value | Recommendation |
|---|-------------|-------------|--------|-------|----------------|
| 1 | Export/Import Captures | ✅ High | Low | High | **Implement** |
| 2 | Automation/Macros | ✅ High | Medium | High | **Implement** |
| 3 | Multi-device Parallel Control | ✅ High | Low | High | **Implement** |
| 4 | BLE Advertising Data Access | ❌ Blocked | N/A | High | **Reject** |
| 5 | Scheduled Tasks / Notification Triggers | ⚠️ Low | High | Medium | **Defer** |

---

## 1. Export/Import Captures

**Name:** Capture Profile Import/Export

**Description:** Extend the existing JSON export to support **import** of capture profiles. Users can export a capture, share it (AirDrop, email), and import it on another device or session. Enables backup, restore, and collaboration.

**Feasibility:** ✅ **High** — Web Bluetooth/Bluefy constraints: None. File input API works in Bluefy. JSON parsing is standard. No BLE-specific limitations.

**Implementation effort:** **Low** — Add `importCapture()` to Announcements module, file input in Replay tab, validate JSON structure.

**User value:** **High** — Backup captures across sessions, share profiles with colleagues, restore after clearing device list.

**Recommendation:** **Implement**

---

## 2. Automation/Macros

**Name:** Action Macros / Workflow Automation

**Description:** Record and replay sequences of BLE actions: connect → light flash → delay → set color → replay capture → disconnect. Users define macros (e.g., "Test Govee Light") and run them with one tap. Supports delays, conditional steps, and chaining.

**Feasibility:** ✅ **High** — All primitives exist: connect, write, read, replay. No new Web Bluetooth APIs needed. Stored as JSON in localStorage.

**Implementation effort:** **Medium** — New Macros module, UI for create/edit/run, step executor with delay support.

**User value:** **High** — Repeatable testing workflows, regression testing, demo scripts.

**Recommendation:** **Implement**

---

## 3. Multi-device Parallel Control

**Name:** Parallel Multi-device Light Control

**Description:** Upgrade "Flash All Lights" and "Set Color on All Lights" to send commands **in parallel** (Promise.all) instead of sequentially. Reduces total time when controlling many lights. Extend to other bulk actions (e.g., parallel replay to multiple targets).

**Feasibility:** ✅ **High** — Web Bluetooth allows multiple connections (parallel discovery already does this). Sequential control is a current implementation choice, not an API limit.

**Implementation effort:** **Low** — Refactor `runLightActionOnAllDevices` to use `Promise.all` for parallel writes. Minor UI feedback for progress.

**User value:** **High** — Faster bulk light control, better UX when managing many devices.

**Recommendation:** **Implement**

---

## 4. BLE Advertising Data Access

**Name:** Raw Advertisement Packet Access

**Description:** Expose raw BLE advertising data (manufacturer data, service UUIDs, TX power, RSSI) without connecting. Useful for beacon scanning, device fingerprinting, and pre-connection analysis.

**Feasibility:** ❌ **Blocked** — Web Bluetooth API does **not** expose advertising packets. `requestDevice()` shows a picker; the browser/OS handles scanning. The Web Bluetooth Scanning API (BluetoothLEScan) exists in Chrome but is **not** supported in Bluefy/Safari. No path for iOS/Bluefy.

**Implementation effort:** N/A

**User value:** **High** (if available)

**Recommendation:** **Reject** — Not feasible within Web Bluetooth/Bluefy constraints. Would require native app or different platform.

---

## 5. Scheduled Tasks / Notification-based Triggers

**Name:** Scheduled BLE Actions & Notification Triggers

**Description:** Schedule BLE actions (e.g., "Flash lights at 8:00 AM") or trigger actions when a notification arrives. Enables automation without user presence.

**Feasibility:** ⚠️ **Low** — PWAs on iOS have severe background limits. Service Workers are suspended when app is backgrounded. Push Notifications require server + APNs. `setTimeout`/`setInterval` do not run reliably when tab is inactive. No reliable way to run BLE operations on schedule in Bluefy.

**Implementation effort:** **High** — Would need Push API, backend, complex workarounds. Still unreliable on iOS.

**User value:** **Medium** — Useful for power users, but niche.

**Recommendation:** **Defer** — Platform constraints make this unreliable. Revisit if Web Bluetooth gains background scanning or iOS PWA capabilities improve.

---

## Other Considered Enhancements

| Enhancement | Feasibility | Reason |
|-------------|-------------|--------|
| Device Pairing Management | ❌ Blocked | Web Bluetooth has no pairing API; pairing is automatic |
| OTA Firmware Updates | ⚠️ Low | Vendor-specific DFU services; high effort, device-dependent |
| Notification-based Triggers | ⚠️ Low | iOS background limits, Push API complexity |

---

## Implementation Priority

1. **Export/Import Captures** — Highest value/effort ratio
2. **Automation/Macros** — High value, enables power-user workflows
3. **Multi-device Parallel Control** — Quick win, improves existing features
