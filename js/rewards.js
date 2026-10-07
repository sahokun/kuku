/* Game records are independent of the spaced-repetition mastery rules. */
(function (root, factory) {
    const api = factory(typeof module === 'object' && module.exports ? require('./learning.js') : root.KukuLearning);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KukuRewards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L) {
    'use strict';
    const MAX_ANSWER_MS = 86400000;
    const courses = [];
    for (let a = 2; a <= 9; a++) courses.push({ id: `dan-${a}`, dans: [a], title: `${a}のだん`, count: 9, pass: 9 });
    for (let a = 2; a <= 8; a += 2) courses.push({ id: `pair-${a}`, dans: [a, a + 1], title: `${a}・${a + 1}のだん`, count: 10 });
    courses.push({ id: 'final', dans: [2,3,4,5,6,7,8,9], title: '50もん テスト', count: 50, pass: 45, test: true });
    courses.push({ id: 'all-81', dans: [1,2,3,4,5,6,7,8,9], title: '81もん テスト', count: 81, pass: 81, test: true });
    const course = id => courses.find(c => c.id === id);
    const count = (v, max = 1e7) => Number.isInteger(v) && v >= 0 && v <= max ? v : 0;
    const dateOK = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && L.day(new Date(v + 'T12:00:00').getTime()) === v;
    const fresh = () => ({ version: 1, bests: {}, legacyBests: {}, days: {}, trail: { cleared: [], selected: [], mixed: [], rounds: 0, passed: false, passedAll: false }  });
    const emptyDay = () => ({ ms: 0, games: 0, answers: 0, correct: 0, recited: 0, reviewed: 0, finished: 0, bestRoundCorrect: 0, missionVersion: 2, missions: [], reviewKeys: [], seal: false });
    const missionIds = ['play', 'play-three', 'round-correct', 'review', 'recite', 'correct'];
    function restore(raw, learning) {
        const r = fresh();
        if (raw?.version === 1) {
            for (const c of courses) {
                const v = raw.bests?.[c.id];
                if (c.id.startsWith('pair-')) {
                    const old = v?.count === 18 ? v : raw.legacyBests?.[c.id];
                    if (old?.count === 18 && dateOK(old.date)) r.legacyBests[c.id] = {
                        date: old.date, count: 18, score: count(old.score, 18 * 1050), correct: count(old.correct, 18),
                        answerMs: count(old.answerMs, 18 * MAX_ANSWER_MS), runs: count(old.runs)
                    };
                }
                if (!v || !dateOK(v.date) || v.count !== c.count) continue;
                r.bests[c.id] = { score: count(v.score, c.count * (c.count > 60 ? 5050 : c.count > 20 ? 3050 : 1050)), correct: count(v.correct, c.count),
                    answerMs: count(v.answerMs, c.count * MAX_ANSWER_MS), count: c.count, date: v.date, pace: ['first','easy','normal','hard','robot'].includes(v.pace) ? v.pace : null, runs: Math.max(1, count(v.runs)),
                    last: v.last && dateOK(v.last.date) ? { score: count(v.last.score, c.count * (c.count > 60 ? 5050 : c.count > 20 ? 3050 : 1050)), correct: count(v.last.correct, c.count),
                        answerMs: count(v.last.answerMs, c.count * MAX_ANSWER_MS), date: v.last.date, pace: ['first','easy','normal','hard','robot'].includes(v.last.pace) ? v.last.pace : null } : null };
            }
            for (const [date, v] of Object.entries(raw.days || {}).filter(([d]) => dateOK(d)).sort().slice(-730)) {
                if (!v || typeof v !== 'object') continue;
                const d = emptyDay();
                for (const key of ['ms', 'games', 'answers', 'correct', 'recited', 'reviewed', 'finished', 'bestRoundCorrect']) d[key] = count(v[key], key === 'ms' ? 86400000 : 1e6);
                d.missionVersion = v.missionVersion === 2 ? 2 : 0;
                d.missions = [...new Set(Array.isArray(v.missions) ? v.missions.filter(id => missionIds.includes(id)) : [])].slice(0, 4);
                d.reviewKeys = [...new Set(Array.isArray(v.reviewKeys) ? v.reviewKeys.filter(id => /^[2-9]x[1-9]$/.test(id)) : [])].slice(0, 72);
                d.seal = v.seal === true;
                r.days[date] = d;
            }
        }
        const t = raw?.trail;
        if (t) {
            for (const field of ['cleared', 'selected']) r.trail[field] = [...new Set(Array.isArray(t[field]) ? t[field].filter(a => Number.isInteger(a) && a >= 2 && a <= 9) : [])];
            r.trail.mixed = [...new Set(Array.isArray(t.mixed) ? t.mixed.filter(id => /^[2-9]x[1-9]$/.test(id)) : [])];
            r.trail.rounds = count(t.rounds); r.trail.passed = t.passed === true; r.trail.passedAll = t.passedAll === true;
        }
        if (learning) syncCalendar({ ...learning, rewards: r });
        return r;
    }
    function syncCalendar(s) {
        for (const [date, source] of Object.entries(s.days)) {
            if (!dateOK(date) || !source.answers && !source.ms && !source.games) continue;
            const d = s.rewards.days[date] ||= emptyDay();
            for (const key of ['ms', 'games', 'answers']) d[key] = Math.max(d[key], Math.round(source[key] || 0));
        }
        const dates = Object.keys(s.rewards.days).sort();
        dates.slice(0, Math.max(0, dates.length - 730)).forEach(date => delete s.rewards.days[date]);
    }
    function ensureDay(s, date = L.day()) {
        syncCalendar(s);
        const d = s.rewards.days[date] ||= emptyDay();
        if (!d.missions.length) {
            d.reviewKeys = Object.entries(s.problems).filter(([id, r]) => id[0] !== '1' && r.lastAt && L.day(r.lastAt) < date && r.due && r.due <= date).map(([id]) => id);
        }
        d.missions = ['play', 'play-three', 'round-correct', ...(d.reviewKeys.length ? ['review'] : [])];
        d.missionVersion = 2;
        return d;
    }
    function missions(s, date = L.day()) {
        const d = ensureDay(s, date);
        const defs = {
            play: { text: '1かい さいごまで あそぼう', goal: 1, value: d.finished },
            'play-three': { text: '3かい さいごまで あそぼう', goal: 3, value: d.finished },
            'round-correct': { text: '1かいで 3もん せいかいしよう', goal: 3, value: d.bestRoundCorrect },
            review: { text: 'まえの 九九を おさらいしよう', goal: 1, value: d.reviewed }
        };
        return d.missions.map(id => ({ id, ...defs[id], done: defs[id].value >= defs[id].goal }));
    }
    function event(s, date, ev) {
        const d = ensureDay(s, date), before = new Set(missions(s, date).filter(m => m.done).map(m => m.id));
        if (ev.type === 'answer' && ev.ok) { d.correct++; d.bestRoundCorrect = Math.max(d.bestRoundCorrect, count(ev.roundCorrect, 81)); }
        if (ev.type === 'recite') { d.recited++; if (ev.review) d.reviewed++; }
        if (ev.type === 'finish') d.finished++;
        const list = missions(s, date), earned = list.filter(m => m.done && !before.has(m.id));
        const sealed = !d.seal && list.every(m => m.done);
        if (sealed) d.seal = true;
        return { earned, sealed };
    }
    function points(ok, ms, combo, size = 10) {
        if (!ok) return { base: 0, speed: 0, chain: 0, total: 0, label: 'もういちど おぼえよう' };
        const speed = Math.round(30 * Math.max(0, 1 - Math.max(0, ms - 1500) / 3500));
        const chain = Math.min(20, Math.max(0, combo - 1) * 4);
        const base = size > 60 ? 5000 : size > 20 ? 3000 : 1000;
        return { base, speed, chain, total: base + speed + chain, label: ms <= 1500 ? 'すばやい！' : ms <= 3000 ? 'いいリズム！' : 'できた！' };
    }
    function available(s, c) { return !!c && (c.test ? finalReady(s) : c.dans.every(a => s.ordered.includes(a))); }
    function questions(c, random = Math.random) {
        // A fixed, balanced sample keeps final-test records comparable between runs.
        const list = c.id === 'final' ? c.dans.flatMap((a, row) => Array.from({ length: row < 2 ? 7 : 6 }, (_, i) => ({ a, b: (i + row * 2) % 9 + 1 }))) : c.id.startsWith('pair-') ? c.dans.flatMap((a, row) => Array.from({ length: 5 }, (_, i) => ({ a, b: (i * 2 + row) % 9 + 1 }))) : c.dans.flatMap(a => Array.from({ length: 9 }, (_, i) => ({ a, b: i + 1 })));
        for (let i = list.length - 1; i > 0; i--) { const j = Math.min(i, Math.floor(random() * (i + 1))); [list[i], list[j]] = [list[j], list[i]]; }
        return list;
    }
    function recordRun(s, id, answers, date = L.day(), pace = null) {
        const c = course(id);
        if (!c || answers.length !== c.count) return null;
        const expected = new Set(questions(c).map(q => L.key(q.a, q.b)));
        let score = 0, correct = 0, answerMs = 0, combo = 0;
        for (const a of answers) {
            if (!expected.delete(L.key(a.a, a.b)) || typeof a.ok !== 'boolean' || !Number.isFinite(a.ms) || a.ms < 0 || a.ms > MAX_ANSWER_MS) return null;
            combo = a.ok ? combo + 1 : 0; correct += a.ok ? 1 : 0;
            answerMs += Math.round(a.ms); score += points(a.ok, a.ms, combo, c.count).total;
        }
        if (id.startsWith('dan-') && correct === 9 && !s.rewards.trail.cleared.includes(c.dans[0])) s.rewards.trail.cleared.push(c.dans[0]);
        if (id === 'final' && correct >= 45) s.rewards.trail.passed = true;
        if (id === 'all-81' && correct === 81) s.rewards.trail.passedAll = true;
        const current = { score, correct, answerMs, count: c.count, date, pace: ['first','easy','normal','hard','robot'].includes(pace) ? pace : null };
        const previous = s.rewards.bests[id] || null;
        const improved = !!previous && score > previous.score;
        s.rewards.bests[id] = { ...(!previous || improved ? current : previous), runs: (previous?.runs || 0) + 1, last: current };
        return { current, previous, improved, first: !previous, best: s.rewards.bests[id] };
    }
    function route(s, dan) {
        const records = Array.from({ length: 9 }, (_, i) => s.problems[L.key(dan, i + 1)]);
        return { dan, introduced: dan === 1 ? s.tutorial : s.introduced.includes(dan), ordered: s.ordered.includes(dan),
            ready: records.filter(r => r?.everReady).length, mastered: records.filter(r => r?.mastered).length,
            repair: records.filter(r => r?.repair).length };
    }
    function cleared(s) {
        return Array.from({length: 8}, (_, i) => i + 2).filter(a => s.rewards.trail.cleared.includes(a) || s.rewards.bests[`dan-${a}`]?.correct === 9 || route(s, a).ready === 9);
    }
    function selected(s) {
        const open = cleared(s), chosen = s.rewards.trail.selected.filter(a => open.includes(a));
        return chosen.length ? chosen : open;
    }
    function finalReady(s) { return cleared(s).length === 8 && s.rewards.trail.mixed.length === 72; }
    function rowPlan(s, dan) {
        if (!s.tutorial) return {kind: 'intro', dan: 1, count: 9, title: 'あそびかたを おぼえよう'};
        if (!s.introduced.includes(dan)) return {kind: 'intro', dan, count: 9, title: `${dan}のだんを きこう`};
        if (!s.ordered.includes(dan)) return {kind: 'ordered', dan, count: 9, title: `${dan}のだんを じゅんばんに`};
        return {kind: 'challenge', courseId: `dan-${dan}`, dans: [dan], count: 9, title: `${dan}のだん`, queue: questions(course(`dan-${dan}`))};
    }
    function mixPlan(s, dans = selected(s), now = Date.now(), random = Math.random) {
        dans = [...new Set(dans)].filter(a => cleared(s).includes(a)).sort();
        if (dans.length < 2) return null;
        const used = new Set(), rows = new Map(dans.map(a => [a, 0])), queue = [];
        const pool = dans.flatMap(a => Array.from({length: 9}, (_, i) => ({a, b: i + 1, tie: random()})));
        for (let i = 0; i < 10; i++) {
            const rank = q => {
                const id = L.key(q.a, q.b), r = s.problems[id];
                return (r && !L.eligible(s, r, now) ? 100 : 0) + (s.rewards.trail.mixed.includes(id) ? 10 : 0) + (r?.due && r.due <= L.day(now) ? 0 : 2) + q.tie;
            };
            const min = Math.min(...rows.values());
            const candidates = pool.filter(q => !used.has(L.key(q.a, q.b)) && rows.get(q.a) === min).sort((a,b) => rank(a) - rank(b));
            const q = candidates[0]; queue.push({a:q.a,b:q.b}); used.add(L.key(q.a,q.b)); rows.set(q.a, rows.get(q.a)+1);
        }
        return {kind:'mix', title: 'まぜて 10もん', dans, count:10, queue};
    }
    function finishMix(s, plan, answers) {
        if (plan.kind !== 'mix' || plan.count !== 10 || answers.length !== 10 || plan.dans.length < 2 || !plan.dans.every(a => cleared(s).includes(a))) return false;
        const seen = new Set();
        for (let i = 0; i < answers.length; i++) {
            const a = answers[i], q = plan.queue[i], id = L.key(a.a,a.b);
            if (!q || a.a !== q.a || a.b !== q.b || !plan.dans.includes(a.a) || seen.has(id) || typeof a.ok !== 'boolean') return false;
            seen.add(id);
        }
        s.rewards.trail.rounds++;
        s.rewards.trail.mixed = [...new Set([...s.rewards.trail.mixed, ...answers.filter(a => a.ok).map(a => L.key(a.a,a.b))])];
        return true;
    }
    function plan(s) {
        const dan = s.focusDan || 2;
        if (!s.tutorial || !cleared(s).includes(dan)) return rowPlan(s, dan);
        return mixPlan(s) || {kind:'route', title:'つぎの だんを えらぼう'};
    }
    function calendar(s, year, month) {
        syncCalendar(s);
        return Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => {
            const date = L.day(new Date(year, month, i + 1, 12).getTime()), d = s.rewards.days[date];
            return { date, number: i + 1, played: !!d?.answers, seal: !!d?.seal, ...(d || emptyDay()) };
        });
    }
    return { fresh, restore, courses, course, available, questions, syncCalendar, ensureDay, missions, event, points, recordRun, route, calendar, cleared, selected, finalReady, rowPlan, mixPlan, finishMix, plan };
});
