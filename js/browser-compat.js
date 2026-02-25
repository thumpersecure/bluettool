/**
 * BlueTTool - Browser Compatibility Detection
 * Detects Bluefy, Chrome, and feature support for graceful degradation.
 * - BLE (Web Bluetooth): Bluefy, Chrome, WebBLE
 * - Classic BT (Web Serial): Chrome 117+ only — NOT in Bluefy/Safari
 */
const BrowserCompat = (() => {
  const ua = navigator.userAgent || '';
  const isBluefy = /Bluefy/.test(ua);
  const isWebBLE = /WebBLE/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);

  const hasWebBluetooth = !!navigator.bluetooth;
  const hasWebSerial = !!navigator.serial;

  function isBleSupported() {
    return hasWebBluetooth && (isBluefy || isWebBLE || isChrome);
  }

  function isClassicBtSupported() {
    return hasWebSerial; // Chrome 117+ only; Bluefy/Safari do not have Web Serial
  }

  function getBrowserName() {
    if (isBluefy) return 'Bluefy';
    if (isWebBLE) return 'WebBLE';
    if (isChrome) return 'Chrome';
    if (isSafari) return 'Safari';
    return 'Unknown';
  }

  function getFeatureMatrix() {
    return {
      ble: {
        supported: isBleSupported(),
        detail: isBluefy
          ? 'BLE works in Bluefy on iOS'
          : isChrome
            ? 'BLE works on Android/Desktop'
            : isSafari
              ? 'Safari has no Web Bluetooth — use Bluefy'
              : 'Use Bluefy (iOS) or Chrome (Android/Desktop)'
      },
      classicBt: {
        supported: isClassicBtSupported(),
        detail: hasWebSerial
          ? 'Classic BT (RFCOMM/SPP) via Web Serial'
          : 'Classic BT requires Chrome 117+ — not in Bluefy/Safari'
      }
    };
  }

  return {
    isBluefy,
    isChrome,
    isSafari,
    isWebBLE,
    hasWebBluetooth,
    hasWebSerial,
    isBleSupported,
    isClassicBtSupported,
    getBrowserName,
    getFeatureMatrix
  };
})();
