/**
 * BlueTTool - Advanced Agentic Auto-Discovery Module
 *
 * Supports multiple concurrent agent instances processing different devices
 * in parallel. Each agent runs independently through the discovery pipeline
 * with its own state, log, and results.
 *
 * Key parallelization:
 *  - Cross-device: multiple agents process different devices simultaneously
 *  - Within-device: characteristic reads batched via Promise.allSettled
 *  - Phase overlap: capture + vulnerability assessment run concurrently
 *
 * For personal testing and educational purposes only.
 */
const Advanced = (() => {
  const agents = new Map();
  let nextAgentId = 1;
  let globalStopRequested = false;
  let statusCallback = null;
  let aggregateCallback = null;
  let discoveryLog = [];
  let activeRunToken = 0;
  const MAX_LOG_ENTRIES = 1000;
  const PARALLEL_READ_AGENT_LIMIT = 4;
  const PARALLEL_READ_AGENT_MIN = 2;
  const MAX_CONCURRENT_AGENTS = 4;
  const CHAR_READ_BATCH_SIZE = 5;

  const AGENT_STATES = {
    IDLE: 'idle',
    QUEUED: 'queued',
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

  function createAgent(deviceInfo) {
    const id = nextAgentId++;
    const agent = {
      id,
      deviceId: deviceInfo ? deviceInfo.id : null,
      deviceName: deviceInfo ? deviceInfo.name : 'Unknown',
      state: AGENT_STATES.IDLE,
      running: false,
      stopRequested: false,
      runToken: 0,
      log: [],
      results: null,
      startTime: null,
      endTime: null
    };
    agents.set(id, agent);
    return agent;
  }

  function emitAgent(agent, state, message, data) {
    agent.state = state;
    const entry = {
      time: new Date().toISOString(),
      state,
      message,
      data: data || null,
      agentId: agent.id,
      deviceName: agent.deviceName
    };
    agent.log.push(entry);
    if (agent.log.length > MAX_LOG_ENTRIES) {
      agent.log.splice(0, agent.log.length - MAX_LOG_ENTRIES);
    }
    Logger.info(`[Agent #${agent.id}] ${message}`);
    if (statusCallback) statusCallback(entry);
  }

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

  function setOnAggregate(cb) {
    aggregateCallback = cb;
  }

  function isRunning() {
    if (agents.size > 0) {
      for (const agent of agents.values()) {
        if (agent.running) return true;
      }
    }
    return currentState !== AGENT_STATES.IDLE &&
           currentState !== AGENT_STATES.COMPLETE &&
           currentState !== AGENT_STATES.ERROR;
  }

  function getState() {
    return currentState;
  }

  function getLog() {
    return [...discoveryLog];
  }

  function getAgents() {
    return Array.from(agents.values());
  }

  function getAgentCount() {
    let running = 0;
    let completed = 0;
    let total = agents.size;
    for (const agent of agents.values()) {
      if (agent.running) running++;
      if (agent.state === AGENT_STATES.COMPLETE) completed++;
    }
    return { total, running, completed };
  }

  function stop() {
    globalStopRequested = true;
    activeRunToken++;
    for (const agent of agents.values()) {
      agent.stopRequested = true;
      agent.running = false;
    }
    setStatus(AGENT_STATES.IDLE, 'All agents stopped by user');
    currentState = AGENT_STATES.IDLE;
  }

  function stopAgent(agentId) {
    const agent = agents.get(agentId);
    if (!agent || !agent.running) return;
    agent.stopRequested = true;
    agent.running = false;
    agent.runToken++;
    emitAgent(agent, AGENT_STATES.IDLE, `Agent #${agentId} stopped by user`);
  }

  function clearAgents() {
    stop();
    agents.clear();
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
   * Read characteristics in parallel batches for a single device.
   * Returns count of successfully read values.
   */
  async function parallelReadCharacteristics(updatedInfo, agent) {
    if (!updatedInfo) return 0;
    let readCount = 0;
    const readableChars = [];
    for (const svc of updatedInfo.services) {
      for (const ch of svc.characteristics) {
        if (ch.properties.includes('read') && ch.characteristic) {
          readableChars.push(ch);
        }
      }
    }

    for (let i = 0; i < readableChars.length; i += CHAR_READ_BATCH_SIZE) {
      if (agent.stopRequested) break;
      const batch = readableChars.slice(i, i + CHAR_READ_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(ch => BluetoothScanner.readCharacteristic(ch))
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          readCount++;
          emitAgent(agent, AGENT_STATES.READING,
            `Read ${batch[j].name}: ${batch[j].value || '(empty)'}`,
            { char: batch[j].name, value: batch[j].value });
        }
      }
    }
    return readCount;
  }

  /**
   * Run discovery pipeline for a single agent/device.
   * Uses internal parallelism for characteristic reads and
   * concurrent capture + vulnerability assessment.
   */
  async function runAgentDiscovery(agent, deviceInfo) {
    const localToken = ++agent.runToken;
    agent.running = true;
    agent.stopRequested = false;
    agent.startTime = Date.now();
    const shouldStop = () => agent.stopRequested || agent.runToken !== localToken || globalStopRequested;

    const results = {
      agentId: agent.id,
      deviceName: deviceInfo.name,
      deviceId: deviceInfo.id,
      devicesFound: 1,
      servicesFound: 0,
      characteristicsFound: 0,
      readableValues: 0,
      writableChars: 0,
      captureId: null,
      vulnReport: null,
      analysis: null
    };

    try {
      emitAgent(agent, AGENT_STATES.CONNECTING, `Connecting to ${deviceInfo.name}...`);

      try {
        await BluetoothScanner.connect(deviceInfo.id, { source: 'agent', deepReadOnEnumerate: false });
        if (shouldStop()) return results;
        emitAgent(agent, AGENT_STATES.CONNECTING, `Connected to ${deviceInfo.name}`);
      } catch (err) {
        emitAgent(agent, AGENT_STATES.ERROR,
          `Connection failed: ${err.message} — analyzing what we have`);
        if (shouldStop()) return results;
        return finalizeAgent(agent, results);
      }

      if (shouldStop()) return results;

      emitAgent(agent, AGENT_STATES.ENUMERATING, 'Enumerating GATT services and characteristics...');

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
        emitAgent(agent, AGENT_STATES.ENUMERATING,
          `Found ${results.servicesFound} services, ${results.characteristicsFound} characteristics`,
          { services: results.servicesFound, chars: results.characteristicsFound });
      }

      if (shouldStop()) return results;

      emitAgent(agent, AGENT_STATES.READING, 'Reading all accessible characteristics (parallel batches)...');
      results.readableValues = await parallelReadCharacteristics(updatedInfo, agent);
      emitAgent(agent, AGENT_STATES.READING,
        `Read ${results.readableValues} characteristic values`);

      if (shouldStop()) return results;

      emitAgent(agent, AGENT_STATES.CAPTURING, 'Running capture + vulnerability assessment in parallel...');
      const [captureResult, vulnResult] = await Promise.allSettled([
        (async () => {
          const profile = await Announcements.captureFromDeviceId(deviceInfo.id, { reRead: false });
          return profile;
        })(),
        (async () => {
          const freshInfo = BluetoothScanner.getDevices().find(d => d.id === deviceInfo.id);
          if (freshInfo) return Vulnerability.assessDevice(freshInfo);
          return null;
        })()
      ]);

      if (captureResult.status === 'fulfilled' && captureResult.value) {
        results.captureId = captureResult.value.id;
        emitAgent(agent, AGENT_STATES.CAPTURING,
          `Profile captured: ${captureResult.value.totalChars} chars, ${captureResult.value.readableChars} readable`,
          { captureId: captureResult.value.id });
      } else if (captureResult.status === 'rejected') {
        emitAgent(agent, AGENT_STATES.ERROR, `Capture failed: ${captureResult.reason?.message || 'unknown error'}`);
      }

      if (vulnResult.status === 'fulfilled' && vulnResult.value) {
        results.vulnReport = vulnResult.value;
        emitAgent(agent, AGENT_STATES.VULN_ASSESS,
          `Assessment: ${vulnResult.value.riskLevel} risk (score ${vulnResult.value.riskScore}/100), ${vulnResult.value.findings.length} findings`,
          { riskLevel: vulnResult.value.riskLevel, riskScore: vulnResult.value.riskScore });
      } else if (vulnResult.status === 'rejected') {
        emitAgent(agent, AGENT_STATES.ERROR, `Vulnerability assessment failed: ${vulnResult.reason?.message || 'unknown error'}`);
      }

      if (shouldStop()) return results;

      return finalizeAgent(agent, results);

    } catch (err) {
      if (!shouldStop()) {
        emitAgent(agent, AGENT_STATES.ERROR, `Agent error: ${err.message}`);
      }
      return results;
    } finally {
      agent.running = false;
      agent.endTime = Date.now();
    }
  }

  function finalizeAgent(agent, results) {
    emitAgent(agent, AGENT_STATES.ANALYZING, 'Analyzing discovery results...');

    const analysis = {
      summary: [],
      riskFactors: [],
      recommendations: []
    };

    analysis.summary.push(`Device: ${results.deviceName}`);
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
    agent.results = results;
    emitAgent(agent, AGENT_STATES.COMPLETE, 'Discovery complete', results);
    return results;
  }

  /**
   * Run parallel discovery across all discovered (disconnected) devices.
   * Connects to and analyzes multiple devices concurrently, respecting
   * the MAX_CONCURRENT_AGENTS limit.
   */
  async function runParallelDiscovery() {
    const allDevices = BluetoothScanner.getDevices();
    const targets = allDevices.filter(d => !d.connected);

    if (targets.length === 0) {
      setStatus(AGENT_STATES.IDLE, 'No discovered devices to analyze — scan for devices first');
      return [];
    }

    globalStopRequested = false;
    const runToken = ++activeRunToken;
    currentState = AGENT_STATES.SCANNING;

    const agentList = targets.map(dev => createAgent(dev));
    agentList.forEach(a => emitAgent(a, AGENT_STATES.QUEUED, `Queued for parallel processing`));

    setStatus(AGENT_STATES.SCANNING,
      `Launching ${agentList.length} parallel agent(s) across ${targets.length} device(s)`,
      { agentCount: agentList.length });

    if (aggregateCallback) {
      aggregateCallback({ type: 'start', agents: agentList.map(a => ({ id: a.id, deviceName: a.deviceName })) });
    }

    const allResults = [];
    const concurrencyLimit = Math.min(MAX_CONCURRENT_AGENTS, agentList.length);

    let idx = 0;
    async function runNext() {
      while (idx < agentList.length && !globalStopRequested) {
        const currentIdx = idx++;
        const agent = agentList[currentIdx];
        const device = targets[currentIdx];
        const result = await runAgentDiscovery(agent, device);
        allResults.push(result);
        if (aggregateCallback) {
          aggregateCallback({ type: 'agent_complete', agentId: agent.id, result });
        }
      }
    }

    const workers = [];
    for (let i = 0; i < concurrencyLimit; i++) {
      workers.push(runNext());
    }
    await Promise.all(workers);

    const aggregate = buildAggregateResults(allResults);
    setStatus(AGENT_STATES.COMPLETE, `Parallel discovery complete — ${allResults.length} device(s) analyzed`, aggregate);
    currentState = AGENT_STATES.COMPLETE;

    if (aggregateCallback) {
      aggregateCallback({ type: 'complete', aggregate });
    }

    return allResults;
  }

  /**
   * Build aggregate results from multiple agent runs.
   */
  function buildAggregateResults(allResults) {
    const aggregate = {
      totalDevices: allResults.length,
      totalServices: 0,
      totalCharacteristics: 0,
      totalReadable: 0,
      totalWritable: 0,
      highRiskDevices: 0,
      agentResults: allResults,
      analysis: {
        summary: [],
        riskFactors: [],
        recommendations: []
      }
    };

    for (const r of allResults) {
      aggregate.totalServices += r.servicesFound || 0;
      aggregate.totalCharacteristics += r.characteristicsFound || 0;
      aggregate.totalReadable += r.readableValues || 0;
      aggregate.totalWritable += r.writableChars || 0;
      if (r.vulnReport && (r.vulnReport.riskLevel === 'Critical' || r.vulnReport.riskLevel === 'High')) {
        aggregate.highRiskDevices++;
      }
    }

    aggregate.analysis.summary.push(`Analyzed ${aggregate.totalDevices} device(s) in parallel`);
    aggregate.analysis.summary.push(`${aggregate.totalServices} total services, ${aggregate.totalCharacteristics} total characteristics`);
    aggregate.analysis.summary.push(`${aggregate.totalReadable} readable values, ${aggregate.totalWritable} writable characteristics`);

    if (aggregate.highRiskDevices > 0) {
      aggregate.analysis.riskFactors.push(
        `${aggregate.highRiskDevices} device(s) rated High/Critical risk`
      );
    }

    for (const r of allResults) {
      if (r.analysis?.riskFactors) {
        for (const rf of r.analysis.riskFactors) {
          aggregate.analysis.riskFactors.push(`[${r.deviceName}] ${rf}`);
        }
      }
    }

    aggregate.analysis.recommendations.push('Compare vulnerability profiles across devices for common weaknesses');
    aggregate.analysis.recommendations.push('Prioritize high-risk devices for deeper manual testing');

    for (const r of allResults) {
      if (r.analysis?.recommendations) {
        for (const rec of r.analysis.recommendations) {
          if (!aggregate.analysis.recommendations.includes(rec)) {
            aggregate.analysis.recommendations.push(`[${r.deviceName}] ${rec}`);
          }
        }
      }
    }

    return aggregate;
  }

  /**
   * Run the full agentic discovery pipeline for a single device.
   * Backward-compatible entry point — scans, connects, then uses
   * internal parallelism for reads and concurrent capture + vuln.
   */
  async function runFullDiscovery() {
    if (isRunning()) {
      Logger.warn('Agent already running');
      return null;
    }

    const runToken = ++activeRunToken;
    globalStopRequested = false;
    discoveryLog = [];
    const emit = (state, message, data) => setStatus(state, message, data, runToken);
    const shouldStop = () => globalStopRequested || runToken !== activeRunToken;

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

    currentState = AGENT_STATES.SCANNING;

    try {
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
          currentState = AGENT_STATES.IDLE;
          return results;
        }
        throw err;
      }

      if (shouldStop()) return results;

      emit(AGENT_STATES.CONNECTING, `Connecting to ${deviceInfo.name}...`);

      try {
        await BluetoothScanner.connect(deviceInfo.id, { source: 'agent', deepReadOnEnumerate: false });
        if (shouldStop()) return results;
        emit(AGENT_STATES.CONNECTING, `Connected to ${deviceInfo.name}`);
      } catch (err) {
        emit(AGENT_STATES.ERROR,
          `Connection failed: ${err.message} - analyzing what we have`);
        if (shouldStop()) return results;
        return finalize(results, runToken);
      }

      if (shouldStop()) return results;

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

      emit(AGENT_STATES.READING, 'Reading all accessible characteristics (parallel batches)...');

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

      emit(AGENT_STATES.CAPTURING, 'Running capture + vulnerability assessment in parallel...');

      const [captureResult, vulnResult] = await Promise.allSettled([
        Announcements.captureFromDeviceId(deviceInfo.id, { reRead: false }).catch(err => {
          emit(AGENT_STATES.ERROR, `Capture failed: ${err.message}`);
          return null;
        }),
        (async () => {
          try {
            return Vulnerability.assessDevice(updatedInfo);
          } catch (err) {
            emit(AGENT_STATES.ERROR, `Vulnerability assessment failed: ${err.message}`);
            return null;
          }
        })()
      ]);

      if (captureResult.status === 'fulfilled' && captureResult.value) {
        results.captureId = captureResult.value.id;
        emit(AGENT_STATES.CAPTURING,
          `Profile captured: ${captureResult.value.totalChars} chars, ${captureResult.value.readableChars} readable`,
          { captureId: captureResult.value.id });
      }

      if (vulnResult.status === 'fulfilled' && vulnResult.value) {
        results.vulnReport = vulnResult.value;
        emit(AGENT_STATES.VULN_ASSESS,
          `Assessment: ${vulnResult.value.riskLevel} risk (score ${vulnResult.value.riskScore}/100), ${vulnResult.value.findings.length} findings`,
          { riskLevel: vulnResult.value.riskLevel, riskScore: vulnResult.value.riskScore, findingCount: vulnResult.value.findings.length });
      }

      if (shouldStop()) return results;

      return finalize(results, runToken);

    } catch (err) {
      if (!shouldStop()) {
        emit(AGENT_STATES.ERROR, `Agent error: ${err.message}`);
      }
      return results;
    } finally {
      if (runToken === activeRunToken) {
        currentState = AGENT_STATES.IDLE;
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
    if (isRunning()) return null;
    const runToken = ++activeRunToken;
    globalStopRequested = false;
    discoveryLog = [];
    currentState = AGENT_STATES.SCANNING;
    const emit = (state, message, data) => setStatus(state, message, data, runToken);
    const shouldStop = () => globalStopRequested || runToken !== activeRunToken;

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
        currentState = AGENT_STATES.IDLE;
      }
    }
  }

  return {
    runFullDiscovery,
    runParallelDiscovery,
    quickScan,
    stop,
    stopAgent,
    clearAgents,
    isRunning,
    getState,
    getLog,
    getAgents,
    getAgentCount,
    setOnStatus,
    setOnAggregate,
    AGENT_STATES,
    MAX_CONCURRENT_AGENTS
  };
})();
