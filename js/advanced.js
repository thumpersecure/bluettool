/**
 * BlueTTool - Advanced Agentic Auto-Discovery Module
 *
 * Automated BLE discovery pipeline that scans, connects, enumerates,
 * captures, and reports findings in real-time — agent-style automation.
 *
 * For personal testing and educational purposes only.
 */
const Advanced = (() => {
  let running = false;
  let stopRequested = false;
  let statusCallback = null;
  let discoveryLog = [];

  const AGENT_STATES = {
    IDLE: 'idle',
    SCANNING: 'scanning',
    CONNECTING: 'connecting',
    ENUMERATING: 'enumerating',
    READING: 'reading',
    CAPTURING: 'capturing',
    ANALYZING: 'analyzing',
    MIMICKING: 'mimicking',
    COMPLETE: 'complete',
    ERROR: 'error'
  };

  let currentState = AGENT_STATES.IDLE;

  function setStatus(state, message, data) {
    currentState = state;
    const entry = {
      time: new Date().toISOString(),
      state,
      message,
      data: data || null
    };
    discoveryLog.push(entry);
    Logger.info(`[Agent] ${message}`);
    if (statusCallback) statusCallback(entry);
  }

  function setOnStatus(cb) {
    statusCallback = cb;
  }

  function isRunning() {
    return running;
  }

  function getState() {
    return currentState;
  }

  function getLog() {
    return [...discoveryLog];
  }

  function stop() {
    if (!running) return;
    stopRequested = true;
    setStatus(AGENT_STATES.IDLE, 'Agent stopped by user');
    running = false;
  }

  /**
   * Run the full agentic discovery pipeline.
   * Scans -> Connects -> Enumerates -> Reads -> Captures -> Analyzes
   */
  async function runFullDiscovery() {
    if (running) {
      Logger.warn('Agent already running');
      return null;
    }

    running = true;
    stopRequested = false;
    discoveryLog = [];

    const results = {
      devicesFound: 0,
      servicesFound: 0,
      characteristicsFound: 0,
      readableValues: 0,
      writableChars: 0,
      captureId: null,
      analysis: null
    };

    try {
      // Phase 1: Scan for devices
      setStatus(AGENT_STATES.SCANNING, 'Initiating broad BLE scan...');

      let deviceInfo;
      try {
        deviceInfo = await BluetoothScanner.scanAll();
        results.devicesFound++;
        setStatus(AGENT_STATES.SCANNING,
          `Found device: ${deviceInfo.name} (${deviceInfo.id})`,
          { name: deviceInfo.name, id: deviceInfo.id });
      } catch (err) {
        if (err.name === 'NotFoundError') {
          setStatus(AGENT_STATES.IDLE, 'Scan cancelled - no device selected');
          running = false;
          return results;
        }
        throw err;
      }

      if (stopRequested) return results;

      // Phase 2: Connect
      setStatus(AGENT_STATES.CONNECTING, `Connecting to ${deviceInfo.name}...`);

      try {
        await BluetoothScanner.connect(deviceInfo.id);
        setStatus(AGENT_STATES.CONNECTING, `Connected to ${deviceInfo.name}`);
      } catch (err) {
        setStatus(AGENT_STATES.ERROR,
          `Connection failed: ${err.message} - analyzing what we have`);
        return finalize(results);
      }

      if (stopRequested) return results;

      // Phase 3: Enumerate services (already done by connect)
      setStatus(AGENT_STATES.ENUMERATING, 'Enumerating GATT services and characteristics...');

      const updatedInfo = BluetoothScanner.getDevices().find(d => d.id === deviceInfo.id);
      if (updatedInfo) {
        results.servicesFound = updatedInfo.services.length;
        for (const svc of updatedInfo.services) {
          results.characteristicsFound += svc.characteristics.length;
          for (const ch of svc.characteristics) {
            if (ch.properties.includes('write') || ch.properties.includes('writeNoResp')) {
              results.writableChars++;
            }
          }
        }
        setStatus(AGENT_STATES.ENUMERATING,
          `Found ${results.servicesFound} services, ${results.characteristicsFound} characteristics`,
          { services: results.servicesFound, chars: results.characteristicsFound });
      }

      if (stopRequested) return results;

      // Phase 4: Deep read all readable characteristics
      setStatus(AGENT_STATES.READING, 'Reading all accessible characteristic values...');

      if (updatedInfo) {
        for (const svc of updatedInfo.services) {
          for (const ch of svc.characteristics) {
            if (stopRequested) break;
            if (ch.properties.includes('read') && ch.characteristic) {
              try {
                await BluetoothScanner.readCharacteristic(ch);
                results.readableValues++;
                setStatus(AGENT_STATES.READING,
                  `Read ${ch.name}: ${ch.value || '(empty)'}`,
                  { char: ch.name, value: ch.value });
              } catch (_) {
                // Some characteristics refuse reads — that's normal
              }
            }
          }
        }
        setStatus(AGENT_STATES.READING,
          `Read ${results.readableValues} characteristic values`);
      }

      if (stopRequested) return results;

      // Phase 5: Capture profile
      setStatus(AGENT_STATES.CAPTURING, 'Capturing full device profile snapshot...');

      try {
        const profile = await Announcements.captureFromDevice();
        results.captureId = profile.id;
        setStatus(AGENT_STATES.CAPTURING,
          `Profile captured: ${profile.totalChars} chars, ${profile.readableChars} readable`,
          { captureId: profile.id });
      } catch (err) {
        setStatus(AGENT_STATES.ERROR, `Capture failed: ${err.message}`);
      }

      if (stopRequested) return results;

      // Phase 6: Analyze findings
      return finalize(results);

    } catch (err) {
      setStatus(AGENT_STATES.ERROR, `Agent error: ${err.message}`);
      running = false;
      return results;
    }
  }

  function finalize(results) {
    setStatus(AGENT_STATES.ANALYZING, 'Analyzing discovery results...');

    const analysis = {
      summary: [],
      riskFactors: [],
      recommendations: []
    };

    analysis.summary.push(`Discovered ${results.devicesFound} device(s)`);
    analysis.summary.push(`${results.servicesFound} GATT services with ${results.characteristicsFound} characteristics`);
    analysis.summary.push(`${results.readableValues} readable values captured`);
    analysis.summary.push(`${results.writableChars} writable characteristics found`);

    if (results.writableChars > 0) {
      analysis.riskFactors.push(
        `${results.writableChars} writable characteristic(s) — values can be modified by any connected client`
      );
    }

    if (results.readableValues > 5) {
      analysis.riskFactors.push(
        'Device exposes multiple readable values — potential information disclosure'
      );
    }

    if (results.servicesFound > 3) {
      analysis.riskFactors.push(
        'Large service surface area — increased attack surface for GATT-level testing'
      );
    }

    analysis.recommendations.push('Review writable characteristics for input validation testing');
    analysis.recommendations.push('Check if sensitive data is exposed via readable characteristics');
    analysis.recommendations.push('Test replay of captured values to verify write protections');
    if (results.captureId) {
      analysis.recommendations.push('Profile captured — use Replay in the Announce tab for write testing');
    }

    results.analysis = analysis;

    setStatus(AGENT_STATES.COMPLETE, 'Discovery complete', results);
    running = false;
    return results;
  }

  /**
   * Run a quick scan-only pass (no connect).
   */
  async function quickScan() {
    if (running) return null;
    running = true;
    stopRequested = false;
    discoveryLog = [];

    setStatus(AGENT_STATES.SCANNING, 'Quick scan — select a device to identify...');

    try {
      const info = await BluetoothScanner.scanAll();
      setStatus(AGENT_STATES.COMPLETE,
        `Identified: ${info.name} (${info.id})`,
        { name: info.name, id: info.id });
      running = false;
      return info;
    } catch (err) {
      setStatus(AGENT_STATES.IDLE, 'Quick scan cancelled');
      running = false;
      return null;
    }
  }

  return {
    runFullDiscovery,
    quickScan,
    stop,
    isRunning,
    getState,
    getLog,
    setOnStatus,
    AGENT_STATES
  };
})();
