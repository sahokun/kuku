/* Pure learning rules, shared by the browser and Node's test runner. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports)
        module.exports = api;
    else
        root.KukuLearning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const VERSION = 1;
    const answerTimes = Object.freeze({ first: Infinity, easy: 10000, normal: 5000, hard: 3000, robot: 1500 });
    function answerTime(pace) { return Object.hasOwn(answerTimes, pace) ? answerTimes[pace] : answerTimes.normal; }
    function answerDeadline(pace, firstDigitMs = null) {
        const limit = answerTime(pace);
        return firstDigitMs === null ? limit : Math.max(limit, firstDigitMs + Math.min(1800, limit * .36));
    }
    const key = (a, b) => `${a}x${b}`;
    function day(now = Date.now()) {
        const d = new Date(now);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function plusDays(date, count) {
        const [y, m, d] = date.split('-').map(Number);
        return day(new Date(y, m - 1, d + count, 12).getTime());
    }
    function fresh() {
        return { version: VERSION, serial: 0, tutorial: false, focusDan: 2, introduced: [], ordered: [], problems: {}, days: {},
            settings: { sound: false, voice: true, motion: 0.65, volume: 0.55, pace: 'auto', paceVersion: 2 } };
    }
    const int = (v, lo, hi, fallback = lo) => Number.isInteger(v) && v >= lo && v <= hi ? v : fallback;
    const dateOK = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    function restore(raw) {
        const s = fresh();
        if (!raw || raw.version !== VERSION)
            return s;
        s.serial = int(raw.serial, 0, Number.MAX_SAFE_INTEGER);
        s.tutorial = raw.tutorial === true;
        s.focusDan = int(raw.focusDan, 2, 9, 2);
        s.introduced = [...new Set(Array.isArray(raw.introduced) ? raw.introduced.filter(n => Number.isInteger(n) && n >= 2 && n <= 9) : [])];
        s.ordered = [...new Set(Array.isArray(raw.ordered) ? raw.ordered.filter(n => Number.isInteger(n) && n >= 2 && n <= 9) : [])];
        const opts = raw.settings || {};
        if (opts.pace === 'auto' || Object.hasOwn(answerTimes, opts.pace)) s.settings.pace = opts.pace === 'normal' && opts.paceVersion !== 2 ? 'auto' : opts.pace;
        for (const name of ['sound', 'voice'])
            if (typeof opts[name] === 'boolean')
                s.settings[name] = opts[name];
        for (const name of ['motion', 'volume'])
            if (Number.isFinite(opts[name]))
                s.settings[name] = Math.max(0, Math.min(1, opts[name]));
        for (let a = 1; a <= 9; a++)
            for (let b = 1; b <= 9; b++) {
                const r = raw.problems?.[key(a, b)];
                if (!r || typeof r !== 'object')
                    continue;
                s.problems[key(a, b)] = {
                    attempts: int(r.attempts, 0, 1e9), correct: int(r.correct, 0, 1e9),
                    today: dateOK(r.today) ? r.today : '', hits: int(r.hits, 0, 2),
                    lastSerial: int(r.lastSerial, 0, s.serial), lastAt: Number.isFinite(r.lastAt) ? Math.max(0, r.lastAt) : 0,
                    gap: int(r.gap, 0, 5), stage: int(r.stage, 0, 4), due: dateOK(r.due) ? r.due : '',
                    everReady: r.everReady === true, mastered: r.mastered === true, repair: r.repair === true,
                    stars: Math.max(int(r.stars, 0, 3), mapStars(r)),
                    lastReview: dateOK(r.lastReview) ? r.lastReview : '',
                    history: Array.isArray(r.history) ? r.history.filter(x => x && Number.isFinite(x.at) && typeof x.ok === 'boolean').slice(-24) : []
                };
            }
        for (const [d, v] of Object.entries(raw.days || {}).sort().slice(-90)) {
            if (dateOK(d) && v && typeof v === 'object')
                s.days[d] = {
                    ms: Number.isFinite(v.ms) ? Math.max(0, Math.min(v.ms, 86400000)) : 0,
                    games: int(v.games, 0, 1e5), answers: int(v.answers, 0, 1e6)
                };
        }
        return s;
    }
    function record(s, q) {
        return s.problems[key(q.a, q.b)] ||= { attempts: 0, correct: 0, today: '', hits: 0,
            lastSerial: 0, lastAt: 0, gap: 0, stage: 0, due: '', everReady: false, mastered: false, repair: false, lastReview: '', history: [] };
    }
    function daily(s, date) { return s.days[date] ||= { ms: 0, games: 0, answers: 0 }; }
    function isDue(r, now) { return !r || !r.due || r.due <= day(now); }
    function eligible(s, r, now) {
        return !r || !r.gap || day(now) > day(r.lastAt) || (s.serial - r.lastSerial >= r.gap && now - r.lastAt >= (r.gap === 5 ? 30000 : 0));
    }
    function activeDan(s) {
        const order = [...Array.from({ length: 10 - s.focusDan }, (_, i) => s.focusDan + i), ...Array.from({ length: s.focusDan - 2 }, (_, i) => 2 + i)];
        for (const a of order) {
            if (!s.introduced.includes(a) || Array.from({ length: 9 }, (_, i) => s.problems[key(a, i + 1)]).some(r => !r?.everReady))
                return a;
        }
        return 10;
    }
    function danProgress(s, a) {
        return Array.from({ length: 9 }, (_, i) => s.problems[key(a, i + 1)]).filter(r => r?.everReady).length;
    }
    function chooseDan(s, a) {
        if (!Number.isInteger(a) || a < 2 || a > 9)
            return false;
        s.focusDan = a;
        return true;
    }
    function plan(s) {
        if (!s.tutorial)
            return { kind: 'intro', dan: 1, count: 9, title: '1のだんで はじめよう' };
        const a = activeDan(s);
        if (a < 10 && !s.introduced.includes(a))
            return { kind: 'intro', dan: a, count: 9, title: `${a}のだんを きこう` };
        if (a < 10 && !s.ordered.includes(a))
            return { kind: 'ordered', dan: a, count: 9, title: `${a}のだんを じゅんばんに` };
        return { kind: 'auto', dan: a, count: 10, title: a < 10 ? `${a}のだんと おさらい` : 'きょうの10もん' };
    }
    function mapStars(r) {
        return Math.max(int(r?.stars, 0, 3), r?.mastered === true ? 3 : Number.isInteger(r?.stage) && r.stage >= 2 && r.stage <= 4 ? 2 : r?.everReady === true || r?.stage === 1 ? 1 : 0);
    }
    const paceLabels = { first: 'はじめて・じかん なし', easy: 'やさしい・10びょう', normal: 'ふつう・5びょう', hard: 'むずかしい・3びょう', robot: 'ろぼっと・1.5びょう' };
    function paceLabel(pace) { return paceLabels[pace] || 'じかんの きろく なし'; }
    function roundPace(s, p, choice = s.settings.pace) {
        if (p.kind === 'intro') return 'first';
        if (Object.hasOwn(answerTimes, choice)) return choice;
        const rows = p.dans || (p.kind === 'ordered' ? [p.dan] : s.introduced.filter(a => a <= p.dan));
        const pool = p.queue || (p.keys ? p.keys.map(id => { const [a,b] = id.split('x').map(Number);return {a,b}; }) : rows.flatMap(a => Array.from({length:9},(_,i)=>({a,b:i+1}))));
        let pace = 'normal';
        for (const q of pool) {
            const r = s.problems[key(q.a,q.b)], recent = (r?.history || []).filter(x => x.kind !== 'intro').slice(-2);
            if (!recent.length || recent.length === 2 && recent.every(x => !x.ok)) return 'first';
            if (!r?.everReady || !r.stage || r.repair || !recent[recent.length-1].ok) pace = 'easy';
        }
        return pool.length ? pace : 'first';
    }
    function submit(s, q, ok, now, elapsed, kind = 'random') {
        const previousStars = mapStars(s.problems[key(q.a,q.b)]);
        const change = submitAttempt(s, q, ok, now, elapsed, kind);
        const r = record(s,q);r.stars = Math.max(previousStars, mapStars(r));
        return change;
    }
    function submitAttempt(s, q, ok, now, elapsed, kind = 'random') {
        const r = record(s, q), today = day(now);
        const canCredit = eligible(s, r, now);
        const due = isDue(r, now);
        if (r.today !== today) {
            r.today = today;
            r.hits = 0;
        }
        s.serial++;
        r.attempts++;
        daily(s, today).answers++;
        if (ok && kind !== 'intro')
            r.correct++;
        r.history.push({ at: now, ok, ms: Math.max(0, Math.round(elapsed)), kind });
        r.history = r.history.slice(-24);
        let change = 'practice';
        if (kind === 'intro') {
            r.lastSerial = s.serial;
            r.lastAt = now;
            r.gap = 3;
            return 'seen';
        }
        if (!ok) {
            r.hits = 0;
            r.stage = 0;
            r.due = today;
            r.repair = r.mastered;
            r.lastSerial = s.serial;
            r.lastAt = now;
            r.gap = 3;
            return 'again';
        }
        if (!canCredit || !due || (kind !== 'random' && !(kind === 'ordered' && r.stage === 0 && r.hits === 0))) {
            r.lastSerial = s.serial;
            r.lastAt = now;
            return change;
        }
        if (r.stage > 0 && r.lastReview !== today) {
            r.stage = Math.min(4, r.stage + 1);
            r.lastReview = today;
            r.hits = 2;
            r.due = plusDays(today, r.stage === 2 ? 3 : r.stage === 3 ? 7 : 14);
            change = r.stage === 4 && (!r.mastered || r.repair) ? 'mastered' : 'reviewed';
            if (r.stage === 4) {
                r.mastered = true;
                r.repair = false;
            }
        }
        else if (r.stage === 0) {
            r.hits++;
            if (r.hits >= 2) {
                r.stage = 1;
                r.everReady = true;
                r.lastReview = today;
                r.due = plusDays(today, 1);
                change = 'ready';
            }
            else
                change = 'first';
        }
        r.lastSerial = s.serial;
        r.lastAt = now;
        r.gap = 5;
        return change;
    }
    function finishIntro(s, dan) {
        if (dan === 1)
            s.tutorial = true;
        else if (!s.introduced.includes(dan))
            s.introduced.push(dan);
    }
    function pick(s, p, recent = [], now = Date.now(), random = Math.random) {
        const all = [], buffers = [];
        for (let a = 1; a <= 9; a++)
            for (let b = 1; b <= 9; b++) {
                const id = key(a, b), r = s.problems[id];
                if (p.kind === 'manual') {
                    if (p.keys ? !p.keys.includes(id) : !p.dans.includes(a))
                        continue;
                }
                else {
                    if (a === 1 || a > p.dan || !s.introduced.includes(a))
                        continue;
                    if (!isDue(r, now)) {
                        buffers.push({ a, b, id, r });
                        continue;
                    }
                }
                all.push({ a, b, id, r });
            }
        if (!all.length)
            return null;
        const reviewSlot = recent.length % 3 === 2;
        let group = p.kind === 'manual' ? all : all.filter(q => reviewSlot ? q.a < p.dan : q.a === p.dan);
        if (!group.length)
            group = all;
        const ready = group.filter(q => eligible(s, q.r, now));
        if (ready.length)
            group = ready;
        else if (p.kind !== 'manual') {
            const otherDue = all.filter(q => eligible(s, q.r, now));
            const buffer = buffers;
            if (otherDue.length)
                group = otherDue;
            else if (buffer.length)
                group = buffer;
        }
        const spaced = group.filter(q => !recent.slice(-3).includes(q.id));
        if (spaced.length)
            group = spaced;
        const fillingGap = !group.some(q => eligible(s, q.r, now));
        group = group.map(q => ({ ...q, priority: (fillingGap ? ((q.r?.lastAt || 0) - now) / 1000 : 0) + (isDue(q.r, now) ? 20 : 0) + (q.r?.repair ? 6 : 0) +
                (q.r?.today === day(now) && q.r.hits === 1 ? 4 : 0) + (q.r ? 0 : 2) + random() }));
        group.sort((a, b) => b.priority - a.priority);
        return { a: group[0].a, b: group[0].b };
    }
    function status(r) {
        if (!r || !r.attempts)
            return 'new';
        if (r.repair)
            return 'repair';
        if (r.mastered)
            return 'mastered';
        if (r.stage >= 2)
            return 'review';
        if (r.stage === 1)
            return 'ready';
        return 'learning';
    }
    function countMastered(s) {
        let n = 0;
        for (let a = 2; a <= 9; a++)
            for (let b = 1; b <= 9; b++)
                if (s.problems[key(a, b)]?.mastered && !s.problems[key(a, b)].repair)
                    n++;
        return n;
    }
    return { VERSION, mapStars, roundPace, paceLabel, answerTime, answerDeadline, key, day, plusDays, fresh, restore, record, daily, eligible, isDue, activeDan, danProgress, chooseDan, plan, submit, finishIntro, pick, status, countMastered };
});
