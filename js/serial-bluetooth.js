/**
 * BlueTTool - Classic Bluetooth via Web Serial API
 * Chrome 117+ supports connecting to paired Bluetooth Classic devices
 * that expose RFCOMM/SPP (Serial Port Profile).
 * BLE remains the primary API; this extends support to Classic BT.
 */
const SerialBluetooth = (() => {
  let port = null;
  let reader = null;
  let writer = null;
  let connected = false;

  function isSupported() {
    return !!navigator.serial;
  }

  /**
   * Request user to select a Bluetooth serial port (paired Classic BT device).
   * Returns the port or null if cancelled.
   */
  async function requestPort() {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported. Use Chrome 117+ for Classic Bluetooth.');
    }
    const p = await navigator.serial.requestPort();
    port = p;
    return p;
  }

  /**
   * Open the selected port and return readable/writable streams.
   */
  async function open(baudRate = 9600) {
    if (!port) throw new Error('No port selected. Call requestPort() first.');
    await port.open({ baudRate });
    writer = port.writable.getWriter();
    reader = port.readable.getReader();
    connected = true;
    return { reader, writer };
  }

  /**
   * Close the connection.
   */
  async function close() {
    connected = false;
    try {
      if (reader) {
        await reader.cancel();
        reader = null;
      }
      if (writer) {
        await writer.close();
        writer = null;
      }
      if (port) {
        await port.close();
        port = null;
      }
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.warn('Serial close: ' + e.message);
    }
  }

  /**
   * Check if currently connected.
   */
  function isConnected() {
    return connected;
  }

  return {
    isSupported,
    requestPort,
    open,
    close,
    isConnected
  };
})();
