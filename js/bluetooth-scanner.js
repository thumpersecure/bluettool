/**
 * BlueTTool - Bluetooth Scanner Engine
 * Uses Web Bluetooth API to scan, connect, enumerate services/characteristics
 */
const BluetoothScanner = (() => {
  const devices = new Map(); // id -> device info
  let connectedDevice = null;
  let connectedServer = null;
  let onDeviceFound = null;
  let onConnectionChange = null;
  const SMART_LIGHT_SERVICE_UUIDS = [
    '0000ffd5-0000-1000-8000-00805f9b34fb', // Common Govee control service
    '0000ffe0-0000-1000-8000-00805f9b34fb', // Common BLE UART/light service
    '0000ffb0-0000-1000-8000-00805f9b34fb', // Common smart-light custom range
    '00001300-0000-1000-8000-00805f9b34fb'  // Bluetooth Mesh Lighting service
  ];

  const IDENTITY_CHAR_UUIDS = new Set([
    '00002a00-0000-1000-8000-00805f9b34fb', // Device Name
    '00002a29-0000-1000-8000-00805f9b34fb', // Manufacturer Name
    '00002a24-0000-1000-8000-00805f9b34fb', // Model Number
  ]);

  /** Check Web Bluetooth support */
  function checkSupport() {
    const results = [];

    results.push({
      name: 'Web Bluetooth API',
      ok: !!navigator.bluetooth,
      detail: navigator.bluetooth ? 'Available' : 'Not supported in this browser'
    });

    results.push({
      name: 'HTTPS / Secure Context',
      ok: window.isSecureContext,
      detail: window.isSecureContext ? 'Secure context' : 'Requires HTTPS or localhost'
    });

    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isBluefy = /Bluefy/.test(navigator.userAgent);
    const isWebBLE = /WebBLE/.test(navigator.userAgent);

    let browserDetail = 'Unknown browser';
    let browserOk = false;
    if (isBluefy) {
      browserDetail = 'Bluefy detected — full BLE support on iOS';
      browserOk = true;
    } else if (isWebBLE) {
      browserDetail = 'WebBLE detected — BLE support available';
      browserOk = true;
    } else if (isChrome) {
      browserDetail = 'Chrome — BLE works on Android/Desktop. For iOS use Bluefy.';
      browserOk = true;
    } else if (isSafari) {
      browserDetail = 'Safari — no Web Bluetooth. Install Bluefy from the App Store.';
      browserOk = false;
    } else {
      browserDetail = 'Unknown browser — install Bluefy for iOS BLE support';
      browserOk = false;
    }

    results.push({ name: 'Browser Support', ok: browserOk, detail: browserDetail });

    results.push({
      name: 'Bluetooth Availability',
      ok: null, // async check below
      detail: 'Checking...'
    });

    // Classic Bluetooth via Web Serial (Chrome 117+)
    const hasSerial = !!navigator.serial;
    results.push({
      name: 'Classic Bluetooth (Web Serial)',
      ok: hasSerial,
      detail: hasSerial ? 'Available — RFCOMM/SPP on paired devices' : 'Chrome 117+ required for Classic BT'
    });

    if (navigator.bluetooth && navigator.bluetooth.getAvailability) {
      navigator.bluetooth.getAvailability().then(available => {
        results[3].ok = available;
        results[3].detail = available ? 'Bluetooth adapter available' : 'No Bluetooth adapter found';
        renderCompatibility(results);
      }).catch(() => {
        results[3].ok = null;
        results[3].detail = 'Could not check (may still work)';
        renderCompatibility(results);
      });
    } else {
      results[3].detail = 'getAvailability() not supported';
    }

    renderCompatibility(results);
    renderCompatMatrix();
    return results;
  }

  function renderCompatibility(results) {
    const container = document.getElementById('compat-status');
    if (!container) return;
    container.innerHTML = results.map(r => {
      const cls = r.ok === true ? 'compat-ok' : r.ok === false ? 'compat-fail' : 'compat-warn';
      const icon = r.ok === true ? '\u2713' : r.ok === false ? '\u2717' : '?';
      return `<div class="compat-item">
        <span>${r.name}</span>
        <span class="${cls}">${icon} ${r.detail}</span>
      </div>`;
    }).join('');
  }

  function renderCompatMatrix() {
    const container = document.getElementById('compat-matrix');
    if (!container || typeof BrowserCompat === 'undefined') return;

    const matrix = BrowserCompat.getFeatureMatrix();
    const browserName = BrowserCompat.getBrowserName();

    container.innerHTML = `
      <div class="compat-matrix-header">What works in ${browserName}</div>
      <div class="compat-matrix-grid">
        <div class="compat-matrix-item ${matrix.ble.supported ? 'compat-ok' : 'compat-fail'}">
          <span class="compat-matrix-label">BLE (Web Bluetooth)</span>
          <span class="compat-matrix-detail">${matrix.ble.supported ? '\u2713 Works' : '\u2717 Not available'}</span>
        </div>
        <div class="compat-matrix-item ${matrix.classicBt.supported ? 'compat-ok' : 'compat-fail'}">
          <span class="compat-matrix-label">Classic BT (Web Serial)</span>
          <span class="compat-matrix-detail">${matrix.classicBt.supported ? '\u2713 Works' : '\u2717 Chrome 117+ only'}</span>
        </div>
      </div>
      <p class="compat-matrix-hint">Bluefy: BLE only. Chrome 117+: BLE + Classic BT.</p>
    `;
  }

  /**
   * Scan for BLE devices
   * @param {Object} options - Scan filter options
   */
  async function scan(options = {}) {
    if (!navigator.bluetooth) {
      Logger.error('Web Bluetooth API not available');
      throw new Error('Web Bluetooth not supported. On iPhone, use the Bluefy app.');
    }

    Logger.info('Starting BLE scan...');
    updateStatus('scanning', 'Scanning...');

    const requestParams = buildScanFilters(options);

    try {
      const device = await navigator.bluetooth.requestDevice(requestParams);
      Logger.success(`Device found: ${device.name || 'Unnamed'}`, `ID: ${device.id}`);

      const info = {
        id: device.id,
        name: (device.name || '').trim() || 'Unknown Device',
        device: device,
        server: null,
        discovered: new Date().toISOString(),
        connected: false,
        services: [],
        characteristics: [],
        rssi: null,
        manufacturer: null,
        model: null,
        deviceType: 'unknown',
        lightTestPlan: null
      };

      devices.set(device.id, info);
      updateStatus('offline', 'Device found');
      updateDeviceCount();

      device.addEventListener('gattserverdisconnected', () => {
        Logger.warn(`Device disconnected: ${info.name}`);
        info.connected = false;
        info.server = null;
        if (connectedDevice?.id === info.id) connectedDevice = null;
        if (connectedServer && connectedServer?.device?.id === info.id) connectedServer = null;
        updateStatus('offline', 'Disconnected');
        if (onConnectionChange) onConnectionChange(info, false, { source: 'device' });
      });

      if (onDeviceFound) onDeviceFound(info);
      return info;

    } catch (err) {
      if (err.name === 'NotFoundError') {
        Logger.warn('Scan cancelled by user');
      } else {
        Logger.error(`Scan failed: ${err.message}`);
      }
      updateStatus('offline', 'Bluetooth Ready');
      throw err;
    }
  }

  /**
   * Scan accepting all devices (no filter)
   */
  async function scanAll() {
    return scan({ acceptAll: true });
  }

  function buildScanFilters(options) {
    if (options.acceptAll) {
      return {
        acceptAllDevices: true,
        optionalServices: getCommonServiceUUIDs()
      };
    }

    const filters = [];

    if (options.namePrefix) {
      filters.push({ namePrefix: options.namePrefix });
    }

    if (options.services && options.services.length > 0) {
      filters.push({ services: options.services });
    }

    if (filters.length === 0) {
      return {
        acceptAllDevices: true,
        optionalServices: getCommonServiceUUIDs()
      };
    }

    return {
      filters,
      optionalServices: getCommonServiceUUIDs()
    };
  }

  function getCommonServiceUUIDs() {
    return [
      'generic_access',
      'generic_attribute',
      'device_information',
      'battery_service',
      'heart_rate',
      'health_thermometer',
      'tx_power',
      'immediate_alert',
      'link_loss',
      'current_time',
      'human_interface_device',
      ...SMART_LIGHT_SERVICE_UUIDS,
    ];
  }

  /**
   * Connect to a discovered device and enumerate its GATT services
   */
  async function connect(deviceId, options = {}) {
    const info = devices.get(deviceId);
    if (!info) {
      Logger.error(`Unknown device ID: ${deviceId}`);
      throw new Error('Device not found');
    }

    Logger.info(`Connecting to ${info.name}...`);
    updateStatus('connecting', 'Connecting...');

    try {
      if (!info.device.gatt) {
        throw new Error('Device GATT server unavailable — try scanning again');
      }
      const deepReadOnEnumerate = options.deepReadOnEnumerate !== false;
      const ctx = { ...options, source: options.source || 'user' };

      const server = await info.device.gatt.connect();
      info.server = server;
      connectedDevice = info; // "active" device for UI features like Replay
      connectedServer = server;
      info.connected = true;

      Logger.success(`Connected to ${info.name}`);
      updateStatus('connected', `Connected: ${info.name}`);

      if (onConnectionChange) onConnectionChange(info, true, ctx);

      // Enumerate services
      await enumerateServices(info, server, { readValues: deepReadOnEnumerate });

      return info;

    } catch (err) {
      Logger.error(`Connection failed: ${err.message}`);
      updateStatus('offline', 'Connection failed');
      throw err;
    }
  }

  /**
   * Disconnect from device
   */
  function disconnect(deviceId) {
    const info = devices.get(deviceId);
    if (!info) return;

    try {
      if (info.device.gatt?.connected) {
        Logger.info(`Disconnecting from ${info.name}...`);
        info.device.gatt.disconnect();
      }
    } catch (_) {
      // GATT may already be disconnected
    }
    info.connected = false;
    info.server = null;
    if (connectedDevice && connectedDevice.id === deviceId) {
      connectedDevice = null;
      connectedServer = null;
    }
    updateStatus('offline', 'Disconnected');
    if (onConnectionChange) onConnectionChange(info, false, { source: 'user' });
  }

  /**
   * Enumerate all GATT services and their characteristics
   */
  async function enumerateServices(info, server, options = {}) {
    Logger.info('Enumerating GATT services...');
    info.services = [];
    info.characteristics = [];
    info.lightTestPlan = null;
    info.deviceType = 'unknown';
    const readValues = options.readValues !== false;

    try {
      const services = await server.getPrimaryServices();
      Logger.info(`Found ${services.length} services`);

      for (const service of services) {
        const svcInfo = {
          uuid: service.uuid,
          name: resolveServiceName(service.uuid),
          characteristics: []
        };

        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            const props = [];
            if (char.properties.read) props.push('read');
            if (char.properties.write) props.push('write');
            if (char.properties.writeWithoutResponse) props.push('writeNoResp');
            if (char.properties.notify) props.push('notify');
            if (char.properties.indicate) props.push('indicate');
            if (char.properties.broadcast) props.push('broadcast');

            const charInfo = {
              uuid: char.uuid,
              name: resolveCharacteristicName(char.uuid),
              properties: props,
              value: null,
              characteristic: char
            };

            // Try to read the value
            const normalizedUuid = normalizeUuid(char.uuid);
            const shouldReadValue = !!(char.properties.read && (readValues || IDENTITY_CHAR_UUIDS.has(normalizedUuid)));
            if (shouldReadValue) {
              try {
                const value = await char.readValue();
                charInfo.value = dataViewToHex(value);
                charInfo.textValue = dataViewToString(value);
                Logger.info(`  Char ${charInfo.name}: ${charInfo.value}`);
              } catch (readErr) {
                Logger.warn(`  Could not read ${charInfo.name}: ${readErr.message}`);
              }
            }

            svcInfo.characteristics.push(charInfo);
            info.characteristics.push(charInfo);
          }
        } catch (charErr) {
          Logger.warn(`Could not enumerate chars for ${svcInfo.name}: ${charErr.message}`);
        }

        info.services.push(svcInfo);
        Logger.success(`Service: ${svcInfo.name} (${svcInfo.characteristics.length} chars)`);
      }

      hydrateDeviceIdentity(info);
      info.deviceType = detectDeviceType(info);
      info.lightTestPlan = buildLightTestPlan(info);

      Logger.info('Service enumeration complete', {
        services: info.services.length,
        characteristics: info.characteristics.length,
        deviceType: info.deviceType,
        suggestedTest: info.lightTestPlan?.bestAction || 'none'
      });

    } catch (err) {
      Logger.error(`Service enumeration failed: ${err.message}`);
    }
  }

  /**
   * Read a characteristic value
   */
  async function readCharacteristic(charInfo) {
    try {
      const value = await charInfo.characteristic.readValue();
      charInfo.value = dataViewToHex(value);
      charInfo.textValue = dataViewToString(value);
      Logger.info(`Read ${charInfo.name}: ${charInfo.value}`);
      return charInfo;
    } catch (err) {
      Logger.error(`Read failed for ${charInfo.name}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Write a value to a characteristic
   */
  async function writeCharacteristic(charInfo, hexString) {
    try {
      if (!charInfo?.characteristic) {
        throw new Error('Invalid characteristic');
      }

      const gatt = charInfo?.characteristic?.service?.device?.gatt;
      if (!gatt || !gatt.connected) {
        throw new Error('Device disconnected');
      }

      if (typeof hexString !== 'string' || !hexString.trim()) {
        throw new Error('Hex payload required');
      }

      const bytes = hexToBytes(hexString);
      const buffer = new Uint8Array(bytes).buffer;

      if (charInfo.properties.includes('write')) {
        await charInfo.characteristic.writeValue(buffer);
      } else if (charInfo.properties.includes('writeNoResp')) {
        await charInfo.characteristic.writeValueWithoutResponse(buffer);
      } else {
        throw new Error('Characteristic is not writable');
      }

      Logger.success(`Wrote to ${charInfo.name}: ${hexString}`);
      return true;
    } catch (err) {
      Logger.error(`Write failed for ${charInfo.name}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Subscribe to notifications from a characteristic
   */
  async function subscribeNotifications(charInfo, callback) {
    try {
      await charInfo.characteristic.startNotifications();
      charInfo.characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = dataViewToHex(event.target.value);
        Logger.info(`Notification from ${charInfo.name}: ${value}`);
        if (callback) callback(charInfo, value);
      });
      Logger.success(`Subscribed to notifications: ${charInfo.name}`);
    } catch (err) {
      Logger.error(`Notification subscribe failed: ${err.message}`);
      throw err;
    }
  }

  // --- Utilities ---

  function dataViewToHex(dataView) {
    const bytes = [];
    for (let i = 0; i < dataView.byteLength; i++) {
      bytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
    }
    return bytes.join(':');
  }

  function dataViewToString(dataView) {
    const decoder = new TextDecoder('utf-8');
    try {
      const data = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
      return decoder.decode(data);
    } catch {
      return '';
    }
  }

  function hexToBytes(hex) {
    const clean = hex.replace(/[:\s]/g, '');
    if (!clean || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
      throw new Error('Invalid hex payload');
    }
    const bytes = [];
    for (let i = 0; i < clean.length; i += 2) {
      bytes.push(parseInt(clean.substring(i, i + 2), 16));
    }
    return bytes;
  }

  function normalizeUuid(uuid) {
    return String(uuid || '').toLowerCase();
  }

  function getTextCharacteristicValue(info, targetUuid) {
    if (!info?.services?.length) return '';
    const normalizedTarget = normalizeUuid(targetUuid);
    for (const svc of info.services) {
      for (const ch of svc.characteristics || []) {
        if (normalizeUuid(ch.uuid) === normalizedTarget && typeof ch.textValue === 'string') {
          return ch.textValue.replace(/\0/g, '').trim();
        }
      }
    }
    return '';
  }

  function isPlaceholderName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    return normalized.length === 0 || normalized === 'unknown device' || normalized === 'unnamed';
  }

  function hydrateDeviceIdentity(info) {
    const gattName = getTextCharacteristicValue(info, '00002a00-0000-1000-8000-00805f9b34fb');
    const manufacturer = getTextCharacteristicValue(info, '00002a29-0000-1000-8000-00805f9b34fb');
    const model = getTextCharacteristicValue(info, '00002a24-0000-1000-8000-00805f9b34fb');

    if (manufacturer) info.manufacturer = manufacturer;
    if (model) info.model = model;

    if (isPlaceholderName(info.name) && gattName) {
      info.name = gattName;
      Logger.info(`Using GATT Device Name for ${info.id}: ${info.name}`);
    }

    if (isPlaceholderName(info.name)) {
      const inferred = [manufacturer, model].filter(Boolean).join(' ').trim();
      if (inferred) {
        info.name = inferred;
        Logger.info(`Using inferred device name for ${info.id}: ${info.name}`);
      }
    }
  }

  function isWritableCharacteristic(charInfo) {
    if (!charInfo?.properties) return false;
    return charInfo.properties.includes('write') || charInfo.properties.includes('writeNoResp');
  }

  function detectDeviceType(info) {
    const name = String(info?.name || '').toLowerCase();
    const manufacturer = String(info?.manufacturer || '').toLowerCase();
    const serviceUuids = (info?.services || []).map(s => normalizeUuid(s.uuid));

    if (serviceUuids.some(uuid => uuid.includes('ffd5')) || name.includes('govee') || manufacturer.includes('govee')) {
      return 'govee_light';
    }

    if (
      serviceUuids.some(uuid => SMART_LIGHT_SERVICE_UUIDS.includes(uuid) || /0000ff[0-9a-f]{2}-0000-1000-8000-00805f9b34fb/.test(uuid)) ||
      /(led|light|bulb|lamp|rgb)/.test(name) ||
      /(led|light|bulb|lamp|rgb)/.test(manufacturer)
    ) {
      return 'smart_light';
    }

    return 'unknown';
  }

  function findBestWritableLightCharacteristic(info) {
    const writableChars = (info?.characteristics || []).filter(isWritableCharacteristic);
    if (writableChars.length === 0) return null;

    const preferredUuids = [
      '00002a06-0000-1000-8000-00805f9b34fb', // Alert Level
      '00002b00-0000-1000-8000-00805f9b34fb', // Light Lightness Actual
      '0000ffd9-0000-1000-8000-00805f9b34fb', // Common Govee command characteristic
      '0000ffe1-0000-1000-8000-00805f9b34fb'
    ];

    for (const uuid of preferredUuids) {
      const exact = writableChars.find(ch => normalizeUuid(ch.uuid) === uuid);
      if (exact) return exact;
    }

    for (const svc of info.services || []) {
      if (!isLikelyLightService(svc.uuid)) continue;
      const svcWritable = (svc.characteristics || []).find(isWritableCharacteristic);
      if (svcWritable) return svcWritable;
    }

    const byName = writableChars.find(ch => /(light|led|rgb|color|power|control)/i.test(String(ch.name || '')));
    if (byName) return byName;

    return writableChars[0];
  }

  function isLikelyLightService(uuid) {
    const normalized = normalizeUuid(uuid);
    return SMART_LIGHT_SERVICE_UUIDS.includes(normalized) ||
      /0000ff[0-9a-f]{2}-0000-1000-8000-00805f9b34fb/.test(normalized);
  }

  function inferPayloadLength(charInfo) {
    if (!charInfo?.value || typeof charInfo.value !== 'string') return 1;
    const compact = charInfo.value.replace(/[:\s]/g, '');
    if (!compact || compact.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(compact)) return 1;
    const byteLength = compact.length / 2;
    return Math.max(1, Math.min(byteLength, 8));
  }

  function buildHexPayload(length, seed) {
    const payloadLength = Math.max(1, Math.min(length || 1, 8));
    const seedBytes = Array.isArray(seed) && seed.length > 0 ? seed : [0x00];
    const bytes = [];
    for (let i = 0; i < payloadLength; i++) {
      bytes.push(seedBytes[i % seedBytes.length] & 0xff);
    }
    return bytes.map(b => b.toString(16).padStart(2, '0')).join(':');
  }

  function buildLightTestPlan(info) {
    const targetChar = findBestWritableLightCharacteristic(info);
    if (!targetChar) return null;

    const targetUuid = normalizeUuid(targetChar.uuid);
    const targetServiceUuid = normalizeUuid(targetChar?.characteristic?.service?.uuid);
    const likelyLightDevice = info?.deviceType === 'govee_light' || info?.deviceType === 'smart_light';
    const lightContext =
      likelyLightDevice ||
      isLikelyLightService(targetServiceUuid) ||
      /(light|led|rgb|color|bulb|lamp)/i.test(`${info?.name || ''} ${targetChar?.name || ''}`);

    if (targetUuid === '00002a06-0000-1000-8000-00805f9b34fb') {
      return {
        available: true,
        targetCharUuid: targetChar.uuid,
        targetCharName: targetChar.name,
        bestAction: 'flash',
        bestActionLabel: 'Flash',
        reason: 'Immediate Alert characteristic detected — standardized alert test values available.',
        confidence: 'high',
        actions: {
          flash: {
            label: 'Flash',
            steps: ['02', '00', '02', '00'],
            delayMs: 180
          },
          off: {
            label: 'Off',
            steps: ['00'],
            delayMs: 0
          }
        }
      };
    }

    const payloadLength = inferPayloadLength(targetChar);
    const offHex = buildHexPayload(payloadLength, [0x00]);
    const fullHex = buildHexPayload(payloadLength, [0xff]);
    const redHex = buildHexPayload(payloadLength, [0xff, 0x00, 0x00]);
    const supportsColor = payloadLength >= 3 || /(rgb|color)/i.test(String(targetChar.name || ''));

    const actions = {
      flash: {
        label: 'Flash',
        steps: [fullHex, offHex, fullHex, offHex],
        delayMs: 180
      },
      off: {
        label: 'Off',
        steps: [offHex],
        delayMs: 0
      }
    };
    if (supportsColor) {
      actions.color = {
        label: 'Color',
        steps: [redHex],
        delayMs: 0
      };
    }

    return {
      available: true,
      targetCharUuid: targetChar.uuid,
      targetCharName: targetChar.name,
      bestAction: supportsColor ? 'color' : 'flash',
      bestActionLabel: supportsColor ? 'Color' : 'Flash',
      reason: lightContext
        ? `Using writable characteristic ${targetChar.name} (${targetChar.uuid}).`
        : `No known light profile matched. Using writable characteristic ${targetChar.name} (${targetChar.uuid}) as a generic best-effort test target.`,
      confidence: lightContext ? 'medium' : 'low',
      actions
    };
  }

  function resolveServiceName(uuid) {
    const names = {
      'generic_access': 'Generic Access',
      'generic_attribute': 'Generic Attribute',
      'device_information': 'Device Information',
      'battery_service': 'Battery Service',
      'heart_rate': 'Heart Rate',
      'health_thermometer': 'Health Thermometer',
      'tx_power': 'Tx Power',
      'immediate_alert': 'Immediate Alert',
      'link_loss': 'Link Loss',
      'current_time': 'Current Time',
      'human_interface_device': 'HID',
      '00001800-0000-1000-8000-00805f9b34fb': 'Generic Access',
      '00001801-0000-1000-8000-00805f9b34fb': 'Generic Attribute',
      '0000180a-0000-1000-8000-00805f9b34fb': 'Device Information',
      '0000180f-0000-1000-8000-00805f9b34fb': 'Battery Service',
      '0000180d-0000-1000-8000-00805f9b34fb': 'Heart Rate',
      '00001809-0000-1000-8000-00805f9b34fb': 'Health Thermometer',
      '0000ffd5-0000-1000-8000-00805f9b34fb': 'Smart Light Control (Govee-like)',
      '0000ffe0-0000-1000-8000-00805f9b34fb': 'Smart Light UART',
      '0000ffb0-0000-1000-8000-00805f9b34fb': 'Smart Light Vendor Service',
      '00001300-0000-1000-8000-00805f9b34fb': 'Mesh Lighting',
    };
    const normalized = normalizeUuid(uuid);
    return names[normalized] || names[uuid] || uuid;
  }

  function resolveCharacteristicName(uuid) {
    const names = {
      '00002a00-0000-1000-8000-00805f9b34fb': 'Device Name',
      '00002a06-0000-1000-8000-00805f9b34fb': 'Alert Level',
      '00002a01-0000-1000-8000-00805f9b34fb': 'Appearance',
      '00002a04-0000-1000-8000-00805f9b34fb': 'Peripheral Params',
      '00002a19-0000-1000-8000-00805f9b34fb': 'Battery Level',
      '00002a24-0000-1000-8000-00805f9b34fb': 'Model Number',
      '00002a25-0000-1000-8000-00805f9b34fb': 'Serial Number',
      '00002a26-0000-1000-8000-00805f9b34fb': 'Firmware Revision',
      '00002a27-0000-1000-8000-00805f9b34fb': 'Hardware Revision',
      '00002a28-0000-1000-8000-00805f9b34fb': 'Software Revision',
      '00002a29-0000-1000-8000-00805f9b34fb': 'Manufacturer Name',
      '00002a37-0000-1000-8000-00805f9b34fb': 'Heart Rate Measurement',
      '00002a38-0000-1000-8000-00805f9b34fb': 'Body Sensor Location',
      '00002b00-0000-1000-8000-00805f9b34fb': 'Light Lightness Actual',
      '0000ffd9-0000-1000-8000-00805f9b34fb': 'Vendor Light Command',
      '0000ffe1-0000-1000-8000-00805f9b34fb': 'Vendor UART RX/TX',
    };
    const normalized = normalizeUuid(uuid);
    return names[normalized] || names[uuid] || uuid;
  }

  function updateStatus(state, text) {
    const indicator = document.getElementById('bt-status-indicator');
    const statusText = document.getElementById('bt-status-text');
    if (indicator) {
      indicator.className = `indicator ${state}`;
    }
    if (statusText) {
      statusText.textContent = text;
    }
  }

  function updateDeviceCount() {
    const el = document.getElementById('device-count');
    if (el) {
      el.textContent = `${devices.size} device${devices.size !== 1 ? 's' : ''}`;
    }
  }

  function getDevices() {
    return Array.from(devices.values());
  }

  function getDevice(deviceId) {
    return devices.get(deviceId) || null;
  }

  function getConnectedDevice() {
    return connectedDevice;
  }

  function getConnectedServer() {
    return connectedServer;
  }

  function getServer(deviceId) {
    const info = devices.get(deviceId);
    return info?.server || null;
  }

  function clearDevices() {
    // Disconnect any connected device first
    for (const [id, info] of devices) {
      if (info.connected && info.device.gatt?.connected) {
        info.device.gatt.disconnect();
      }
      info.server = null;
    }
    devices.clear();
    connectedDevice = null;
    connectedServer = null;
    updateDeviceCount();
    updateStatus('offline', 'Bluetooth Ready');
    Logger.info('Device list cleared');
  }

  function exportCSV() {
    const rows = [['Name', 'Device ID', 'Connected', 'Discovered', 'Services', 'Characteristics']];
    for (const info of devices.values()) {
      rows.push([
        info.name,
        info.id,
        info.connected ? 'Yes' : 'No',
        info.discovered,
        (info.services || []).map(s => s.name).join('; '),
        (info.characteristics || []).map(c => `${c.name}=${c.value || 'N/A'}`).join('; ')
      ]);
    }

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bluettool-scan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Logger.success('Device list exported to CSV');
  }

  function setOnDeviceFound(cb) { onDeviceFound = cb; }
  function setOnConnectionChange(cb) { onConnectionChange = cb; }

  return {
    checkSupport,
    scan,
    scanAll,
    connect,
    disconnect,
    readCharacteristic,
    writeCharacteristic,
    subscribeNotifications,
    getDevices,
    getDevice,
    getConnectedDevice,
    getConnectedServer,
    getServer,
    clearDevices,
    exportCSV,
    setOnDeviceFound,
    setOnConnectionChange,
    dataViewToHex,
    hexToBytes
  };
})();
