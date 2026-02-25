/**
 * BlueTTool - BLE Announcement Capture & Mimic
 *
 * Captures GATT characteristic data from connected devices and allows
 * replaying those values for testing. Works within Web Bluetooth API
 * constraints (no raw advertisement access in browsers).
 */
const Announcements = (() => {
  const captures = []; // array of captured profiles

  /**
   * Capture all readable characteristic data from the currently connected device.
   * This creates a "profile" snapshot of the device's GATT state.
   */
  async function captureFromDevice() {
    const deviceInfo = BluetoothScanner.getConnectedDevice();
    if (!deviceInfo?.id) {
      Logger.error('No device connected - connect to a device first');
      throw new Error('No device connected');
    }
    return captureFromDeviceId(deviceInfo.id);
  }

  /**
   * Capture a BLE profile snapshot from a specific connected device.
   * @param {string} deviceId - BluetoothScanner device id
   * @param {Object} options
   * @param {boolean} [options.reRead=true] - if true, re-read readable characteristics during capture
   */
  async function captureFromDeviceId(deviceId, options = {}) {
    const deviceInfo = BluetoothScanner.getDevice(deviceId) ||
      BluetoothScanner.getDevices().find(d => d.id === deviceId);
    if (!deviceInfo || !deviceInfo.connected) {
      Logger.error('Device not connected - connect to a device first');
      throw new Error('No device connected');
    }

    const reRead = options.reRead !== false;

    Logger.info(`Capturing BLE profile from ${deviceInfo.name}...`);

    const profile = {
      id: `capture-${Date.now()}`,
      deviceName: deviceInfo.name,
      deviceId: deviceInfo.id,
      timestamp: new Date().toISOString(),
      services: [],
      totalChars: 0,
      readableChars: 0
    };

    for (const svc of deviceInfo.services) {
      const svcCapture = {
        uuid: svc.uuid,
        name: svc.name,
        characteristics: []
      };

      for (const char of svc.characteristics) {
        profile.totalChars++;
        const charCapture = {
          uuid: char.uuid,
          name: char.name,
          properties: [...char.properties],
          value: null,
          textValue: null
        };

        // Re-read current values (optional)
        if (reRead && char.properties.includes('read')) {
          try {
            const updated = await BluetoothScanner.readCharacteristic(char);
            charCapture.value = updated.value;
            charCapture.textValue = updated.textValue;
            profile.readableChars++;
          } catch (err) {
            Logger.warn(`Could not read ${char.name} during capture: ${err.message}`);
          }
        } else if (char.value) {
          charCapture.value = char.value;
          charCapture.textValue = char.textValue;
          profile.readableChars++;
        }

        svcCapture.characteristics.push(charCapture);
      }

      profile.services.push(svcCapture);
    }

    captures.push(profile);

    Logger.success(`Profile captured: ${profile.deviceName}`, {
      services: profile.services.length,
      characteristics: profile.totalChars,
      readable: profile.readableChars
    });

    return profile;
  }

  /**
   * Replay captured characteristic values to a connected device.
   * Writes previously captured values to writable characteristics
   * matched by UUID.
   */
  async function replayToDevice(captureId) {
    const profile = captures.find(c => c.id === captureId);
    if (!profile) {
      Logger.error('Capture profile not found');
      throw new Error('Capture not found');
    }

    const deviceInfo = BluetoothScanner.getConnectedDevice();
    if (!deviceInfo || !deviceInfo.connected) {
      Logger.error('No device connected for replay');
      throw new Error('No device connected');
    }

    const normalizeUuid = (uuid) => {
      const raw = String(uuid || '').toLowerCase();
      if (typeof BluetoothUUID !== 'undefined' && typeof BluetoothUUID.canonicalUUID === 'function') {
        try {
          return BluetoothUUID.canonicalUUID(raw);
        } catch (_) {
          // Fall through to local normalization
        }
      }
      if (/^[0-9a-f]{4}$/.test(raw)) {
        return `0000${raw}-0000-1000-8000-00805f9b34fb`;
      }
      return raw;
    };
    const capturedServices = new Set(profile.services.map(s => normalizeUuid(s.uuid)));
    const connectedServices = new Set((deviceInfo.services || []).map(s => normalizeUuid(s.uuid)));
    let sharedServiceCount = 0;
    for (const svcUuid of capturedServices) {
      if (connectedServices.has(svcUuid)) sharedServiceCount++;
    }

    const overlapRatio = capturedServices.size > 0 ? (sharedServiceCount / capturedServices.size) : 0;
    if (deviceInfo.id !== profile.deviceId && overlapRatio < 0.5) {
      Logger.error('Replay blocked: connected device does not match capture profile');
      throw new Error('Connected device does not match this capture profile');
    }
    if (deviceInfo.id !== profile.deviceId) {
      Logger.warn(`Replay target differs from capture source (${profile.deviceId} -> ${deviceInfo.id})`);
    }

    Logger.info(`Replaying profile "${profile.deviceName}" to ${deviceInfo.name}...`);

    let written = 0;
    let skipped = 0;
    let failed = 0;

    for (const svc of profile.services) {
      const targetService = deviceInfo.services.find(s => normalizeUuid(s.uuid) === normalizeUuid(svc.uuid));
      for (const capturedChar of svc.characteristics) {
        if (!capturedChar.value) {
          skipped++;
          continue;
        }

        const canWrite = capturedChar.properties.includes('write') ||
                         capturedChar.properties.includes('writeNoResp');
        if (!canWrite) {
          skipped++;
          continue;
        }

        if (!targetService) {
          skipped++;
          continue;
        }

        // Find matching characteristic on connected device within same service
        const targetChar = targetService.characteristics.find(
          c => normalizeUuid(c.uuid) === normalizeUuid(capturedChar.uuid)
        );

        if (!targetChar) {
          skipped++;
          continue;
        }

        const targetWritable = targetChar.properties.includes('write') ||
          targetChar.properties.includes('writeNoResp');
        if (!targetWritable) {
          skipped++;
          continue;
        }

        try {
          await BluetoothScanner.writeCharacteristic(targetChar, capturedChar.value);
          written++;
        } catch (err) {
          Logger.warn(`Replay write failed for ${capturedChar.name}: ${err.message}`);
          failed++;
        }
      }
    }

    const summary = `Replay complete: ${written} written, ${skipped} skipped, ${failed} failed`;
    Logger.success(summary);
    return { written, skipped, failed };
  }

  /**
   * Export a capture profile as JSON for external analysis
   */
  function exportCapture(captureId) {
    const profile = captures.find(c => c.id === captureId);
    if (!profile) return;

    const exportData = {
      ...profile,
      services: profile.services.map(s => ({
        uuid: s.uuid,
        name: s.name,
        characteristics: s.characteristics.map(c => ({
          uuid: c.uuid,
          name: c.name,
          properties: c.properties,
          value: c.value,
          textValue: c.textValue
        }))
      }))
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ble-capture-${profile.deviceName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Logger.success('Capture profile exported as JSON');
  }

  function getCaptures() {
    return [...captures];
  }

  function clearCaptures() {
    captures.length = 0;
    Logger.info('All captured profiles cleared');
  }

  return {
    captureFromDevice,
    captureFromDeviceId,
    replayToDevice,
    exportCapture,
    getCaptures,
    clearCaptures
  };
})();
