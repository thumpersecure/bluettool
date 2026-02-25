/**
 * BlueTTool - Audio Player Module
 * Generates and plays DTMF/fax-machine tones via Web Audio API.
 * Can also play the pre-generated WAV file from the repo.
 * Provides audio test tools for BLE testing workflows.
 */
const AudioPlayer = (() => {
  const DTMF_FREQS = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], 'A': [697, 1633],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477], 'B': [770, 1633],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], 'C': [852, 1633],
    '*': [941, 1209], '0': [941, 1336], '#': [941, 1477], 'D': [941, 1633],
  };

  const CNG_FREQ = 1100;
  const CED_FREQ = 2100;

  let audioCtx = null;
  let isPlaying = false;
  let stopRequested = false;
  let activeNodes = [];
  let fileAudioEl = null;

  function getContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function stopAll() {
    stopRequested = true;
    activeNodes.forEach(n => {
      try { n.stop(); } catch (_) { /* already stopped */ }
    });
    activeNodes = [];
    if (fileAudioEl) {
      fileAudioEl.pause();
      fileAudioEl.currentTime = 0;
    }
    isPlaying = false;
    Logger.info('Audio stopped');
  }

  function playTone(freq1, freq2, duration, volume) {
    return new Promise(resolve => {
      if (stopRequested) { resolve(); return; }
      const ctx = getContext();
      const gain = ctx.createGain();
      gain.gain.value = volume || 0.3;
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.frequency.value = freq1;
      osc1.type = 'sine';
      osc1.connect(gain);

      const startTime = ctx.currentTime;
      const endTime = startTime + duration;

      // Fade envelope to avoid clicks
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume || 0.3, startTime + 0.005);
      gain.gain.setValueAtTime(volume || 0.3, endTime - 0.005);
      gain.gain.linearRampToValueAtTime(0, endTime);

      osc1.start(startTime);
      osc1.stop(endTime);
      activeNodes.push(osc1);

      if (freq2 && freq2 !== freq1) {
        const osc2 = ctx.createOscillator();
        osc2.frequency.value = freq2;
        osc2.type = 'sine';
        osc2.connect(gain);
        osc2.start(startTime);
        osc2.stop(endTime);
        activeNodes.push(osc2);
      }

      setTimeout(() => {
        activeNodes = activeNodes.filter(n => n !== osc1);
        resolve();
      }, duration * 1000 + 20);
    });
  }

  function wait(ms) {
    return new Promise(resolve => {
      if (stopRequested) { resolve(); return; }
      setTimeout(resolve, ms);
    });
  }

  /**
   * Play a live-generated DTMF/fax sequence using Web Audio API.
   */
  async function playDTMFSequence() {
    if (isPlaying) return;
    isPlaying = true;
    stopRequested = false;
    Logger.info('Playing DTMF/fax tone sequence...');

    try {
      // CNG tones (calling fax)
      for (let i = 0; i < 3 && !stopRequested; i++) {
        await playTone(CNG_FREQ, CNG_FREQ, 0.5, 0.35);
        await wait(200);
      }

      // CED tone (answer)
      if (!stopRequested) await playTone(CED_FREQ, CED_FREQ, 1.5, 0.3);
      await wait(200);

      // DTMF digit sequence
      const sequence = '18005550192#*55512340987#';
      for (const digit of sequence) {
        if (stopRequested) break;
        const freqs = DTMF_FREQS[digit];
        if (freqs) {
          await playTone(freqs[0], freqs[1], 0.1, 0.35);
          await wait(50);
        }
      }

      await wait(200);

      // Final modem-like tones
      if (!stopRequested) await playTone(1650, 1850, 1.0, 0.25);
      if (!stopRequested) await playTone(CED_FREQ, CED_FREQ, 0.5, 0.25);

      Logger.success('DTMF sequence complete');
    } catch (err) {
      if (!stopRequested) Logger.error('Audio playback error: ' + err.message);
    } finally {
      isPlaying = false;
    }
  }

  /**
   * Play the pre-generated WAV file from the repo.
   */
  function playFile() {
    if (isPlaying) return;
    isPlaying = true;
    stopRequested = false;
    Logger.info('Playing DTMF/fax audio file...');

    if (!fileAudioEl) {
      fileAudioEl = new Audio('audio/dtmf-fax-tones.wav');
    }

    fileAudioEl.currentTime = 0;
    fileAudioEl.play().then(() => {
      Logger.success('Audio file playback started');
    }).catch(err => {
      Logger.error('Could not play audio file: ' + err.message);
      isPlaying = false;
    });

    fileAudioEl.onended = () => {
      isPlaying = false;
      Logger.info('Audio file playback ended');
    };
  }

  /**
   * Get the WAV file as a Blob for sharing.
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
    playFile,
    stopAll,
    getAudioBlob,
    triggerOnConnect,
    getIsPlaying,
    DTMF_FREQS
  };
})();
