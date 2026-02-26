/**
 * BlueTTool - Delight Module
 * Confetti, vibration feedback, and celebratory micro-interactions.
 * Mobile-first, no external dependencies.
 */
const Delight = (() => {
  const FIRST_CAPTURE_KEY = 'bluettool_first_capture_done';

  /**
   * Lightweight canvas confetti burst. Runs once on first capture.
   */
  function triggerConfetti() {
    if (typeof document === 'undefined' || !document.body) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);

    const colors = ['#00e5ff', '#4a7dff', '#00e676', '#b388ff', '#ffab40'];
    const particles = [];
    const count = Math.min(60, Math.floor(w / 8));

    for (let i = 0; i < count; i++) {
      particles.push({
        x: w / 2,
        y: h / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.8) * 10 - 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        decay: 0.96 + Math.random() * 0.03,
      });
    }

    let frame = 0;
    const maxFrames = 90;

    function animate() {
      ctx.clearRect(0, 0, w, h);
      frame++;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.vx *= p.decay;
        p.vy *= p.decay;

        const alpha = Math.max(0, 1 - frame / maxFrames);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    }

    requestAnimationFrame(animate);
  }

  /**
   * Check if this is the user's first capture; if so, trigger confetti and mark done.
   */
  function maybeFirstCaptureConfetti() {
    try {
      if (localStorage.getItem(FIRST_CAPTURE_KEY)) return false;
      localStorage.setItem(FIRST_CAPTURE_KEY, '1');
      triggerConfetti();
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Haptic-like feedback via Vibration API. Graceful no-op if unavailable.
   * @param {number|number[]} pattern - Duration(s) in ms, e.g. 50 or [50, 30, 50]
   */
  function vibrate(pattern) {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch (_) {
      /* ignore */
    }
  }

  /**
   * Light tap feedback (success).
   */
  function successBuzz() {
    vibrate([30, 20, 30]);
  }

  /**
   * Error/warning feedback.
   */
  function errorBuzz() {
    vibrate([50, 30, 50, 30, 50]);
  }

  /**
   * Subtle tap feedback for button press.
   */
  function tapBuzz() {
    vibrate(15);
  }

  return {
    triggerConfetti,
    maybeFirstCaptureConfetti,
    vibrate,
    successBuzz,
    errorBuzz,
    tapBuzz,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Delight;
}
