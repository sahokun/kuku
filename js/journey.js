window.KukuJourney = (() => {
    const $ = id => document.getElementById(id), R = KukuRewards, L = KukuLearning;
    function create({ state: s, start, show, save }) {
        let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1), toastTimer, coursePage = 'rows';
        function toast(text) {
            clearTimeout(toastTimer);$('reward-toast').textContent = text;$('reward-toast').hidden = false;
            toastTimer = setTimeout(() => $('reward-toast').hidden = true, 2400);
        }
        function event(ev, date = L.day()) {
            const result = R.event(s, date, ev);
            if (result.sealed) toast('✿ きょうの めあて、ぜんぶ できた！');
            else if (result.earned.length) toast('✓ めあてが ひとつ できたよ！');
            return result;
        }
        function startCourse(id) {
            const c = R.course(id);if (!R.available(s, c)) return;
            start({ kind: 'challenge', courseId: id, title: c.title, dans: c.dans, count: c.count, queue: R.questions(c) });
        }
        function startMission(id) {
            const d = R.ensureDay(s);
            if (id === 'review' && d.reviewKeys.length) start({ kind: 'manual', keys: d.reviewKeys, count: 10 });
            else start(R.plan(s));
        }
        function home() {
            const list = R.missions(s);$('home-missions').replaceChildren();
            $('mission-count').textContent = `${list.filter(m => m.done).length} / ${list.length}`;
            for (const m of list) {
                const button = document.createElement('button');button.className = 'mission' + (m.done ? ' done' : '');
                const mark = document.createElement('span'), text = document.createElement('span'), value = document.createElement('strong');
                mark.textContent = m.done ? '✓' : '○';text.textContent = m.text;value.textContent = `${Math.min(m.goal, m.value)} / ${m.goal}`;
                button.append(mark, text, value);button.disabled = m.done;button.onclick = () => startMission(m.id);$('home-missions').append(button);
            }
            $('mission-reward').textContent = R.ensureDay(s).seal ? '✿ カレンダーに はなが さいたよ！' : `${list.length}つ できたら、カレンダーに はなが さくよ。`;
        }
        function route() {
            const open = R.cleared(s), chosen = R.selected(s), trail = s.rewards.trail;
            $('route-list').replaceChildren();
            $('route-tutorial').textContent = s.tutorial ? '♧ あそびかた・1のだんを もういちど' : '♧ はじめに あそびかたを おぼえよう';
            $('route-tutorial').onclick = () => start({kind:'intro',dan:1,count:9});
            for (let dan = 2; dan <= 9; dan++) {
                const r = R.route(s, dan), done = open.includes(dan);
                const card = document.createElement('article');card.className = `route-node${done ? ' cleared' : ''}${r.mastered === 9 && !r.repair ? ' mastered' : ''}`;card.dataset.dan = dan;
                const heading = document.createElement('h3');heading.textContent = `${dan}のだん`;
                const status = document.createElement('strong');status.className = 'route-badge';status.textContent = done ? '✓ クリア！' : !r.introduced ? 'きいて おぼえる' : !r.ordered ? 'じゅんばんに 9もん' : 'ばらばらで 9もん';
                const stars = document.createElement('p');stars.textContent = `★ ${r.mastered} / 9${r.repair ? ' ・ おさらいしよう' : ''}`;
                const button = document.createElement('button');button.dataset.rowStart = dan;button.textContent = done ? 'もういちど 9もん' : 'この だんで あそぶ →';
                button.onclick = () => { L.chooseDan(s, dan);save();start(R.rowPlan(s, dan)); };
                card.append(heading,status,stars,button);$('route-list').append(card);
            }
            $('route-cleared').textContent = `${open.length} / 8だん クリア`;
            $('mix-choices').replaceChildren();
            for (let dan = 2; dan <= 9; dan++) {
                const b = document.createElement('button');b.textContent = `${dan}のだん`;b.dataset.mixDan = dan;b.disabled = !open.includes(dan);b.setAttribute('aria-pressed', String(chosen.includes(dan)));
                b.onclick = () => { const next = new Set(chosen);next.has(dan) ? next.delete(dan) : next.add(dan);trail.selected = [...next];if (!trail.selected.length) trail.selected = [dan];save();route(); };
                $('mix-choices').append(b);
            }
            $('mix-all').disabled = open.length < 2;
            $('mix-all').onclick = () => { trail.selected = [...open];save();route(); };
            $('mix-start').disabled = chosen.length < 2;
            $('mix-start').onclick = () => { const p = R.mixPlan(s);if (p) start(p); };
            const covered = trail.mixed.filter(id => chosen.includes(Number(id[0]))).length;
            $('mix-help').textContent = open.length < 2 ? 'すきな 2つの だんを クリアすると、まぜられるよ。' : chosen.length < 2 ? 'まぜたい だんを 2つ いじょう えらぼう。' : `${chosen.join('・')}のだんを まぜて 10もん！`;
            $('mix-progress').max = Math.max(1,chosen.length*9);$('mix-progress').value = covered;
            $('mix-count').textContent = `えらんだ だん：${covered} / ${chosen.length*9}しゅるい できた`;
            $('mix-rounds').textContent = `${trail.rounds}かい 10もんを あそんだよ`;
            const stamps = $('mix-stamps');stamps.replaceChildren();
            for (let i = 0; i < 10; i++) { const dot = document.createElement('span');dot.textContent = i < trail.rounds % 10 || trail.rounds > 0 && trail.rounds % 10 === 0 ? '✿' : '○';stamps.append(dot); }
            const ready = R.finalReady(s);
            $('final-status').textContent = ready ? 'すきな テストに ちょうせん！' : `だんの クリア ${open.length}/8 ・ まぜて ${trail.mixed.length}/72しゅるい`;
            $('test-unlock').hidden = ready;
            for (const [id, buttonId, statusId, passed] of [['final', 'final-start', 'final-record', trail.passed], ['all-81', 'all-start', 'all-record', trail.passedAll]]) {
                const best = s.rewards.bests[id];
                $(buttonId).disabled = !ready;
                $(buttonId).onclick = () => startCourse(id);
                $(statusId).textContent = passed ? '✓ クリア！' + (best ? ` ベスト ${best.score.toLocaleString()}` : '') : best ? `ベスト ${best.correct}/${best.count}もん ・ ${best.score.toLocaleString()}てん` : ready ? 'ちょうせんする ▶' : 'まだ じゅんびちゅう';
            }
        }
        document.querySelectorAll('[data-route-page]').forEach(button => button.onclick = () => {
            document.querySelectorAll('[data-route-page]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
            for (const page of ['rows', 'mix', 'final']) $('route-' + page).hidden = page !== button.dataset.routePage;
            if (button.dataset.routePage === 'mix') KukuSound.message('mix');
        });
        document.querySelectorAll('[data-course-page]').forEach(button => button.onclick = () => {
            coursePage = button.dataset.coursePage;
            document.querySelectorAll('[data-course-page]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
            challenges();
        });
        function challenges() {
            $('challenge-list').replaceChildren();
            for (const c of R.courses) {
                const button = document.createElement('button'), best = s.rewards.bests[c.id], open = R.available(s, c);
                button.className = 'challenge-course';button.disabled = !open;button.dataset.course = c.id;button.hidden = coursePage === 'rows' ? !c.id.startsWith('dan-') : c.id.startsWith('dan-');
                const title = document.createElement('strong'), record = document.createElement('span'), note = document.createElement('small');
                title.textContent = c.title;record.textContent = best ? `ベスト ${best.score.toLocaleString()}てん` : open ? 'はじめの きろくを つくろう！' : c.test ? 'だんを クリアして ひらこう' : 'じゅんばんの あとで あそぼう';
                note.textContent = `${c.count}もん${c.test ? ` ・ ${c.pass}もんで クリア` : ''}${best ? ` ・ ${best.correct}/${best.count}もん ・ ${L.paceLabel(best.pace)}` : ''}`;
                button.append(title, record, note);button.onclick = () => startCourse(c.id);$('challenge-list').append(button);
            }
        }
        function calendar() {
            R.syncCalendar(s);
            const now = new Date(), current = new Date(now.getFullYear(), now.getMonth(), 1);
            if (month > current) month = current;
            const year = month.getFullYear(), m = month.getMonth();
            const oldest = Object.keys(s.rewards.days).sort()[0] || L.day();
            $('calendar-month').textContent = `${year}年 ${m + 1}月`;
            $('calendar-next').disabled = month.getTime() >= current.getTime();
            $('calendar-prev').disabled = L.day(month.getTime()).slice(0, 7) <= oldest.slice(0, 7);
            const grid = $('calendar-grid');grid.replaceChildren();
            for (let i = 0; i < month.getDay(); i++) grid.append(document.createElement('span'));
            for (const d of R.calendar(s, year, m)) {
                const b = document.createElement('button');b.className = (d.seal ? 'sealed' : d.played ? 'played' : '') + (d.date === L.day() ? ' today' : '');
                b.disabled = d.date > L.day();b.dataset.date = d.date;b.setAttribute('aria-label', `${d.number}日、${d.seal ? 'めあて ぜんぶ できた' : d.played ? 'あそんだ日' : 'きろくなし'}`);
                const number = document.createElement('span'), mark = document.createElement('strong');number.textContent = d.number;mark.textContent = d.seal ? '✿' : d.played ? '●' : '·';b.append(number, mark);
                b.onclick = () => { $('calendar-detail').textContent = `${m + 1}月${d.number}日：${d.played ? `${Math.floor(d.ms / 60000)}ふん ${Math.round(d.ms / 1000) % 60}びょう・${d.answers}もん・${d.games}かい あそんだよ。${d.seal ? ' めあて、ぜんぶ できた！' : ''}` : 'まだ きろくが ないよ。'}`; };
                grid.append(b);
            }
            $('calendar-detail').textContent = '日を おすと、その日の がんばりが 見られるよ。';
        }
        $('calendar-prev').onclick = () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1);calendar(); };
        $('calendar-next').onclick = () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1);calendar(); };
        function result(session, record) {
            const scored = session.plan.kind !== 'intro' && session.answers.length > 0;
            $('result-score-card').hidden = !scored;
            $('result').classList.toggle('has-score', scored);
            $('result-score-card').classList.toggle('new-best', !!record?.improved);
            $('result-score-label').textContent = record?.improved ? '🏆 ベスト こうしん！' : record?.first ? '🏆 はじめての きろく！' : 'このかいの スコア';
            $('result-score').textContent = `${session.score.toLocaleString()}てん`;
            $('result-score-detail').textContent = `せいかい ${session.correct}もん ＋ はやさ ${session.speedPoints} ＋ れんぞく ${session.chainPoints} ・ ${L.paceLabel(session.pace)}`;
            $('result-comparison').textContent = record?.previous ? record.improved ? `まえの ベストより +${record.current.score - record.previous.score}てん！` : `じぶんの ベスト ${record.best.score.toLocaleString()}てん` : scored && !record ? 'きろくに ちょうせんで、ベストを のこそう。' : '';
            $('challenge-again').hidden = !record;
            $('challenge-again').onclick = () => startCourse(session.plan.courseId);
            const list = R.missions(s);$('result-missions').textContent = `${R.ensureDay(s).seal ? '✿' : '✓'} きょうの めあて ${list.filter(m => m.done).length} / ${list.length}${R.ensureDay(s).seal ? '　はなが さいたよ！' : ''}`;
        }
        return { home, route, challenges, calendar, result, event, startCourse, toast };
    }
    return { create };
})();
