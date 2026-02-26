/**
 * BlueTTool - Automation Macros Module
 *
 * Record and replay sequences of BLE actions: connect, light flash/color/off,
 * replay capture, delay. Supports repeatable testing workflows.
 *
 * Step types: delay, light_flash, light_off, light_color, replay, connect_device
 */
const Macros = (() => {
  const STORAGE_KEY = 'bluettool_macros';
  const STEP_TYPES = [
    'delay',
    'light_flash',
    'light_off',
    'light_color',
    'replay',
    'connect_device',
  ];
  const MAX_NAME_LENGTH = 80;

  function log(level, message, data) {
    if (typeof Logger === 'undefined') return;
    if (typeof Logger[level] === 'function') Logger[level](message, data);
  }

  function createMacroId() {
    return `macro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeStep(step) {
    if (!step || typeof step !== 'object' || !STEP_TYPES.includes(step.type)) {
      return null;
    }
    const normalized = { type: step.type };
    if (step.type === 'delay') {
      const ms = Number(step.ms);
      normalized.ms = Number.isFinite(ms) ? Math.max(0, Math.min(ms, 120000)) : 500;
      return normalized;
    }
    if (step.deviceId !== null && step.deviceId !== undefined) {
      normalized.deviceId = String(step.deviceId);
    }
    if (step.captureId !== null && step.captureId !== undefined) {
      normalized.captureId = String(step.captureId);
    }
    if (step.hex !== null && step.hex !== undefined) {
      normalized.hex = String(step.hex);
    }
    return normalized;
  }

  function normalizeMacro(macro) {
    if (!macro || typeof macro !== 'object') return null;
    const id = String(macro.id || createMacroId());
    const name =
      String(macro.name || 'Untitled Macro')
        .trim()
        .slice(0, MAX_NAME_LENGTH) || 'Untitled Macro';
    const steps = Array.isArray(macro.steps) ? macro.steps.map(normalizeStep).filter(Boolean) : [];
    return {
      id,
      name,
      steps,
      createdAt: macro.createdAt || new Date().toISOString(),
      updatedAt: macro.updatedAt || new Date().toISOString(),
    };
  }

  function loadMacros() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeMacro).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function saveMacros(macros) {
    try {
      const normalized = Array.isArray(macros) ? macros.map(normalizeMacro).filter(Boolean) : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (err) {
      log('error', `Failed to save macros: ${err.message}`);
    }
  }

  function getMacros() {
    return [...loadMacros()];
  }

  function createMacro(name, steps = []) {
    const macro = normalizeMacro({
      id: createMacroId(),
      name,
      steps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const macros = loadMacros();
    macros.push(macro);
    saveMacros(macros);
    log('info', `Macro created: ${macro.name}`);
    return macro;
  }

  function updateMacro(id, updates) {
    const macros = loadMacros();
    const idx = macros.findIndex((m) => m.id === id);
    if (idx < 0) return null;
    const updated = normalizeMacro({
      ...macros[idx],
      ...updates,
      id: macros[idx].id,
      updatedAt: new Date().toISOString(),
    });
    macros[idx] = updated;
    saveMacros(macros);
    log('info', `Macro updated: ${updated.name}`);
    return updated;
  }

  function deleteMacro(id) {
    const macros = loadMacros().filter((m) => m.id !== id);
    saveMacros(macros);
    log('info', `Macro deleted: ${id}`);
    return true;
  }

  function getMacro(id) {
    return loadMacros().find((m) => m.id === id) || null;
  }

  /**
   * Execute a macro. Returns { success, completed, failed, errors }.
   * Requires: BluetoothScanner, Announcements, runLightTestAction, runLightTestActionWithColor
   * passed via executor or global context.
   */
  async function runMacro(macroId, executor) {
    const macro = getMacro(macroId);
    if (!macro) {
      throw new Error('Macro not found');
    }
    if (!executor || typeof executor.delay !== 'function') {
      throw new Error('Invalid macro executor');
    }

    const result = { success: 0, failed: 0, errors: [] };

    for (let i = 0; i < macro.steps.length; i++) {
      const step = macro.steps[i];
      if (!step || !step.type) continue;

      try {
        switch (step.type) {
          case 'delay':
            await executor.delay(Number(step.ms) || 500);
            result.success++;
            break;
          case 'light_flash':
            await executor.lightAction('flash', null, step.deviceId);
            result.success++;
            break;
          case 'light_off':
            await executor.lightAction('off', null, step.deviceId);
            result.success++;
            break;
          case 'light_color':
            await executor.lightAction('color', step.hex || '#ff0000', step.deviceId);
            result.success++;
            break;
          case 'replay':
            if (executor.replay && step.captureId) {
              await executor.replay(step.captureId);
              result.success++;
            } else {
              result.failed++;
              result.errors.push(`Step ${i + 1}: Replay requires captureId`);
            }
            break;
          case 'connect_device':
            if (executor.connectDevice && step.deviceId) {
              await executor.connectDevice(step.deviceId);
              result.success++;
            } else {
              result.failed++;
              result.errors.push(`Step ${i + 1}: Connect requires deviceId`);
            }
            break;
        }
      } catch (err) {
        result.failed++;
        result.errors.push(`Step ${i + 1}: ${err?.message || 'Unknown error'}`);
        log('warn', `Macro step ${i + 1} failed`, err?.message || err);
      }
    }

    return result;
  }

  return {
    getMacros,
    getMacro,
    createMacro,
    updateMacro,
    deleteMacro,
    runMacro,
    STEP_TYPES,
    STORAGE_KEY,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Macros;
}
