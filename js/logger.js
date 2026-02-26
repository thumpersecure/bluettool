/**
 * BlueTTool - Activity Logger
 * Centralized logging for all Bluetooth operations
 */
const Logger = (() => {
  const entries = [];
  let logContainer = null;
  const MAX_ENTRIES = 500;
  const LOG_LEVEL_KEY = 'bluettool_log_level';
  const LEVEL_PRIORITY = { debug: 10, info: 20, success: 20, warn: 30, error: 40 };
  let currentLevel = 'info';
  let onEntry = null;

  function init() {
    logContainer = document.getElementById('log-output');
    currentLevel = resolveInitialLevel();
  }

  function timestamp() {
    const now = new Date();
    return (
      now.toLocaleTimeString('en-US', { hour12: false }) +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0')
    );
  }

  function resolveInitialLevel() {
    const fromGlobal = String(
      typeof window !== 'undefined' ? window.BLUETTOOL_LOG_LEVEL || '' : '',
    ).toLowerCase();
    let fromStorage = '';
    try {
      fromStorage =
        typeof localStorage !== 'undefined'
          ? String(localStorage.getItem(LOG_LEVEL_KEY) || '').toLowerCase()
          : '';
    } catch (_) {
      fromStorage = '';
    }
    const candidate = fromStorage || fromGlobal || 'info';
    return Object.prototype.hasOwnProperty.call(LEVEL_PRIORITY, candidate) ? candidate : 'info';
  }

  function shouldLog(level) {
    const entryPriority = LEVEL_PRIORITY[level] ?? LEVEL_PRIORITY.info;
    return entryPriority >= LEVEL_PRIORITY[currentLevel];
  }

  function setLevel(level) {
    const normalized = String(level || '').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(LEVEL_PRIORITY, normalized)) {
      return false;
    }
    currentLevel = normalized;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(LOG_LEVEL_KEY, normalized);
    } catch (_) {
      // ignore storage failures
    }
    return true;
  }

  function getLevel() {
    return currentLevel;
  }

  function redactSensitive(value) {
    if (typeof value !== 'string') return value;
    return value
      .replace(/[0-9a-f]{2}(?::[0-9a-f]{2}){7,}/gi, '[REDACTED_HEX]')
      .replace(/\b([0-9a-f]{8}-[0-9a-f-]{27,})\b/gi, '[REDACTED_UUID]');
  }

  function addEntry(level, message, data) {
    if (!shouldLog(level)) return null;
    const entry = {
      time: timestamp(),
      level,
      message: redactSensitive(message),
      data: data ? redactSensitive(typeof data === 'string' ? data : JSON.stringify(data)) : null,
    };
    entries.push(entry);
    // Prune oldest entries to prevent memory growth
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
      if (logContainer && logContainer.children.length > MAX_ENTRIES) {
        while (logContainer.children.length > MAX_ENTRIES) {
          logContainer.removeChild(logContainer.firstChild);
        }
      }
    }
    renderEntry(entry);
    if (typeof onEntry === 'function') onEntry(entry);
    return entry;
  }

  function renderEntry(entry) {
    if (!logContainer) return;
    const div = document.createElement('div');
    div.className = 'log-entry';

    let html = `<span class="log-time">${entry.time}</span>`;
    html += `<span class="log-${entry.level}">${escapeHtml(entry.message)}</span>`;

    if (entry.data) {
      html += `<br><span class="log-data">&nbsp;&nbsp;${escapeHtml(
        typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data, null, 2),
      )}</span>`;
    }

    div.innerHTML = html;
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function info(msg, data) {
    return addEntry('info', msg, data);
  }
  function debug(msg, data) {
    return addEntry('debug', msg, data);
  }
  function success(msg, data) {
    return addEntry('success', msg, data);
  }
  function warn(msg, data) {
    return addEntry('warn', msg, data);
  }
  function error(msg, data) {
    return addEntry('error', msg, data);
  }

  function clear() {
    entries.length = 0;
    if (logContainer) logContainer.innerHTML = '';
  }

  function getAll() {
    return [...entries];
  }

  function copyToClipboard() {
    const text = entries
      .map((e) => {
        let line = `[${e.time}] [${e.level.toUpperCase()}] ${e.message}`;
        if (e.data) {
          line += '\n  ' + (typeof e.data === 'string' ? e.data : JSON.stringify(e.data));
        }
        return line;
      })
      .join('\n');

    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      !navigator.clipboard.writeText
    ) {
      warn('Clipboard API unavailable');
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        info('Log copied to clipboard');
      })
      .catch(() => {
        warn('Could not copy to clipboard');
      });
  }

  function setOnEntry(cb) {
    onEntry = typeof cb === 'function' ? cb : null;
  }

  return {
    init,
    debug,
    info,
    success,
    warn,
    error,
    clear,
    getAll,
    copyToClipboard,
    setLevel,
    getLevel,
    setOnEntry,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
}
