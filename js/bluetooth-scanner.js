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
        name: device.name || 'Unknown Device',
        device: device,
        discovered: new Date().toISOString(),
        connected: false,
        services: [],
        characteristics: [],
        rssi: null
      };

      devices.set(device.id, info);
      updateStatus('offline', 'Device found');
      updateDeviceCount();

      device.addEventListener('gattserverdisconnected', () => {
        Logger.warn(`Device disconnected: ${info.name}`);
        info.connected = false;
        connectedDevice = null;
        connectedServer = null;
        updateStatus('offline', 'Disconnected');
        if (onConnectionChange) onConnectionChange(info, false);
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
    ];
  }

  /**
   * Connect to a discovered device and enumerate its GATT services
   */
  async function connect(deviceId) {
    const info = devices.get(deviceId);
    if (!info) {
      Logger.error(`Unknown device ID: ${deviceId}`);
      throw new Error('Device not found');
    }

    Logger.info(`Connecting to ${info.name}...`);
    updateStatus('scanning', 'Connecting...');

    try {
      const server = await info.device.gatt.connect();
      connectedDevice = info;
      connectedServer = server;
      info.connected = true;

      Logger.success(`Connected to ${info.name}`);
      updateStatus('connected', `Connected: ${info.name}`);

      if (onConnectionChange) onConnectionChange(info, true);

      // Enumerate services
      await enumerateServices(info, server);

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
      if (info.device.gatt.connected) {
        Logger.info(`Disconnecting from ${info.name}...`);
        info.device.gatt.disconnect();
      }
    } catch (_) {
      // GATT may already be disconnected
    }
    info.connected = false;
    if (connectedDevice && connectedDevice.id === deviceId) {
      connectedDevice = null;
      connectedServer = null;
    }
    updateStatus('offline', 'Disconnected');
    if (onConnectionChange) onConnectionChange(info, false);
  }

  /**
   * Enumerate all GATT services and their characteristics
   */
  async function enumerateServices(info, server) {
    Logger.info('Enumerating GATT services...');
    info.services = [];
    info.characteristics = [];

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
            if (char.properties.read) {
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

      Logger.info('Service enumeration complete', {
        services: info.services.length,
        characteristics: info.characteristics.length
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
      return decoder.decode(dataView.buffer);
    } catch {
      return '';
    }
  }

  function hexToBytes(hex) {
    const clean = hex.replace(/[:\s]/g, '');
    const bytes = [];
    for (let i = 0; i < clean.length; i += 2) {
      bytes.push(parseInt(clean.substr(i, 2), 16));
    }
    return bytes;
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
    };
    return names[uuid] || uuid;
  }

  function resolveCharacteristicName(uuid) {
    const names = {
      '00002a00-0000-1000-8000-00805f9b34fb': 'Device Name',
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
    };
    return names[uuid] || uuid;
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

  function getConnectedDevice() {
    return connectedDevice;
  }

  function getConnectedServer() {
    return connectedServer;
  }

  function clearDevices() {
    // Disconnect any connected device first
    for (const [id, info] of devices) {
      if (info.connected && info.device.gatt.connected) {
        info.device.gatt.disconnect();
      }
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
        info.services.map(s => s.name).join('; '),
        info.characteristics.map(c => `${c.name}=${c.value || 'N/A'}`).join('; ')
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
    getConnectedDevice,
    getConnectedServer,
    clearDevices,
    exportCSV,
    setOnDeviceFound,
    setOnConnectionChange,
    dataViewToHex,
    hexToBytes
  };
})();
