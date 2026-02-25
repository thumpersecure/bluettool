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
  let activeRunToken = 0;
  const MAX_LOG_ENTRIES = 1000;
  const PARALLEL_READ_AGENT_LIMIT = 4;
  const PARALLEL_READ_AGENT_MIN = 2;

  const AGENT_STATES = {
    IDLE: 'idle',
    SCANNING: 'scanning',
    CONNECTING: 'connecting',
    ENUMERATING: 'enumerating',
    READING: 'reading',
    CAPTURING: 'capturing',
    VULN_ASSESS: 'vuln_assess',
    ANALYZING: 'analyzing',
    MIMICKING: 'mimicking',
    COMPLETE: 'complete',
    ERROR: 'error'
  };

  let currentState = AGENT_STATES.IDLE;

  function setStatus(state, message, data, runToken) {
    if (typeof runToken === 'number' && runToken !== activeRunToken) return;
    currentState = state;
    const entry = {
      time: new Date().toISOString(),
      state,
      message,
      data: data || null
    };
    discoveryLog.push(entry);
    if (discoveryLog.length > MAX_LOG_ENTRIES) {
      discoveryLog.splice(0, discoveryLog.length - MAX_LOG_ENTRIES);
    }
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
    activeRunToken++;
    setStatus(AGENT_STATES.IDLE, 'Agent stopped by user');
    running = false;
  }

  function getParallelReadAgentCount(totalReads) {
    const total = Number.isFinite(totalReads) ? Math.max(0, totalReads) : 0;
    if (total === 0) return 0;
    const hardwareHint = typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : PARALLEL_READ_AGENT_LIMIT;
    const suggested = Math.max(
      PARALLEL_READ_AGENT_MIN,
      Math.min(PARALLEL_READ_AGENT_LIMIT, Math.floor(hardwareHint / 2) || PARALLEL_READ_AGENT_MIN)
    );
    return Math.min(total, suggested);
  }

  async function runParallelReadAgents(readQueue, emit, shouldStop, results) {
    if (!Array.isArray(readQueue) || readQueue.length === 0) {
      emit(AGENT_STATES.READING, 'No readable characteristics available for deep read pass');
      return;
    }

    const readAgentCount = getParallelReadAgentCount(readQueue.length);
    let nextIndex = 0;
    let completedReads = 0;
    let failedReads = 0;

    emit(
      AGENT_STATES.READING,
      `Launching ${readAgentCount} parallel read agent${readAgentCount === 1 ? '' : 's'} for ${readQueue.length} characteristic reads...`,
      { readAgents: readAgentCount, totalReads: readQueue.length }
    );

    const readAgents = Array.from({ length: readAgentCount }, (_, agentIndex) => (async () => {
      while (true) {
        if (shouldStop()) return;
        const queueIndex = nextIndex++;
        if (queueIndex >= readQueue.length) return;

        const ch = readQueue[queueIndex];
        try {
          await BluetoothScanner.readCharacteristic(ch);
          if (shouldStop()) return;
          completedReads++;
          results.readableValues++;
          emit(AGENT_STATES.READING,
            `[agent ${agentIndex + 1}] Read ${ch.name}: ${ch.value || '(empty)'}`,
            {
              char: ch.name,
              value: ch.value,
              readAgent: agentIndex + 1,
              progress: `${completedReads + failedReads}/${readQueue.length}`
            });
        } catch (_) {
          failedReads++;
          // Some characteristics refuse reads — that's normal
        }
      }
    })());

    await Promise.all(readAgents);
    if (shouldStop()) return;

    emit(AGENT_STATES.READING,
      `Read ${results.readableValues}/${readQueue.length} characteristic values using ${readAgentCount} parallel agents`,
      {
        readAgents: readAgentCount,
        attemptedReads: readQueue.length,
        successfulReads: results.readableValues,
        failedReads
      });
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

    const runToken = ++activeRunToken;
    running = true;
    stopRequested = false;
    discoveryLog = [];
    const emit = (state, message, data) => setStatus(state, message, data, runToken);
    const shouldStop = () => stopRequested || runToken !== activeRunToken;

    const results = {
      devicesFound: 0,
      servicesFound: 0,
      characteristicsFound: 0,
      readableValues: 0,
      writableChars: 0,
      captureId: null,
      vulnReport: null,
      analysis: null
    };

    try {
      // Phase 1: Scan for devices
      emit(AGENT_STATES.SCANNING, 'Initiating broad BLE scan...');

      let deviceInfo;
      try {
        deviceInfo = await BluetoothScanner.scanAll();
        if (shouldStop()) return results;
        results.devicesFound++;
        emit(AGENT_STATES.SCANNING,
          `Found device: ${deviceInfo.name} (${deviceInfo.id})`,
          { name: deviceInfo.name, id: deviceInfo.id });
      } catch (err) {
        if (err.name === 'NotFoundError') {
          emit(AGENT_STATES.IDLE, 'Scan cancelled - no device selected');
          return results;
        }
        throw err;
      }

      if (shouldStop()) return results;

      // Phase 2: Connect
      emit(AGENT_STATES.CONNECTING, `Connecting to ${deviceInfo.name}...`);

      try {
        await BluetoothScanner.connect(deviceInfo.id);
        if (shouldStop()) return results;
        emit(AGENT_STATES.CONNECTING, `Connected to ${deviceInfo.name}`);
      } catch (err) {
        emit(AGENT_STATES.ERROR,
          `Connection failed: ${err.message} - analyzing what we have`);
        if (shouldStop()) return results;
        return finalize(results, runToken);
      }

      if (shouldStop()) return results;

      // Phase 3: Enumerate services (already done by connect)
      emit(AGENT_STATES.ENUMERATING, 'Enumerating GATT services and characteristics...');

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
        emit(AGENT_STATES.ENUMERATING,
          `Found ${results.servicesFound} services, ${results.characteristicsFound} characteristics`,
          { services: results.servicesFound, chars: results.characteristicsFound });
      }

      if (shouldStop()) return results;

      // Phase 4: Deep read all readable characteristics
      emit(AGENT_STATES.READING, 'Reading all accessible characteristic values...');

      if (updatedInfo) {
        const readQueue = [];
        for (const svc of updatedInfo.services) {
          for (const ch of svc.characteristics) {
            if (ch.properties.includes('read') && ch.characteristic) {
              readQueue.push(ch);
            }
          }
        }
        await runParallelReadAgents(readQueue, emit, shouldStop, results);
      }

      if (shouldStop()) return results;

      // Phase 5: Capture profile
      emit(AGENT_STATES.CAPTURING, 'Capturing full device profile snapshot...');

      try {
        const profile = await Announcements.captureFromDevice();
        if (shouldStop()) return results;
        results.captureId = profile.id;
        emit(AGENT_STATES.CAPTURING,
          `Profile captured: ${profile.totalChars} chars, ${profile.readableChars} readable`,
          { captureId: profile.id });
      } catch (err) {
        emit(AGENT_STATES.ERROR, `Capture failed: ${err.message}`);
      }

      if (shouldStop()) return results;

      // Phase 6: Vulnerability assessment
      emit(AGENT_STATES.VULN_ASSESS, 'Running vulnerability assessment...');

      try {
        const vulnReport = Vulnerability.assessDevice(updatedInfo);
        results.vulnReport = vulnReport;
        emit(AGENT_STATES.VULN_ASSESS,
          `Assessment: ${vulnReport.riskLevel} risk (score ${vulnReport.riskScore}/100), ${vulnReport.findings.length} findings`,
          { riskLevel: vulnReport.riskLevel, riskScore: vulnReport.riskScore, findingCount: vulnReport.findings.length });
      } catch (err) {
        emit(AGENT_STATES.ERROR, `Vulnerability assessment failed: ${err.message}`);
      }

      if (shouldStop()) return results;

      // Phase 7: Analyze findings
      if (shouldStop()) return results;
      return finalize(results, runToken);

    } catch (err) {
      if (!shouldStop()) {
        emit(AGENT_STATES.ERROR, `Agent error: ${err.message}`);
      }
      return results;
    } finally {
      if (runToken === activeRunToken) {
        running = false;
      }
    }
  }

  function finalize(results, runToken) {
    if (runToken !== activeRunToken) return results;
    setStatus(AGENT_STATES.ANALYZING, 'Analyzing discovery results...', null, runToken);

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

    if (results.vulnReport) {
      analysis.summary.push(`Vulnerability score: ${results.vulnReport.riskScore}/100 (${results.vulnReport.riskLevel})`);
      for (const f of results.vulnReport.findings.filter(f => f.severity === 'critical' || f.severity === 'high')) {
        analysis.riskFactors.push(`[${f.severity.toUpperCase()}] ${f.title}: ${f.detail}`);
      }
      for (const rec of results.vulnReport.recommendations) {
        analysis.recommendations.push(`[${rec.priority.toUpperCase()}] ${rec.text}`);
      }
    } else {
      analysis.recommendations.push('Review writable characteristics for input validation testing');
      analysis.recommendations.push('Check if sensitive data is exposed via readable characteristics');
    }
    analysis.recommendations.push('Test replay of captured values to verify write protections');
    if (results.captureId) {
      analysis.recommendations.push('Profile captured — use Replay in the Announce tab for write testing');
    }

    results.analysis = analysis;

    setStatus(AGENT_STATES.COMPLETE, 'Discovery complete', results, runToken);
    return results;
  }

  /**
   * Run a quick scan-only pass (no connect).
   */
  async function quickScan() {
    if (running) return null;
    const runToken = ++activeRunToken;
    running = true;
    stopRequested = false;
    discoveryLog = [];
    const emit = (state, message, data) => setStatus(state, message, data, runToken);
    const shouldStop = () => stopRequested || runToken !== activeRunToken;

    emit(AGENT_STATES.SCANNING, 'Quick scan — select a device to identify...');

    try {
      const info = await BluetoothScanner.scanAll();
      if (shouldStop()) return null;
      emit(AGENT_STATES.COMPLETE,
        `Identified: ${info.name} (${info.id})`,
        { name: info.name, id: info.id });
      return info;
    } catch (err) {
      if (!shouldStop()) {
        emit(AGENT_STATES.IDLE, 'Quick scan cancelled');
      }
      return null;
    } finally {
      if (runToken === activeRunToken) {
        running = false;
      }
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
