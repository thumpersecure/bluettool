const VoiceCommands = require('../../js/voice-commands.js');

describe('VoiceCommands', () => {
  it('parses known commands', () => {
    expect(VoiceCommands.parseCommand('Please flash lights now')).toBe('flash_lights');
    expect(VoiceCommands.parseCommand('turn off lights')).toBe('lights_off');
    expect(VoiceCommands.parseCommand('set color red')).toBe('set_color');
    expect(VoiceCommands.parseCommand('unrelated text')).toBeNull();
  });

  it('extracts color from transcript', () => {
    expect(VoiceCommands.parseColorFromTranscript('set color blue')).toBe('#0000ff');
    expect(VoiceCommands.parseColorFromTranscript('make it green')).toBe('#00ff00');
    expect(VoiceCommands.parseColorFromTranscript('no color here')).toBeNull();
  });

  it('reports unsupported status when speech API is unavailable', () => {
    const statusSpy = vi.fn();
    VoiceCommands.setOnStatus(statusSpy);
    const started = VoiceCommands.startListening();
    expect(started).toBe(false);
    expect(statusSpy).toHaveBeenCalled();
  });

  it('exposes available command metadata', () => {
    const commands = VoiceCommands.getAvailableCommands();
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.some((item) => item.action === 'flash_lights')).toBe(true);
  });

  it('supports callback assignment without throwing', () => {
    const resultSpy = vi.fn();
    const statusSpy = vi.fn();
    VoiceCommands.setOnResult(resultSpy);
    VoiceCommands.setOnStatus(statusSpy);
    VoiceCommands.stopListening();
    expect(typeof VoiceCommands.isSupported()).toBe('boolean');
  });
});
