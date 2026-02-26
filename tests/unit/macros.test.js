const Macros = require('../../js/macros.js');

describe('Macros', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and normalizes macros', () => {
    const macro = Macros.createMacro('  Test Macro  ', [
      { type: 'delay', ms: 200 },
      { type: 'invalid_type' },
      { type: 'light_flash', deviceId: 'all' },
    ]);

    expect(macro.id).toMatch(/^macro-/);
    expect(macro.name).toBe('Test Macro');
    expect(macro.steps).toHaveLength(2);
    expect(Macros.getMacros()).toHaveLength(1);
  });

  it('updates and deletes macros', () => {
    const macro = Macros.createMacro('One', [{ type: 'delay', ms: 100 }]);
    const updated = Macros.updateMacro(macro.id, { name: 'Two' });
    expect(updated.name).toBe('Two');
    expect(Macros.deleteMacro(macro.id)).toBe(true);
    expect(Macros.getMacro(macro.id)).toBeNull();
  });

  it('executes a macro and tracks failures', async () => {
    const macro = Macros.createMacro('Runner', [
      { type: 'delay', ms: 1 },
      { type: 'light_color', hex: '#ff00ff', deviceId: 'all' },
      { type: 'light_off', deviceId: 'all' },
      { type: 'connect_device', deviceId: 'dev-1' },
      { type: 'replay' }, // missing captureId should fail
    ]);

    const executor = {
      delay: vi.fn(async () => {}),
      lightAction: vi.fn(async (action) => {
        if (action === 'off') {
          throw new Error('light write failure');
        }
      }),
      replay: vi.fn(async () => {}),
      connectDevice: vi.fn(async () => {}),
    };

    const result = await Macros.runMacro(macro.id, executor);
    expect(result.success).toBe(3);
    expect(result.failed).toBe(2);
    expect(result.errors.join(' ')).toMatch(/Replay requires captureId/i);
    expect(result.errors.join(' ')).toMatch(/light write failure/i);
    expect(executor.lightAction).toHaveBeenCalledTimes(2);
    expect(executor.connectDevice).toHaveBeenCalledWith('dev-1');
  });

  it('rejects runMacro when macro/executor is invalid', async () => {
    await expect(Macros.runMacro('missing-id', { delay: async () => {} })).rejects.toThrow(
      /Macro not found/i,
    );
    const macro = Macros.createMacro('A', []);
    await expect(Macros.runMacro(macro.id, null)).rejects.toThrow(/Invalid macro executor/i);
  });

  it('logs storage errors when persistence fails', () => {
    global.Logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    Macros.createMacro('Will fail save', [{ type: 'delay', ms: 50 }]);
    expect(global.Logger.error).toHaveBeenCalled();
  });
});
