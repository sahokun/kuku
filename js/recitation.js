/* A cancellable, speech-completion-driven listen / cue / repeat sequence. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KukuRecitation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function create({ text, say, stop, onStep, onDone, repeatOnly = false, encouragement = null }) {
        const readingTime = Math.max(2400, text.length * 180 + 400);
        const sequence = [
            { name: 'listen', text, label: 'まずは きいてね', fallback: readingTime, gap: 400 },
            { name: 'cue', text: 'いってみよう。せーのっ！', label: 'いってみよう、せーのっ！', fallback: 2200, gap: 500 },
            { name: 'repeat', text, label: repeatOnly ? 'こたえを きこう' : 'いっしょに いってみよう', fallback: readingTime, gap: 900 }
        ];
        const steps = repeatOnly ? sequence.slice(2) : sequence;
        if (encouragement) {
            steps[steps.length - 1].gap = 160;
            steps.push({ name: 'encouragement', text: encouragement, label: encouragement, fallback: 0, gap: 180 });
        }
        let index = 0, generation = 0, elapsed = 0, gap = 0;
        let mode = 'idle', paused = false, cancelled = false;
        function enter() {
            const token = ++generation, step = steps[index];
            elapsed = 0; gap = step.gap; mode = 'waiting';
            onStep(step.name, step.label);
            try {
                const started = say(step.text, ended => {
                    if (token !== generation || paused || cancelled || mode !== 'waiting') return;
                    mode = ended ? 'gap' : 'fallback';
                    if (!ended) elapsed = 0;
                });
                if (!started && mode === 'waiting') mode = 'fallback';
            } catch (_) { mode = 'fallback'; }
        }
        function tick(ms) {
            if (paused || cancelled || mode === 'idle' || mode === 'done') return;
            const step = steps[index];
            elapsed += ms;
            // A failed audio device may never dispatch completion. Keep the UI recoverable.
            if (mode === 'waiting' && elapsed >= Math.max(15000, step.fallback * 4)) {
                generation++; stop(); mode = 'gap';
            }
            if (mode === 'fallback' && elapsed >= step.fallback) mode = 'gap';
            if (mode !== 'gap') return;
            gap -= ms;
            if (gap > 0) return;
            if (++index < steps.length) enter();
            else { mode = 'done'; generation++; onDone(); }
        }
        return {
            start() { if (mode === 'idle' && !cancelled) enter(); },
            tick,
            pause() { if (cancelled || mode === 'done') return; paused = true; generation++; stop(); },
            resume() { if (!paused || cancelled) return; paused = false; enter(); },
            cancel() { cancelled = true; generation++; stop(); }
        };
    }
    return { create };
});
