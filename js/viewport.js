/* Match the visible browser area without disabling the user's pinch zoom. */
(() => {
    const root = document.documentElement;
    let pending = false;
    function measure() {
        pending = false;
        const viewport = window.visualViewport;
        if (viewport && Math.abs(viewport.scale - 1) > .02) return;
        const height = Math.round(viewport?.height || window.innerHeight);
        root.style.setProperty('--app-height', `${height}px`);
        root.dataset.short = height < 660 ? 'true' : 'false';
        window.dispatchEvent(new Event('kuku:viewport'));
    }
    function resize() { if (!pending) { pending = true; requestAnimationFrame(measure); } }
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('pageshow', resize);
    measure();
})();
