/**
 * BlueTTool - Main Application Controller
 * Wires UI events to Bluetooth scanner, audio, advanced agent, and sharing.
 * Optimized for Bluefy browser on iOS.
 */
document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Cache (avoids repeated getElementById in hot paths) ---
  const $cache = {};
  const $ = (id) => {
    if (!$cache[id]) $cache[id] = document.getElementById(id);
    return $cache[id];
  };

  // --- Shared Utilities ---
  const _escapeDiv = document.createElement('div');
  function escapeHtml(str) {
    if (!str) return '';
    _escapeDiv.textContent = String(str);
    return _escapeDiv.innerHTML;
  }

  function isPrintable(str) {
    return /^[\x20-\x7E]+$/.test(str);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeUuid(uuid) {
    return String(uuid || '').toLowerCase();
  }

  function shortDeviceId(id) {
    return String(id || '').slice(0, 8);
  }

  function isPlaceholderName(name) {
    const normalized = String(name || '')
      .trim()
      .toLowerCase();
    return normalized.length === 0 || normalized === 'unknown device' || normalized === 'unnamed';
  }

  function getDisplayName(dev) {
    const raw = String(dev?.name || '').trim();
    if (!isPlaceholderName(raw)) return raw;
    const inferred = [dev?.manufacturer, dev?.model].filter(Boolean).join(' ').trim();
    if (inferred) return inferred;
    return `Device ${shortDeviceId(dev?.id)}`;
  }

  function getDeviceTypeLabel(dev) {
    if (dev?.deviceType === 'govee_light') return 'Govee Light';
    if (dev?.deviceType === 'smart_light') return 'Smart Light';
    return '';
  }

  function getWritableCount(dev) {
    return (dev?.characteristics || []).filter(
      (ch) => ch.properties?.includes('write') || ch.properties?.includes('writeNoResp'),
    ).length;
  }

  function findDeviceAndChar(deviceId, charUuid) {
    const freshDevices = BluetoothScanner.getDevices();
    const d = freshDevices.find((x) => x.id === deviceId);
    if (!d) return null;
    const charInfo = (d.characteristics || []).find(
      (c) => normalizeUuid(c.uuid) === normalizeUuid(charUuid),
    );
    return charInfo ? { device: d, charInfo } : null;
  }

  function isValidServiceFilter(value) {
    return (
      /^[a-z_]+$/i.test(value) ||
      /^[0-9a-fA-F]{4}$/.test(value) ||
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
    );
  }

  function isValidHexInput(value) {
    const clean = String(value || '').replace(/[:\s]/g, '');
    const MAX_HEX_INPUT_BYTES = 512;
    return (
      clean.length > 0 &&
      clean.length % 2 === 0 &&
      /^[0-9a-fA-F]+$/.test(clean) &&
      clean.length / 2 <= MAX_HEX_INPUT_BYTES
    );
  }

  async function runLightTestAction(deviceId, action, buttonEl, options = {}) {
    const showNotifications = options.showNotifications !== false;
    const devices = BluetoothScanner.getDevices();
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev || !dev.connected) {
      if (showNotifications) {
        showToast('Connect to this device before running light tests', 'error');
      }
      return;
    }
    const plan = dev.lightTestPlan;
    const actionSpec = plan?.actions?.[action];
    if (!plan?.available || !actionSpec) {
      if (showNotifications) {
        showToast('No compatible test command found from GATT profile', 'error');
      }
      return;
    }

    const targetChar = (dev.characteristics || []).find(
      (ch) => normalizeUuid(ch.uuid) === normalizeUuid(plan.targetCharUuid),
    );
    if (!targetChar) {
      if (showNotifications) {
        showToast('Suggested test characteristic is no longer available', 'error');
      }
      return;
    }

    const defaultLabel = buttonEl ? buttonEl.textContent : '';
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = 'Sending...';
    }

    try {
      for (let i = 0; i < actionSpec.steps.length; i++) {
        await BluetoothScanner.writeCharacteristic(targetChar, actionSpec.steps[i]);
        if (i < actionSpec.steps.length - 1 && actionSpec.delayMs > 0) {
          await sleep(actionSpec.delayMs);
        }
      }
      if (showNotifications) {
        showToast(`${actionSpec.label || action} test sent`, 'success');
      }
    } catch (err) {
      if (showNotifications) {
        showToast(`Test failed: ${err?.message || 'write error'}`, 'error');
      }
      if (!showNotifications) {
        throw err;
      }
    } finally {
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.textContent = defaultLabel;
      }
    }
  }

  // --- Toast Notifications ---
  function showToast(message, type) {
    const container = $('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);
    if (typeof Delight !== 'undefined') {
      if (type === 'success') Delight.successBuzz();
      else if (type === 'error') Delight.errorBuzz();
    }
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // --- Confirm Dialog ---
  function showConfirm(title, message) {
    return new Promise((resolve) => {
      const dialog = $('confirm-dialog');
      const titleEl = $('confirm-title');
      const messageEl = $('confirm-message');
      const okBtn = $('confirm-ok');
      const cancelBtn = $('confirm-cancel');
      if (!dialog || !titleEl || !messageEl || !okBtn || !cancelBtn) {
        resolve(false);
        return;
      }
      titleEl.textContent = title;
      messageEl.textContent = message;
      dialog.classList.remove('hidden');
      dialog.setAttribute('aria-hidden', 'false');

      function cleanup(result) {
        dialog.classList.add('hidden');
        dialog.setAttribute('aria-hidden', 'true');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        dialog.removeEventListener('click', onOverlayClick);
        resolve(result);
      }
      function onOk() {
        cleanup(true);
      }
      function onCancel() {
        cleanup(false);
      }
      function onOverlayClick(e) {
        if (e.target === dialog) cleanup(false);
      }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      dialog.addEventListener('click', onOverlayClick);
    });
  }

  // --- Device Notes (localStorage) ---
  const DEVICE_NOTES_KEY = 'bluettool_device_notes';

  function getDeviceNotes(deviceId) {
    try {
      const raw = localStorage.getItem(DEVICE_NOTES_KEY);
      if (!raw) return '';
      const map = JSON.parse(raw);
      return String(map[deviceId] || '').trim();
    } catch {
      return '';
    }
  }

  function setDeviceNotes(deviceId, notes) {
    try {
      const raw = localStorage.getItem(DEVICE_NOTES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const trimmed = String(notes || '').trim();
      if (trimmed) {
        map[deviceId] = trimmed;
      } else {
        delete map[deviceId];
      }
      localStorage.setItem(DEVICE_NOTES_KEY, JSON.stringify(map));
    } catch (_) {
      /* ignore */
    }
  }

  // --- Settings (localStorage) ---
  // Use bluettool_* prefix for any new localStorage keys (e.g. bluettool_call_history, bluettool_captures)
  const SETTINGS_KEY = 'bluettool_settings';
  const FAVORITES_KEY = 'bluettool_favorites';
  const LAST_CONNECTED_KEY = 'bluettool_last_connected';
  const DEFAULT_SETTINGS = {
    themeDark: true,
    persistVolume: true,
    volume: 50,
    scanTimeout: 0,
    defaultSort: 'date-desc',
    defaultFilter: 'all',
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {
      /* ignore */
    }
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveFavorites(ids) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
    } catch (_) {
      /* ignore */
    }
  }

  function toggleFavorite(deviceId) {
    const favs = loadFavorites();
    const idx = favs.indexOf(deviceId);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(deviceId);
    }
    saveFavorites(favs);
    renderDeviceList();
  }

  function isFavorite(deviceId) {
    return loadFavorites().includes(deviceId);
  }

  function saveLastConnected(deviceId) {
    try {
      localStorage.setItem(LAST_CONNECTED_KEY, deviceId);
    } catch (_) {
      /* ignore */
    }
  }

  function loadLastConnected() {
    try {
      return localStorage.getItem(LAST_CONNECTED_KEY) || '';
    } catch {
      return '';
    }
  }

  function clearLastConnected() {
    try {
      localStorage.removeItem(LAST_CONNECTED_KEY);
    } catch (_) {
      /* ignore */
    }
  }

  function applySettings(settings) {
    document.documentElement.setAttribute('data-theme', settings.themeDark ? 'dark' : 'light');
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = settings.themeDark ? '#0a0e27' : '#f5f6fa';
    const themeCheck = $('setting-theme-dark');
    if (themeCheck) themeCheck.checked = settings.themeDark;
    const persistVol = $('setting-persist-volume');
    if (persistVol) persistVol.checked = settings.persistVolume;
    if (settings.persistVolume && typeof settings.volume === 'number') {
      const volSlider = $('volume-slider');
      const volVal = $('volume-value');
      if (volSlider && volVal) {
        volSlider.value = Math.min(100, Math.max(0, settings.volume));
        volVal.textContent = volSlider.value + '%';
        if (typeof AudioPlayer !== 'undefined') AudioPlayer.setVolume(volSlider.value / 100);
      }
    }
    const scanTimeout = $('setting-scan-timeout');
    if (scanTimeout) scanTimeout.value = String(settings.scanTimeout || 0);
    const defaultSort = $('setting-default-sort');
    if (defaultSort) defaultSort.value = settings.defaultSort || 'date-desc';
    const defaultFilter = $('setting-default-filter');
    if (defaultFilter) defaultFilter.value = settings.defaultFilter || 'all';
    const deviceSort = $('device-sort');
    if (deviceSort) deviceSort.value = settings.defaultSort || 'date-desc';
    const deviceFilter = $('device-filter');
    if (deviceFilter) deviceFilter.value = settings.defaultFilter || 'all';
    const scanDurationHint = $('scan-duration-hint');
    if (scanDurationHint) scanDurationHint.value = String(settings.scanTimeout || 0);
  }

  function getCurrentSettings() {
    const s = loadSettings();
    const themeCheck = $('setting-theme-dark');
    const persistVol = $('setting-persist-volume');
    const volSlider = $('volume-slider');
    const scanTimeout = $('setting-scan-timeout');
    const defaultSort = $('setting-default-sort');
    const defaultFilter = $('setting-default-filter');
    return {
      ...s,
      themeDark: themeCheck ? themeCheck.checked : s.themeDark,
      persistVolume: persistVol ? persistVol.checked : s.persistVolume,
      volume: volSlider ? parseInt(volSlider.value, 10) : s.volume,
      scanTimeout: scanTimeout ? parseInt(scanTimeout.value, 10) : s.scanTimeout,
      defaultSort: defaultSort ? defaultSort.value : s.defaultSort,
      defaultFilter: defaultFilter ? defaultFilter.value : s.defaultFilter,
    };
  }

  // --- Initialize ---
  Logger.init();
  window.addEventListener('error', (event) => {
    Logger.error(`Unhandled error: ${event.message || 'unknown error'}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason || 'unknown rejection';
    Logger.error(`Unhandled promise rejection: ${reason}`);
  });
  Logger.info('BlueTTool initialized — Bluefy mobile app');
  Logger.info('Checking browser compatibility...');
  BluetoothScanner.checkSupport();

  const initialSettings = loadSettings();
  applySettings(initialSettings);

  // --- Tab Navigation ---
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tabContents.forEach((tc) => tc.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const targetEl = document.getElementById(target);
      if (targetEl) targetEl.classList.add('active');
    });
  });

  // Empty state CTA: Go to Scan, Go to Devices
  document.addEventListener('click', (e) => {
    if (e.target.closest('#empty-cta-scan')) {
      const scanTab = document.querySelector('.tab[data-tab="scanner"]');
      if (scanTab) scanTab.click();
    }
    if (e.target.closest('#empty-cta-import-calls')) {
      $('call-import-input')?.click();
    }
    if (e.target.closest('#empty-cta-devices')) {
      const devicesTab = document.querySelector('.tab[data-tab="devices"]');
      if (devicesTab) devicesTab.click();
    }
  });

  // Device list: event delegation (single listener, no re-binding on re-render)
  $('device-list')?.addEventListener('click', (e) => {
    const pinBtn = e.target.closest('.btn-pin');
    if (pinBtn) {
      e.stopPropagation();
      toggleFavorite(pinBtn.dataset.deviceId);
      renderDeviceList();
      return;
    }
    const resetFilterBtn = e.target.closest('#empty-cta-reset-filter');
    if (resetFilterBtn) {
      e.stopPropagation();
      const filterEl = $('device-filter');
      if (filterEl) {
        filterEl.value = 'all';
        renderDeviceList();
      }
      return;
    }
    const reconnectBtn = e.target.closest('.btn-reconnect');
    if (reconnectBtn) {
      e.stopPropagation();
      reconnectBtn.disabled = true;
      reconnectBtn.textContent = 'Connecting...';
      BluetoothScanner.connect(reconnectBtn.dataset.deviceId)
        .then(() => renderDeviceList())
        .catch(() => {
          reconnectBtn.disabled = false;
          reconnectBtn.textContent = 'Reconnect';
          showToast('Connection failed', 'error');
        });
      return;
    }
    const lightTestBtn = e.target.closest('.btn-light-test');
    if (lightTestBtn) {
      e.stopPropagation();
      runLightTestAction(lightTestBtn.dataset.deviceId, lightTestBtn.dataset.action, lightTestBtn);
      return;
    }
    const deviceItem = e.target.closest('.device-item');
    if (deviceItem && !e.target.closest('.device-quick-actions .btn')) {
      showDeviceDetail(deviceItem.dataset.deviceId);
    }
  });

  // --- Scanner Tab ---
  const btnScan = $('btn-scan');
  const btnScanAll = $('btn-scan-all');

  // Classic Bluetooth (Web Serial) — graceful degradation: disable in Bluefy
  const btnSerialConnect = $('btn-serial-connect');
  const serialStatusEl = $('serial-status');
  const classicBtUnavailableEl = $('classic-bt-unavailable');

  function applyClassicBtUiState() {
    const supported = typeof SerialBluetooth !== 'undefined' && SerialBluetooth.isSupported();
    if (btnSerialConnect) btnSerialConnect.disabled = !supported;
    if (classicBtUnavailableEl) classicBtUnavailableEl.classList.toggle('hidden', supported);
  }
  applyClassicBtUiState();

  if (btnSerialConnect && typeof SerialBluetooth !== 'undefined') {
    function updateSerialButton() {
      btnSerialConnect.textContent = SerialBluetooth.isConnected()
        ? 'Disconnect Classic BT'
        : 'Connect Classic BT Device';
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
    const nameFilterEnabled = $('filter-name')?.checked;
    const nameValue = $('filter-name-value')?.value?.trim() || '';
    const svcFilterEnabled = $('filter-services')?.checked;
    const svcValue = $('filter-service-value')?.value?.trim() || '';
    const scanDurationHint = $('scan-duration-hint');
    const scanDuration = scanDurationHint ? parseInt(scanDurationHint.value, 10) : 0;

    if (nameFilterEnabled && nameValue) {
      options.namePrefix = nameValue;
    }
    if (svcFilterEnabled && svcValue) {
      if (!isValidServiceFilter(svcValue)) {
        showToast(
          'Invalid service filter. Use a named UUID (heart_rate), 16-bit, or full 128-bit UUID.',
          'error',
        );
        return;
      }
      options.services = [svcValue];
    }
    if (scanDuration > 0) {
      options.scanDuration = scanDuration;
    }

    btnScan.disabled = true;
    btnScan.classList.add('loading');
    const scanLabel = btnScan.textContent;
    btnScan.dataset.originalText = scanLabel;
    btnScan.textContent = 'Scanning...';
    try {
      await BluetoothScanner.scan(options);
      renderDeviceList();
      showToast('Device found', 'success');
    } catch (err) {
      showToast(err?.message || 'Scan cancelled or failed', 'error');
    } finally {
      btnScan.disabled = false;
      btnScan.classList.remove('loading');
      btnScan.textContent = btnScan.dataset.originalText || 'Scan for Devices';
    }
  });

  btnScanAll?.addEventListener('click', async () => {
    const scanDurationHint = $('scan-duration-hint');
    const scanDuration = scanDurationHint ? parseInt(scanDurationHint.value, 10) : 0;
    const options = scanDuration > 0 ? { scanDuration } : {};
    btnScanAll.disabled = true;
    btnScanAll.classList.add('loading');
    const scanAllLabel = btnScanAll.textContent;
    btnScanAll.dataset.originalText = scanAllLabel;
    btnScanAll.textContent = 'Scanning...';
    try {
      await BluetoothScanner.scanAll(options);
      renderDeviceList();
      showToast('Device found', 'success');
    } catch (err) {
      showToast(err?.message || 'Scan cancelled or failed', 'error');
    } finally {
      btnScanAll.disabled = false;
      btnScanAll.classList.remove('loading');
      btnScanAll.textContent = btnScanAll.dataset.originalText || 'Scan All (No Filter)';
    }
  });

  // --- Device List ---
  // Device found and connection change callbacks are set in the Agent section
  // to also update parallel device counts alongside device list rendering.

  $('btn-refresh-devices')?.addEventListener('click', () => {
    renderDeviceList();
    showToast('Device list refreshed', 'info');
  });

  function onDeviceListPrefChange(sortOrFilter, key) {
    renderDeviceList();
    const s = getCurrentSettings();
    s[key] = $('device-' + sortOrFilter)?.value || s[key];
    saveSettings(s);
  }
  $('device-sort')?.addEventListener('change', () => onDeviceListPrefChange('sort', 'defaultSort'));
  $('device-filter')?.addEventListener('change', () =>
    onDeviceListPrefChange('filter', 'defaultFilter'),
  );

  $('btn-clear-devices')?.addEventListener('click', async () => {
    const devices = BluetoothScanner.getDevices();
    if (devices.length === 0) return;
    const confirmed = await showConfirm(
      'Clear All Devices',
      `Remove ${devices.length} device(s) from the list? Connected devices will be disconnected.`,
    );
    if (!confirmed) return;
    BluetoothScanner.clearDevices();
    clearLastConnected();
    renderDeviceList();
    updateQuickReconnectUI();
    showToast('Device list cleared', 'info');
  });

  $('btn-export-devices')?.addEventListener('click', () => {
    BluetoothScanner.exportCSV();
    showToast('CSV exported', 'success');
  });

  function getFilteredAndSortedDevices() {
    const devices = BluetoothScanner.getDevices();
    const filterVal = $('device-filter')?.value || 'all';
    const sortVal = $('device-sort')?.value || 'date-desc';
    const favs = loadFavorites();

    let filtered = devices;
    if (filterVal === 'connected') {
      filtered = devices.filter((d) => d.connected);
    } else if (filterVal === 'available') {
      filtered = devices.filter((d) => !d.connected);
    }

    const sorted = [...filtered].sort((a, b) => {
      const aPinned = favs.includes(a.id);
      const bPinned = favs.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      const nameA = getDisplayName(a).toLowerCase();
      const nameB = getDisplayName(b).toLowerCase();
      const dateA = new Date(a.discovered).getTime();
      const dateB = new Date(b.discovered).getTime();
      if (sortVal === 'name-asc') return nameA.localeCompare(nameB);
      if (sortVal === 'name-desc') return nameB.localeCompare(nameA);
      if (sortVal === 'date-asc') return dateA - dateB;
      return dateB - dateA; // date-desc
    });
    return sorted;
  }

  let renderDeviceListRaf = null;
  function renderDeviceList() {
    if (renderDeviceListRaf) return;
    renderDeviceListRaf = requestAnimationFrame(() => {
      renderDeviceListRaf = null;
      renderDeviceListImmediate();
    });
  }

  function renderDeviceListImmediate() {
    const list = $('device-list');
    if (!list) return;
    const allDevices = BluetoothScanner.getDevices();
    const devices = getFilteredAndSortedDevices();

    const countEl = $('device-count');
    if (countEl) {
      countEl.textContent = `${allDevices.length} device${allDevices.length !== 1 ? 's' : ''}`;
    }

    if (allDevices.length === 0) {
      list.innerHTML = `<div class="empty-state" id="devices-empty-state">
        <div class="empty-icon" aria-hidden="true">&#x1F4E1;</div>
        <p>No devices discovered yet</p>
        <p class="empty-hint">Tap <strong>Scan</strong> to find nearby BLE devices. Make sure Bluetooth is on.</p>
        <button type="button" class="empty-cta" id="empty-cta-scan" aria-label="Go to Scan tab">Go to Scan</button>
      </div>`;
      return;
    }

    if (devices.length === 0) {
      list.innerHTML = `<div class="empty-state" id="devices-filter-empty-state">
        <div class="empty-icon" aria-hidden="true">&#x1F50C;</div>
        <p>No devices match the current filter</p>
        <p class="empty-hint">Try "All devices" in the filter dropdown, or scan for more devices.</p>
        <button type="button" class="empty-cta" id="empty-cta-reset-filter" aria-label="Show all devices">Show All Devices</button>
      </div>`;
      return;
    }

    list.innerHTML = devices
      .map((dev) => {
        const displayName = getDisplayName(dev);
        const deviceTypeLabel = getDeviceTypeLabel(dev);
        const plan = dev.lightTestPlan;
        const hasLightPlan = !!plan?.available;
        const writableCount = getWritableCount(dev);
        const pinned = isFavorite(dev.id);
        const hasNotes = !!getDeviceNotes(dev.id);
        return `
      <div class="device-item${dev.connected ? ' connected-glow' : ''}" data-device-id="${escapeHtml(dev.id)}">
        <div class="device-item-header">
          <button class="btn btn-ghost btn-pin" data-device-id="${escapeHtml(dev.id)}" title="${pinned ? 'Unpin' : 'Pin to top'}" aria-label="${pinned ? 'Unpin' : 'Pin to top'}">${pinned ? '&#128204;' : '&#128205;'}</button>
          <span class="device-name">${escapeHtml(displayName)}</span>
          ${hasNotes ? '<span class="device-note-badge" title="Has notes">&#x1F4DD;</span>' : ''}
          ${dev.connected ? '<span class="conn-badge">Connected</span>' : ''}
        </div>
        <div class="device-id-row">
          <span class="device-id-label">ID:</span>
          <span class="device-id">${escapeHtml(dev.id)}</span>
        </div>
        <div class="device-meta">
          ${dev.connected ? '<span class="device-tag tag-connected">GATT</span>' : ''}
          ${deviceTypeLabel ? `<span class="device-tag tag-light">${escapeHtml(deviceTypeLabel)}</span>` : ''}
          ${hasLightPlan ? `<span class="device-tag tag-best-test">Best: ${escapeHtml(plan.bestActionLabel || plan.bestAction)}</span>` : ''}
          ${dev.connected && !hasLightPlan && writableCount === 0 ? '<span class="device-tag tag-best-test">No writable chars</span>' : ''}
          ${!dev.connected ? '<span class="device-tag tag-best-test">Connect for tests</span>' : ''}
          ${(dev.services || []).length > 0 ? `<span class="device-tag tag-service">${(dev.services || []).length} svc</span>` : ''}
          ${(dev.characteristics || []).length > 0 ? `<span class="device-tag tag-char">${(dev.characteristics || []).length} char</span>` : ''}
          <span class="device-tag tag-time">${new Date(dev.discovered).toLocaleTimeString()}</span>
        </div>
        ${
          dev.connected && hasLightPlan
            ? `<div class="device-quick-actions">
          <button class="btn btn-warning btn-small btn-light-test" data-action="flash" data-device-id="${escapeHtml(dev.id)}" ${plan.actions?.flash ? '' : 'disabled'}>Flash</button>
          <button class="btn btn-primary btn-small btn-light-test" data-action="color" data-device-id="${escapeHtml(dev.id)}" ${plan.actions?.color ? '' : 'disabled'}>Color</button>
          <button class="btn btn-danger btn-small btn-light-test" data-action="off" data-device-id="${escapeHtml(dev.id)}" ${plan.actions?.off ? '' : 'disabled'}>Off</button>
        </div>`
            : ''
        }
        ${
          !dev.connected
            ? `<div class="device-quick-actions">
          <button class="btn btn-secondary btn-small btn-reconnect" data-device-id="${escapeHtml(dev.id)}">Reconnect</button>
        </div>`
            : ''
        }
      </div>
    `;
      })
      .join('');

    // Update captures section
    renderCaptures();
    updateQuickReconnectUI();
  }

  function updateQuickReconnectUI() {
    const card = $('quick-reconnect-card');
    const nameEl = $('quick-reconnect-name');
    if (!card || !nameEl) return;

    const lastId = loadLastConnected();
    const devices = BluetoothScanner.getDevices();
    const dev = devices.find((d) => d.id === lastId);

    if (lastId && dev && !dev.connected) {
      card.classList.remove('hidden');
      nameEl.textContent = getDisplayName(dev);
    } else {
      card.classList.add('hidden');
    }
  }

  $('btn-quick-reconnect')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    const lastId = loadLastConnected();
    if (!lastId) return;
    btn.disabled = true;
    const nameEl = $('quick-reconnect-name');
    const origName = nameEl?.textContent || 'Device';
    if (nameEl) nameEl.textContent = 'Connecting...';
    try {
      await BluetoothScanner.connect(lastId);
      renderDeviceList();
    } catch (_) {
      showToast('Connection failed', 'error');
      if (nameEl) nameEl.textContent = origName;
    } finally {
      btn.disabled = false;
      const dev = BluetoothScanner.getDevice(lastId);
      if (nameEl) nameEl.textContent = dev ? getDisplayName(dev) : origName;
    }
  });

  // --- Device Detail Panel ---
  function showDeviceDetail(deviceId) {
    const devices = BluetoothScanner.getDevices();
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) return;

    const panel = $('device-detail');
    const nameEl = $('detail-device-name');
    const content = $('detail-content');
    panel.dataset.deviceId = deviceId;

    const displayName = getDisplayName(dev);
    const deviceTypeLabel = getDeviceTypeLabel(dev);
    const lightPlan = dev.lightTestPlan;
    nameEl.textContent = displayName;

    const currentNotes = getDeviceNotes(deviceId);
    let html = `
      <div class="detail-section">
        <h3>Device Notes</h3>
        <p class="hint" style="margin-bottom:8px;">Add notes for this device (saved locally).</p>
        <textarea id="device-notes-input" class="input-field device-notes-textarea" placeholder="e.g. Tested on 2024-01-15, firmware v2.1..." rows="3">${escapeHtml(currentNotes)}</textarea>
        <button class="btn btn-secondary btn-small" id="btn-save-device-notes">Save Notes</button>
      </div>
      <div class="detail-section">
        <h3>Device Info</h3>
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">${escapeHtml(displayName)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Device ID</span>
          <span class="detail-value detail-value-mono">${escapeHtml(dev.id)}</span>
        </div>
        ${
          dev.manufacturer
            ? `
        <div class="detail-row">
          <span class="detail-label">Manufacturer</span>
          <span class="detail-value">${escapeHtml(dev.manufacturer)}</span>
        </div>`
            : ''
        }
        ${
          dev.model
            ? `
        <div class="detail-row">
          <span class="detail-label">Model</span>
          <span class="detail-value">${escapeHtml(dev.model)}</span>
        </div>`
            : ''
        }
        ${
          deviceTypeLabel
            ? `
        <div class="detail-row">
          <span class="detail-label">Type</span>
          <span class="detail-value">${escapeHtml(deviceTypeLabel)}</span>
        </div>`
            : ''
        }
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
          <span class="detail-value">${(dev.services || []).length}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Characteristics</span>
          <span class="detail-value">${(dev.characteristics || []).length}</span>
        </div>
      </div>
    `;

    if (lightPlan?.available) {
      html += `
      <div class="detail-section light-test-section">
        <h3>Smart Light Test Commands</h3>
        <div class="detail-row">
          <span class="detail-label">Best suggested test</span>
          <span class="detail-value">${escapeHtml(lightPlan.bestActionLabel || lightPlan.bestAction || 'N/A')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Reason</span>
          <span class="detail-value">${escapeHtml(lightPlan.reason || 'Writable light-control characteristic detected')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Target characteristic</span>
          <span class="detail-value detail-value-mono">${escapeHtml(lightPlan.targetCharUuid || '')}</span>
        </div>
        <div class="light-test-actions">
          <button class="btn btn-warning btn-small btn-detail-light-test" data-action="flash" data-device-id="${escapeHtml(dev.id)}" ${dev.connected && lightPlan.actions?.flash ? '' : 'disabled'}>Flash</button>
          <button class="btn btn-primary btn-small btn-detail-light-test" data-action="color" data-device-id="${escapeHtml(dev.id)}" ${dev.connected && lightPlan.actions?.color ? '' : 'disabled'}>Color</button>
          <button class="btn btn-danger btn-small btn-detail-light-test" data-action="off" data-device-id="${escapeHtml(dev.id)}" ${dev.connected && lightPlan.actions?.off ? '' : 'disabled'}>Off</button>
        </div>
        <p class="hint light-test-hint">${dev.connected ? 'Tip: use device name + ID to avoid mixing up similar lights.' : 'Connect first to run test commands.'}</p>
      </div>
      `;
    } else {
      const writableCount = getWritableCount(dev);
      html += `
      <div class="detail-section light-test-section">
        <h3>Smart Light Test Commands</h3>
        <p class="hint light-test-hint">
          ${
            dev.connected
              ? writableCount > 0
                ? 'Connected. No light-specific signature found yet. Reconnect to re-enumerate or use manual Write controls below.'
                : 'Connected, but no writable GATT characteristics were found for test commands.'
              : 'Connect & enumerate this device to reveal Flash/Color/Off light testing options.'
          }
        </p>
      </div>
      `;
    }

    // Connect / Disconnect
    if (dev.connected) {
      html += `<button class="btn btn-danger btn-large" id="btn-detail-disconnect">Disconnect</button>`;
      html += `<button class="btn btn-secondary btn-large" id="btn-detail-capture" style="margin-top:8px;">Capture Profile Snapshot</button>`;
    } else {
      html += `<button class="btn btn-primary btn-large" id="btn-detail-connect">Connect &amp; Enumerate</button>`;
    }

    // Services + Characteristics
    const devServices = dev.services || [];
    if (devServices.length > 0) {
      html += `<div class="detail-section"><h3>GATT Services (${devServices.length})</h3>`;
      for (const svc of devServices) {
        html += `<div class="service-item">
          <strong>${escapeHtml(svc.name)}</strong>
          <div class="service-uuid">${escapeHtml(svc.uuid)}</div>`;

        for (const char of svc.characteristics || []) {
          const props = char.properties || [];
          html += `<div class="char-item">
            <div><strong>${escapeHtml(char.name)}</strong></div>
            <div class="char-uuid">${escapeHtml(char.uuid)}</div>
            <div class="char-props">
              ${props.map((p) => `<span class="char-prop-tag">${escapeHtml(p)}</span>`).join('')}
            </div>`;

          if (char.value) {
            html += `<div class="char-value">Hex: ${escapeHtml(char.value)}</div>`;
          }
          if (char.textValue && char.textValue.length > 0 && isPrintable(char.textValue)) {
            html += `<div class="char-value">Text: ${escapeHtml(char.textValue)}</div>`;
          }

          html += `<div class="char-actions">`;
          if (props.includes('read')) {
            html += `<button class="btn btn-secondary btn-small btn-char-read"
              data-char-uuid="${escapeHtml(char.uuid)}" data-device-id="${escapeHtml(dev.id)}">Read</button>`;
          }
          if (props.includes('notify') || props.includes('indicate')) {
            html += `<button class="btn btn-secondary btn-small btn-char-notify"
              data-char-uuid="${escapeHtml(char.uuid)}" data-device-id="${escapeHtml(dev.id)}">Subscribe</button>`;
          }
          if (props.includes('write') || props.includes('writeNoResp')) {
            html += `<button class="btn btn-warning btn-small btn-char-write-toggle"
              data-char-uuid="${escapeHtml(char.uuid)}" data-device-id="${escapeHtml(dev.id)}">Write</button>`;
          }
          html += `</div>`;

          // Write input (hidden by default)
          if (props.includes('write') || props.includes('writeNoResp')) {
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
  }

  // Device detail panel: delegated click handler (single listener, no re-binding)
  $('device-detail')?.addEventListener('click', async (e) => {
    const deviceId = e.currentTarget.dataset.deviceId;
    if (!deviceId) return;
    const content = $('detail-content');

    const saveNotesBtn = e.target.closest('#btn-save-device-notes');
    if (saveNotesBtn) {
      const input = content?.querySelector('#device-notes-input');
      const notes = input?.value?.trim() || '';
      setDeviceNotes(deviceId, notes);
      showToast(notes ? 'Notes saved' : 'Notes cleared', 'success');
      renderDeviceList();
      return;
    }

    const connectBtn = e.target.closest('#btn-detail-connect');
    if (connectBtn) {
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
      return;
    }

    const disconnectBtn = e.target.closest('#btn-detail-disconnect');
    if (disconnectBtn) {
      BluetoothScanner.disconnect(deviceId);
      showDeviceDetail(deviceId);
      renderDeviceList();
      return;
    }

    const captureBtn = e.target.closest('#btn-detail-capture');
    if (captureBtn) {
      captureBtn.disabled = true;
      captureBtn.textContent = 'Capturing...';
      try {
        await Announcements.captureFromDevice();
        captureBtn.textContent = 'Captured!';
        captureBtn.classList.add('btn-success-state');
        if (typeof Delight !== 'undefined') Delight.maybeFirstCaptureConfetti();
        showToast('Profile captured', 'success');
        renderCaptures();
        setTimeout(() => {
          captureBtn.classList.remove('btn-success-state');
          captureBtn.textContent = 'Capture Profile Snapshot';
          captureBtn.disabled = false;
        }, 2000);
      } catch (_) {
        captureBtn.textContent = 'Capture Failed';
        captureBtn.classList.add('btn-error-state');
        captureBtn.disabled = false;
        showToast('Capture failed', 'error');
        setTimeout(() => captureBtn.classList.remove('btn-error-state'), 500);
      }
      return;
    }

    const lightTestBtn = e.target.closest('.btn-detail-light-test');
    if (lightTestBtn) {
      e.stopPropagation();
      await runLightTestAction(
        lightTestBtn.dataset.deviceId,
        lightTestBtn.dataset.action,
        lightTestBtn,
      );
      if (BluetoothScanner.getDevices().find((x) => x.id === deviceId)) {
        showDeviceDetail(deviceId);
        renderDeviceList();
      }
      return;
    }

    const charReadBtn = e.target.closest('.btn-char-read');
    if (charReadBtn) {
      e.stopPropagation();
      const found = findDeviceAndChar(charReadBtn.dataset.deviceId, charReadBtn.dataset.charUuid);
      if (!found) return;
      charReadBtn.disabled = true;
      charReadBtn.textContent = 'Reading...';
      try {
        await BluetoothScanner.readCharacteristic(found.charInfo);
        showDeviceDetail(deviceId);
      } catch (_) {
        charReadBtn.disabled = false;
        charReadBtn.textContent = 'Read';
        showToast('Read failed', 'error');
      }
      return;
    }

    const charNotifyBtn = e.target.closest('.btn-char-notify');
    if (charNotifyBtn) {
      e.stopPropagation();
      const found = findDeviceAndChar(
        charNotifyBtn.dataset.deviceId,
        charNotifyBtn.dataset.charUuid,
      );
      if (!found) return;
      charNotifyBtn.disabled = true;
      charNotifyBtn.textContent = 'Subscribing...';
      try {
        await BluetoothScanner.subscribeNotifications(found.charInfo, () =>
          showDeviceDetail(deviceId),
        );
        charNotifyBtn.textContent = 'Subscribed';
        showToast('Subscribed to notifications', 'success');
      } catch (_) {
        charNotifyBtn.disabled = false;
        charNotifyBtn.textContent = 'Subscribe';
        showToast('Subscribe failed', 'error');
      }
      return;
    }

    const writeToggleBtn = e.target.closest('.btn-char-write-toggle');
    if (writeToggleBtn) {
      e.stopPropagation();
      const form = content?.querySelector(
        `.char-write-form[data-write-for="${writeToggleBtn.dataset.charUuid}"]`,
      );
      if (form) form.classList.toggle('hidden');
      return;
    }

    const writeSendBtn = e.target.closest('.btn-char-write-send');
    if (writeSendBtn) {
      e.stopPropagation();
      const charUuid = writeSendBtn.dataset.charUuid;
      const input = content?.querySelector(`.char-write-input[data-char-uuid="${charUuid}"]`);
      if (!input) return;
      const hexVal = input.value.trim();
      if (!hexVal) {
        showToast('Enter a hex value first', 'error');
        return;
      }
      if (!isValidHexInput(hexVal)) {
        showToast(
          'Invalid hex format. Use an even number of bytes (e.g., FF or 01:FF:AB), up to 512 bytes.',
          'error',
        );
        return;
      }
      const found = findDeviceAndChar(writeSendBtn.dataset.deviceId, charUuid);
      if (!found) return;
      const { charInfo } = found;
      writeSendBtn.disabled = true;
      writeSendBtn.textContent = 'Writing...';
      try {
        await BluetoothScanner.writeCharacteristic(charInfo, hexVal);
        showToast('Value written', 'success');
        writeSendBtn.textContent = 'Sent!';
        setTimeout(() => {
          writeSendBtn.textContent = 'Send';
          writeSendBtn.disabled = false;
        }, 1500);
        if ((charInfo.properties || []).includes('read')) {
          try {
            await BluetoothScanner.readCharacteristic(charInfo);
            showDeviceDetail(deviceId);
          } catch (_) {
            /* ok */
          }
        }
      } catch (_) {
        writeSendBtn.disabled = false;
        writeSendBtn.textContent = 'Send';
        showToast('Write failed', 'error');
      }
    }
  });

  $('btn-back-devices')?.addEventListener('click', () => {
    $('device-detail')?.classList.add('hidden');
  });

  // --- Captures / Replay (Replay tab) ---
  const captureImportInput = $('capture-import-input');
  const btnImportCaptures = $('btn-import-captures');
  btnImportCaptures?.addEventListener('click', () => captureImportInput?.click());
  captureImportInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await Announcements.importCapture(file);
      renderCaptures();
      if (count === 0) {
        showToast('No valid profiles found in file', 'info');
      } else {
        showToast(`Imported ${count} profile(s)`, 'success');
      }
    } catch (err) {
      showToast(err?.message || 'Import failed', 'error');
    }
    captureImportInput.value = '';
  });

  function renderCaptures() {
    const capturedList = $('captured-list');
    const replaySection = $('replay-section');
    const replayEmptyState = $('replay-empty-state');
    const mimicSelect = $('mimic-select');
    const mimicBtn = $('btn-mimic');
    const mimicAllBtn = $('btn-mimic-all');
    const captures = Announcements.getCaptures();

    if (captures.length === 0) {
      if (replayEmptyState) replayEmptyState.style.display = 'flex';
      if (replaySection) replaySection.style.display = 'none';
      if (capturedList) capturedList.innerHTML = '';
      return;
    }

    if (replayEmptyState) replayEmptyState.style.display = 'none';
    if (replaySection) replaySection.style.display = 'block';

    if (capturedList) {
      capturedList.innerHTML = captures
        .map(
          (cap) => `
        <div class="captured-item">
          <strong>${escapeHtml(cap.deviceName)}</strong>
          <div class="captured-detail">${new Date(cap.timestamp).toLocaleString()}</div>
          <div class="captured-detail">Services: ${cap.services.length} | Chars: ${cap.totalChars} (${cap.readableChars} readable)</div>
          <button class="btn btn-secondary btn-small btn-export-capture" data-capture-id="${cap.id}">Export JSON</button>
        </div>
      `,
        )
        .join('');
    }

    const connected = BluetoothScanner.getConnectedDevice();
    const connectedCount = BluetoothScanner.getDevices().filter((d) => d.connected).length;
    const hasCapture = !!mimicSelect?.value;
    if (mimicSelect) {
      mimicSelect.innerHTML =
        '<option value="">Select captured profile...</option>' +
        captures
          .map(
            (c) =>
              `<option value="${c.id}">${escapeHtml(c.deviceName)} (${new Date(c.timestamp).toLocaleTimeString()})</option>`,
          )
          .join('');
    }
    if (mimicBtn) mimicBtn.disabled = !connected || !hasCapture;
    if (mimicAllBtn) mimicAllBtn.disabled = connectedCount === 0 || !hasCapture;
  }

  // Captured list: event delegation for export buttons (no per-item listeners)
  $('captured-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-export-capture');
    if (btn) {
      Announcements.exportCapture(btn.dataset.captureId);
      showToast('JSON exported', 'success');
    }
  });

  // Mimic select change — use a single handler, not re-bound each render
  const mimicSelect = $('mimic-select');
  const mimicBtn = $('btn-mimic');
  const mimicAllBtn = $('btn-mimic-all');
  function updateReplayButtons() {
    const hasCapture = !!mimicSelect?.value;
    const connected = BluetoothScanner.getConnectedDevice();
    const connectedCount = BluetoothScanner.getDevices().filter((d) => d.connected).length;
    if (mimicBtn) mimicBtn.disabled = !hasCapture || !connected;
    if (mimicAllBtn) mimicAllBtn.disabled = !hasCapture || connectedCount === 0;
  }
  mimicSelect?.addEventListener('change', updateReplayButtons);

  mimicBtn?.addEventListener('click', async () => {
    const captureId = mimicSelect?.value;
    if (!captureId) return;
    const statusEl = $('mimic-status');
    if (statusEl) {
      statusEl.textContent = 'Replaying...';
      statusEl.className = 'mimic-status';
    }
    mimicBtn.disabled = true;
    if (mimicAllBtn) mimicAllBtn.disabled = true;
    try {
      const result = await Announcements.replayToDevice(captureId);
      if (statusEl) {
        statusEl.textContent = `Done: ${result.written} written, ${result.skipped} skipped, ${result.failed} failed`;
        statusEl.classList.add('mimic-success');
      }
      showToast('Replay complete', 'success');
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `Failed: ${err?.message || 'Unknown error'}`;
        statusEl.classList.add('mimic-error');
      }
      showToast('Replay failed', 'error');
    } finally {
      updateReplayButtons();
    }
  });

  mimicAllBtn?.addEventListener('click', async () => {
    const captureId = mimicSelect?.value;
    if (!captureId) return;
    const statusEl = $('mimic-status');
    const connectedCount = BluetoothScanner.getDevices().filter((d) => d.connected).length;
    if (statusEl) {
      statusEl.textContent = `Replaying to ${connectedCount} device(s)...`;
      statusEl.className = 'mimic-status';
    }
    mimicBtn.disabled = true;
    mimicAllBtn.disabled = true;
    try {
      const result = await Announcements.replayToAllConnectedDevices(captureId);
      if (statusEl) {
        statusEl.textContent = `Done: ${result.successCount}/${result.totalDevices} devices, ${result.totalWritten} written, ${result.totalFailed} failed`;
        statusEl.classList.add(result.totalFailed > 0 ? 'mimic-status' : 'mimic-success');
      }
      showToast(
        `Replay to ${result.successCount} device(s): ${result.totalWritten} written`,
        result.totalFailed > 0 ? 'info' : 'success',
      );
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `Failed: ${err?.message || 'Unknown error'}`;
        statusEl.classList.add('mimic-error');
      }
      showToast('Replay failed', 'error');
    } finally {
      updateReplayButtons();
    }
  });

  // --- Tools Tab: Sound ---
  $('btn-play-dtmf')?.addEventListener('click', () => {
    if (typeof AudioPlayer === 'undefined') return;
    const speedEl = $('dtmf-speed');
    const speed = speedEl ? parseFloat(speedEl.value) || 1 : 1;
    AudioPlayer.playDTMFSequence(speed);
  });

  $('btn-play-custom-dtmf')?.addEventListener('click', () => {
    if (typeof AudioPlayer === 'undefined') return;
    const input = $('dtmf-custom-input');
    const seq = input?.value?.trim() || '';
    if (!seq) {
      showToast('Enter a DTMF sequence (0-9, *, #, A-D)', 'error');
      return;
    }
    if (!/^[0-9*#A-Da-d]+$/.test(seq)) {
      showToast('Invalid characters. Use only 0-9, *, #, A-D', 'error');
      return;
    }
    const speedEl = $('dtmf-speed');
    const speed = speedEl ? parseFloat(speedEl.value) || 1 : 1;
    AudioPlayer.playCustomDTMFSequence(seq, speed);
    showAudioOverlay();
  });

  $('btn-play-file')?.addEventListener('click', () => {
    if (typeof AudioPlayer !== 'undefined') AudioPlayer.playFile();
  });

  $('btn-stop-audio')?.addEventListener('click', () => {
    if (typeof AudioPlayer !== 'undefined') AudioPlayer.stopAll();
    showToast('Audio stopped', 'info');
  });

  // Volume slider (throttle persist to avoid excessive localStorage writes)
  const volumeSlider = $('volume-slider');
  const volumeValue = $('volume-value');
  let volumePersistTimeout = null;
  volumeSlider?.addEventListener('input', () => {
    const vol = parseInt(volumeSlider.value, 10);
    if (typeof AudioPlayer !== 'undefined') AudioPlayer.setVolume(vol / 100);
    if (volumeValue) volumeValue.textContent = vol + '%';
    const s = getCurrentSettings();
    if (s.persistVolume) {
      s.volume = vol;
      if (volumePersistTimeout) clearTimeout(volumePersistTimeout);
      volumePersistTimeout = setTimeout(() => {
        volumePersistTimeout = null;
        saveSettings(s);
      }, 150);
    }
  });

  // --- Tools Tab: Lights (Flash All, Turn Off All, Set Color) ---
  async function runLightActionOnAllDevices(action, colorHex) {
    let devices = BluetoothScanner.getDevices().filter(
      (d) => d.connected && d.lightTestPlan?.available,
    );
    if (action === 'color' && colorHex) {
      devices = devices.filter((d) => d.lightTestPlan?.actions?.color);
    }
    if (devices.length === 0) {
      showToast(
        action === 'color'
          ? 'No connected RGB lights. Connect color-capable lights in Devices tab first.'
          : 'No connected smart lights. Connect lights in Devices tab first.',
        'error',
      );
      return;
    }
    const settled = await Promise.allSettled(
      devices.map((dev) => {
        if (action === 'color' && colorHex) {
          return runLightTestActionWithColor(dev.id, colorHex);
        }
        return runLightTestAction(dev.id, action, null, { showNotifications: false });
      }),
    );
    const success = settled.filter((r) => r.status === 'fulfilled').length;
    const fail = settled.length - success;
    showToast(`Lights: ${success} ok, ${fail} failed`, success > 0 ? 'success' : 'error');
  }

  async function runLightTestActionWithColor(deviceId, hexColor) {
    const devices = BluetoothScanner.getDevices();
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev || !dev.connected) throw new Error('Device not connected');
    const plan = dev.lightTestPlan;
    if (!plan?.available || !plan.targetCharUuid) throw new Error('No light plan');
    const targetChar = (dev.characteristics || []).find(
      (ch) => normalizeUuid(ch.uuid) === normalizeUuid(plan.targetCharUuid),
    );
    if (!targetChar) throw new Error('Characteristic not found');
    const hex = String(hexColor || '#ff0000')
      .replace(/^#/, '')
      .slice(0, 6);
    if (hex.length < 6) throw new Error('Invalid color format');
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(0, 2), 16) || 0));
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(2, 4), 16) || 0));
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(4, 6), 16) || 0));
    const colorHex = [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(':');
    await BluetoothScanner.writeCharacteristic(targetChar, colorHex);
  }

  $('btn-flash-all-lights')?.addEventListener('click', async () => {
    await runLightActionOnAllDevices('flash');
  });

  $('btn-off-all-lights')?.addEventListener('click', async () => {
    await runLightActionOnAllDevices('off');
  });

  $('btn-set-color-all-lights')?.addEventListener('click', async () => {
    const hexInput = $('light-color-hex');
    const picker = $('light-color-picker');
    const hex = (hexInput?.value || picker?.value || '#ff0000').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      showToast('Enter valid hex color (e.g. #ff0000)', 'error');
      return;
    }
    await runLightActionOnAllDevices('color', hex);
  });

  const lightColorPicker = $('light-color-picker');
  const lightColorHex = $('light-color-hex');
  lightColorPicker?.addEventListener('input', () => {
    if (lightColorHex) lightColorHex.value = lightColorPicker.value;
  });
  lightColorHex?.addEventListener('input', () => {
    const v = lightColorHex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v) && lightColorPicker) {
      lightColorPicker.value = v;
    }
  });

  $('btn-silence-all')?.addEventListener('click', async () => {
    const devices = BluetoothScanner.getDevices();
    const connCount = devices.filter((d) => d.connected).length;
    if (connCount > 0) {
      const confirmed = await showConfirm(
        'Silence All',
        `Stop audio and disconnect ${connCount} device(s)?`,
      );
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
  $('btn-share-audio')?.addEventListener('click', async () => {
    const ok = await Sharing.shareAudioFile();
    showToast(
      ok ? 'Audio shared' : 'Audio downloaded (share not available)',
      ok ? 'success' : 'info',
    );
  });

  $('btn-share-hearts')?.addEventListener('click', async () => {
    const ok = await Sharing.shareHearts();
    showToast(ok ? 'Hearts shared' : 'Hearts copied to clipboard', ok ? 'success' : 'info');
  });

  $('btn-share-link')?.addEventListener('click', async () => {
    const ok = await Sharing.shareLink(
      window.BLUETTOOL_APP_URL || 'https://thumpersecure.github.io/bluettool/',
      'BlueTTool',
      'BLE scanner and testing tool for Bluefy on iOS',
    );
    showToast(ok ? 'Link shared' : 'Link copied to clipboard', ok ? 'success' : 'info');
  });

  // --- Voice Commands ---
  const btnVoiceMic = document.getElementById('btn-voice-mic');
  const voiceUnsupported = document.getElementById('voice-unsupported');
  const voiceStatus = document.getElementById('voice-status');
  const voiceLastResult = document.getElementById('voice-last-result');

  if (typeof VoiceCommands !== 'undefined') {
    const supported = VoiceCommands.isSupported();
    if (voiceUnsupported) voiceUnsupported.classList.toggle('hidden', supported);
    if (btnVoiceMic) btnVoiceMic.disabled = !supported;

    VoiceCommands.setOnStatus((ev) => {
      if (voiceStatus) voiceStatus.textContent = ev.message || '';
      if (btnVoiceMic) {
        btnVoiceMic.classList.toggle('listening', ev.type === 'listening');
        btnVoiceMic.querySelector('.voice-mic-label').textContent =
          ev.type === 'listening' ? 'Listening...' : 'Tap to Speak';
      }
      if (ev.type === 'error' && ev.message) {
        showToast(ev.message, 'error');
      }
    });

    VoiceCommands.setOnResult(async (result) => {
      if (voiceLastResult) {
        voiceLastResult.classList.remove('hidden');
        voiceLastResult.textContent = `Heard: "${result.transcript}"`;
        voiceLastResult.classList.remove('success', 'unknown');
      }

      const runAction = async (actionId, colorHex) => {
        try {
          if (actionId === 'flash_lights') {
            await runLightActionOnAllDevices('flash');
            showToast('Flash lights', 'success');
          } else if (actionId === 'lights_off') {
            await runLightActionOnAllDevices('off');
            showToast('Lights off', 'success');
          } else if (actionId === 'silence_all') {
            const devices = BluetoothScanner.getDevices();
            const connCount = devices.filter((d) => d.connected).length;
            if (connCount > 0) {
              const confirmed = await showConfirm(
                'Silence All',
                `Stop audio and disconnect ${connCount} device(s)?`,
              );
              if (!confirmed) return;
            }
            if (typeof AudioPlayer !== 'undefined') AudioPlayer.stopAll();
            for (const dev of BluetoothScanner.getDevices()) {
              if (dev.connected) BluetoothScanner.disconnect(dev.id);
            }
            renderDeviceList();
            showToast('Silenced', 'success');
          } else if (actionId === 'stop_audio') {
            if (typeof AudioPlayer !== 'undefined') AudioPlayer.stopAll();
            showToast('Audio stopped', 'info');
          } else if (actionId === 'scan') {
            const scanTab = document.querySelector('.tab[data-tab="scanner"]');
            if (scanTab) scanTab.click();
            const btnScan = document.getElementById('btn-scan-all');
            if (btnScan && !btnScan.disabled) btnScan.click();
          } else if (actionId === 'set_color' && colorHex) {
            await runLightActionOnAllDevices('color', colorHex);
            showToast(`Color set: ${colorHex}`, 'success');
          } else if (actionId === 'help') {
            showToast('Say: Flash lights, Turn off, Silence, Stop, Scan, Set color red', 'info');
          } else if (actionId === 'unknown') {
            if (voiceLastResult) voiceLastResult.classList.add('unknown');
            showToast(`Unknown: "${result.transcript}". Try "Flash lights" or "Silence"`, 'info');
          }
          if (voiceLastResult && actionId !== 'unknown') {
            voiceLastResult.classList.add('success');
          }
        } catch (err) {
          showToast(err?.message || 'Command failed', 'error');
        }
      };

      await runAction(result.action, result.color);
    });

    btnVoiceMic?.addEventListener('click', () => {
      if (VoiceCommands.isSupported()) {
        VoiceCommands.startListening();
      }
    });
  }

  // --- Macros ---
  function renderMacros() {
    const list = $('macros-list');
    const form = $('macro-form');
    if (!list) return;
    const macros = typeof Macros !== 'undefined' ? Macros.getMacros() : [];
    if (macros.length === 0) {
      list.innerHTML =
        '<div class="macros-empty"><div class="empty-icon" aria-hidden="true">&#x2699;</div><p>No macros yet</p><p class="empty-hint">Add one to automate light tests: delay → flash → off.</p></div>';
    } else {
      list.innerHTML = macros
        .map(
          (m) => `
        <div class="macro-item" data-macro-id="${escapeHtml(m.id)}">
          <div class="macro-item-name">${escapeHtml(m.name)}</div>
          <div class="macro-item-steps">${(m.steps || []).length} steps</div>
          <div class="macro-item-actions">
            <button class="btn btn-primary btn-small btn-run-macro" data-macro-id="${escapeHtml(m.id)}">Run</button>
            <button class="btn btn-danger btn-small btn-delete-macro" data-macro-id="${escapeHtml(m.id)}">Delete</button>
          </div>
        </div>
      `,
        )
        .join('');
    }
    if (form) form.classList.add('hidden');
  }

  // Macros list: event delegation (no per-item listeners on re-render)
  $('macros-list')?.addEventListener('click', async (e) => {
    const runBtn = e.target.closest('.btn-run-macro');
    if (runBtn) {
      e.stopPropagation();
      const origText = runBtn.textContent;
      runBtn.disabled = true;
      runBtn.textContent = 'Running...';
      try {
        await runMacroById(runBtn.dataset.macroId);
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = origText;
      }
      return;
    }
    const delBtn = e.target.closest('.btn-delete-macro');
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.macroId;
      const m = Macros.getMacro(id);
      const confirmed = await showConfirm('Delete Macro', `Delete "${m?.name || id}"?`);
      if (confirmed) {
        Macros.deleteMacro(id);
        renderMacros();
        showToast('Macro deleted', 'info');
      }
    }
  });

  async function runMacroById(macroId) {
    const executor = {
      delay: (ms) => sleep(ms),
      lightAction: async (action, colorHex, deviceId) => {
        if (deviceId && deviceId !== 'all') {
          if (action === 'color' && colorHex) {
            await runLightTestActionWithColor(deviceId, colorHex);
          } else {
            await runLightTestAction(deviceId, action, null);
          }
        } else {
          await runLightActionOnAllDevices(action, action === 'color' ? colorHex : null);
        }
      },
      replay: (captureId) => Announcements.replayToDevice(captureId),
      connectDevice: (deviceId) => BluetoothScanner.connect(deviceId),
    };
    try {
      const result = await Macros.runMacro(macroId, executor);
      showToast(
        `Macro done: ${result.success} ok, ${result.failed} failed`,
        result.failed > 0 ? 'info' : 'success',
      );
    } catch (err) {
      showToast(err?.message || 'Macro failed', 'error');
    }
  }

  $('btn-add-macro')?.addEventListener('click', () => {
    const form = $('macro-form');
    const nameInput = $('macro-name-input');
    if (form && nameInput) {
      nameInput.value = '';
      nameInput.placeholder = 'Macro name (e.g. Quick Light Test)';
      $('macro-steps-preview').textContent = 'Preset: delay → flash → delay → off';
      form.classList.remove('hidden');
    }
  });

  $('btn-save-macro')?.addEventListener('click', () => {
    const nameInput = $('macro-name-input');
    const name = (nameInput?.value || '').trim() || 'Quick Light Test';
    const steps = [
      { type: 'delay', ms: 500 },
      { type: 'light_flash', deviceId: 'all' },
      { type: 'delay', ms: 1000 },
      { type: 'light_off', deviceId: 'all' },
    ];
    Macros.createMacro(name, steps);
    $('macro-form')?.classList.add('hidden');
    renderMacros();
    showToast(`Macro "${name}" created`, 'success');
  });

  $('btn-cancel-macro')?.addEventListener('click', () => {
    $('macro-form')?.classList.add('hidden');
  });

  renderMacros();

  // --- Audio Overlay ---
  function showAudioOverlay() {
    const overlay = $('audio-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
    }
  }

  $('btn-close-audio-overlay')?.addEventListener('click', () => {
    const overlay = $('audio-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (typeof AudioPlayer !== 'undefined') AudioPlayer.stopAll();
  });

  // --- Advanced / Agent Tab ---
  const agentStatusCard = $('agent-status-card');
  const agentResultsCard = $('agent-results-card');
  const agentFeed = $('agent-feed');
  const agentBadge = $('agent-state-badge');
  const agentResultsEl = $('agent-results');
  const btnAgentStop = $('btn-agent-stop');
  const btnAgentFull = $('btn-agent-full');
  const btnAgentQuick = $('btn-agent-quick');
  const btnAgentParallel = $('btn-agent-parallel');
  const btnAgentStopAll = $('btn-agent-stop-all');
  const parallelStatusCard = $('parallel-status-card');
  const parallelDeviceCount = $('parallel-device-count');
  const aggregateResultsCard = $('aggregate-results-card');

  function updateParallelDeviceCount() {
    const allDevices = BluetoothScanner.getDevices();
    const available = allDevices.filter((d) => !d.connected).length;
    if (parallelDeviceCount) {
      parallelDeviceCount.textContent = `${available} device${available !== 1 ? 's' : ''} available for parallel scan`;
    }
  }

  function updateAgentButtons() {
    const running = Advanced.isRunning();
    if (btnAgentStop) btnAgentStop.disabled = !running;
    if (btnAgentStopAll) btnAgentStopAll.disabled = !running;
    if (btnAgentFull) btnAgentFull.disabled = running;
    if (btnAgentQuick) btnAgentQuick.disabled = running;
    if (btnAgentParallel) btnAgentParallel.disabled = running;
  }

  function renderAgentPoolList() {
    const poolList = $('agent-pool-list');
    if (!poolList) return;
    const agentList = Advanced.getAgents();
    if (agentList.length === 0) {
      poolList.innerHTML = '';
      return;
    }

    poolList.innerHTML = agentList
      .map((agent) => {
        const stateClass = 'agent-' + agent.state;
        const elapsed =
          agent.endTime && agent.startTime
            ? ((agent.endTime - agent.startTime) / 1000).toFixed(1)
            : agent.startTime
              ? ((Date.now() - agent.startTime) / 1000).toFixed(1)
              : '—';
        const lastMsg = agent.log.length > 0 ? agent.log[agent.log.length - 1].message : '';
        return `
        <div class="agent-pool-item ${stateClass}">
          <div class="agent-pool-header">
            <span class="agent-pool-name">#${agent.id} ${escapeHtml(agent.deviceName)}</span>
            <span class="agent-badge agent-badge-sm ${stateClass}">${agent.state}</span>
          </div>
          <div class="agent-pool-detail">
            <span class="agent-pool-time">${elapsed}s</span>
            <span class="agent-pool-msg">${escapeHtml(lastMsg)}</span>
          </div>
        </div>
      `;
      })
      .join('');

    const counts = Advanced.getAgentCount();
    const runningEl = $('parallel-running');
    const completedEl = $('parallel-completed');
    const totalEl = $('parallel-total');
    if (runningEl) runningEl.textContent = `${counts.running} running`;
    if (completedEl) completedEl.textContent = `${counts.completed} done`;
    if (totalEl) totalEl.textContent = `${counts.total} total`;
  }

  let agentStatusRaf = null;
  const pendingAgentEntries = [];
  Advanced.setOnStatus((entry) => {
    pendingAgentEntries.push(entry);
    if (agentStatusRaf) return;
    agentStatusRaf = requestAnimationFrame(() => {
      agentStatusRaf = null;
      const entries = pendingAgentEntries.splice(0, pendingAgentEntries.length);
      const last = entries[entries.length - 1];
      if (agentStatusCard) agentStatusCard.style.display = 'block';
      if (agentBadge && last) {
        agentBadge.textContent = last.state;
        agentBadge.className = 'agent-badge agent-' + last.state;
      }
      if (agentFeed && entries.length > 0) {
        const frag = document.createDocumentFragment();
        for (const e of entries) {
          const line = document.createElement('div');
          line.className = 'agent-feed-line';
          const prefix = e.agentId ? `[#${e.agentId}] ` : '';
          line.innerHTML = `<span class="agent-feed-time">${new Date(e.time).toLocaleTimeString()}</span> <span class="agent-feed-msg">${escapeHtml(prefix + e.message)}</span>`;
          frag.appendChild(line);
        }
        agentFeed.appendChild(frag);
        agentFeed.scrollTop = agentFeed.scrollHeight;
      }
      if (last?.state === 'complete' && last?.data?.analysis && !last?.data?.agentResults) {
        renderAgentResults(last.data);
      }
      updateAgentButtons();
      renderAgentPoolList();
    });
  });

  Advanced.setOnAggregate((event) => {
    if (event.type === 'start') {
      parallelStatusCard.style.display = 'block';
      renderAgentPoolList();
    } else if (event.type === 'agent_complete') {
      renderAgentPoolList();
    } else if (event.type === 'complete' && event.aggregate) {
      renderAggregateResults(event.aggregate);
      renderAgentPoolList();
      updateAgentButtons();
    }
  });

  btnAgentFull.addEventListener('click', async () => {
    agentFeed.innerHTML = '';
    agentResultsCard.style.display = 'none';
    aggregateResultsCard.style.display = 'none';
    $('vuln-report-card').style.display = 'none';
    await Advanced.runFullDiscovery();
    renderDeviceList();
    updateAgentButtons();
  });

  btnAgentQuick.addEventListener('click', async () => {
    agentFeed.innerHTML = '';
    agentResultsCard.style.display = 'none';
    aggregateResultsCard.style.display = 'none';
    $('vuln-report-card').style.display = 'none';
    await Advanced.quickScan();
    renderDeviceList();
    updateAgentButtons();
  });

  btnAgentParallel.addEventListener('click', async () => {
    agentFeed.innerHTML = '';
    agentResultsCard.style.display = 'none';
    aggregateResultsCard.style.display = 'none';
    $('vuln-report-card').style.display = 'none';
    parallelStatusCard.style.display = 'none';
    Advanced.clearAgents();
    updateAgentButtons();
    const results = await Advanced.runParallelDiscovery();
    renderDeviceList();
    updateAgentButtons();
    if (results && results.length > 0) {
      showToast(`Parallel scan complete — ${results.length} device(s) analyzed`, 'success');
    }
  });

  btnAgentStop.addEventListener('click', () => {
    Advanced.stop();
    agentStatusCard.style.display = 'none';
    agentFeed.innerHTML = '';
    agentResultsCard.style.display = 'none';
    aggregateResultsCard.style.display = 'none';
    parallelStatusCard.style.display = 'none';
    $('vuln-report-card').style.display = 'none';
    agentBadge.textContent = 'idle';
    agentBadge.className = 'agent-badge agent-idle';
    btnAgentStop.disabled = true;
    btnAgentStopAll.disabled = true;
    btnAgentFull.disabled = false;
    btnAgentQuick.disabled = false;
    btnAgentParallel.disabled = false;
    showToast('Agent stopped', 'info');
  });

  btnAgentStopAll.addEventListener('click', () => {
    Advanced.stop();
    parallelStatusCard.style.display = 'none';
    agentStatusCard.style.display = 'none';
    agentFeed.innerHTML = '';
    agentResultsCard.style.display = 'none';
    aggregateResultsCard.style.display = 'none';
    $('vuln-report-card').style.display = 'none';
    agentBadge.textContent = 'idle';
    agentBadge.className = 'agent-badge agent-idle';
    updateAgentButtons();
    showToast('All agents stopped', 'info');
  });

  function renderAggregateResults(aggregate) {
    if (!aggregate) return;
    aggregateResultsCard.style.display = 'block';

    const statsEl = $('aggregate-stats');
    const resultsEl = $('aggregate-results');

    statsEl.innerHTML = [
      `Devices: ${aggregate.totalDevices}`,
      `Services: ${aggregate.totalServices}`,
      `Characteristics: ${aggregate.totalCharacteristics}`,
      `Readable: ${aggregate.totalReadable}`,
      `Writable: ${aggregate.totalWritable}`,
      `High Risk: ${aggregate.highRiskDevices}`,
    ]
      .map((s) => `<span class="aggregate-stat">${s}</span>`)
      .join('');

    const a = aggregate.analysis || {};
    const summary = Array.isArray(a.summary) ? a.summary : [];
    const riskFactors = Array.isArray(a.riskFactors) ? a.riskFactors : [];
    const recommendations = Array.isArray(a.recommendations) ? a.recommendations : [];

    let html = '<div class="agent-results-section">';
    html += '<h3>Summary</h3>';
    html += '<ul>' + summary.map((s) => `<li>${escapeHtml(s)}</li>`).join('') + '</ul>';

    if (riskFactors.length > 0) {
      html += '<h3>Findings</h3>';
      html +=
        '<ul class="agent-risks">' +
        riskFactors.map((r) => `<li>${escapeHtml(r)}</li>`).join('') +
        '</ul>';
    }

    if (recommendations.length > 0) {
      html += '<h3>Recommendations</h3>';
      html += '<ul>' + recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join('') + '</ul>';
    }

    html += '</div>';

    if (aggregate.agentResults) {
      html += '<h3 style="margin-top:12px;">Per-Device Results</h3>';
      for (const r of aggregate.agentResults) {
        if (!r.analysis) continue;
        html += `<div class="per-device-result">`;
        html += `<div class="per-device-header">${escapeHtml(r.deviceName || 'Unknown')}</div>`;
        html += `<div class="per-device-stats">${r.servicesFound} svc, ${r.characteristicsFound} char, ${r.readableValues} read, ${r.writableChars} write</div>`;
        if (r.vulnReport) {
          html += `<div class="per-device-risk risk-${r.vulnReport.riskLevel.toLowerCase()}">${r.vulnReport.riskLevel} (${r.vulnReport.riskScore}/100)</div>`;
        }
        html += `</div>`;
      }
    }

    resultsEl.innerHTML = html;

    const highestRiskResult = aggregate.agentResults?.find((r) => r.vulnReport);
    if (highestRiskResult?.vulnReport) {
      renderVulnReport(highestRiskResult.vulnReport);
    }
  }

  BluetoothScanner.setOnDeviceFound(() => {
    renderDeviceList();
    updateParallelDeviceCount();
  });

  BluetoothScanner.setOnConnectionChange((info, connected, context) => {
    renderDeviceList();
    updateParallelDeviceCount();
    updateQuickReconnectUI();
    const displayName = getDisplayName(info);
    if (connected) {
      saveLastConnected(info.id);
      if (context?.source !== 'agent') {
        showAudioOverlay();
        AudioPlayer.triggerOnConnect();
      }
      showToast(`Connected to ${displayName}`, 'success');
    } else {
      showToast(`Disconnected from ${displayName}`, 'info');
    }
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
    html += '<ul>' + summary.map((s) => `<li>${escapeHtml(s)}</li>`).join('') + '</ul>';

    if (riskFactors.length > 0) {
      html += '<h3>Findings</h3>';
      html +=
        '<ul class="agent-risks">' +
        riskFactors.map((r) => `<li>${escapeHtml(r)}</li>`).join('') +
        '</ul>';
    }

    html += '<h3>Recommendations</h3>';
    html += '<ul>' + recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join('') + '</ul>';
    html += '</div>';

    agentResultsEl.innerHTML = html;

    // Render vulnerability report if available
    if (data.vulnReport) {
      renderVulnReport(data.vulnReport);
    }
  }

  function renderVulnReport(report) {
    const card = $('vuln-report-card');
    card.style.display = 'block';

    // Score banner
    const banner = $('vuln-score-banner');
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
    const statsEl = $('vuln-stats');
    statsEl.innerHTML = [
      `Readable: ${report.stats.totalReadable}`,
      `Writable: ${report.stats.totalWritable}`,
      `Sensitive: ${report.stats.sensitiveExposed}`,
      `Notify: ${report.stats.notifyChars}`,
      `Findings: ${report.findings.length}`,
    ]
      .map((s) => `<span class="vuln-stat">${s}</span>`)
      .join('');

    // Findings
    const findingsEl = $('vuln-findings');
    if (report.findings.length === 0) {
      findingsEl.innerHTML =
        '<div style="font-size:12px;color:var(--text-hint);text-align:center;padding:12px;">No vulnerability findings</div>';
    } else {
      findingsEl.innerHTML = report.findings
        .map(
          (f) => `
        <div class="vuln-finding sev-${f.severity}">
          <div class="vuln-finding-header">
            <span class="vuln-sev-badge sev-${f.severity}">${escapeHtml(f.severity)}</span>
            <span class="vuln-finding-title">${escapeHtml(f.title)}</span>
          </div>
          <div class="vuln-finding-detail">${escapeHtml(f.detail)}</div>
          <div class="vuln-finding-category">${escapeHtml(f.category)}</div>
        </div>
      `,
        )
        .join('');
    }

    // Recommendations
    const recsEl = $('vuln-recommendations');
    recsEl.innerHTML =
      '<h3>Recommendations</h3>' +
      report.recommendations
        .map(
          (r) => `
        <div class="vuln-rec">
          <span class="vuln-rec-priority pri-${r.priority}">${escapeHtml(r.priority)}</span>
          ${escapeHtml(r.text)}
        </div>
      `,
        )
        .join('');
  }

  // --- Calls Tab ---
  const callImportInput = $('call-import-input');
  const btnImportCalls = $('btn-import-calls');
  const btnExportCalls = $('btn-export-calls');
  const btnClearCalls = $('btn-clear-calls');
  const callList = $('call-list');

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
    const confirmed = await showConfirm(
      'Clear Call History',
      `Remove ${calls.length} call(s) from the list?`,
    );
    if (!confirmed) return;
    CallHistory.clearCalls();
    renderCallList();
    showToast('Call history cleared', 'info');
  });

  function renderCallList() {
    if (!callList) return;
    const calls = typeof CallHistory !== 'undefined' ? CallHistory.getCalls() : [];
    if (calls.length === 0) {
      callList.innerHTML = `<div class="empty-state" id="calls-empty-state">
        <div class="empty-icon" aria-hidden="true">&#x1F4DE;</div>
        <p>No calls imported yet</p>
        <p class="empty-hint">Export from iPhone Settings → Phone, or use a call history backup app, then import the file here.</p>
        <button type="button" class="empty-cta" id="empty-cta-import-calls" aria-label="Import call history">Import Calls</button>
      </div>`;
      return;
    }
    callList.innerHTML = calls
      .map(
        (c) => `
      <div class="call-item">
        <span class="call-item-date">${escapeHtml(c.date)}</span>
        <span class="call-item-number">${escapeHtml(c.name || c.number)}</span>
        <span class="call-item-duration">${escapeHtml(c.duration)}</span>
        <span class="call-item-type">${escapeHtml(c.type)}</span>
      </div>
    `,
      )
      .join('');
  }

  // --- Settings Tab ---
  document.querySelectorAll('.settings-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelId = 'panel-' + btn.dataset.toggle;
      const panel = $(panelId);
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      panel?.classList.toggle('open', !expanded);
    });
  });

  $('setting-theme-dark')?.addEventListener('change', () => {
    const s = getCurrentSettings();
    s.themeDark = $('setting-theme-dark').checked;
    saveSettings(s);
    applySettings(s);
    showToast(s.themeDark ? 'Dark theme' : 'Light theme', 'info');
  });

  $('setting-persist-volume')?.addEventListener('change', () => {
    const s = getCurrentSettings();
    saveSettings(s);
  });

  $('setting-scan-timeout')?.addEventListener('change', () => {
    const s = getCurrentSettings();
    saveSettings(s);
    const scanDurationHint = $('scan-duration-hint');
    if (scanDurationHint) scanDurationHint.value = $('setting-scan-timeout').value;
  });

  $('setting-default-sort')?.addEventListener('change', () => {
    const s = getCurrentSettings();
    saveSettings(s);
    const deviceSort = $('device-sort');
    if (deviceSort) {
      deviceSort.value = $('setting-default-sort').value;
      renderDeviceList();
    }
  });

  $('setting-default-filter')?.addEventListener('change', () => {
    const s = getCurrentSettings();
    saveSettings(s);
    const deviceFilter = $('device-filter');
    if (deviceFilter) {
      deviceFilter.value = $('setting-default-filter').value;
      renderDeviceList();
    }
  });

  $('scan-duration-hint')?.addEventListener('change', () => {
    const val = $('scan-duration-hint')?.value;
    const settingScanTimeout = $('setting-scan-timeout');
    if (settingScanTimeout) settingScanTimeout.value = val;
    const s = getCurrentSettings();
    s.scanTimeout = parseInt(val, 10);
    saveSettings(s);
  });

  $('btn-reset-settings')?.addEventListener('click', async () => {
    const confirmed = await showConfirm('Reset Settings', 'Restore all settings to defaults?');
    if (!confirmed) return;
    saveSettings(DEFAULT_SETTINGS);
    applySettings(DEFAULT_SETTINGS);
    renderDeviceList();
    showToast('Settings reset to defaults', 'info');
  });

  // --- Log Tab ---
  $('btn-copy-log')?.addEventListener('click', () => {
    Logger.copyToClipboard();
    showToast('Log copied to clipboard', 'success');
  });

  $('btn-clear-log')?.addEventListener('click', async () => {
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
  renderCaptures(); // Initial Replay tab state
  updateQuickReconnectUI(); // Show quick reconnect if last device available
});
