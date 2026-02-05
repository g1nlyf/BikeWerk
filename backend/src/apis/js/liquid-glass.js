// Liquid Glass interactions: dynamic glare and subtle parallax
(function () {
  const root = document.documentElement;
  const body = document.body;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Backdrop-filter support check (Chrome/Safari/Edge/Firefox modern)
  try {
    const test = document.createElement('div');
    test.style.cssText = 'backdrop-filter: blur(1px); -webkit-backdrop-filter: blur(1px);';
    const supported = !!(test.style.backdropFilter || test.style.webkitBackdropFilter);
    if (!supported) body.classList.add('no-backdrop-filter');
  } catch (_) {}

  // Track pointer for glare position
  let mouseX = 0.5, mouseY = 0.5, rafId = null;
  const parallaxEls = Array.from(document.querySelectorAll('[data-parallax]'));
  // Hint the browser for better perf
  for (const el of parallaxEls) {
    try {
      el.style.willChange = 'transform';
      el.style.transform = 'translateZ(0)';
    } catch (_) {}
  }

  function onMove(e) {
    let x, y;
    if (e.touches && e.touches[0]) {
      x = e.touches[0].clientX; y = e.touches[0].clientY;
    } else {
      x = e.clientX; y = e.clientY;
    }
    mouseX = Math.max(0, Math.min(1, x / window.innerWidth));
    mouseY = Math.max(0, Math.min(1, y / window.innerHeight));
    if (!rafId) rafId = requestAnimationFrame(applyEffects);
  }

  function applyEffects() {
    rafId = null;
    root.style.setProperty('--mx', mouseX.toFixed(4));
    root.style.setProperty('--my', mouseY.toFixed(4));

    if (prefersReduced) return;
    const cx = (mouseX - 0.5);
    const cy = (mouseY - 0.5);
    const rotY = cx * 2; // deg (subtle)
    const rotX = -cy * 2; // deg (subtle)

    for (const el of parallaxEls) {
      const depth = Math.max(0, Math.min(1, parseFloat(el.getAttribute('data-parallax') || '0.2')));
      // Amplitude 2–5px depending on depth
      const amp = 2 + depth * 3; // 2..5 px
      const tx = cx * amp;
      const ty = cy * amp;
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotateY(${rotY * depth}deg) rotateX(${rotX * depth}deg)`;
    }
  }

  // Bind events
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });

  // Initial tick
  applyEffects();
})();