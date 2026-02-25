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
  const STEP_TYPES = ['delay', 'light_flash', 'light_off', 'light_color', 'replay', 'connect_device'];

  function loadMacros() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveMacros(macros) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
    } catch (err) {
      Logger.error('Failed to save macros:', err.message);
    }
  }

  function getMacros() {
    return [...loadMacros()];
  }

  function createMacro(name, steps = []) {
    const macro = {
      id: `macro-${Date.now()}`,
      name: String(name || 'Untitled Macro').trim() || 'Untitled Macro',
      steps: Array.isArray(steps) ? steps : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const macros = loadMacros();
    macros.push(macro);
    saveMacros(macros);
    Logger.info(`Macro created: ${macro.name}`);
    return macro;
  }

  function updateMacro(id, updates) {
    const macros = loadMacros();
    const idx = macros.findIndex(m => m.id === id);
    if (idx < 0) return null;
    const updated = {
      ...macros[idx],
      ...updates,
      id: macros[idx].id,
      updatedAt: new Date().toISOString()
    };
    macros[idx] = updated;
    saveMacros(macros);
    Logger.info(`Macro updated: ${updated.name}`);
    return updated;
  }

  function deleteMacro(id) {
    const macros = loadMacros().filter(m => m.id !== id);
    saveMacros(macros);
    Logger.info(`Macro deleted: ${id}`);
    return true;
  }

  function getMacro(id) {
    return loadMacros().find(m => m.id === id) || null;
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
            await executor.delay(step.ms || 500);
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
          default:
            result.failed++;
            result.errors.push(`Step ${i + 1}: Unknown step type "${step.type}"`);
        }
      } catch (err) {
        result.failed++;
        result.errors.push(`Step ${i + 1}: ${err?.message || 'Unknown error'}`);
        Logger.warn(`Macro step ${i + 1} failed:`, err);
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
    STORAGE_KEY
  };
})();
