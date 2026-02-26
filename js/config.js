/**
 * BlueTTool runtime configuration.
 *
 * Configuration can be provided by setting:
 *   window.__BLUETTOOL_CONFIG__ = { ... }
 * before loading app scripts.
 */
const BlueTToolConfig = (() => {
  const DEFAULTS = {
    appUrl: 'https://thumpersecure.github.io/bluettool/',
    logLevel: 'info',
    enableTelemetry: false,
    maxImportBytes: 1024 * 1024,
  };

  const LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

  function toBoolean(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  }

  function toPositiveInt(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return fallback;
    return Math.floor(num);
  }

  function sanitizeUrl(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    return /^https?:\/\//i.test(raw) ? raw : fallback;
  }

  function sanitizeLogLevel(value, fallback) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    return LOG_LEVELS.has(normalized) ? normalized : fallback;
  }

  const runtime =
    typeof window !== 'undefined' && window.__BLUETTOOL_CONFIG__ ? window.__BLUETTOOL_CONFIG__ : {};

  const config = {
    appUrl: sanitizeUrl(runtime.appUrl, DEFAULTS.appUrl),
    logLevel: sanitizeLogLevel(runtime.logLevel, DEFAULTS.logLevel),
    enableTelemetry: toBoolean(runtime.enableTelemetry, DEFAULTS.enableTelemetry),
    maxImportBytes: toPositiveInt(runtime.maxImportBytes, DEFAULTS.maxImportBytes),
  };

  if (typeof window !== 'undefined') {
    window.BLUETTOOL_APP_URL = config.appUrl;
    window.BLUETTOOL_LOG_LEVEL = config.logLevel;
    window.BLUETTOOL_ENABLE_TELEMETRY = config.enableTelemetry;
    window.BLUETTOOL_MAX_IMPORT_BYTES = config.maxImportBytes;
  }

  return {
    get() {
      return { ...config };
    },
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlueTToolConfig;
}
