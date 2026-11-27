(() => {
    'use strict';
    const R = KukuRewards, L = KukuLearning, store = KukuStore, s = store.state, sound = KukuSound, fx = KukuVisuals;
    const $ = id => document.getElementById(id);
    const data = new Map(KukuData.map(q => [L.key(q.a, q.b), q]));
    let session = null, screen = 'home', lastTick = performance.now(), selected = new Set([2]), custom = new Set();
    const narrated = new Set();
    // Taps that land just after the screen moves on belong to the previous question, not the new one.
    const INPUT_GUARD_MS = 600;
    const minutes = n => `${n}${[1, 3, 4, 6, 8, 10].includes(n) ? 'ぷん' : 'ふん'}`;
    let answerPage = 0, pendingPlan = null;
    const backTargets = {}, roots = ['home', 'route', 'records', 'menu'];
    const journey = KukuJourney.create({ state: s, start, show, save });
    const names = { new: 'まだ これから', learning: 'れんしゅうちゅう', ready: 'きょうの かくにん OK', review: '日を あけて かくにんちゅう', mastered: 'しっかり おぼえた！', repair: 'もういちど おさらい' };
    function save(defer = false) {
        if (defer) { store.queueSave(() => $('storage-warning').hidden = store.available); return; }
        store.save(); $('storage-warning').hidden = store.available;
    }
    function show(id, returning = false) {
        if (!returning && id !== screen && !roots.includes(id) && !['game', 'result', 'result-details', 'result-answers'].includes(id) && !['game', 'result', 'result-details', 'result-answers'].includes(screen)) backTargets[id] = screen;
        screen = id;
        const section = ['game', 'result', 'result-details', 'result-answers'].includes(id) ? null : id === 'calendar' && backTargets.calendar === 'missions' ? 'home' : ['map', 'calendar', 'challenge', 'records'].includes(id) ? 'records' : ['manual', 'custom', 'table', 'settings', 'menu', 'updates'].includes(id) ? 'menu' : id === 'route' ? 'route' : 'home';
        $('main-nav').hidden = !section;
        document.querySelectorAll('[data-nav]').forEach(b => { if (b.dataset.nav === section) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
        fx.setScene(id);
        document.querySelectorAll('.screen').forEach(el => el.hidden = el.id !== id);
        if (id !== 'game') {
            sound.stop();
            sound.cancelSpeech();
        }
        window.scrollTo(0, 0);
        if (['home', 'missions', 'records'].includes(id))
            renderHome();
        if (id === 'manual')
            renderManual();
        if (id === 'map')
            renderMap();
        if (id === 'table')
            renderTable();
        if (id === 'settings')
            renderSettings();
        if (id === 'updates') { updatesPage = 0; renderUpdates(); }
        if (id === 'route') journey.route();
        if (id === 'challenge') journey.challenges();
        if (id === 'calendar') journey.calendar();
        if (id === 'result-answers') renderAnswers();
        const focus = $(id).querySelector('h1');
        if (focus) {
            if (focus.tagName !== 'BUTTON')
                focus.tabIndex = -1;
            focus.focus({ preventScroll: true });
        }
        const guide = { route: 'route', manual: 'manual', map: 'map', table: 'table', missions: 'missions', calendar: 'calendar' }[id];
        if (guide && !narrated.has(id) && s.settings.voice) { narrated.add(id); sound.message(guide); }
    }
    function voiceBanks(plan) {
        const rows = plan.queue ? plan.queue.map(q => q.a) : plan.keys ? plan.keys.map(key => Number(key.split('x')[0])) : plan.dans ||
            (['intro', 'ordered'].includes(plan.kind) ? [plan.dan] : plan.kind === 'auto' ? s.introduced.filter(a => a > 1 && a <= plan.dan) : []);
        return ['messages', 'cue', ...[...new Set(rows)].map(a => 'dan-' + a)];
    }
    function syncSound() {
        $('sound').setAttribute('aria-pressed', String(s.settings.sound));
        $('sound').setAttribute('aria-label', s.settings.sound ? 'おんがくを とめる' : 'おんがくを ながす');
        $('sound').style.opacity = s.settings.sound ? '1' : '.8';
        $('sound').querySelector('span').textContent = s.settings.sound ? 'おんがく あり' : 'おんがく なし';
    }
    function renderHome() {
        fx.setEnergy(.08);
        const p = R.plan(s), d = L.daily(s, L.day());
        sound.warm(voiceBanks(p));
        $('recommendation-title').textContent = p.title;
        $('choose-course').hidden = p.kind === 'route';
        $('auto-start').textContent = p.kind === 'route' ? 'だんを えらぶ ▶' : p.kind === 'intro' ? 'きいてみる ▶' : 'はじめる ▶';
        const span = p.kind === 'intro' ? [2, 3] : R.estimate(s, p) || [2, 4];
        $('round-estimate').textContent = p.kind === 'route' ? 'すきな だんから' : `${p.count || 9}もん・やく ${span[0]}〜${minutes(span[1])}`;
        const now = new Date();
        $('home-date').textContent = `${now.getMonth() + 1}月${now.getDate()}日 ${'日月火水木金土'[now.getDay()]}`;
        const missions = R.missions(s), completed = missions.filter(m => m.done).length;
        $('home-mission-count').textContent = `${completed} / ${missions.length}`;
        $('home-mission-note').textContent = completed === missions.length ? 'できた！ はなが さいたよ' : 'あそんで はなを さかせよう';
        $('auto-description').textContent = p.next ? 'あたらしい だんに ちょうせん！' : (p.kind === 'mix' ? `${p.dans.join('・')}のだんを まぜて 10もん。` : p.kind === 'route' ? 'すきな だんを えらんで、クリアを ふやそう。' : p.kind === 'intro' ? 'まずは こえを きいて、いっしょに いってみよう。' : p.kind === 'challenge' ? 'ばらばらの 9もん。ぜんぶ できたら クリア！' : 'この だんを、じゅんばんに れんしゅうしよう。');
        $('daily-time').textContent = d.ms >= 600000 ? `${Math.floor(d.ms / 60000)}ふん ✓` : `${Math.floor(d.ms / 60000)} / 10ふん`;
        $('daily-progress').value = Math.min(600000, d.ms);
        $('daily-note').textContent = d.ms >= 600000 ? 'きょうも がんばったね！ また あした。' : 'きく・いう れんしゅうは、ゆっくりで OK。';
        $('mastered-count').textContent = `しっかり おぼえた ${L.countMastered(s)} / 72`;
        const open = R.cleared(s);
        $('dan-progress-card').hidden = !s.tutorial;
        $('dan-progress-title').textContent = 'だんの クリア';
        $('dan-progress-count').textContent = `${open.length} / 8だん`;
        $('dan-progress-dots').replaceChildren();
        for (let dan = 2; dan <= 9; dan++) {
            const mark = document.createElement('span');mark.textContent = dan;mark.className = open.includes(dan) ? 'done' : '';$('dan-progress-dots').append(mark);
        }
        $('next-dan').hidden = false;$('next-dan').textContent = 'あそぶ →';
        journey.home();
        syncSound();
    }
    function start(p, chosenPace) {
        if (p.kind === 'route') { show('route'); return; }
        if (p.kind !== 'intro' && !chosenPace) {
            pendingPlan = p;
            $('round-setup-title').textContent = p.title || (p.kind === 'mix' ? 'まぜて 10もん' : '10もん れんしゅう');
            $('round-pace').value = s.settings.pace;
            updateRoundPace();
            sound.warm(voiceBanks(p));
            $('round-setup').showModal();
            return;
        }
        session?.recitation?.cancel();
        sound.cancelSpeech();
        const rowDan = ['intro', 'ordered'].includes(p.kind) ? p.dan : p.courseId?.startsWith('dan-') ? p.dans[0] : 0;
        if (rowDan >= 2) L.chooseDan(s, rowDan);
        session = { pace: chosenPace || L.roundPace(s, p), score: 0, speedPoints: 0, chainPoints: 0, answers: [], responses: [], bestCrossed: false, plan: p, index: 0, recent: [], correct: 0, combo: 0, changes: { ready: 0, reviewed: 0, mastered: 0 }, quick: 0, elapsed: 0, questionMs: 0, phaseMs: 0, paused: false, phase: 'question', input: '', extended: false, lockMs: 0 };
        R.ensureDay(s);
        fx.clear();
        $('score-strip').hidden = p.kind === 'intro';
        $('game-score').textContent = '0';
        $('score-gain').textContent = '';
        const best = s.rewards.bests[p.courseId];
        $('game-best').textContent = p.kind === 'challenge' ? best ? `ベスト ${best.score.toLocaleString()}` : 'はじめの きろく！' : 'れんしゅう';
        show('game');
        sound.setEnergy(.08);
        session.voiceBanks = voiceBanks(p);
        if (sound.ready(session.voiceBanks)) { session.voiceReady = true; beginRound(session); return; }
        session.phase = 'loading';
        $('input-controls').hidden = true;
        $('intro-guide').hidden = true;
        $('equation').textContent = '♫';
        $('answer').textContent = '';
        $('reading').textContent = '';
        $('feedback').textContent = '';
        $('round-name').textContent = 'もうすぐ はじまるよ';
        $('counter').textContent = '';
        $('combo').textContent = '';
        $('mode-note').textContent = '';
        $('round-progress').value = 0;
        $('game').classList.remove('correct', 'revealed');
        delete $('game').dataset.recitation;
        prepareRound(session);
    }
    async function prepareRound(active) {
        $('voice-loading').hidden = false;
        $('voice-load-status').textContent = 'こえを じゅんびちゅう…';
        $('voice-load-actions').hidden = true;
        const ready = await sound.prepare(active.voiceBanks);
        if (session !== active || screen !== 'game') return;
        if (!ready) {
            $('voice-load-status').textContent = 'こえが よみこめなかったよ';
            $('voice-load-actions').hidden = false;
            return;
        }
        active.voiceReady = true;
        beginRound(active);
    }
    function beginRound(active) {
        if (session !== active || active.paused || !active.voiceReady || screen !== 'game') return;
        $('voice-loading').hidden = true;
        sound.start();
        next();
        lastTick = performance.now();
    }
    function next() {
        if (!session)
            return;
        if (session.index >= session.plan.count) {
            finish();
            return;
        }
        const q = session.plan.queue ? session.plan.queue[session.index] : ['intro', 'ordered'].includes(session.plan.kind) ? { a: session.plan.dan, b: session.index + 1 } : L.pick(s, session.plan, session.recent);
        if (!q) {
            finish();
            return;
        }
        fx.nextQuestion();
        session.q = data.get(L.key(q.a, q.b));
        session.input = '';
        session.questionMs = 0;
        session.phaseMs = 0;
        session.extended = false;
        // Every lecture question starts by listening; in the 1のだん tutorial the child then types the same fact (startCopy).
        const intro = session.plan.kind === 'intro';
        session.copy = false;
        session.phase = intro ? 'intro' : 'question';
        updateParade(session.index);
        $('game').classList.remove('correct', 'revealed');
        $('round-name').textContent = session.plan.kind === 'mix' ? `${session.plan.dans.join('・')}のだんを まぜよう` : intro ? `${q.a}のだんを きこう` : session.plan.kind === 'ordered' ? `${q.a}のだんを じゅんばんに` : session.plan.kind === 'challenge' ? `${session.plan.title}に ちょうせん` : session.plan.kind === 'manual' ? 'じぶんの れんしゅう' : session.plan.dan < 10 ? `${session.plan.dan}のだんと おさらい` : 'きょうの10もん';
        $('counter').textContent = `${session.index + 1}もんめ / ${session.plan.count}`;
        $('round-progress').max = session.plan.count;
        $('round-progress').value = session.index;
        $('mode-note').textContent = intro ? 'いっしょに いってみよう' : L.paceLabel(session.pace);
        $('equation').textContent = `${q.a} × ${q.b} =`;
        $('reading').textContent = intro ? session.q.q_read + session.q.a_read : session.q.q_read;
        $('answer').textContent = intro ? String(q.a * q.b) : '?';
        $('feedback').textContent = intro ? '' : GUIDE;
        $('score-gain').textContent = '';
        session.hinted = false;
        delete $('game').dataset.wait;
        $('reveal').textContent = 'わからない → ヒント';
        if (intro) showDots(session.q, true); else hideDots();
        $('input-controls').hidden = intro;
        $('intro-guide').hidden = !intro;
        delete $('game').dataset.recitation;
        $('combo').textContent = session.combo >= 2 ? `${session.combo}もん れんぞく！` : '';
        session.lockMs = intro ? 0 : INPUT_GUARD_MS;
        setKeys(intro);
        if (intro)
            startRecitation(true);
        else {
            sound.effect('ready');
            if (session.plan.kind === 'auto' && session.plan.dan < 10) sound.speak(session.q.q_speak || session.q.q_read);
        }
    }
    function updateParade(done) {
        const e = .15 + .85 * done / Math.max(1, session.plan.count);
        fx.setEnergy(e);
        sound.setEnergy(e);
        fx.progress(done, session.plan.count);
    }
    const GUIDE = 'おしたら すぐ こたえあわせ（2けたは 2つ）';
    // Said when the hint appears, so a hinted answer scoring nothing is not a surprise afterwards.
    const HINT_RULE = '（ヒントの あとは △。てんは つかないよ）';
    // "a × b" read as "a pieces, b times": b groups of a dots (rows of five), laid out to fit the stage.
    function showDots(q, total) {
        const board = $('dot-board');
        board.hidden = false;
        const area = board.getBoundingClientRect();
        const width = area.width - 20, height = area.height - 30, cols = Math.min(q.a, 5), rows = Math.ceil(q.a / 5);
        let best = { size: 0, per: q.b };
        for (let lines = 1; lines <= q.b; lines++) {
            const per = Math.ceil(q.b / lines), size = Math.min(width / (per * cols * 1.25 + (per - 1)), height / (lines * rows * 1.25 + (lines - 1)));
            if (size > best.size) best = { size, per };
        }
        board.style.setProperty('--dot', Math.max(3, Math.min(16, Math.floor(best.size))) + 'px');
        board.style.setProperty('--cols', cols);
        const groups = Array.from({ length: q.b }, () => {
            const g = document.createElement('span');g.className = 'dot-group';
            g.append(...Array.from({ length: q.a }, () => document.createElement('i')));
            return g;
        });
        $('dot-rows').replaceChildren(...Array.from({ length: Math.ceil(q.b / best.per) }, (_, i) => {
            const line = document.createElement('div');line.className = 'dot-line';
            line.append(...groups.slice(i * best.per, i * best.per + best.per));
            return line;
        }));
        $('dot-caption').textContent = total ? `${q.a}こが ${q.b}つで ${q.a * q.b}こ` : `${q.a}こが ${q.b}つ`;
    }
    function hideDots() { $('dot-board').hidden = true; }
    function help() {
        if (!session || session.paused || screen !== 'game') return;
        if (session.phase === 'wait') { proceed(); return; }
        if (session.phase !== 'question' || session.lockMs > 0) return;
        if (session.hinted) { answer(true); return; }
        session.hinted = true;
        showDots(session.q, false);
        $('feedback').textContent = L.hint(session.q.a, session.q.b) + HINT_RULE;
        $('reveal').textContent = 'こたえを きく';
        // A hint restarts a limited clock so the child can use it.
        if (Number.isFinite(L.answerTime(session.pace))) { session.questionMs = 0; session.extended = false; }
    }
    function waitForNext() {
        session.phase = 'wait';
        $('game').dataset.wait = 'true';
        $('feedback').textContent = 'いえたら つぎへ';
        $('reveal').textContent = session.index + 1 < session.plan.count ? 'つぎの もんだいへ ▶' : 'けっかを 見る ▶';
        $('reveal').disabled = false;
    }
    function proceed() {
        if (!session || session.phase !== 'wait' || session.paused) return;
        delete $('game').dataset.wait;
        session.index++;
        next();
    }
    function fullRead(q) { return (q.q_speak || q.q_read) + (q.a_speak || q.a_read); }
    function setKeys(enabled) {
        $('input-controls').querySelectorAll('button').forEach(b => b.disabled = !enabled);
    }
    function digit(n) {
        if (!session || session.paused || session.phase !== 'question' || session.lockMs > 0 || screen !== 'game')
            return;
        if (session.input.length >= 2)
            return;
        session.input += n;
        fx.digit(n);
        $('answer').textContent = session.input;
        sound.effect('key', Number(n));
        if (!session.extended) {
            session.extended = true;
            session.deadline = L.answerDeadline(session.pace, session.questionMs);
        }
        if (session.input.length >= String(session.q.a * session.q.b).length)
            answer(false);
        else if (!session.hinted)
            $('feedback').textContent = 'あと 1つ おすか「こたえる」';
    }
    function answer(reveal, reason = 'shown') {
        if (!session || session.phase !== 'question' || session.paused || session.lockMs > 0)
            return;
        if (!reveal && session.input === '')
            return;
        const right = !reveal && Number(session.input) === session.q.a * session.q.b;
        const helped = right && session.hinted && !session.copy, ok = right && !helped;
        session.review = R.ensureDay(s).reviewKeys.includes(L.key(session.q.a, session.q.b));
        const change = L.submit(s, session.q, right, Date.now(), session.questionMs, session.copy ? 'intro' : helped ? 'hint' : session.plan.kind === 'ordered' ? 'ordered' : 'random');
        const quick = ok && !session.copy && session.questionMs <= L.FLUENT_MS;
        if (quick) session.quick++;
        session.justMastered = change === 'mastered';
        session.newBest = false;
        session.recent.push(L.key(session.q.a, session.q.b));
        if (ok) {
            session.correct++;
            session.combo++;
        }
        else
            session.combo = 0;
        $('combo').textContent = session.combo >= 2 ? `${session.combo}もん れんぞく！` : '';
        const award = R.points(ok, session.questionMs, session.combo, session.plan.count);
        const response = { a: session.q.a, b: session.q.b, ok, ms: session.questionMs, given: session.input || null, reason: reveal ? reason : ok ? 'correct' : helped ? 'hint' : 'wrong' };
        session.answers.push(response);
        session.responses.push(response);
        journey.event({ type: 'answer', ok: ok && !session.copy, roundCorrect: session.copy ? 0 : session.correct });
        if (session.plan.kind !== 'intro') {
            session.score += award.total;session.speedPoints += award.speed;session.chainPoints += award.chain;
            $('game-score').textContent = session.score.toLocaleString();
            $('score-gain').textContent = ok ? `+${award.total}` : helped ? 'ヒントで できた' : reveal ? (reason === 'timeout' ? 'じかんぎれ' : '') : `きみの こたえ：${session.input}`;
        }
        if (Object.hasOwn(session.changes, change))
            session.changes[change]++;
        session.phase = 'recitation';
        session.phaseMs = 0;
        $('game').classList.add(right ? 'correct' : 'revealed');
        if (right) hideDots(); else showDots(session.q, true);
        $('answer').textContent = String(session.q.a * session.q.b);
        $('reading').textContent = session.q.q_read + session.q.a_read;
        $('round-progress').value = session.index + 1;
        // A status worth reading stays on screen through the answer's recitation.
        session.status = helped ? 'ヒントで できた！' : !ok ? '' : change === 'ready' ? 'きょうは OK！' : change === 'mastered' ? 'しっかり おぼえた！' : change === 'slow' ? 'できた！ つぎは もっと はやく' : quick ? 'すぐ いえた！' : '';
        $('feedback').textContent = session.status || (ok || right ? 'できた！' : 'まずは きいてね');
        setKeys(false);
        sound.cancelSpeech();
        // A wrong answer still counts as answered, but without the star flight or a stage change.
        if (right) updateParade(session.index + 1); else fx.progress(session.index + 1, session.plan.count, false);
        sound.effect(right ? 'correct' : 'reveal', session.combo);
        if (right) {
            fx.burst(false, session.combo);
            if (ok && session.plan.kind !== 'intro') {
                const best = s.rewards.bests[session.plan.courseId];
                const crossed = !!best && session.score > best.score && !session.bestCrossed;
                session.newBest = crossed;
                if (crossed) { session.bestCrossed = true;journey.toast('🏆 じぶんの ベストを こえた！');sound.effect('lift'); }
                fx.scoreGain(award.total, award.label, crossed);
            }
            startRecitation(false, true);
        }
        else {
            fx.reveal();
            // Show the button that comes next, locked until the child has said the fact together with the voice.
            $('reveal').textContent = session.index + 1 < session.plan.count ? 'いっしょに いったら つぎへ ▶' : 'いっしょに いったら けっかへ ▶';
            startRecitation(false);
        }
        save(true);
    }
    function startRecitation(intro, repeatOnly = false) {
        const active = session, question = session.q;
        let encouragement = null;
        if (!intro && active.index + 1 < active.plan.count) {
            if (repeatOnly) {
                const key = active.newBest ? 'praise-best' : active.justMastered ? 'praise-mastered' : active.correct === 1 ? 'praise-first' :
                    ({ 3: 'praise-three', 5: 'praise-five', 8: 'praise-eight', 10: 'praise-eight' })[active.combo];
                encouragement = sound.phrase(key);
            } else {
                active.misses = (active.misses || 0) + 1;
                if (active.misses === 1 || active.misses % 3 === 0) encouragement = sound.phrase(active.misses === 1 ? 'encourage' : 'encourage-again');
            }
        }
        const flow = KukuRecitation.create({
            text: fullRead(question),
            repeatOnly,
            encouragement: s.settings.voice ? encouragement : null,
            silent: !sound.canSpeak(),
            say: sound.speak,
            stop: sound.cancelSpeech,
            onStep(name, label) {
                if (session !== active || session.q !== question) return;
                $('game').dataset.recitation = name;
                if (!repeatOnly) fx.lessonStep(name);
                $('feedback').textContent = repeatOnly && active.status ? active.status : label;
            },
            onDone() {
                if (session !== active || active.paused || active.recitation !== flow) return;
                active.recitation = null;
                journey.event({ type: 'recite', review: !intro && active.review });
                if (intro) active.plan.dan === 1 ? startCopy() : advanceIntro();
                // After a miss, let the child say it and move on with a tap instead of racing to the next question.
                else if (!repeatOnly) waitForNext();
                else { active.index++; next(); }
            }
        });
        active.recitation = flow;
        flow.start();
    }
    function startCopy() {
        // Tutorial: type the fact that was just heard, so the first answers practise the keys, not unheard facts.
        if (!session || session.phase !== 'intro' || session.paused || session.recitation)
            return;
        Object.assign(session, { copy: true, hinted: true, phase: 'question', input: '', questionMs: 0, extended: false, lockMs: INPUT_GUARD_MS });
        $('answer').textContent = '?';
        $('reading').textContent = session.q.q_read;
        $('feedback').textContent = 'きいた こたえを おしてみよう';
        $('reveal').textContent = 'こたえを きく';
        $('input-controls').hidden = false;
        $('intro-guide').hidden = true;
        delete $('game').dataset.recitation;
        hideDots();
        setKeys(false);
        sound.effect('ready');
    }
    function advanceIntro() {
        if (!session || session.phase !== 'intro' || session.paused || session.recitation)
            return;
        session.responses.push({ a: session.q.a, b: session.q.b, ok: null, kind: 'listen', given: null });
        L.submit(s, session.q, false, Date.now(), session.questionMs, 'intro');
        session.recent.push(L.key(session.q.a, session.q.b));
        session.index++;
        save();
        sound.cancelSpeech();
        next();
    }
    function finish() {
        if (!session || session.phase === 'done')
            return;
        if (session.plan.kind === 'intro' && session.index === 9)
            L.finishIntro(s, session.plan.dan);
        if (session.plan.kind === 'ordered' && session.index === 9 && !s.ordered.includes(session.plan.dan))
            s.ordered.push(session.plan.dan);
        if (session.index)
            L.daily(s, L.day()).games++;
        const complete = session.index === session.plan.count, intro = session.plan.kind === 'intro';
        const perfect = complete && !intro && session.correct === session.plan.count;
        if (complete) journey.event({ type: 'finish' });
        const record = session.plan.kind === 'challenge' ? R.recordRun(s, session.plan.courseId, session.answers, L.day(), session.pace) : null;
        R.finishMix(s, session.plan, session.answers);
        journey.result(session, record);
        const course = R.course(session.plan.courseId);
        const passed = !!(complete && course?.pass && session.correct >= course.pass);
        answerPage = 0;
        $('result-title').textContent = passed ? 'クリア！' : !complete ? 'きょうは OK！' : intro ? 'はなまる！' : perfect ? 'ぜんもん せいかい！' : session.correct * 2 >= session.plan.count ? 'はなまる！' : 'もう すこし！';
        $('result-main').textContent = complete ? intro ? `${session.plan.dan}のだんで あそべたね！` : `${session.index}もん がんばったね！` : 'おさらいは また あした';
        $('result-detail').textContent = complete ? intro ? 'つぎは こたえを おもいだしてみよう。' : selfCorrectLine(session) : 'じぶんで えらんで あそぶことも できるよ。';
        const c = session.changes;
        $('result-changes').replaceChildren();
        for (const [count, label] of [[session.quick, 'もん すぐ いえた！'], [c.ready, 'もん きょうの かくにん OK'], [c.reviewed, 'もん 日を あけても できた！'], [c.mastered, 'もん しっかり おぼえた！']]) {
            if (count) {
                const p = document.createElement('p');
                p.textContent = count + label;
                $('result-changes').append(p);
            }
        }
        const open = R.cleared(s);
        $('result-dan-progress').textContent = course?.test ? passed ? `★ ${course.count}もん テスト、クリア！` : `${course.pass}もん せいかいで クリア。まぜて おさらいしよう！` : session.plan.courseId?.startsWith('dan-') && passed ? `${session.plan.dans[0]}のだん クリア！ ほかの だんと まぜられるよ。` : `${open.length} / 8だん クリア ・ まぜて ${s.rewards.trail.mixed.length} / 72しゅるい できた`;
        $('result-next-dan').hidden = !s.tutorial;
        $('result-next-dan').textContent = 'だんを えらぶ →';
        const dayMs = L.daily(s, L.day()).ms;
        $('result-time').textContent = `このかい ${Math.round(session.elapsed / 1000)}びょう ・ きょう ${Math.floor(dayMs / 60000)}ふん`;
        const enough = dayMs >= 600000;
        $('continue').textContent = enough ? 'きょうは おしまい →' : session.plan.kind === 'challenge' ? 'だんを えらぶ →' : session.plan.kind === 'mix' ? (R.plan(s).next ? 'つぎの だんへ →' : 'つぎの 10もん →') : 'つぎの れんしゅう →';
        $('finish').textContent = enough ? 'もうすこし あそぶ' : 'きょうは おしまい';
        $('continue').dataset.finish = String(enough);
        // A perfect round keeps its own heading; reaching ten minutes is told by the buttons and the message instead.
        if (enough && !passed && !perfect)
            $('result-title').textContent = 'きょうも がんばったね！';
        session.phase = 'done';
        save();
        show('result');
        fx.setEnergy(1);
        if (complete) {
            fx.burst(true);
            sound.effect('finish');
            sound.message(course?.test && passed ? 'final-clear' : passed ? 'clear' : perfect ? 'perfect' : enough ? 'daily-finish' :
                intro ? 'intro-finish' : 'finish');
        }
    }
    // Hinted answers are neither 'by yourself' nor wrong, so count them apart from the misses.
    function selfCorrectLine(round) {
        const hinted = round.answers.filter(a => a.reason === 'hint').length;
        return `じぶんで できた ${round.correct} / ${round.index}もん` + (hinted ? `（ヒントで ${hinted}もん）` : '');
    }
    function renderAnswers() {
        const view = KukuResults.page(session?.responses || [], answerPage);
        answerPage = view.index;
        $('answer-list').replaceChildren();
        for (const item of view.rows) {
            const row = document.createElement('li');row.className = 'answer-row ' + item.state;
            const number = document.createElement('span');number.className = 'answer-number';number.textContent = item.number;
            const content = document.createElement('div'), equation = document.createElement('strong'), note = document.createElement('small');
            equation.textContent = item.equation;note.textContent = item.note;content.append(equation, note);
            const mark = document.createElement('span');mark.className = 'answer-mark';mark.textContent = item.mark;
            mark.setAttribute('aria-label', item.state === 'correct' ? 'せいかい' : item.state === 'listen' ? 'きいたよ' : item.state === 'hint' ? 'ヒントで できた' : 'もういちど');
            row.append(number, content, mark);$('answer-list').append(row);
        }
        $('answers-page').textContent = view.total ? `${view.start + 1}〜${view.end} / ${view.total}もん` : 'もんだいは ないよ';
        $('answers-prev').disabled = view.index === 0;
        $('answers-next').disabled = view.index + 1 >= view.pages;
    }
    $('answers-prev').onclick = () => { answerPage--;renderAnswers(); };
    $('answers-next').onclick = () => { answerPage++;renderAnswers(); };
    function follow() {
        const p = session?.plan;
        if (p?.kind === 'challenge') { show('route'); return; }
        if (p?.kind === 'mix') { const nextPlan = R.plan(s); start(nextPlan.next ? nextPlan : R.mixPlan(s, p.dans)); return; }
        if (p?.kind === 'manual')
            start(p);
        else {
            const nextPlan = R.plan(s);
            start(nextPlan);
        }
    }
    function tick() {
        const now = performance.now(), dt = Math.max(0, Math.min(now - lastTick, 300));
        lastTick = now;
        if (screen !== 'game' || !session || session.paused || session.phase === 'loading' || document.hidden)
            return;
        session.elapsed += dt;
        L.daily(s, L.day()).ms += dt;
        if (session.phase === 'question' && session.lockMs > 0) {
            // The answer clock starts when the keys come alive.
            session.lockMs -= dt;
            if (session.lockMs <= 0) { session.lockMs = 0; setKeys(true); }
            return;
        }
        session.questionMs += dt;
        session.phaseMs += dt;
        if (session.recitation) { session.recitation.tick(dt); return; }
        if (session.phase === 'question' && session.questionMs >= (session.extended ? session.deadline : L.answerTime(session.pace)))
            answer(true, 'timeout');
    }
    function pause() {
        if (screen !== 'game' || !session || session.paused)
            return;
        session.paused = true;
        fx.setPaused(true);
        session.recitation?.pause();
        sound.stop();
        sound.cancelSpeech();
        save();
        $('pause-dialog').showModal();
    }
    function resume() {
        if (!session)
            return;
        $('pause-dialog').close();
        session.paused = false;
        fx.setPaused(false);
        lastTick = performance.now();
        if (session.phase === 'loading') { beginRound(session); return; }
        sound.start();
        session.recitation?.resume();
    }
    function home() {
        if (screen === 'game') {
            pause();
            return;
        }
        session = null;
        show('home');
    }
    function renderManual() {
        if (screen === 'manual') sound.warm(voiceBanks({ kind: 'manual', dans: [...selected] }));
        $('dan-buttons').replaceChildren();
        for (let a = 1; a <= 9; a++) {
            const b = document.createElement('button');
            b.textContent = `${a}のだん`;
            b.setAttribute('aria-pressed', String(selected.has(a)));
            b.onclick = () => { selected.has(a) ? selected.delete(a) : selected.add(a); renderManual(); };
            $('dan-buttons').append(b);
        }
        $('manual-summary').textContent = selected.size ? [...selected].sort().join('・') + 'のだんを まぜて れんしゅう' : 'だんを えらんでね。';
        $('manual-start').disabled = !selected.size;
        $('manual-focus').hidden = selected.size !== 1 || selected.has(1) || !s.tutorial;
        if (selected.size === 1)
            $('manual-focus').textContent = `${[...selected][0]}のだんを おすすめに する →`;
    }
    function makeGrid(id, render, firstRow = 1) {
        const grid = $(id);
        grid.replaceChildren();
        for (let a = 0; a <= 9; a++)
            for (let b = 0; b <= 9; b++) {
                if (a > 0 && a < firstRow) continue;
                if (!a || !b) {
                    const label = document.createElement('span');
                    label.className = 'axis';
                    label.textContent = !a && !b ? '×' : String(a || b);
                    grid.append(label);
                }
                else {
                    const button = document.createElement('button');
                    render(button, a, b);
                    grid.append(button);
                }
            }
    }
    const MAP_DETAIL_PROMPT = 'マスを おすと、きろくが 見られるよ。';
    function renderMap() {
        $('map-count').textContent = `しっかり おぼえた ${L.countMastered(s)} / 72もん`;
        $('map').classList.remove('picked');
        $('map-detail').textContent = MAP_DETAIL_PROMPT;
        makeGrid('map-grid', (button, a, b) => {
            const r = s.problems[L.key(a, b)], status = L.status(r), stars = L.mapStars(r);
            const review = stars > 0 && (r?.repair || !r?.stage || L.isDue(r, Date.now()));
            button.className = `star-cell stars-${stars}` + (!r?.attempts ? ' untouched' : '') + (review ? ' needs-review' : '');
            button.innerHTML = '<svg viewBox="0 0 36 26" aria-hidden="true">' + [0,1,2].map((i) => `<path class="${i < stars ? 'filled' : ''}" transform="translate(${i*12} ${i === 1 ? 0 : 7})" d="M6 1 7.5 4.5 11 5 8.5 7.5 9 11 6 9.3 3 11 3.5 7.5 1 5 4.5 4.5Z"/>`).join('') + '</svg>';
            button.setAttribute('aria-label', `${a}かける${b}、ほし ${stars}こ、${names[status]}${review ? '、おさらいしよう' : ''}`);
            button.onclick = () => {
                $('map').classList.add('picked');
                $('map-detail').textContent = `${a} × ${b} = ${a * b}　ほし ${stars}こ。${names[status]}。` +
                    (review ? ' おさらいしよう！' : '') + (r ? ` じぶんで できた ${r.correct}かい。` : '') + ' ' + L.nextStep(r);
            };
        }, 2);
    }

    function renderTable() {
        sound.warm(['messages', 'dan-' + $('table-dan').value]);
        $('table-list').replaceChildren();
        const a = Number($('table-dan').value);
        for (let b = 1; b <= 9; b++) {
            const q = data.get(L.key(a, b)), button = document.createElement('button'), formula = document.createElement('strong'), reading = document.createElement('small');
            formula.textContent = `${a} × ${b} = ${a * b}`;
            reading.textContent = q.q_read + q.a_read;
            button.append(formula, reading);
            button.onclick = () => sound.speak(fullRead(q));
            $('table-list').append(button);
        }
    }
    let updatesPage = 0;
    // Two notes per page keep the list readable on a phone without scrolling.
    const updatePages = KukuVersion.notes.flatMap(note => Array.from({ length: Math.ceil(note.items.length / 2) }, (_, i) => ({ ...note, items: note.items.slice(i * 2, i * 2 + 2) })));
    function renderUpdates() {
        updatesPage = Math.max(0, Math.min(updatePages.length - 1, updatesPage));
        const note = updatePages[updatesPage];
        $('updates-version').textContent = `バージョン ${note.version}`;
        $('updates-date').textContent = note.date.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1年$2月$3日');
        $('updates-list').replaceChildren(...note.items.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
        $('updates-page').textContent = `${updatesPage + 1} / ${updatePages.length}`;
        $('updates-newer').disabled = updatesPage === 0;
        $('updates-older').disabled = updatesPage + 1 >= updatePages.length;
    }
    $('updates-newer').onclick = () => { updatesPage--; renderUpdates(); };
    $('updates-older').onclick = () => { updatesPage++; renderUpdates(); };
    $('app-version').textContent = `バージョン ${KukuVersion.version}`;
    function renderSettings() {
        $('setting-pace').value = s.settings.pace;
        $('setting-sound').checked = s.settings.sound;
        $('setting-voice').checked = s.settings.voice;
        $('setting-volume').value = s.settings.volume * 100;
        $('setting-motion').value = s.settings.motion * 100;
    }
    document.querySelectorAll('[data-manual-page]').forEach(button => button.onclick = () => {
        const range = button.dataset.manualPage === 'range';
        $('manual-range').hidden = !range;
        $('dan-buttons').hidden = range;
        document.querySelectorAll('[data-manual-page]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    });
    function updateRoundPace() {
        if (!pendingPlan) return;
        const pace = L.roundPace(s, pendingPlan, $('round-pace').value);
        $('round-pace-preview').textContent = 'こんかいは ' + L.paceLabel(pace);
        $('round-pace-note').textContent = paceNote($('round-pace').value, pace);
    }
    function paceNote(choice, pace) {
        if (choice !== 'auto') return 'この 1かいは、えらんだ じかんで あそぶよ。';
        // おまかせ stays unlimited while the child counts up; say so, or it looks as if the time never moves on.
        if (pace === 'first') return 'はじめての 九九や、かぞえて こたえて いる あいだは じかん なし。はやく いえる ように なると、みじかく なるよ。';
        return 'これまでの せいかいと、こたえるのに かかった じかんに あわせたよ。';
    }
    $('round-pace').onchange = updateRoundPace;
    $('round-go').onclick = () => {
        if (!pendingPlan) return;
        const p = pendingPlan, pace = L.roundPace(s, p, $('round-pace').value);
        pendingPlan = null;$('round-setup').close();start(p, pace);
    };
    $('round-cancel').onclick = () => { pendingPlan = null;$('round-setup').close(); };
    $('round-setup').addEventListener('cancel', () => { pendingPlan = null; });
    $('map-tutorial').onclick = () => start({kind:'intro',dan:1,count:9});
    $('auto-start').onclick = () => start(R.plan(s));
    let greetings = 0;
    $('mascot-home').onclick = () => sound.message(greetings++ ? 'home-help' : L.daily(s, L.day()).ms ? 'welcome-back' : 'welcome');
    $('voice-retry').onclick = () => { if (session?.phase === 'loading') prepareRound(session); };
    $('voice-skip').onclick = () => { if (session?.phase === 'loading') { session.voiceReady = true; beginRound(session); } };
    $('brand').onclick = e => { e.preventDefault(); home(); };
    document.querySelectorAll('.back:not([data-open])').forEach(b => b.onclick = () => { const target = backTargets[screen] || 'home'; delete backTargets[screen]; show(target, true); });
    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => show(b.dataset.open, b.classList.contains('back')));
    $('sound').onclick = () => {
        s.settings.sound = !s.settings.sound;
        sound.update();
        if (screen === 'game' && !session.paused) {
            s.settings.sound ? sound.start() : sound.stop();
        }
        else if (s.settings.sound)
            sound.effect('key');
        syncSound();
        save();
    };
    document.querySelectorAll('[data-digit]').forEach(b => b.onclick = () => digit(b.dataset.digit));
    $('erase').onclick = () => {
        if (session?.phase === 'question' && !session.paused) {
            session.input = session.input.slice(0, -1);
            $('answer').textContent = session.input || '?';
        }
    };
    $('enter').onclick = () => answer(false);
    $('reveal').onclick = help;

    $('pause').onclick = pause;
    $('resume').onclick = resume;
    $('pause-dialog').addEventListener('cancel', e => { e.preventDefault(); resume(); });
    $('quit').onclick = () => { $('pause-dialog').close(); session?.recitation?.cancel(); session = null; save(); show('home'); };
    $('continue').onclick = () => { $('continue').dataset.finish === 'true' ? home() : follow(); };
    $('finish').onclick = () => { if ($('continue').dataset.finish === 'true') follow(); else { home(); sound.message('goodbye'); } };
    function moveFocus(a) { if (L.chooseDan(s, a)) {
        save();
        show('home');
    } }
    $('next-dan').onclick = () => show('route');
    $('result-next-dan').onclick = () => { show('route'); document.querySelector('[data-route-page="rows"]').click(); };
    $('manual-focus').onclick = () => moveFocus([...selected][0]);
    $('manual-start').onclick = () => {
        if (selected.size)
            start({ kind: 'manual', dans: [...selected], count: 10 });
    };
    for (const id of ['range-from', 'range-to', 'table-dan'])
        for (let a = 1; a <= 9; a++) {
            const o = document.createElement('option');
            o.value = a;
            o.textContent = a + 'のだん';
            $(id).append(o);
        }
    $('range-from').value = 2;
    $('range-to').value = 5;
    $('table-dan').value = 2;
    $('range-apply').onclick = () => { const lo = Math.min(+$('range-from').value, +$('range-to').value), hi = Math.max(+$('range-from').value, +$('range-to').value); selected = new Set(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)); renderManual(); };
    makeGrid('problem-picker', (b, a, n) => { const id = L.key(a, n); b.textContent = a * n; b.setAttribute('aria-label', `${a}かける${n}`); b.setAttribute('aria-pressed', 'false'); b.onclick = () => { custom.has(id) ? custom.delete(id) : custom.add(id); b.setAttribute('aria-pressed', String(custom.has(id))); $('custom-start').disabled = !custom.size; }; });
    $('custom-start').onclick = () => {
        if (custom.size)
            start({ kind: 'manual', keys: [...custom], count: 10 });
    };
    if (window.KukuDiagnostics) window.addEventListener('kuku:diagnostic-start', () => {
        start({ kind: 'challenge', courseId: 'dan-4', title: '4のだん', dans: [4], count: 9,
            queue: [9, 1, 7, 2, 4, 8, 6, 3, 5].map(b => ({ a: 4, b })) });
    });
    $('table-dan').onchange = renderTable;
    for (const name of ['sound', 'voice', 'volume', 'motion'])
        $('setting-' + name).addEventListener('input', e => {
            s.settings[name] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value) / 100;
            sound.update();
            syncSound();
            save();
            if (name === 'motion')
                fx.burst();
            if (name === 'voice' && s.settings.voice) sound.message('voice-on');
        });
    $('setting-pace').onchange = () => { s.settings.pace = $('setting-pace').value; save(); };
    $('tutorial-replay').onclick = () => start({ kind: 'intro', dan: 1, count: 9 });
    document.addEventListener('keydown', e => {
        if (screen !== 'game')
            return;
        if (e.key === 'Escape') {
            e.preventDefault();
            session?.paused ? resume() : pause();
            return;
        }
        if (session?.paused || e.ctrlKey || e.metaKey || e.altKey)
            return;
        if (/^\d$/.test(e.key)) {
            e.preventDefault();
            digit(e.key);
        }
        if (e.key === 'Backspace') {
            e.preventDefault();
            $('erase').click();
        }
        if (e.key === 'Enter' && !['BUTTON', 'INPUT', 'SELECT'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            if (session?.phase === 'wait') proceed(); else answer(false);
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pause();
            sound.stop();
            sound.cancelSpeech();
            save();
        }
        lastTick = performance.now();
    });
    window.addEventListener('pagehide', () => { sound.stop(); sound.cancelSpeech(); save(); });
    setInterval(tick, 50);
    setInterval(() => {
        if (screen === 'game' && !session?.paused)
            save(true);
    }, 5000);
    renderManual();
    fx.setScene('home');
    renderHome();
    $('storage-warning').hidden = store.available;
})();
