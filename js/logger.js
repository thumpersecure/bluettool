/**
 * BlueTTool - Activity Logger
 * Centralized logging for all Bluetooth operations
 */
const Logger = (() => {
  const entries = [];
  let logContainer = null;

  function init() {
    logContainer = document.getElementById('log-output');
  }

  function timestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false }) +
      '.' + String(now.getMilliseconds()).padStart(3, '0');
  }

  const MAX_ENTRIES = 500;

  function addEntry(level, message, data) {
    const entry = {
      time: timestamp(),
      level,
      message,
      data: data || null
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
        typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data, null, 2)
      )}</span>`;
    }

    div.innerHTML = html;
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function info(msg, data) { return addEntry('info', msg, data); }
  function success(msg, data) { return addEntry('success', msg, data); }
  function warn(msg, data) { return addEntry('warn', msg, data); }
  function error(msg, data) { return addEntry('error', msg, data); }

  function clear() {
    entries.length = 0;
    if (logContainer) logContainer.innerHTML = '';
  }

  function getAll() {
    return [...entries];
  }

  function copyToClipboard() {
    const text = entries.map(e => {
      let line = `[${e.time}] [${e.level.toUpperCase()}] ${e.message}`;
      if (e.data) {
        line += '\n  ' + (typeof e.data === 'string' ? e.data : JSON.stringify(e.data));
      }
      return line;
    }).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      info('Log copied to clipboard');
    }).catch(() => {
      warn('Could not copy to clipboard');
    });
  }

  return { init, info, success, warn, error, clear, getAll, copyToClipboard };
})();
