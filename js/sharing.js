/**
 * BlueTTool - Sharing / AirDrop Module
 *
 * Uses the Web Share API to share files via AirDrop (iOS), nearby share
 * (Android), or other platform sharing mechanisms.
 *
 * On iOS with AirDrop enabled, navigator.share() with files triggers
 * the native share sheet which includes AirDrop.
 */
const Sharing = (() => {
  function handleShareError(err) {
    if (err.name === 'AbortError') {
      Logger.info('Share cancelled by user');
    } else {
      Logger.error('Share failed: ' + err.message);
    }
  }

  /**
   * Check if Web Share API with file support is available.
   */
  function canShareFiles() {
    return !!(navigator.canShare && typeof File !== 'undefined');
  }

  /**
   * Share the DTMF/fax tones audio file via AirDrop / native share sheet.
   */
  async function shareAudioFile() {
    Logger.info('Preparing DTMF audio file for sharing...');

    try {
      const blob = await AudioPlayer.getAudioBlob();
      if (!blob) throw new Error('Could not load audio file');

      const file = new File([blob], 'dtmf-fax-tones.wav', { type: 'audio/wav' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'BlueTTool DTMF Tones',
          text: 'DTMF/fax machine test tones from BlueTTool',
          files: [file],
        });
        Logger.success('Audio file shared successfully');
        return true;
      } else {
        Logger.warn('File sharing not supported — downloading instead');
        downloadBlob(blob, 'dtmf-fax-tones.wav');
        return false;
      }
    } catch (err) {
      handleShareError(err);
      return false;
    }
  }

  /**
   * Share a text link (e.g., the app URL) via AirDrop / native share.
   */
  async function shareLink(url, title, text) {
    Logger.info('Sharing link...');

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        Logger.success('Link shared');
        return true;
      } else {
        if (navigator.clipboard?.writeText) {
          Logger.warn('Web Share API not available — copying to clipboard');
          await navigator.clipboard.writeText(url);
          Logger.success('Link copied to clipboard');
          return false;
        }
        Logger.warn('Web Share and clipboard APIs unavailable');
        return false;
      }
    } catch (err) {
      handleShareError(err);
      return false;
    }
  }

  /**
   * Share random heart emojis text via AirDrop / native share.
   */
  async function shareHearts() {
    const hearts = [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💗',
      '💖',
      '💝',
      '💘',
      '💕',
      '💞',
    ];
    const count = 10 + Math.floor(Math.random() * 20);
    let msg = '';
    for (let i = 0; i < count; i++) {
      msg += hearts[Math.floor(Math.random() * hearts.length)];
    }

    Logger.info('Sharing hearts...');

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'From BlueTTool',
          text: msg,
        });
        Logger.success('Hearts shared');
        return true;
      } else {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(msg);
          Logger.success('Hearts copied to clipboard');
          return false;
        }
        Logger.warn('Web Share and clipboard APIs unavailable');
        return false;
      }
    } catch (err) {
      handleShareError(err);
      return false;
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    canShareFiles,
    shareAudioFile,
    shareLink,
    shareHearts,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Sharing;
}
