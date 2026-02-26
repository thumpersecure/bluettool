/**
 * BlueTTool - Voice Commands Module
 * Uses Web Speech API for hands-free control: "Flash lights", "Silence", etc.
 * Graceful fallback when SpeechRecognition is unavailable (e.g. some browsers).
 */
const VoiceCommands = (() => {
  const root = typeof window !== 'undefined' ? window : {};
  const SpeechRecognition = root.SpeechRecognition || root.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;
  let onResult = null;
  let onStatus = null;

  // Command phrases (lowercase) mapped to action IDs
  const COMMAND_MAP = [
    {
      phrases: ['flash', 'flash lights', 'flash all lights', 'flash the lights'],
      action: 'flash_lights',
    },
    {
      phrases: ['turn off', 'turn off lights', 'lights off', 'off', 'turn off all lights'],
      action: 'lights_off',
    },
    {
      phrases: ['silence', 'silence all', 'silence everything', 'mute', 'stop all', 'disconnect'],
      action: 'silence_all',
    },
    { phrases: ['stop', 'stop audio', 'stop music', 'stop sound'], action: 'stop_audio' },
    { phrases: ['scan', 'start scan', 'scan for devices', 'find devices'], action: 'scan' },
    { phrases: ['set color', 'change color', 'color'], action: 'set_color' },
    { phrases: ['help', 'what can you do', 'commands'], action: 'help' },
  ];

  function isSupported() {
    return !!SpeechRecognition;
  }

  /**
   * Parse transcribed text and return matching action ID, or null
   */
  function parseCommand(transcript) {
    if (!transcript || typeof transcript !== 'string') return null;
    const normalized = transcript.trim().toLowerCase();
    if (normalized.length === 0) return null;

    if (
      parseColorFromTranscript(normalized) &&
      /(?:set|change).*(?:color)|color/.test(normalized)
    ) {
      return 'set_color';
    }

    for (const { phrases, action } of COMMAND_MAP) {
      for (const phrase of phrases) {
        if (normalized.includes(phrase) || normalized === phrase) {
          return action;
        }
      }
    }
    return null;
  }

  /**
   * Extract color from transcript if present (e.g. "set color red")
   */
  function parseColorFromTranscript(transcript) {
    if (!transcript || typeof transcript !== 'string') return null;
    const normalized = transcript.trim().toLowerCase();
    const colorMap = {
      red: '#ff0000',
      green: '#00ff00',
      blue: '#0000ff',
      white: '#ffffff',
      yellow: '#ffff00',
      orange: '#ff8800',
      purple: '#8800ff',
      pink: '#ff0088',
      cyan: '#00ffff',
    };
    for (const [name, hex] of Object.entries(colorMap)) {
      if (normalized.includes(name)) return hex;
    }
    return null;
  }

  function startListening() {
    if (!SpeechRecognition) {
      if (onStatus) onStatus({ type: 'error', message: 'Speech recognition not supported' });
      return false;
    }

    if (isListening) {
      if (onStatus) onStatus({ type: 'listening', message: 'Already listening' });
      return true;
    }

    try {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        isListening = true;
        if (onStatus) onStatus({ type: 'listening', message: 'Listening...' });
      };

      recognition.onend = () => {
        isListening = false;
        if (onStatus) onStatus({ type: 'idle', message: '' });
      };

      recognition.onerror = (event) => {
        isListening = false;
        const msg =
          event.error === 'no-speech'
            ? 'No speech detected'
            : event.error === 'aborted'
              ? 'Cancelled'
              : event.error === 'not-allowed'
                ? 'Microphone permission denied'
                : `Error: ${event.error}`;
        if (onStatus) onStatus({ type: 'error', message: msg });
      };

      recognition.onresult = (event) => {
        const results = event.results;
        if (!results || results.length === 0) return;

        const last = results[results.length - 1];
        const transcript = last[0]?.transcript?.trim() || '';
        const confidence = last[0]?.confidence ?? 0;

        if (transcript && onResult) {
          const action = parseCommand(transcript);
          const color = parseColorFromTranscript(transcript);
          onResult({
            transcript,
            confidence,
            action: action || 'unknown',
            color: action === 'set_color' ? color : null,
          });
        }
      };

      recognition.start();
      return true;
    } catch (err) {
      if (onStatus) onStatus({ type: 'error', message: err?.message || 'Failed to start' });
      return false;
    }
  }

  function stopListening() {
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch (_) {
        /* ignore */
      }
      isListening = false;
    }
    recognition = null;
  }

  function getAvailableCommands() {
    return COMMAND_MAP.map(({ phrases, action }) => ({
      action,
      examples: phrases.slice(0, 3),
    }));
  }

  function setOnResult(cb) {
    onResult = cb;
  }

  function setOnStatus(cb) {
    onStatus = cb;
  }

  return {
    isSupported,
    startListening,
    stopListening,
    parseCommand,
    parseColorFromTranscript,
    getAvailableCommands,
    setOnResult,
    setOnStatus,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceCommands;
}
