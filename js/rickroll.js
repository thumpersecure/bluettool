/**
 * BlueTTool - Rick Roll Module
 * Plays Rick Astley on YouTube when a device is connected.
 * Triggered automatically on successful GATT connection.
 */
const RickRoll = (() => {
  const YOUTUBE_VIDEO_ID = 'dQw4w9WgXcQ';
  let isActive = false;

  /**
   * Trigger the Rick Roll overlay with embedded YouTube player
   */
  function trigger() {
    if (isActive) return;
    isActive = true;

    Logger.success('Vulnerability test initiated - deploying Rick Roll payload');

    const overlay = document.getElementById('rickroll-overlay');
    const container = document.getElementById('rickroll-container');

    if (!overlay || !container) return;

    // Embed YouTube iframe with autoplay
    container.innerHTML = `<iframe
      src="https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&playsinline=1&controls=1"
      allow="autoplay; encrypted-media"
      allowfullscreen
      playsinline
    ></iframe>`;

    overlay.classList.remove('hidden');
  }

  /**
   * Close the Rick Roll overlay
   */
  function dismiss() {
    const overlay = document.getElementById('rickroll-overlay');
    const container = document.getElementById('rickroll-container');

    if (overlay) overlay.classList.add('hidden');
    if (container) container.innerHTML = '';
    isActive = false;

    Logger.info('Rick Roll dismissed');
  }

  /**
   * Open Rick Roll directly in a new tab (fallback if iframe blocked)
   */
  function openInNewTab() {
    window.open(`https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`, '_blank');
    Logger.info('Rick Roll opened in new tab');
  }

  function isPlaying() {
    return isActive;
  }

  return { trigger, dismiss, openInNewTab, isPlaying };
})();
