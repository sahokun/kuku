const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/learning.js');
const at = (d = '2026-09-28', h = 12) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime();
const q = { a: 2, b: 3 };
function twice(s, t = at()) { L.submit(s, q, true, t, 1000); s.serial += 5; return L.submit(s, q, true, t + 31000, 1000); }
test('a single answer or immediate repeat cannot mark a problem ready', () => { const s = L.fresh(); assert.equal(L.submit(s, q, true, at(), 1000), 'first'); assert.equal(L.submit(s, q, true, at() + 1000, 1000), 'practice'); assert.equal(L.record(s, q).stage, 0); });
test('both five intervening attempts and thirty seconds are required', () => { const s = L.fresh(); L.submit(s, q, true, at(), 1000); s.serial += 5; assert.equal(L.submit(s, q, true, at() + 29000, 1000), 'practice'); s.serial += 5; assert.equal(L.submit(s, q, true, at() + 60000, 1000), 'ready'); assert.equal(L.record(s, q).due, '2026-09-29'); });
test('elapsed time alone cannot replace intervening questions', () => { const s = L.fresh(); L.submit(s, q, true, at(), 1000); assert.equal(L.submit(s, q, true, at() + 60000, 1000), 'practice'); });
test('one correct yesterday does not combine with one today', () => { const s = L.fresh(); L.submit(s, q, true, at(), 1000); s.serial += 5; assert.equal(L.submit(s, q, true, at('2026-09-29'), 1000), 'first'); });
test('date-spaced 1/3/7 day checks are required for a star', () => { const s = L.fresh(); assert.equal(twice(s), 'ready'); s.serial += 5; assert.equal(L.submit(s, q, true, at('2026-09-29'), 1000), 'reviewed'); assert.equal(L.record(s, q).due, '2026-10-02'); s.serial += 5; assert.equal(L.submit(s, q, true, at('2026-09-30'), 1000), 'practice'); assert.equal(L.countMastered(s), 0); s.serial += 5; L.submit(s, q, true, at('2026-10-02'), 1000); assert.equal(L.record(s, q).due, '2026-10-09'); s.serial += 5; assert.equal(L.submit(s, q, true, at('2026-10-09'), 1000), 'mastered'); assert.equal(L.countMastered(s), 1); });
test('wrong answers restart same-day learning and retain historical star', () => { const s = L.fresh(); twice(s); const r = L.record(s, q); r.mastered = true; r.stage = 4; L.submit(s, q, false, at() + 40000, 5000); assert.equal(r.hits, 0); assert.equal(r.stage, 0); assert.equal(r.mastered, true); assert.equal(r.repair, true); assert.equal(L.countMastered(s), 0); assert.equal(L.submit(s, q, true, at() + 41000, 1000), 'practice'); });
test('introductory exposure cannot earn credit', () => { const s = L.fresh(); L.submit(s, q, true, at(), 1000, 'intro'); assert.equal(L.record(s, q).stage, 0); assert.equal(L.record(s, q).hits, 0); });
test('tutorial then ascending introductions, next dan does not wait for long-term mastery', () => {
    const s = L.fresh();
    assert.equal(L.plan(s).dan, 1);
    L.finishIntro(s, 1);
    assert.deepEqual(L.plan(s), { kind: 'intro', dan: 2, count: 9, title: '2のだんを きこう' });
    L.finishIntro(s, 2);
    assert.equal(L.plan(s).kind, 'ordered');
    s.ordered.push(2);
    assert.equal(L.plan(s).kind, 'auto');
    for (let b = 1; b <= 9; b++)
        L.record(s, { a: 2, b }).everReady = true;
    assert.equal(L.plan(s).dan, 3);
    assert.equal(L.plan(s).kind, 'intro');
});
test('auto excludes tutorial and future reviews, manual preserves exact selections', () => {
    const s = L.fresh();
    s.tutorial = true;
    s.introduced = [2];
    for (let b = 1; b <= 9; b++)
        L.record(s, { a: 2, b }).due = '2026-09-29';
    assert.equal(L.pick(s, { kind: 'auto', dan: 2 }, [], at()), null);
    assert.deepEqual(L.pick(s, { kind: 'manual', dans: [1] }, [], at(), () => 0), { a: 1, b: 1 });
    assert.deepEqual(L.pick(s, { kind: 'manual', keys: ['7x8'] }, [], at()), { a: 7, b: 8 });
});
test('mixing selects overdue earlier dan without introducing unseen dan', () => { const s = L.fresh(); s.tutorial = true; s.introduced = [2, 3]; assert.equal(L.pick(s, { kind: 'auto', dan: 3 }, [], at()).a, 3); assert.equal(L.pick(s, { kind: 'auto', dan: 3 }, ['3x1', '3x2'], at()).a, 2); });
test('a date crossing midnight uses calendar dates', () => { assert.equal(L.plusDays('2026-12-31', 1), '2027-01-01'); assert.equal(L.plusDays('2028-02-28', 1), '2028-02-29'); });
test('restoration validates malformed records and preserves bounded history', () => { const s = L.restore({ version: 1, serial: -3, introduced: [2, 2, 99], problems: { '2x3': { stage: 99, hits: -2, history: [null, {}, { at: at(), ok: true }] } }, settings: { motion: 99 }, days: { oops: { ms: 50 } } }); assert.equal(s.serial, 0); assert.deepEqual(s.introduced, [2]); assert.equal(s.problems['2x3'].stage, 0); assert.equal(s.problems['2x3'].history.length, 1); assert.equal(s.settings.motion, 1); assert.deepEqual(s.days, {}); assert.deepEqual(L.restore({ version: 999 }), L.fresh()); });
test('completed same-day learning persists after storage roundtrip', () => { const s = L.fresh(); twice(s); const copy = L.restore(JSON.parse(JSON.stringify(s))); assert.equal(copy.problems['2x3'].stage, 1); assert.equal(copy.problems['2x3'].due, '2026-09-29'); });
test('automatic practice can finish a whole dan without getting stuck on the last two problems', () => {
    const s = L.fresh();
    s.tutorial = true;
    s.introduced = [2];
    let now = at();
    const recent = [];
    for (let i = 0; i < 150; i++) {
        const p = L.pick(s, { kind: 'auto', dan: 2 }, recent, now, () => .5);
        if (!p)
            break;
        L.submit(s, p, true, now, 2000);
        recent.push(L.key(p.a, p.b));
        now += 2400;
    }
    for (let b = 1; b <= 9; b++)
        assert.equal(s.problems[L.key(2, b)]?.everReady, true, `2x${b}`);
});
test('a recent practice answer restarts the spacing interval', () => {
    const s = L.fresh();
    L.submit(s, q, true, at(), 1000);
    s.serial += 5;
    L.submit(s, q, true, at() + 20000, 1000);
    s.serial += 5;
    assert.equal(L.submit(s, q, true, at() + 31000, 1000), 'practice');
    assert.equal(L.record(s, q).stage, 0);
});
test('ordered practice earns only the first confirmation; random recall is required for the second', () => { const s = L.fresh(); assert.equal(L.submit(s, q, true, at(), 1000, 'ordered'), 'first'); s.serial += 5; assert.equal(L.submit(s, q, true, at() + 31000, 1000, 'ordered'), 'practice'); assert.equal(L.record(s, q).stage, 0); s.serial += 5; assert.equal(L.submit(s, q, true, at() + 62000, 1000, 'random'), 'ready'); });
test('next-day recall is eligible even without five other answers since yesterday', () => { const s = L.fresh(); twice(s); assert.equal(L.submit(s, q, true, at('2026-09-29'), 1000), 'reviewed'); });
test('choosing the next dan changes the recommendation without marking earlier answers learned', () => {
    const s = L.fresh();
    s.tutorial = true;
    s.introduced = [2];
    s.ordered = [2];
    assert.equal(L.chooseDan(s, 3), true);
    assert.equal(L.plan(s).dan, 3);
    assert.equal(L.plan(s).kind, 'intro');
    assert.equal(L.danProgress(s, 2), 0);
    assert.equal(L.countMastered(s), 0);
    assert.equal(L.restore(JSON.parse(JSON.stringify(s))).focusDan, 3);
    L.finishIntro(s, 3);
    s.ordered.push(3);
    assert.equal(L.pick(s, L.plan(s), ['3x1', '3x2'], at()).a, 2);
    assert.equal(L.chooseDan(s, 10), false);
    assert.equal(s.focusDan, 3);
});
test('an explicitly selected dan can be completed while skipped earlier practice remains queued', () => {
    const s = L.fresh();
    s.tutorial = true;
    s.introduced = [2, 3];
    s.ordered = [2, 3];
    s.focusDan = 3;
    for (let b = 1; b <= 9; b++)
        L.record(s, { a: 3, b }).everReady = true;
    assert.equal(L.plan(s).dan, 4);
    assert.equal(L.danProgress(s, 3), 9);
    assert.equal(L.danProgress(s, 2), 0);
});


test('answer pace survives reload and old or invalid settings default to automatic',()=>{
 for(const [pace,ms] of [['first',Infinity],['easy',10000],['normal',5000],['hard',3000],['robot',1500]]) {
  const s=L.fresh();s.settings.pace=pace;
  const restored=L.restore(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.settings.pace,pace);assert.equal(L.answerTime(restored.settings.pace),ms);
 }
 for(const pace of [undefined,'invalid','toString',null]) {
  const s=L.fresh();s.settings.pace=pace;assert.equal(L.restore(s).settings.pace,'auto');
 }
});
test('a late first digit gets a bounded grace period without shortening the original limit',()=>{
 assert.equal(L.answerDeadline('normal',100),5000);assert.equal(L.answerDeadline('normal',4900),6700);
 assert.equal(L.answerDeadline('easy',9900),11700);
 assert.equal(L.answerDeadline('hard',2900),3980);assert.equal(L.answerDeadline('robot',1400),1940);
 assert.equal(L.answerDeadline('first',60000),Infinity);
});

test('automatic pace starts without limits and follows the least familiar question',()=>{
 const s=L.fresh(),p={kind:'manual',keys:['4x7','4x4']};
 assert.equal(s.settings.pace,'auto');assert.equal(L.restore(s).settings.pace,'auto');
 assert.equal(L.roundPace(s,p),'first');
 for(const b of [7,4])L.submit(s,{a:4,b},false,Date.now(),1000,'intro');
 assert.equal(L.roundPace(s,p),'first');
 for(const b of [7,4])L.submit(s,{a:4,b},true,Date.now(),1000);
 assert.equal(L.roundPace(s,p),'easy');
 for(const b of [7,4]){const r=s.problems[L.key(4,b)];r.everReady=true;r.stage=1;}
 assert.equal(L.roundPace(s,p),'normal');
 L.submit(s,{a:4,b:7},false,Date.now(),5000);assert.equal(L.roundPace(s,p),'easy');
 L.submit(s,{a:4,b:7},false,Date.now(),10000);assert.equal(L.roundPace(s,p),'first');
 assert.equal(L.roundPace(s,p,'robot'),'robot');assert.equal(L.roundPace(s,{kind:'intro',dan:4},'robot'),'first');
 assert.equal(L.roundPace(s,{kind:'ordered',dan:9}),'first');
 assert.equal(L.roundPace(s,{kind:'challenge',queue:[{a:4,b:4}]}),'normal');
});
test('map stars grow with spaced progress and survive mistakes and reloads',()=>{
 const s=L.fresh();assert.equal(L.mapStars(),0);
 L.submit(s,q,true,at('2026-09-28'),1000);assert.equal(L.mapStars(L.record(s,q)),0);
 s.serial+=5;L.submit(s,q,true,at('2026-09-28')+31000,1000);assert.equal(L.mapStars(L.record(s,q)),1);
 s.serial+=5;L.submit(s,q,true,at('2026-09-29'),1000);assert.equal(L.mapStars(L.record(s,q)),2);
 L.submit(s,q,false,at('2026-09-29')+1000,1000);assert.equal(L.mapStars(L.record(s,q)),2);
 assert.equal(L.mapStars(L.restore(JSON.parse(JSON.stringify(s))).problems[L.key(q.a,q.b)]),2);
 assert.equal(L.mapStars({mastered:true,repair:true,stage:0}),3);
 assert.equal(L.mapStars({everReady:true,stage:0}),1);
});

test('old default normal pace migrates once; deliberate choices remain available',()=>{
 const old=L.fresh();old.settings.pace='normal';delete old.settings.paceVersion;
 const migrated=L.restore(old);assert.equal(migrated.settings.pace,'auto');
 migrated.settings.pace='normal';assert.equal(L.restore(migrated).settings.pace,'normal');
 old.settings.pace='robot';assert.equal(L.restore(old).settings.pace,'robot');
 assert.equal(L.mapStars({stars:100,stage:100}),0);
});

test('automatic pace follows how long correct answers actually take',()=>{
 const make=ms=>{const s=L.fresh(),now=Date.now();
  for(const b of [1,2,3]){const r=L.record(s,{a:3,b});r.attempts=3;r.everReady=true;r.stage=1;r.history=[{at:now,ok:true,ms,kind:'random'},{at:now,ok:true,ms,kind:'random'}];}
  return s;};
 const p={kind:'manual',keys:['3x1','3x2','3x3']};
 assert.equal(L.roundPace(make(1500),p),'normal');
 assert.equal(L.roundPace(make(4000),p),'easy');
 assert.equal(L.roundPace(make(8000),p),'first');
 const s=make(1500);s.problems['3x3'].history.push({at:Date.now(),ok:true,ms:9000,kind:'random'},{at:Date.now(),ok:true,ms:9000,kind:'random'});
 assert.equal(L.roundPace(s,p),'first','a slow minority above the 80th percentile still needs room');
 assert.equal(L.roundPace(make(8000),p,'normal'),'normal','a hand-picked pace is kept');
});
test('the map explains what earns the next star',()=>{
 const now=new Date('2026-11-16T12:00:00').getTime(),today='2026-11-16';
 assert.match(L.nextStep(undefined,now),/こたえて/);
 const r={attempts:3,correct:2,today,hits:1,stage:0,history:[{at:now,ok:true,ms:3000,kind:'random'}]};
 assert.match(L.nextStep(r,now),/あと 1かい/);
 r.history.push({at:now,ok:false,ms:3000,kind:'random'});r.hits=0;
 assert.match(L.nextStep(r,now),/まちがえた/);assert.match(L.nextStep(r,now),/2かい/);
 Object.assign(r,{stage:1,due:'2026-11-17',stars:1});assert.equal(L.nextStep(r,now),'11月17日から また できたら ★2！');
 r.stars=2;assert.match(L.nextStep(r,now),/つぎの だんかい/);
 Object.assign(r,{stage:3,due:'2026-11-16'});assert.equal(L.nextStep(r,now),'きょう 3びょう いないで できたら ★3！');
 Object.assign(r,{stage:4,mastered:true,repair:false,due:'2026-11-30'});assert.match(L.nextStep(r,now),/ときどき/);
});
test('a hinted correct answer is practice: no self-correct count, no restart, no stage credit, no pace timing',()=>{
 const s=L.fresh(),now=new Date('2026-11-16T12:00:00').getTime(),q={a:3,b:7};
 L.submit(s,q,true,now,2000);
 const before={...s.problems['3x7']};
 assert.equal(L.submit(s,q,true,now+60000,30000,'hint'),'practice');
 const r=s.problems['3x7'];
 assert.equal(r.correct,before.correct);assert.equal(r.stage,before.stage);assert.equal(r.hits,before.hits);
 assert.equal(r.history.at(-1).kind,'hint');
 assert.equal(L.hint(3,7),'3×6＝18。それに 3を たすと？');assert.equal(L.hint(4,1),'4が 1つ。');
});
test('the last two spaced checks must be recalled within three seconds; ★1 and ★2 may be counted out',()=>{
 const s=L.fresh(),q={a:7,b:8},day=d=>new Date(d+'T12:00:00').getTime();
 const t=day('2026-11-16');L.submit(s,q,true,t,6000);s.serial+=5;assert.equal(L.submit(s,q,true,t+31000,6000),'ready');
 assert.equal(L.submit(s,q,true,day('2026-11-17'),8000),'reviewed','★2 can be reached by counting');
 const r=s.problems['7x8'];assert.equal(r.stage,2);assert.equal(L.mapStars(r),2);
 assert.equal(L.submit(s,q,true,day('2026-11-20'),4000),'slow');
 assert.equal(r.stage,2);assert.equal(r.due,'2026-11-20');assert.equal(r.lastReview,'2026-11-17');
 s.serial+=5;assert.equal(L.submit(s,q,true,day('2026-11-20')+60000,L.FLUENT_MS),'reviewed');assert.equal(r.stage,3);
 assert.equal(L.submit(s,q,true,day('2026-11-27'),5000),'slow');assert.equal(r.mastered,false);
 s.serial+=5;assert.equal(L.submit(s,q,true,day('2026-11-27')+60000,2000),'mastered');assert.equal(L.mapStars(r),3);
 assert.equal(L.submit(s,q,true,day('2026-12-11'),9000),'slow');assert.equal(r.mastered,true);assert.equal(r.stage,4);
 assert.equal(L.countMastered(s),1);
});
test('ヒントで正解しても、まちがえた問題の「やりなおし」の説明は消えない',()=>{
 const now=new Date('2026-11-16T12:00:00').getTime(),today='2026-11-16';
 const r={attempts:2,correct:0,today,hits:0,stage:0,history:[{at:now,ok:false,ms:3000,kind:'random'},{at:now+1000,ok:true,ms:9000,kind:'hint'}]};
 assert.match(L.nextStep(r,now),/まちがえたので/);
});
test('★を取った問題が誤答で戻ったとき、たしかめなおしで★は残ると説明する',()=>{
 const now=new Date('2026-11-16T12:00:00').getTime(),today='2026-11-16';
 const r={attempts:9,correct:8,today,hits:1,stage:0,stars:2,everReady:true,history:[{at:now,ok:false,ms:3000,kind:'random'},{at:now+60000,ok:true,ms:4000,kind:'random'}]};
 assert.match(L.nextStep(r,now),/たしかめなおし/);assert.match(L.nextStep(r,now),/★は のこる/);assert.match(L.nextStep(r,now),/あと 1かい/);
});
test('おまかせは、ヒントの回を直近の誤答・正解の判定に使わない',()=>{
 const s=L.fresh(),now=Date.now();s.introduced=[2];
 for(let b=1;b<=9;b++)Object.assign(L.record(s,{a:2,b}),{everReady:true,stage:2,history:[{at:now,ok:true,ms:1000,kind:'random'},{at:now,ok:true,ms:1000,kind:'random'}]});
 L.record(s,{a:2,b:3}).history=[{at:now,ok:false,ms:1000,kind:'random'},{at:now,ok:true,ms:9000,kind:'hint'},{at:now,ok:false,ms:1000,kind:'random'}];
 assert.equal(L.roundPace(s,{kind:'ordered',dan:2}),'first');
});
