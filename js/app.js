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

  // --- Toast Notifications ---
  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // --- Confirm Dialog ---
  function showConfirm(title, message) {
    return new Promise(resolve => {
      const dialog = document.getElementById('confirm-dialog');
      const titleEl = document.getElementById('confirm-title');
      const messageEl = document.getElementById('confirm-message');
      const okBtn = document.getElementById('confirm-ok');
      const cancelBtn = document.getElementById('confirm-cancel');
      if (!dialog || !titleEl || !messageEl || !okBtn || !cancelBtn) {
        resolve(false);
        return;
      }
      titleEl.textContent = title;
      messageEl.textContent = message;
      dialog.classList.remove('hidden');

      function cleanup(result) {
        dialog.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        dialog.removeEventListener('click', onOverlayClick);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onOverlayClick(e) {
        if (e.target === dialog) cleanup(false);
      }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      dialog.addEventListener('click', onOverlayClick);
    });
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
      tabContents.forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      const targetEl = document.getElementById(target);
      if (targetEl) targetEl.classList.add('active');
    });
  });

  // --- Scanner Tab ---
  const btnScan = document.getElementById('btn-scan');
  const btnScanAll = document.getElementById('btn-scan-all');

  // Classic Bluetooth (Web Serial)
  const btnSerialConnect = document.getElementById('btn-serial-connect');
  const serialStatusEl = document.getElementById('serial-status');
  if (btnSerialConnect && typeof SerialBluetooth !== 'undefined') {
    function updateSerialButton() {
      btnSerialConnect.textContent = SerialBluetooth.isConnected() ? 'Disconnect Classic BT' : 'Connect Classic BT Device';
    }
    btnSerialConnect.addEventListener('click', async () => {
      if (!SerialBluetooth.isSupported()) {
        showToast('Web Serial not available. Use Chrome 117+ for Classic BT.', 'error');
        return;
      }
      try {
        if (SerialBluetooth.isConnected()) {
          await SerialBluetooth.close();
          if (serialStatusEl) serialStatusEl.textContent = '';
          updateSerialButton();
          showToast('Classic BT disconnected', 'info');
          return;
        }
        await SerialBluetooth.requestPort();
        await SerialBluetooth.open(9600);
        if (serialStatusEl) serialStatusEl.textContent = 'Connected';
        updateSerialButton();
        showToast('Classic BT device connected', 'success');
      } catch (err) {
        if (err.name !== 'NotFoundError') {
          showToast(err?.message || 'Connection failed', 'error');
        }
        if (serialStatusEl) serialStatusEl.textContent = '';
        updateSerialButton();
      }
    });
  }

  btnScan?.addEventListener('click', async () => {
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

    btnScan.disabled = true;
    btnScan.textContent = 'Scanning...';
    try {
      await BluetoothScanner.scan(options);
      renderDeviceList();
      showToast('Device found', 'success');
    } catch (err) {
      showToast(err?.message || 'Scan cancelled or failed', 'error');
    } finally {
      btnScan.disabled = false;
      btnScan.textContent = 'Scan for Devices';
    }
  });

  btnScanAll?.addEventListener('click', async () => {
    btnScanAll.disabled = true;
    btnScanAll.textContent = 'Scanning...';
    try {
      await BluetoothScanner.scanAll();
      renderDeviceList();
      showToast('Device found', 'success');
    } catch (err) {
      showToast(err?.message || 'Scan cancelled or failed', 'error');
    } finally {
      btnScanAll.disabled = false;
      btnScanAll.textContent = 'Scan All (No Filter)';
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
      showToast(`Connected to ${info.name}`, 'success');
    } else {
      showToast(`Disconnected from ${info.name}`, 'info');
    }
  });

  document.getElementById('btn-clear-devices').addEventListener('click', async () => {
    const devices = BluetoothScanner.getDevices();
    if (devices.length === 0) return;
    const confirmed = await showConfirm('Clear All Devices',
      `Remove ${devices.length} device(s) from the list? Connected devices will be disconnected.`);
    if (!confirmed) return;
    BluetoothScanner.clearDevices();
    renderDeviceList();
    showToast('Device list cleared', 'info');
  });

  document.getElementById('btn-export-devices').addEventListener('click', () => {
    BluetoothScanner.exportCSV();
    showToast('CSV exported', 'success');
  });

  function renderDeviceList() {
    const list = document.getElementById('device-list');
    const devices = BluetoothScanner.getDevices();

    const countEl = document.getElementById('device-count');
    if (countEl) {
      countEl.textContent = `${devices.length} device${devices.length !== 1 ? 's' : ''}`;
    }

    if (devices.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">&#x1F4E1;</div>
        <p>No devices discovered yet</p>
        <p class="empty-hint">Go to Scan tab to find nearby BLE devices</p>
      </div>`;
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
        ${!dev.connected ? `<div class="device-quick-actions">
          <button class="btn btn-secondary btn-small btn-reconnect" data-device-id="${escapeHtml(dev.id)}">Reconnect</button>
        </div>` : ''}
      </div>
    `).join('');

    // Click on device item -> detail
    list.querySelectorAll('.device-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't open detail if clicking a button
        if (e.target.closest('.btn-reconnect')) return;
        showDeviceDetail(item.dataset.deviceId);
      });
    });

    // Reconnect buttons
    list.querySelectorAll('.btn-reconnect').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        btn.textContent = 'Connecting...';
        try {
          await BluetoothScanner.connect(btn.dataset.deviceId);
          renderDeviceList();
        } catch (_) {
          btn.disabled = false;
          btn.textContent = 'Reconnect';
          showToast('Connection failed', 'error');
        }
      });
    });

    // Update captures section
    renderCaptures();
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
        <div class="detail-row">
          <span class="detail-label">Services</span>
          <span class="detail-value">${dev.services.length}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Characteristics</span>
          <span class="detail-value">${dev.characteristics.length}</span>
        </div>
      </div>
    `;

    // Connect / Disconnect
    if (dev.connected) {
      html += `<button class="btn btn-danger btn-large" id="btn-detail-disconnect">Disconnect</button>`;
      html += `<button class="btn btn-secondary btn-large" id="btn-detail-capture" style="margin-top:8px;">Capture Profile Snapshot</button>`;
    } else {
      html += `<button class="btn btn-primary btn-large" id="btn-detail-connect">Connect &amp; Enumerate</button>`;
    }

    // Services + Characteristics
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
          if (char.properties.includes('write') || char.properties.includes('writeNoResp')) {
            html += `<button class="btn btn-warning btn-small btn-char-write-toggle"
              data-char-uuid="${escapeHtml(char.uuid)}" data-device-id="${escapeHtml(dev.id)}">Write</button>`;
          }
          html += `</div>`;

          // Write input (hidden by default)
          if (char.properties.includes('write') || char.properties.includes('writeNoResp')) {
            html += `<div class="char-write-form hidden" data-write-for="${escapeHtml(char.uuid)}">
              <input type="text" class="input-field char-write-input" placeholder="Hex value (e.g., 01:ff:ab)" data-char-uuid="${escapeHtml(char.uuid)}" data-device-id="${escapeHtml(dev.id)}">
              <button class="btn btn-warning btn-small btn-char-write-send" data-char-uuid="${escapeHtml(char.uuid)}" data-device-id="${escapeHtml(dev.id)}">Send</button>
            </div>`;
          }

          html += `</div>`; // char-item
        }

        html += `</div>`; // service-item
      }
      html += `</div>`; // detail-section
    }

    content.innerHTML = html;
    panel.classList.remove('hidden');

    // --- Bind detail panel buttons ---
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
          showToast('Connection failed', 'error');
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
          showToast('Profile captured', 'success');
          renderCaptures();
          setTimeout(() => {
            captureBtn.textContent = 'Capture Profile Snapshot';
            captureBtn.disabled = false;
          }, 2000);
        } catch (_) {
          captureBtn.textContent = 'Capture Failed';
          captureBtn.disabled = false;
          showToast('Capture failed', 'error');
        }
      });
    }

    // Char read buttons
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
          showToast('Read failed', 'error');
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
          showToast('Subscribed to notifications', 'success');
        } catch (_) {
          btn.disabled = false;
          btn.textContent = 'Subscribe';
          showToast('Subscribe failed', 'error');
        }
      });
    });

    // Write toggle buttons — show/hide write form
    content.querySelectorAll('.btn-char-write-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const form = content.querySelector(`.char-write-form[data-write-for="${btn.dataset.charUuid}"]`);
        if (form) form.classList.toggle('hidden');
      });
    });

    // Write send buttons
    content.querySelectorAll('.btn-char-write-send').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const charUuid = btn.dataset.charUuid;
        const input = content.querySelector(`.char-write-input[data-char-uuid="${charUuid}"]`);
        if (!input) return;
        const hexVal = input.value.trim();
        if (!hexVal) { showToast('Enter a hex value first', 'error'); return; }
        // Validate hex
        if (!/^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2})*$/.test(hexVal) && !/^[0-9a-fA-F]+$/.test(hexVal)) {
          showToast('Invalid hex format. Use XX:XX or XXXX', 'error');
          return;
        }
        const freshDevices = BluetoothScanner.getDevices();
        const d = freshDevices.find(x => x.id === btn.dataset.deviceId);
        if (!d) return;
        const charInfo = d.characteristics.find(c => c.uuid === charUuid);
        if (!charInfo) return;
        btn.disabled = true;
        btn.textContent = 'Writing...';
        try {
          await BluetoothScanner.writeCharacteristic(charInfo, hexVal);
          showToast('Value written', 'success');
          btn.textContent = 'Sent!';
          setTimeout(() => { btn.textContent = 'Send'; btn.disabled = false; }, 1500);
          // Re-read to see updated value
          if (charInfo.properties.includes('read')) {
            try {
              await BluetoothScanner.readCharacteristic(charInfo);
              showDeviceDetail(deviceId);
            } catch (_) { /* ok */ }
          }
        } catch (_) {
          btn.disabled = false;
          btn.textContent = 'Send';
          showToast('Write failed', 'error');
        }
      });
    });
  }

  document.getElementById('btn-back-devices').addEventListener('click', () => {
    document.getElementById('device-detail').classList.add('hidden');
  });

  // --- Captures / Replay ---
  function renderCaptures() {
    const capturesSection = document.getElementById('captures-section');
    const capturedList = document.getElementById('captured-list');
    const replaySection = document.getElementById('replay-section');
    const mimicSelect = document.getElementById('mimic-select');
    const captures = Announcements.getCaptures();

    if (captures.length === 0) {
      capturesSection.style.display = 'none';
      return;
    }

    capturesSection.style.display = 'block';

    capturedList.innerHTML = captures.map(cap => `
      <div class="captured-item">
        <strong>${escapeHtml(cap.deviceName)}</strong>
        <div class="captured-detail">${new Date(cap.timestamp).toLocaleString()}</div>
        <div class="captured-detail">Services: ${cap.services.length} | Chars: ${cap.totalChars} (${cap.readableChars} readable)</div>
        <button class="btn btn-secondary btn-small btn-export-capture" data-capture-id="${cap.id}">Export JSON</button>
      </div>
    `).join('');

    capturedList.querySelectorAll('.btn-export-capture').forEach(btn => {
      btn.addEventListener('click', () => {
        Announcements.exportCapture(btn.dataset.captureId);
        showToast('JSON exported', 'success');
      });
    });

    // Replay section
    const connected = BluetoothScanner.getConnectedDevice();
    if (connected) {
      replaySection.style.display = 'block';
      mimicSelect.innerHTML = '<option value="">Select captured profile...</option>' +
        captures.map(c => `<option value="${c.id}">${escapeHtml(c.deviceName)} (${new Date(c.timestamp).toLocaleTimeString()})</option>`).join('');
    } else {
      replaySection.style.display = 'none';
    }
  }

  // Mimic select change — use a single handler, not re-bound each render
  const mimicSelect = document.getElementById('mimic-select');
  const mimicBtn = document.getElementById('btn-mimic');
  mimicSelect.addEventListener('change', () => {
    mimicBtn.disabled = !mimicSelect.value || !BluetoothScanner.getConnectedDevice();
  });

  mimicBtn.addEventListener('click', async () => {
    const captureId = mimicSelect.value;
    if (!captureId) return;
    const statusEl = document.getElementById('mimic-status');
    statusEl.textContent = 'Replaying...';
    statusEl.className = 'mimic-status';
    mimicBtn.disabled = true;
    try {
      const result = await Announcements.replayToDevice(captureId);
      statusEl.textContent = `Done: ${result.written} written, ${result.skipped} skipped, ${result.failed} failed`;
      statusEl.classList.add('mimic-success');
      showToast('Replay complete', 'success');
    } catch (err) {
      statusEl.textContent = `Failed: ${err.message}`;
      statusEl.classList.add('mimic-error');
      showToast('Replay failed', 'error');
    } finally {
      mimicBtn.disabled = false;
    }
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
    showToast('Audio stopped', 'info');
  });

  // Volume slider
  const volumeSlider = document.getElementById('volume-slider');
  const volumeValue = document.getElementById('volume-value');
  volumeSlider.addEventListener('input', () => {
    const vol = parseInt(volumeSlider.value, 10);
    AudioPlayer.setVolume(vol / 100);
    volumeValue.textContent = vol + '%';
  });

  document.getElementById('btn-silence-all').addEventListener('click', async () => {
    const devices = BluetoothScanner.getDevices();
    const connCount = devices.filter(d => d.connected).length;
    if (connCount > 0) {
      const confirmed = await showConfirm('Silence All',
        `Stop audio and disconnect ${connCount} device(s)?`);
      if (!confirmed) return;
    }
    AudioPlayer.stopAll();
    let disconnected = 0;
    for (const dev of BluetoothScanner.getDevices()) {
      if (dev.connected) {
        BluetoothScanner.disconnect(dev.id);
        disconnected++;
      }
    }
    renderDeviceList();
    showToast(`Silenced: ${disconnected} device(s) disconnected`, 'success');
  });

  // --- Sharing ---
  document.getElementById('btn-share-audio')?.addEventListener('click', async () => {
    const ok = await Sharing.shareAudioFile();
    showToast(ok ? 'Audio shared' : 'Audio downloaded (share not available)', ok ? 'success' : 'info');
  });

  document.getElementById('btn-share-hearts')?.addEventListener('click', async () => {
    const ok = await Sharing.shareHearts();
    showToast(ok ? 'Hearts shared' : 'Hearts copied to clipboard', ok ? 'success' : 'info');
  });

  document.getElementById('btn-share-link')?.addEventListener('click', async () => {
    const ok = await Sharing.shareLink(
      'https://thumpersecure.github.io/bluettool/',
      'BlueTTool',
      'BLE scanner and testing tool for Bluefy on iOS'
    );
    showToast(ok ? 'Link shared' : 'Link copied to clipboard', ok ? 'success' : 'info');
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
  const agentResultsEl = document.getElementById('agent-results');
  const btnAgentStop = document.getElementById('btn-agent-stop');
  const btnAgentFull = document.getElementById('btn-agent-full');
  const btnAgentQuick = document.getElementById('btn-agent-quick');

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

    if (entry.state === 'complete' && entry.data && entry.data.analysis) {
      renderAgentResults(entry.data);
    }

    const isRunning = Advanced.isRunning();
    btnAgentStop.disabled = !isRunning;
    btnAgentFull.disabled = isRunning;
    btnAgentQuick.disabled = isRunning;
  });

  btnAgentFull.addEventListener('click', async () => {
    agentFeed.innerHTML = '';
    agentResultsCard.style.display = 'none';
    document.getElementById('vuln-report-card').style.display = 'none';
    await Advanced.runFullDiscovery();
    renderDeviceList();
  });

  btnAgentQuick.addEventListener('click', async () => {
    agentFeed.innerHTML = '';
    agentResultsCard.style.display = 'none';
    document.getElementById('vuln-report-card').style.display = 'none';
    await Advanced.quickScan();
    renderDeviceList();
  });

  btnAgentStop.addEventListener('click', () => {
    Advanced.stop();
    showToast('Agent stopped', 'info');
  });

  function renderAgentResults(data) {
    if (!data?.analysis) return;
    const a = data.analysis;
    const summary = Array.isArray(a.summary) ? a.summary : [];
    const riskFactors = Array.isArray(a.riskFactors) ? a.riskFactors : [];
    const recommendations = Array.isArray(a.recommendations) ? a.recommendations : [];

    agentResultsCard.style.display = 'block';

    let html = '<div class="agent-results-section">';
    html += '<h3>Summary</h3>';
    html += '<ul>' + summary.map(s => `<li>${escapeHtml(s)}</li>`).join('') + '</ul>';

    if (riskFactors.length > 0) {
      html += '<h3>Findings</h3>';
      html += '<ul class="agent-risks">' +
        riskFactors.map(r => `<li>${escapeHtml(r)}</li>`).join('') + '</ul>';
    }

    html += '<h3>Recommendations</h3>';
    html += '<ul>' + recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('') + '</ul>';
    html += '</div>';

    agentResultsEl.innerHTML = html;

    // Render vulnerability report if available
    if (data.vulnReport) {
      renderVulnReport(data.vulnReport);
    }
  }

  function renderVulnReport(report) {
    const card = document.getElementById('vuln-report-card');
    card.style.display = 'block';

    // Score banner
    const banner = document.getElementById('vuln-score-banner');
    const riskClass = 'vuln-risk-' + report.riskLevel.toLowerCase();
    banner.className = 'vuln-score-banner ' + riskClass;
    banner.innerHTML = `
      <div>
        <div class="vuln-score-label">${escapeHtml(report.riskLevel)} Risk</div>
        <div style="font-size:11px;color:var(--text-secondary);">${escapeHtml(report.deviceName)}</div>
      </div>
      <div class="vuln-score-value">${report.riskScore}/100</div>
    `;

    // Stats
    const statsEl = document.getElementById('vuln-stats');
    statsEl.innerHTML = [
      `Readable: ${report.stats.totalReadable}`,
      `Writable: ${report.stats.totalWritable}`,
      `Sensitive: ${report.stats.sensitiveExposed}`,
      `Notify: ${report.stats.notifyChars}`,
      `Findings: ${report.findings.length}`
    ].map(s => `<span class="vuln-stat">${s}</span>`).join('');

    // Findings
    const findingsEl = document.getElementById('vuln-findings');
    if (report.findings.length === 0) {
      findingsEl.innerHTML = '<div style="font-size:12px;color:var(--text-hint);text-align:center;padding:12px;">No vulnerability findings</div>';
    } else {
      findingsEl.innerHTML = report.findings.map(f => `
        <div class="vuln-finding sev-${f.severity}">
          <div class="vuln-finding-header">
            <span class="vuln-sev-badge sev-${f.severity}">${escapeHtml(f.severity)}</span>
            <span class="vuln-finding-title">${escapeHtml(f.title)}</span>
          </div>
          <div class="vuln-finding-detail">${escapeHtml(f.detail)}</div>
          <div class="vuln-finding-category">${escapeHtml(f.category)}</div>
        </div>
      `).join('');
    }

    // Recommendations
    const recsEl = document.getElementById('vuln-recommendations');
    recsEl.innerHTML = '<h3>Recommendations</h3>' +
      report.recommendations.map(r => `
        <div class="vuln-rec">
          <span class="vuln-rec-priority pri-${r.priority}">${escapeHtml(r.priority)}</span>
          ${escapeHtml(r.text)}
        </div>
      `).join('');
  }

  // --- Calls Tab ---
  const callImportInput = document.getElementById('call-import-input');
  const btnImportCalls = document.getElementById('btn-import-calls');
  const btnExportCalls = document.getElementById('btn-export-calls');
  const btnClearCalls = document.getElementById('btn-clear-calls');
  const callList = document.getElementById('call-list');

  btnImportCalls?.addEventListener('click', () => callImportInput?.click());

  callImportInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await CallHistory.importFromFile(file);
      renderCallList();
      showToast(`Imported ${count} call(s)`, 'success');
    } catch (err) {
      Logger.error('Call import failed:', err);
      showToast('Import failed: ' + (err.message || 'Invalid file'), 'error');
    }
    callImportInput.value = '';
  });

  btnExportCalls?.addEventListener('click', () => {
    const calls = CallHistory.getCalls();
    if (calls.length === 0) {
      showToast('No calls to export', 'info');
      return;
    }
    const csv = CallHistory.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'call-history.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported', 'success');
  });

  btnClearCalls?.addEventListener('click', async () => {
    const calls = CallHistory.getCalls();
    if (calls.length === 0) return;
    const confirmed = await showConfirm('Clear Call History',
      `Remove ${calls.length} call(s) from the list?`);
    if (!confirmed) return;
    CallHistory.clearCalls();
    renderCallList();
    showToast('Call history cleared', 'info');
  });

  function renderCallList() {
    if (!callList) return;
    const calls = typeof CallHistory !== 'undefined' ? CallHistory.getCalls() : [];
    if (calls.length === 0) {
      callList.innerHTML = `<div class="empty-state">
        <div class="empty-icon">&#x1F4DE;</div>
        <p>No calls imported yet</p>
        <p class="empty-hint">Import a CSV or JSON file to view call history</p>
      </div>`;
      return;
    }
    callList.innerHTML = calls.map(c => `
      <div class="call-item">
        <span class="call-item-date">${escapeHtml(c.date)}</span>
        <span class="call-item-number">${escapeHtml(c.name || c.number)}</span>
        <span class="call-item-duration">${escapeHtml(c.duration)}</span>
        <span class="call-item-type">${escapeHtml(c.type)}</span>
      </div>
    `).join('');
  }

  // --- Log Tab ---
  document.getElementById('btn-copy-log').addEventListener('click', () => {
    Logger.copyToClipboard();
    showToast('Log copied to clipboard', 'success');
  });

  document.getElementById('btn-clear-log').addEventListener('click', async () => {
    const confirmed = await showConfirm('Clear Log', 'Clear all log entries?');
    if (!confirmed) return;
    Logger.clear();
    showToast('Log cleared', 'info');
  });

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Service worker registration failed — not critical
    });
  }

  Logger.info('Ready. Use Bluefy browser on iOS for full BLE support.');
});
