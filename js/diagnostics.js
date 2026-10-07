/* Opt-in developer measurements. No telemetry or work during ordinary play. */
(() => {
    'use strict';
    if (location.hash !== '#diagnostics') return;
    const VERSION = 'input-20261006-3', LIMIT = 12000;
    const modes = { normal: 'A 通常', silent: 'B 音なし', 'no-input-fx': 'C 入力演出なし',
        'voice-only': 'D 音声ファイルだけ', 'synth-only': 'E 音楽・効果音だけ' };
    const events = [], runs = [], contexts = [], supported = [];
    let recording = false, mode = 'normal', run = 0, dropped = 0, previousFrame = 0, previousTimer = 0;
    let inputPending = null, dialog, output, status, resumeAfterDialog = false;
    const now = () => performance.now(), round = n => Math.round(n * 10) / 10;
    const visible = () => !document.hidden && document.body.dataset.paused !== 'true';
    function add(type, data = {}, at = now()) {
        if (!recording || !visible()) return;
        if (events.length >= LIMIT) { dropped++; return; }
        events.push({ t: round(at), run, type, ...data });
    }
    function begin(name) {
        if (!recording || !visible()) return;
        const start = now(), owner = run;
        return () => { if (owner === run && now() - start >= 8) add('work', { name, ms: round(now() - start) }, start); };
    }
    function resetClocks() { previousFrame = previousTimer = 0; inputPending = null; }
    function frame(t) {
        requestAnimationFrame(frame);
        if (!recording || !visible()) { previousFrame = 0; return; }
        if (previousFrame && t - previousFrame >= 80) add('frame-gap', { ms: round(t - previousFrame), from: round(previousFrame) });
        previousFrame = t;
        if (inputPending) { add('input-next-frame', { input: inputPending.t, ms: round(now() - inputPending.t) }); inputPending = null; }
    }
    function pulse() {
        if (!recording || !visible()) { previousTimer = 0; return; }
        const t = now();
        // Keep ordinary timer ticks too: they distinguish rendering-only gaps.
        add('timer', { ms: previousTimer ? round(t - previousTimer) : 0 }, t); previousTimer = t;
    }
    function wrap(object, name, bypass) {
        const original = object[name];
        object[name] = function (...args) {
            const skipped = !!bypass?.();
            if (object === KukuSound) add('audio-call', { name, kind: name === 'effect' ? args[0] : undefined, skipped });
            if (skipped) return false;
            const stop = begin(name === 'effect' ? 'audio.effect.' + args[0] : name);
            try { return original.apply(this, args); } finally { stop?.(); }
        };
    }
    for (const name of ['start', 'effect']) wrap(KukuSound, name, () => mode === 'silent' || mode === 'voice-only');
    for (const name of ['speak', 'message', 'cancelSpeech']) wrap(KukuSound, name, () => mode === 'silent' || mode === 'synth-only');
    wrap(KukuVisuals, 'digit', () => mode === 'no-input-fx');
    // Observe native audio state without replacing its scheduling or sounds.
    const NativeAudio = window.AudioContext || window.webkitAudioContext;
    if (NativeAudio) {
        const ObservedAudio = new Proxy(NativeAudio, { construct(target, args) {
            const context = new target(...args); contexts.push(context);
            context.addEventListener('statechange', () => add('audio-state', { state: context.state }));
            return context;
        } });
        if (window.AudioContext) window.AudioContext = ObservedAudio;
        else window.webkitAudioContext = ObservedAudio;
    }
    const NativeUtterance = window.SpeechSynthesisUtterance;
    let utteranceId = 0;
    if (NativeUtterance) window.SpeechSynthesisUtterance = new Proxy(NativeUtterance, { construct(target, args) {
        const utterance = new target(...args), id = ++utteranceId, owner = run;
        add('speech-created', { id, text: utterance.text });
        for (const type of ['start', 'end', 'error', 'pause', 'resume']) utterance.addEventListener(type, event => {
            if (owner === run) add('speech-' + type, { id, elapsed: event.elapsedTime, error: event.error });
        });
        return utterance;
    } });
    for (const type of ['longtask', 'event']) {
        if (!window.PerformanceObserver?.supportedEntryTypes?.includes(type)) continue;
        try {
            new PerformanceObserver(list => {
                for (const e of list.getEntries()) {
                    if (!runs.length || e.startTime < runs[runs.length - 1].start) continue;
                    if (type === 'longtask') add('longtask', { ms: round(e.duration) }, e.startTime);
                    else if (e.name === 'click' && e.target?.matches('[data-digit]'))
                        add('event-timing', { digit: e.target.dataset.digit, ms: round(e.duration), delay: round(e.processingStart - e.startTime), handler: round(e.processingEnd - e.processingStart) }, e.startTime);
                }
            }).observe(type === 'event' ? { type, durationThreshold: 16 } : { type });
            supported.push(type);
        } catch (_) { /* These APIs are optional on iPhone. */ }
    }
    function report() {
        return { version: VERSION, created: new Date().toISOString(), userAgent: navigator.userAgent,
            viewport: { width: innerWidth, height: innerHeight, scale: visualViewport?.scale, dpr: devicePixelRatio },
            capabilities: supported, dropped, runs: runs.map(r => ({ ...r })), events: events.slice(),
            interpretation: 'Frame timestamps are callback timings, not presentation timings. A gap alone does not identify its cause. Hidden/paused intervals are excluded.' };
    }
    function summary() {
        const lines = [VERSION, navigator.userAgent];
        for (const r of runs) {
            const es = events.filter(e => e.run === r.id), frames = es.filter(e => e.type === 'frame-gap');
            const max = type => Math.max(0, ...es.filter(e => e.type === type).map(e => e.ms || 0));
            lines.push(`${modes[r.mode]}: 入力${es.filter(e => e.type === 'input-done').length}回 / 描画の空白${frames.length}回 (最大${max('frame-gap')}ms) / タイマー間隔 最大${max('timer')}ms`);
            for (const g of frames.slice(-6)) {
                const preceding = es.filter(e => e.type === 'input-done' && e.t <= g.t).at(-1);
                lines.push(`  空白${g.ms}ms${preceding ? ' / 直前 '+preceding.question+' 入力'+preceding.digit : ''}`);
            }
            for (const e of es.filter(e => e.type === 'work').sort((a, b) => b.ms - a.ms).slice(0, 4)) lines.push(`  ${e.name}: ${e.ms}ms`);
        }
        if (dropped) lines.push(`記録上限: ${dropped}件省略。結果ファイルを保存して再読込してください。`);
        return lines.join('\n');
    }
    function stopRun(reason) {
        if (recording) add('segment-end', { reason });
        recording = false; resetClocks();
        if (runs.length) runs[runs.length - 1].end = round(now());
    }
    function refresh() { output.value = summary(); status.textContent = `${runs.length}回の計測を保持中。結果ファイルに詳細が入ります。`; }
    function open() {
        stopRun('panel'); resumeAfterDialog = document.body.dataset.scene === 'game' && document.body.dataset.paused !== 'true';
        if (resumeAfterDialog) document.getElementById('pause').click();
        refresh(); dialog.showModal();
    }
    function close() {
        dialog.close();
        if (resumeAfterDialog) {
            resetClocks(); recording = true; document.getElementById('resume').click(); add('segment-start');
        }
        resumeAfterDialog = false;
    }
    function startRun() {
        if (document.getElementById('pause-dialog').open) document.getElementById('quit').click();
        KukuSound.stop(); KukuSound.cancelSpeech();
        mode = document.getElementById('diag-mode').value;
        // Settings are in the isolated diagnostic learning store only.
        KukuStore.state.settings.sound = KukuStore.state.settings.voice = true;
        KukuStore.state.settings.motion = .65;
        run++; runs.push({ id: run, mode, start: round(now()), settings: { ...KukuStore.state.settings } });
        resetClocks(); recording = true; resumeAfterDialog = false; dialog.close();
        add('segment-start'); window.dispatchEvent(new Event('kuku:diagnostic-start'));
    }
    window.KukuDiagnostics = { begin, report, summary, voice(type, detail) { add('recording-' + type, detail); }, get mode() { return mode; } };
    document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '.topbar{gap:4px}.topbar a{font-size:17px}.topbar a span{font-size:13px}.diag-launch{padding:3px 7px;min-height:34px;font-size:12px}#diag-panel{width:min(94vw,440px);max-height:92dvh;padding:14px;border:2px solid #8052a1;border-radius:18px}#diag-panel h2{font-size:18px;margin:0 0 8px}#diag-panel p{font-size:12px;margin:6px 0}#diag-panel select,#diag-panel textarea{width:100%;font-size:16px}#diag-panel textarea{height:100px;resize:none}#diag-panel button{font-size:13px;padding:7px;min-height:40px}#diag-panel .diag-actions{display:flex;gap:6px;margin:7px 0}#diag-panel .diag-actions>*{flex:1}';
        document.head.append(style);
        const button = document.createElement('button'); button.id = 'diag-open'; button.className = 'diag-launch'; button.textContent = 'けいそく'; button.onclick = open;
        document.querySelector('.topbar').insertBefore(button, document.getElementById('sound'));
        dialog = document.createElement('dialog'); dialog.id = 'diag-panel';
        dialog.innerHTML = '<h2>入力の計測 D3</h2><p>同じ4の段9問を比較します。普段の学習記録は変わりません。</p><select id="diag-mode" aria-label="計測条件"><option value="normal">A 通常（音・演出あり）</option><option value="voice-only">D 音声ファイルだけ</option><option value="synth-only">E 音楽・効果音だけ</option><option value="silent">B 音なし（音楽・効果音・声）</option><option value="no-input-fx">C 入力演出なし（音あり）</option></select><div class="diag-actions"><button id="diag-start">9問をはじめる</button><button id="diag-close">とじる</button></div><p id="diag-status"></p><textarea id="diag-output" readonly aria-label="計測の要約"></textarea><div class="diag-actions"><button id="diag-copy">要約をコピー</button><button id="diag-file">結果ファイルを保存</button></div><p>結果は自動送信されません。画面更新で計測結果は消えます。</p>';
        document.body.append(dialog); output = document.getElementById('diag-output'); status = document.getElementById('diag-status');
        document.getElementById('diag-start').onclick = startRun;
        document.getElementById('diag-close').onclick = close;
        dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
        document.getElementById('diag-copy').onclick = async () => {
            try { await navigator.clipboard.writeText(summary()); status.textContent = 'コピーしました。この会話に貼り付けてください。'; }
            catch (_) { output.focus(); output.select(); status.textContent = '選択した結果を長押しでコピーしてください。'; }
        };
        document.getElementById('diag-file').onclick = () => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(report())], { type: 'application/json' }));
            const link = document.createElement('a'); link.href = url; link.download = 'kuku-input-diagnostics-D3.json'; document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000); status.textContent = '保存したJSONファイルを、この会話に添付してください。';
        };
        for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click']) document.addEventListener(type, e => {
            const key = e.target.closest?.('[data-digit]'); if (!key) return;
            add(type, { digit: key.dataset.digit, eventTime: round(e.timeStamp), trusted: e.isTrusted });
        }, { capture: true, passive: true });
        for (const key of document.querySelectorAll('[data-digit]')) {
            const original = key.onclick;
            key.onclick = function (e) {
                const start = now(), before = document.getElementById('answer').textContent, question = document.getElementById('equation').textContent;
                try { return original.call(this, e); }
                finally {
                    add('input-done', { digit: key.dataset.digit, before, after: document.getElementById('answer').textContent, question, ms: round(now() - start), audio: contexts.map(c => c.state) }, start);
                    if (recording) inputPending = { t: start };
                }
            };
        }
        new MutationObserver(() => {
            if (recording && document.body.dataset.scene !== 'game') stopRun('screen-change');
            if (document.body.dataset.paused === 'true') resetClocks();
        }).observe(document.body, { attributes: true, attributeFilter: ['data-scene', 'data-paused'] });
        document.addEventListener('visibilitychange', () => { if (recording) add('visibility', { state: document.visibilityState }); resetClocks(); });
        requestAnimationFrame(frame); setInterval(pulse, 100);
        refresh(); dialog.showModal();
    });
})();
