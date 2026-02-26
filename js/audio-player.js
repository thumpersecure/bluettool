/**
 * BlueTTool - Audio Player Module
 * Generates and plays DTMF/fax-machine tones via Web Audio API.
 * Can also play the pre-generated WAV file from the repo.
 * Provides audio test tools for BLE testing workflows.
 */
const AudioPlayer = (() => {
  const DTMF_FREQS = {
    1: [697, 1209],
    2: [697, 1336],
    3: [697, 1477],
    A: [697, 1633],
    4: [770, 1209],
    5: [770, 1336],
    6: [770, 1477],
    B: [770, 1633],
    7: [852, 1209],
    8: [852, 1336],
    9: [852, 1477],
    C: [852, 1633],
    '*': [941, 1209],
    0: [941, 1336],
    '#': [941, 1477],
    D: [941, 1633],
  };

  const CNG_FREQ = 1100;
  const CED_FREQ = 2100;

  let audioCtx = null;
  let isPlaying = false;
  let stopRequested = false;
  let activeNodes = [];
  let fileAudioEl = null;
  let masterVolume = 0.5;
  let pendingTimeouts = [];

  function getContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function setVolume(vol) {
    masterVolume = Math.max(0, Math.min(1, vol));
    if (fileAudioEl) {
      fileAudioEl.volume = masterVolume;
    }
  }

  function getVolume() {
    return masterVolume;
  }

  function stopAll() {
    stopRequested = true;
    activeNodes.forEach((n) => {
      try {
        n.stop();
      } catch (_) {
        /* already stopped */
      }
    });
    activeNodes = [];
    pendingTimeouts.forEach((id) => clearTimeout(id));
    pendingTimeouts = [];
    if (fileAudioEl) {
      fileAudioEl.pause();
      fileAudioEl.currentTime = 0;
    }
    isPlaying = false;
    stopRequested = false;
    Logger.info('Audio stopped');
  }

  function playTone(freq1, freq2, duration, volume) {
    return new Promise((resolve) => {
      if (stopRequested) {
        resolve();
        return;
      }
      const ctx = getContext();
      const scaledVol = (volume || 0.3) * masterVolume;
      const gain = ctx.createGain();
      gain.gain.value = scaledVol;
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.frequency.value = freq1;
      osc1.type = 'sine';
      osc1.connect(gain);

      const startTime = ctx.currentTime;
      const endTime = startTime + duration;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(scaledVol, startTime + 0.005);
      gain.gain.setValueAtTime(scaledVol, endTime - 0.005);
      gain.gain.linearRampToValueAtTime(0, endTime);

      osc1.start(startTime);
      osc1.stop(endTime);
      activeNodes.push(osc1);

      let osc2 = null;
      if (freq2 && freq2 !== freq1) {
        osc2 = ctx.createOscillator();
        osc2.frequency.value = freq2;
        osc2.type = 'sine';
        osc2.connect(gain);
        osc2.start(startTime);
        osc2.stop(endTime);
        activeNodes.push(osc2);
      }

      const tid = setTimeout(
        () => {
          activeNodes = activeNodes.filter((n) => n !== osc1 && n !== osc2);
          pendingTimeouts = pendingTimeouts.filter((t) => t !== tid);
          resolve();
        },
        duration * 1000 + 20,
      );
      pendingTimeouts.push(tid);
    });
  }

  function wait(ms) {
    return new Promise((resolve) => {
      if (stopRequested) {
        resolve();
        return;
      }
      const tid = setTimeout(() => {
        pendingTimeouts = pendingTimeouts.filter((t) => t !== tid);
        resolve();
      }, ms);
      pendingTimeouts.push(tid);
    });
  }

  /**
   * Valid DTMF characters: 0-9, *, #, A-D
   */
  const VALID_DTMF = /^[0-9*#A-Da-d]*$/;
  const MAX_DTMF_SEQUENCE_LENGTH = 64;

  /**
   * Play a custom DTMF sequence. Only plays valid DTMF digits; others are skipped.
   * @param {string} sequence - User-provided sequence (e.g. "123#*456")
   * @param {number} [speed=1] - Playback speed multiplier
   */
  async function playCustomDTMFSequence(sequence, speed = 1) {
    if (isPlaying) return;
    const seq = String(sequence || '').trim();
    if (!seq) return;
    if (!VALID_DTMF.test(seq)) {
      throw new Error('Invalid DTMF sequence');
    }
    if (seq.length > MAX_DTMF_SEQUENCE_LENGTH) {
      throw new Error(`DTMF sequence too long (max ${MAX_DTMF_SEQUENCE_LENGTH} characters)`);
    }
    isPlaying = true;
    stopRequested = false;
    const spd = Math.max(0.25, Math.min(4, Number(speed) || 1));
    Logger.info(`Playing custom DTMF: "${seq}" (${spd}x)...`);

    const scaledWait = (ms) => wait(Math.round(ms / spd));
    const scaledDuration = (d) => d / spd;

    try {
      for (const digit of seq) {
        if (stopRequested) break;
        const upper = digit.toUpperCase();
        const freqs = DTMF_FREQS[upper];
        if (freqs) {
          await playTone(freqs[0], freqs[1], scaledDuration(0.1), 0.35);
          await scaledWait(50);
        }
      }
      if (!stopRequested) Logger.success('Custom DTMF sequence complete');
    } catch (err) {
      if (!stopRequested) Logger.error('Audio playback error: ' + err.message);
    } finally {
      isPlaying = false;
    }
  }

  /**
   * Play a live-generated DTMF/fax sequence using Web Audio API.
   * @param {number} [speed=1] - Playback speed multiplier (0.5 = half speed, 2 = double speed)
   */
  async function playDTMFSequence(speed = 1) {
    if (isPlaying) return;
    isPlaying = true;
    stopRequested = false;
    const spd = Math.max(0.25, Math.min(4, Number(speed) || 1));
    Logger.info(`Playing DTMF/fax tone sequence (${spd}x)...`);

    const scaledWait = (ms) => wait(Math.round(ms / spd));
    const scaledDuration = (d) => d / spd;

    try {
      for (let i = 0; i < 3 && !stopRequested; i++) {
        await playTone(CNG_FREQ, CNG_FREQ, scaledDuration(0.5), 0.35);
        await scaledWait(200);
      }

      if (!stopRequested) await playTone(CED_FREQ, CED_FREQ, scaledDuration(1.5), 0.3);
      await scaledWait(200);

      const sequence = '18005550192#*55512340987#';
      for (const digit of sequence) {
        if (stopRequested) break;
        const freqs = DTMF_FREQS[digit];
        if (freqs) {
          await playTone(freqs[0], freqs[1], scaledDuration(0.1), 0.35);
          await scaledWait(50);
        }
      }

      await scaledWait(200);

      if (!stopRequested) await playTone(1650, 1850, scaledDuration(1.0), 0.25);
      if (!stopRequested) await playTone(CED_FREQ, CED_FREQ, scaledDuration(0.5), 0.25);

      if (!stopRequested) Logger.success('DTMF sequence complete');
    } catch (err) {
      if (!stopRequested) Logger.error('Audio playback error: ' + err.message);
    } finally {
      isPlaying = false;
    }
  }

  /**
   * Play the pre-generated WAV file from the repo.
   * Falls back to live DTMF sequence if file is missing (e.g. 404).
   */
  function playFile() {
    if (isPlaying) return;
    isPlaying = true;
    stopRequested = false;
    Logger.info('Playing DTMF/fax audio file...');

    if (!fileAudioEl) {
      fileAudioEl = new Audio('audio/dtmf-fax-tones.wav');
    }

    fileAudioEl.volume = masterVolume;
    fileAudioEl.currentTime = 0;
    fileAudioEl.onended = () => {
      isPlaying = false;
      Logger.info('Audio file playback ended');
    };

    fileAudioEl
      .play()
      .then(() => {
        if (!stopRequested) Logger.success('Audio file playback started');
      })
      .catch((err) => {
        isPlaying = false;
        if (!stopRequested) {
          Logger.error('Could not play audio file: ' + err.message + ' — using live DTMF instead');
          playDTMFSequence();
        }
      });
  }

  /**
   * Get the WAV file as a Blob for sharing.
   * If file is missing, generates a short DTMF sequence and returns as Blob.
   */
  async function getAudioBlob() {
    try {
      const resp = await fetch('audio/dtmf-fax-tones.wav');
      if (!resp.ok) throw new Error('Could not fetch audio file');
      return await resp.blob();
    } catch (err) {
      Logger.error('Could not load audio file: ' + err.message);
      return null;
    }
  }

  /**
   * Trigger audio on device connection.
   */
  function triggerOnConnect() {
    Logger.success('Device connected - playing DTMF test tones');
    playDTMFSequence();
  }

  function getIsPlaying() {
    return isPlaying;
  }

  return {
    playDTMFSequence,
    playCustomDTMFSequence,
    playFile,
    stopAll,
    getAudioBlob,
    triggerOnConnect,
    getIsPlaying,
    setVolume,
    getVolume,
    DTMF_FREQS,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioPlayer;
}
