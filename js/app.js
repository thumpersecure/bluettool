/**
 * BlueTTool - Main Application Controller
 * Wires UI events to Bluetooth scanner, audio, advanced agent, and sharing.
 * Optimized for Bluefy browser on iOS.
 */
document.addEventListener('DOMContentLoaded', () => {
  // --- Shared Utilities ---
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function isPrintable(str) {
    return /^[\x20-\x7E]+$/.test(str);
  }

  // --- Initialize ---
  Logger.init();
  Logger.info('BlueTTool initialized — Bluefy mobile app');
  Logger.info('Checking browser compatibility...');
  BluetoothScanner.checkSupport();

  // --- Tab Navigation ---
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => {
        // Only toggle visibility for tabs that are in the tab bar
        if (tc.id !== 'announcements') {
          tc.classList.remove('active');
        }
      });
      tab.classList.add('active');
      const targetEl = document.getElementById(target);
      if (targetEl) targetEl.classList.add('active');
    });
  });

  // --- Scanner Tab ---
  document.getElementById('btn-scan').addEventListener('click', async () => {
    const options = {};
    const nameFilterEnabled = document.getElementById('filter-name').checked;
    const nameValue = document.getElementById('filter-name-value').value.trim();
    const svcFilterEnabled = document.getElementById('filter-services').checked;
    const svcValue = document.getElementById('filter-service-value').value.trim();

    if (nameFilterEnabled && nameValue) {
      options.namePrefix = nameValue;
    }
    if (svcFilterEnabled && svcValue) {
      options.services = [svcValue];
    }

    try {
      await BluetoothScanner.scan(options);
      renderDeviceList();
    } catch (_) {
      // Error already logged by scanner
    }
  });

  document.getElementById('btn-scan-all').addEventListener('click', async () => {
    try {
      await BluetoothScanner.scanAll();
      renderDeviceList();
    } catch (_) {
      // Error already logged
    }
  });

  // --- Device List ---
  BluetoothScanner.setOnDeviceFound(() => {
    renderDeviceList();
  });

  BluetoothScanner.setOnConnectionChange((info, connected) => {
    renderDeviceList();
    if (connected) {
      showAudioOverlay();
      AudioPlayer.triggerOnConnect();
    }
  });

  document.getElementById('btn-clear-devices').addEventListener('click', () => {
    BluetoothScanner.clearDevices();
    renderDeviceList();
  });

  document.getElementById('btn-export-devices').addEventListener('click', () => {
    BluetoothScanner.exportCSV();
  });

  function renderDeviceList() {
    const list = document.getElementById('device-list');
    const devices = BluetoothScanner.getDevices();

    // Update device count in status bar
    const countEl = document.getElementById('device-count');
    if (countEl) {
      countEl.textContent = `${devices.length} device${devices.length !== 1 ? 's' : ''}`;
    }

    if (devices.length === 0) {
      list.innerHTML = '<div class="empty-state">No devices discovered yet. Start scanning!</div>';
      return;
    }

    list.innerHTML = devices.map(dev => `
      <div class="device-item" data-device-id="${escapeHtml(dev.id)}">
        <div class="device-item-header">
          <span class="device-name">${escapeHtml(dev.name)}</span>
          ${dev.connected ? '<span class="conn-badge">Connected</span>' : ''}
        </div>
        <div class="device-id-row">
          <span class="device-id-label">ID:</span>
          <span class="device-id">${escapeHtml(dev.id)}</span>
        </div>
        <div class="device-meta">
          ${dev.connected ? '<span class="device-tag tag-connected">GATT</span>' : ''}
          ${dev.services.length > 0 ? `<span class="device-tag tag-service">${dev.services.length} svc</span>` : ''}
          ${dev.characteristics.length > 0 ? `<span class="device-tag tag-char">${dev.characteristics.length} char</span>` : ''}
          <span class="device-tag tag-time">${new Date(dev.discovered).toLocaleTimeString()}</span>
        </div>
      </div>
    `).join('');

    // Bind click handlers
    list.querySelectorAll('.device-item').forEach(item => {
      item.addEventListener('click', () => {
        showDeviceDetail(item.dataset.deviceId);
      });
    });
  }

  // --- Device Detail Panel ---
  function showDeviceDetail(deviceId) {
    const devices = BluetoothScanner.getDevices();
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;

    const panel = document.getElementById('device-detail');
    const nameEl = document.getElementById('detail-device-name');
    const content = document.getElementById('detail-content');

    nameEl.textContent = dev.name;

    let html = `
      <div class="detail-section">
        <h3>Device Info</h3>
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">${escapeHtml(dev.name)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Device ID</span>
          <span class="detail-value detail-value-mono">${escapeHtml(dev.id)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value ${dev.connected ? 'val-connected' : 'val-disconnected'}">
            ${dev.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Discovered</span>
          <span class="detail-value">${new Date(dev.discovered).toLocaleString()}</span>
        </div>
      </div>
    `;

    // Connect / Disconnect button
    if (dev.connected) {
      html += `<button class="btn btn-danger btn-large" id="btn-detail-disconnect">Disconnect</button>`;
    } else {
      html += `<button class="btn btn-primary btn-large" id="btn-detail-connect">Connect &amp; Enumerate</button>`;
    }

    // Capture button for connected devices
    if (dev.connected) {
      html += `<button class="btn btn-secondary btn-large" id="btn-detail-capture" style="margin-top:8px;">Capture Profile Snapshot</button>`;
    }

    // Services
    if (dev.services.length > 0) {
      html += `<div class="detail-section"><h3>GATT Services (${dev.services.length})</h3>`;
      for (const svc of dev.services) {
        html += `<div class="service-item">
          <strong>${escapeHtml(svc.name)}</strong>
          <div class="service-uuid">${escapeHtml(svc.uuid)}</div>`;

        for (const char of svc.characteristics) {
          html += `<div class="char-item">
            <div><strong>${escapeHtml(char.name)}</strong></div>
            <div class="char-uuid">${escapeHtml(char.uuid)}</div>
            <div class="char-props">
              ${char.properties.map(p => `<span class="char-prop-tag">${p}</span>`).join('')}
            </div>`;

          if (char.value) {
            html += `<div class="char-value">Hex: ${escapeHtml(char.value)}</div>`;
          }
          if (char.textValue && char.textValue.length > 0 && isPrintable(char.textValue)) {
            html += `<div class="char-value">Text: ${escapeHtml(char.textValue)}</div>`;
          }

          html += `<div class="char-actions">`;
          if (char.properties.includes('read')) {
            html += `<button class="btn btn-secondary btn-small btn-char-read"
              data-char-uuid="${escapeHtml(char.uuid)}" data-device-id="${escapeHtml(dev.id)}">Read</button>`;
          }
          if (char.properties.includes('notify') || char.properties.includes('indicate')) {
            html += `<button class="btn btn-secondary btn-small btn-char-notify"
              data-char-uuid="${escapeHtml(char.uuid)}" data-device-id="${escapeHtml(dev.id)}">Subscribe</button>`;
          }
          html += `</div></div>`; // char-actions, char-item
        }

        html += `</div>`; // service-item
      }
      html += `</div>`; // detail-section
    }

    content.innerHTML = html;
    panel.classList.remove('hidden');

    // Bind detail panel buttons
    const connectBtn = document.getElementById('btn-detail-connect');
    if (connectBtn) {
      connectBtn.addEventListener('click', async () => {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        try {
          await BluetoothScanner.connect(deviceId);
          showDeviceDetail(deviceId);
          renderDeviceList();
        } catch (_) {
          connectBtn.disabled = false;
          connectBtn.textContent = 'Connect & Enumerate';
        }
      });
    }

    const disconnectBtn = document.getElementById('btn-detail-disconnect');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        BluetoothScanner.disconnect(deviceId);
        showDeviceDetail(deviceId);
        renderDeviceList();
      });
    }

    const captureBtn = document.getElementById('btn-detail-capture');
    if (captureBtn) {
      captureBtn.addEventListener('click', async () => {
        captureBtn.disabled = true;
        captureBtn.textContent = 'Capturing...';
        try {
          await Announcements.captureFromDevice();
          captureBtn.textContent = 'Captured!';
          setTimeout(() => {
            captureBtn.textContent = 'Capture Profile Snapshot';
            captureBtn.disabled = false;
          }, 2000);
        } catch (_) {
          captureBtn.textContent = 'Capture Failed';
          captureBtn.disabled = false;
        }
      });
    }

    // Char read buttons — always get fresh device list to avoid stale refs
    content.querySelectorAll('.btn-char-read').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const charUuid = btn.dataset.charUuid;
        const freshDevices = BluetoothScanner.getDevices();
        const d = freshDevices.find(x => x.id === btn.dataset.deviceId);
        if (!d) return;
        const charInfo = d.characteristics.find(c => c.uuid === charUuid);
        if (!charInfo) return;
        btn.disabled = true;
        btn.textContent = 'Reading...';
        try {
          await BluetoothScanner.readCharacteristic(charInfo);
          showDeviceDetail(deviceId);
        } catch (_) {
          btn.disabled = false;
          btn.textContent = 'Read';
        }
      });
    });

    // Char notify buttons
    content.querySelectorAll('.btn-char-notify').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const charUuid = btn.dataset.charUuid;
        const freshDevices = BluetoothScanner.getDevices();
        const d = freshDevices.find(x => x.id === btn.dataset.deviceId);
        if (!d) return;
        const charInfo = d.characteristics.find(c => c.uuid === charUuid);
        if (!charInfo) return;
        btn.disabled = true;
        btn.textContent = 'Subscribing...';
        try {
          await BluetoothScanner.subscribeNotifications(charInfo, () => {
            showDeviceDetail(deviceId);
          });
          btn.textContent = 'Subscribed';
        } catch (_) {
          btn.disabled = false;
          btn.textContent = 'Subscribe';
        }
      });
    });
  }

  document.getElementById('btn-back-devices').addEventListener('click', () => {
    document.getElementById('device-detail').classList.add('hidden');
  });

  // --- Audio Tab ---
  document.getElementById('btn-play-dtmf').addEventListener('click', () => {
    AudioPlayer.playDTMFSequence();
  });

  document.getElementById('btn-play-file').addEventListener('click', () => {
    AudioPlayer.playFile();
  });

  document.getElementById('btn-stop-audio').addEventListener('click', () => {
    AudioPlayer.stopAll();
  });

  document.getElementById('btn-silence-all').addEventListener('click', () => {
    // Stop any playing audio
    AudioPlayer.stopAll();
    // Disconnect all BLE devices
    const devices = BluetoothScanner.getDevices();
    let disconnected = 0;
    for (const dev of devices) {
      if (dev.connected) {
        BluetoothScanner.disconnect(dev.id);
        disconnected++;
      }
    }
    Logger.success(`Silenced: stopped audio, disconnected ${disconnected} device(s)`);
    renderDeviceList();
    // Visual feedback
    const btn = document.getElementById('btn-silence-all');
    btn.textContent = 'Done!';
    setTimeout(() => {
      btn.textContent = 'Silence All — Disconnect Devices';
    }, 2000);
  });

  // --- Sharing ---
  document.getElementById('btn-share-audio').addEventListener('click', () => {
    Sharing.shareAudioFile();
  });

  document.getElementById('btn-share-hearts').addEventListener('click', () => {
    Sharing.shareHearts();
  });

  document.getElementById('btn-share-link').addEventListener('click', () => {
    Sharing.shareLink(
      'https://thumpersecure.github.io/bluettool/',
      'BlueTTool',
      'BLE scanner and testing tool for Bluefy on iOS'
    );
  });

  // --- Audio Overlay ---
  function showAudioOverlay() {
    const overlay = document.getElementById('audio-overlay');
    if (overlay) overlay.classList.remove('hidden');
  }

  document.getElementById('btn-close-audio-overlay').addEventListener('click', () => {
    const overlay = document.getElementById('audio-overlay');
    if (overlay) overlay.classList.add('hidden');
    AudioPlayer.stopAll();
  });

  // --- Advanced / Agent Tab ---
  const agentStatusCard = document.getElementById('agent-status-card');
  const agentResultsCard = document.getElementById('agent-results-card');
  const agentFeed = document.getElementById('agent-feed');
  const agentBadge = document.getElementById('agent-state-badge');
  const agentResults = document.getElementById('agent-results');
  const btnAgentStop = document.getElementById('btn-agent-stop');

  Advanced.setOnStatus((entry) => {
    agentStatusCard.style.display = 'block';
    agentBadge.textContent = entry.state;
    agentBadge.className = 'agent-badge agent-' + entry.state;

    const line = document.createElement('div');
    line.className = 'agent-feed-line';
    line.innerHTML = `<span class="agent-feed-time">${new Date(entry.time).toLocaleTimeString()}</span>
      <span class="agent-feed-msg">${escapeHtml(entry.message)}</span>`;
    agentFeed.appendChild(line);
    agentFeed.scrollTop = agentFeed.scrollHeight;

    // Show results when complete
    if (entry.state === 'complete' && entry.data && entry.data.analysis) {
      renderAgentResults(entry.data);
    }

    // Update button states
    const isRunning = Advanced.isRunning();
    btnAgentStop.disabled = !isRunning;
    document.getElementById('btn-agent-full').disabled = isRunning;
    document.getElementById('btn-agent-quick').disabled = isRunning;
  });

  document.getElementById('btn-agent-full').addEventListener('click', async () => {
    agentFeed.innerHTML = '';
    agentResultsCard.style.display = 'none';
    await Advanced.runFullDiscovery();
    renderDeviceList();
  });

  document.getElementById('btn-agent-quick').addEventListener('click', async () => {
    agentFeed.innerHTML = '';
    agentResultsCard.style.display = 'none';
    await Advanced.quickScan();
    renderDeviceList();
  });

  btnAgentStop.addEventListener('click', () => {
    Advanced.stop();
  });

  function renderAgentResults(data) {
    if (!data.analysis) return;
    agentResultsCard.style.display = 'block';

    let html = '<div class="agent-results-section">';
    html += '<h3>Summary</h3>';
    html += '<ul>' + data.analysis.summary.map(s => `<li>${escapeHtml(s)}</li>`).join('') + '</ul>';

    if (data.analysis.riskFactors.length > 0) {
      html += '<h3>Findings</h3>';
      html += '<ul class="agent-risks">' +
        data.analysis.riskFactors.map(r => `<li>${escapeHtml(r)}</li>`).join('') + '</ul>';
    }

    html += '<h3>Recommendations</h3>';
    html += '<ul>' + data.analysis.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('') + '</ul>';
    html += '</div>';

    agentResults.innerHTML = html;
  }

  // --- Log Tab ---
  document.getElementById('btn-copy-log').addEventListener('click', () => {
    Logger.copyToClipboard();
  });

  document.getElementById('btn-clear-log').addEventListener('click', () => {
    Logger.clear();
  });

  Logger.info('Ready. Use Bluefy browser on iOS for full BLE support.');
});
