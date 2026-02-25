/**
 * BlueTTool - Main Application Controller
 * Wires together UI events with Bluetooth scanner, announcements, and Rick Roll
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize modules
  Logger.init();
  Logger.info('BlueTTool initialized');
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
      document.getElementById(target).classList.add('active');
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
    } catch (err) {
      // Error already logged by scanner
    }
  });

  document.getElementById('btn-scan-all').addEventListener('click', async () => {
    try {
      await BluetoothScanner.scanAll();
      renderDeviceList();
    } catch (err) {
      // Error already logged
    }
  });

  // --- Device List ---
  BluetoothScanner.setOnDeviceFound(() => {
    renderDeviceList();
  });

  BluetoothScanner.setOnConnectionChange((info, connected) => {
    renderDeviceList();
    updateCaptureButton();
    if (connected) {
      // Trigger Rick Roll on successful connection
      RickRoll.trigger();
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

    if (devices.length === 0) {
      list.innerHTML = '<div class="empty-state">No devices discovered yet. Start scanning!</div>';
      return;
    }

    list.innerHTML = devices.map(dev => `
      <div class="device-item" data-device-id="${dev.id}">
        <div class="device-item-header">
          <span class="device-name">${escapeHtml(dev.name)}</span>
          ${dev.connected ? '<span class="device-rssi">Connected</span>' : ''}
        </div>
        <div class="device-id">ID: ${escapeHtml(dev.id)}</div>
        <div class="device-meta">
          ${dev.connected ? '<span class="device-tag tag-connected">GATT Connected</span>' : ''}
          ${dev.services.length > 0 ? `<span class="device-tag tag-service">${dev.services.length} services</span>` : ''}
          <span class="device-tag tag-new">${new Date(dev.discovered).toLocaleTimeString()}</span>
        </div>
      </div>
    `).join('');

    // Bind click handlers for each device item
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
          <span class="detail-value">${escapeHtml(dev.id)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">${dev.connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Discovered</span>
          <span class="detail-value">${new Date(dev.discovered).toLocaleString()}</span>
        </div>
      </div>
    `;

    // Connect / Disconnect button
    if (dev.connected) {
      html += `<button class="btn btn-danger btn-large" id="btn-detail-disconnect"
        style="margin-bottom:12px">Disconnect</button>`;
    } else {
      html += `<button class="btn btn-primary btn-large" id="btn-detail-connect"
        style="margin-bottom:12px">Connect &amp; Enumerate Services</button>`;
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

          // Action buttons for characteristics
          html += `<div class="char-actions">`;
          if (char.properties.includes('read')) {
            html += `<button class="btn btn-secondary btn-small btn-char-read"
              data-char-uuid="${char.uuid}" data-device-id="${dev.id}">Read</button>`;
          }
          if (char.properties.includes('notify') || char.properties.includes('indicate')) {
            html += `<button class="btn btn-secondary btn-small btn-char-notify"
              data-char-uuid="${char.uuid}" data-device-id="${dev.id}">Subscribe</button>`;
          }
          html += `</div>`;

          html += `</div>`; // char-item
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
        try {
          await BluetoothScanner.connect(deviceId);
          showDeviceDetail(deviceId); // Refresh detail view
          renderDeviceList();
        } catch (err) {
          // Logged by scanner
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

    // Char read buttons
    content.querySelectorAll('.btn-char-read').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const charUuid = btn.dataset.charUuid;
        const d = devices.find(x => x.id === btn.dataset.deviceId);
        if (!d) return;
        const charInfo = d.characteristics.find(c => c.uuid === charUuid);
        if (!charInfo) return;
        try {
          await BluetoothScanner.readCharacteristic(charInfo);
          showDeviceDetail(deviceId);
        } catch (err) {
          // Logged
        }
      });
    });

    // Char notify buttons
    content.querySelectorAll('.btn-char-notify').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const charUuid = btn.dataset.charUuid;
        const d = devices.find(x => x.id === btn.dataset.deviceId);
        if (!d) return;
        const charInfo = d.characteristics.find(c => c.uuid === charUuid);
        if (!charInfo) return;
        try {
          await BluetoothScanner.subscribeNotifications(charInfo, () => {
            showDeviceDetail(deviceId); // Refresh on notification
          });
          btn.textContent = 'Subscribed';
          btn.disabled = true;
        } catch (err) {
          // Logged
        }
      });
    });
  }

  document.getElementById('btn-back-devices').addEventListener('click', () => {
    document.getElementById('device-detail').classList.add('hidden');
  });

  // --- Announcements Tab ---
  function updateCaptureButton() {
    const btn = document.getElementById('btn-capture');
    const connected = BluetoothScanner.getConnectedDevice();
    btn.disabled = !connected || !connected.connected;
  }

  document.getElementById('btn-capture').addEventListener('click', async () => {
    try {
      const profile = await Announcements.captureFromDevice();
      renderCaptures();
    } catch (err) {
      // Logged
    }
  });

  document.getElementById('btn-mimic').addEventListener('click', async () => {
    const select = document.getElementById('mimic-select');
    const captureId = select.value;
    if (!captureId) return;

    const statusEl = document.getElementById('mimic-status');
    statusEl.textContent = 'Replaying...';

    try {
      const result = await Announcements.replayToDevice(captureId);
      statusEl.textContent = `Done: ${result.written} written, ${result.skipped} skipped, ${result.failed} failed`;
      statusEl.style.color = 'var(--accent-green)';
    } catch (err) {
      statusEl.textContent = `Failed: ${err.message}`;
      statusEl.style.color = 'var(--accent-red)';
    }
  });

  function renderCaptures() {
    const list = document.getElementById('captured-list');
    const mimicCard = document.getElementById('mimic-card');
    const mimicSelect = document.getElementById('mimic-select');
    const mimicBtn = document.getElementById('btn-mimic');
    const captures = Announcements.getCaptures();

    if (captures.length === 0) {
      list.innerHTML = '<div class="empty-state">No captured data yet. Connect to a device first.</div>';
      mimicCard.style.display = 'none';
      return;
    }

    list.innerHTML = captures.map(cap => `
      <div class="captured-item">
        <h3>${escapeHtml(cap.deviceName)}</h3>
        <p class="captured-detail">Captured: ${new Date(cap.timestamp).toLocaleString()}</p>
        <p class="captured-detail">Services: ${cap.services.length} | Chars: ${cap.totalChars} (${cap.readableChars} readable)</p>
        ${cap.services.map(s => `
          <p class="captured-detail">  ${escapeHtml(s.name)}: ${s.characteristics.length} chars</p>
        `).join('')}
        <div style="margin-top:8px;display:flex;gap:6px;">
          <button class="btn btn-secondary btn-small btn-export-capture" data-capture-id="${cap.id}">Export JSON</button>
        </div>
      </div>
    `).join('');

    // Export buttons
    list.querySelectorAll('.btn-export-capture').forEach(btn => {
      btn.addEventListener('click', () => {
        Announcements.exportCapture(btn.dataset.captureId);
      });
    });

    // Mimic section
    mimicCard.style.display = 'block';
    mimicSelect.innerHTML = '<option value="">Select captured profile...</option>' +
      captures.map(c => `<option value="${c.id}">${escapeHtml(c.deviceName)} (${new Date(c.timestamp).toLocaleTimeString()})</option>`).join('');

    mimicSelect.addEventListener('change', () => {
      mimicBtn.disabled = !mimicSelect.value || !BluetoothScanner.getConnectedDevice();
    });
  }

  // --- Log Tab ---
  document.getElementById('btn-copy-log').addEventListener('click', () => {
    Logger.copyToClipboard();
  });

  document.getElementById('btn-clear-log').addEventListener('click', () => {
    Logger.clear();
  });

  // --- Rick Roll ---
  document.getElementById('btn-close-rickroll').addEventListener('click', () => {
    RickRoll.dismiss();
  });

  // --- Utilities ---
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function isPrintable(str) {
    return /^[\x20-\x7E]+$/.test(str);
  }

  // Periodically update capture button state
  setInterval(updateCaptureButton, 2000);

  Logger.info('Ready. Tap "Scan for Devices" to begin.');
});
