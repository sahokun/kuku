window.KukuStore = (() => {
    const NORMAL_KEY = 'kuku:learning:v1';
    const diagnostic = window.location?.hash === '#diagnostics';
    const KEY = diagnostic ? 'kuku:diagnostics:learning:v1' : NORMAL_KEY;
    let available = true, state, pending = null;
    try {
        const raw = JSON.parse(localStorage.getItem(diagnostic ? NORMAL_KEY : KEY) || 'null');
        state = KukuLearning.restore(raw);
        state.rewards = KukuRewards.restore(raw?.rewards, state);
    }
    catch (_) {
        state = KukuLearning.fresh();
        state.rewards = KukuRewards.fresh();
        available = false;
    }
    if (!localStorageSafeHasSettings() && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        state.settings.motion = 0;
    function localStorageSafeHasSettings() {
        try {
            return !!JSON.parse(localStorage.getItem(diagnostic ? NORMAL_KEY : KEY) || 'null')?.settings;
        }
        catch (_) {
            return false;
        }
    }
    function cancelPending() {
        if (pending === null) return;
        if (window.cancelIdleCallback) window.cancelIdleCallback(pending); else clearTimeout(pending);
        pending = null;
    }
    function queueSave(done) {
        if (pending !== null) return;
        const flush = () => { pending = null; save(); done?.(); };
        pending = window.requestIdleCallback ? window.requestIdleCallback(flush, { timeout: 700 }) : setTimeout(flush, 80);
    }
    function save() {
        const measured = window.KukuDiagnostics?.begin('store.save');
        cancelPending();
        KukuRewards.syncCalendar(state);
        const dates = Object.keys(state.days).sort();
        dates.slice(0, Math.max(0, dates.length - 90)).forEach(d => delete state.days[d]);
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
            available = true;
        }
        catch (_) {
            available = false;
        }
        measured?.();
        return available;
    }
    return { get state() { return state; }, get available() { return available; }, save, queueSave };
})();
