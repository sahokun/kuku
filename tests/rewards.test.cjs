const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../js/learning.js'),R=require('../js/rewards.js');
const at=date=>new Date(date+'T12:00:00').getTime();
function state(){const s=L.fresh();s.rewards=R.fresh();return s;}
function answers(id,ms=2000){return R.questions(R.course(id),()=>.5).map(q=>({...q,ok:true,ms}));}
test('correct answers earn points, speed and consecutive correctness add bounded bonuses',()=>{
 assert.equal(R.points(false,10,10).total,0);
 assert.equal(R.points(true,5000,1).total,1000);
 assert.equal(R.points(true,1000,1).total,1030);
 assert.equal(R.points(true,1000,9).total,1050);
 assert.ok(R.points(true,2000,3).total>R.points(true,4000,3).total);
 for(const c of R.courses)assert.ok(c.count*R.points(true,5000,1,c.count).total>(c.count-1)*R.points(true,1000,9,c.count).total);
});
test('challenge courses use their declared rows and the same unique questions on every run',()=>{
 for(const c of R.courses){
  const a=R.questions(c,()=>0),b=R.questions(c,()=>.999);
  assert.equal(a.length,c.count);assert.equal(new Set(a.map(q=>L.key(q.a,q.b))).size,c.count);
  assert.ok(a.every(q=>c.dans.includes(q.a)&&q.b>=1&&q.b<=9));
  assert.deepEqual(a.map(q=>L.key(q.a,q.b)).sort(),b.map(q=>L.key(q.a,q.b)).sort());
  assert.notDeepEqual(a,b);
 }
});
test('challenge availability follows ordered practice for every row in that course',()=>{
 const s=state();assert.equal(R.available(s,R.course('dan-2')),false);s.ordered=[2];
 assert.equal(R.available(s,R.course('dan-2')),true);assert.equal(R.available(s,R.course('pair-2')),false);
 s.ordered.push(3);assert.equal(R.available(s,R.course('pair-2')),true);
});
test('high scores are separated by course and only complete exact courses can be recorded',()=>{
 const s=state();assert.equal(R.recordRun(s,'dan-2',answers('dan-2').slice(1)),null);
 const duplicate=answers('dan-2');duplicate[0]=duplicate[1];assert.equal(R.recordRun(s,'dan-2',duplicate),null);
 assert.equal(R.recordRun(s,'dan-3',answers('dan-2')),null);
 const first=R.recordRun(s,'dan-2',answers('dan-2',4000),'2026-09-29');assert.equal(first.first,true);
 const faster=R.recordRun(s,'dan-2',answers('dan-2',1000),'2026-09-30');assert.equal(faster.improved,true);
 const slower=R.recordRun(s,'dan-2',answers('dan-2',4500),'2026-10-01');assert.equal(slower.improved,false);
 assert.equal(s.rewards.bests['dan-2'].score,faster.current.score);assert.equal(s.rewards.bests['dan-2'].runs,3);
 assert.equal(s.rewards.bests['dan-3'],undefined);assert.deepEqual(s.problems,{});
});
test('a mistake resets the chain without taking previously earned score away',()=>{
 const s=state(),run=answers('dan-2',1000);run[3].ok=false;
 const r=R.recordRun(s,'dan-2',run,'2026-09-29');
 let expected=0,combo=0;for(const q of run){combo=q.ok?combo+1:0;expected+=R.points(q.ok,q.ms,combo).total;}
 assert.equal(r.current.score,expected);assert.equal(r.current.correct,8);
});
test('daily mission selection stays fixed across learning changes and reloads',()=>{
 const s=state(),date='2026-09-29';R.ensureDay(s,date);assert.deepEqual(s.rewards.days[date].missions,['play','play-three','round-correct']);
 s.problems['2x3']={lastAt:at('2026-09-28'),due:date};
 assert.deepEqual(R.ensureDay(s,date).missions,['play','play-three','round-correct']);
 s.rewards=R.restore(JSON.parse(JSON.stringify(s.rewards)),s);assert.deepEqual(R.ensureDay(s,date).missions,['play','play-three','round-correct']);
 assert.deepEqual(R.ensureDay(s,'2026-09-30').missions,['play','play-three','round-correct','review']);
});
test('daily flower is awarded once and survives the following day and reload',()=>{
 const s=state(),date='2026-09-29';R.ensureDay(s,date);
 for(let i=0;i<3;i++)R.event(s,date,{type:'answer',ok:true,roundCorrect:i+1});
 for(let i=0;i<2;i++)R.event(s,date,{type:'finish'});
 assert.equal(s.rewards.days[date].seal,false);
 const result=R.event(s,date,{type:'finish'});assert.equal(result.sealed,true);assert.equal(result.earned[0].id,'play-three');
 assert.equal(R.event(s,date,{type:'finish'}).sealed,false);
 R.ensureDay(s,'2026-10-01');s.rewards=R.restore(JSON.parse(JSON.stringify(s.rewards)),s);
 assert.equal(s.rewards.days[date].seal,true);assert.equal(s.rewards.days['2026-10-01'].seal,false);
});
test('review mission remembers its eligible questions after interruption or a wrong answer',()=>{
 const s=state(),date='2026-09-29';s.problems['2x3']={lastAt:at('2026-09-28'),due:date};
 const d=R.ensureDay(s,date);assert.deepEqual(d.reviewKeys,['2x3']);
 s.problems['2x3'].lastAt=at(date);s.rewards=R.restore(JSON.parse(JSON.stringify(s.rewards)),s);
 assert.deepEqual(R.ensureDay(s,date).reviewKeys,['2x3']);
 R.event(s,date,{type:'answer',ok:false});assert.equal(R.missions(s,date).find(m=>m.id==='review').done,false);
 R.event(s,date,{type:'recite',review:true});assert.equal(R.missions(s,date).find(m=>m.id==='review').done,true);
});
test('old learning days migrate to the calendar without inventing mission seals',()=>{
 const s=state();s.days['2026-08-12']={ms:123456,games:2,answers:18};s.rewards=R.restore(undefined,s);
 const d=R.calendar(s,2026,7).find(d=>d.number===12);assert.equal(d.played,true);assert.equal(d.games,2);assert.equal(d.seal,false);
 delete s.days['2026-08-12'];assert.equal(R.calendar(s,2026,7).find(d=>d.number===12).played,true);
});
test('opening the home or calendar does not count as playing and leap months are correct',()=>{
 const s=state();R.ensureDay(s,'2028-02-29');const month=R.calendar(s,2028,1);
 assert.equal(month.length,29);assert.equal(month[28].date,'2028-02-29');assert.ok(month.every(d=>!d.played));
 assert.equal(R.calendar(s,2026,1).length,28);
});
test('restoration rejects invalid record fields and keeps calendar retention bounded',()=>{
 const s=state();const raw={version:1,bests:{'dan-2':{date:'2026-09-29',count:9,score:Infinity,correct:100,answerMs:-1}},days:{'2026-02-31':{},'invalid':{seal:true}}};
 const r=R.restore(raw,s);assert.equal(r.bests['dan-2'].score,0);assert.equal(r.bests['dan-2'].correct,0);assert.equal(Object.keys(r.days).length,0);
 for(let i=0;i<800;i++)s.days[L.plusDays('2024-01-01',i)]={ms:1000,games:1,answers:1};R.syncCalendar(s);assert.equal(Object.keys(s.rewards.days).length,730);
});

test('the route preserves earned stars while showing the need for review',()=>{
 const s=state();s.problems['2x3']={mastered:true,repair:true,everReady:true};
 const r=R.route(s,2);assert.equal(r.mastered,1);assert.equal(r.repair,1);assert.equal(r.ready,1);
});

test('preferred rows start independently and a perfect scrambled row unlocks mixing without granting mastery',()=>{
 const s=state();s.tutorial=true;s.focusDan=7;
 assert.equal(R.plan(s).dan,7);s.introduced=[7];assert.equal(R.plan(s).kind,'ordered');s.ordered=[7];assert.equal(R.plan(s).courseId,'dan-7');
 const run=answers('dan-7');run[0].ok=false;R.recordRun(s,'dan-7',run);assert.deepEqual(R.cleared(s),[]);
 R.recordRun(s,'dan-7',answers('dan-7'));assert.deepEqual(R.cleared(s),[7]);assert.equal(R.plan(s).kind,'route');assert.deepEqual(s.problems,{});
 R.recordRun(s,'dan-3',answers('dan-3'));s.ordered.push(3);assert.equal(R.plan(s).kind,'mix');
});
test('arbitrary cleared rows produce ten unique balanced questions and preserve the selected set',()=>{
 const s=state();s.rewards.trail.cleared=[2,5,9];s.rewards.trail.selected=[5,9];
 const p=R.mixPlan(s,undefined,at('2026-09-29'),()=>.5);
 assert.deepEqual(p.dans,[5,9]);assert.equal(p.queue.length,10);assert.equal(new Set(p.queue.map(q=>L.key(q.a,q.b))).size,10);
 assert.equal(p.queue.filter(q=>q.a===5).length,5);assert.equal(R.mixPlan(s,[2,3]),null);
 s.rewards=R.restore(JSON.parse(JSON.stringify(s.rewards)),s);assert.deepEqual(R.selected(s),[5,9]);
});
test('mix progression requires a completed round and covers unseen questions before repeats',()=>{
 const s=state();s.rewards.trail.cleared=[2,7];let p=R.mixPlan(s);
 const run=p.queue.map(q=>({...q,ok:true,ms:1000}));
 assert.equal(R.finishMix(s,p,run.slice(1)),false);assert.equal(s.rewards.trail.rounds,0);
 run[0].ok=false;assert.equal(R.finishMix(s,p,run),true);assert.equal(s.rewards.trail.mixed.length,9);assert.equal(s.rewards.trail.rounds,1);
 const next=R.mixPlan(s);assert.ok(next.queue.some(q=>q.a===run[0].a&&q.b===run[0].b));
 R.finishMix(s,next,next.queue.map(q=>({...q,ok:true,ms:1000})));assert.equal(s.rewards.trail.mixed.length,18);
 assert.equal(R.finalReady(s),false);
});
test('all mixed coverage opens the final, with 45 correct required and no automatic mastery stars',()=>{
 const s=state();s.ordered=[2,3,4,5,6,7,8,9];s.rewards.trail.cleared=[...s.ordered];
 assert.equal(R.available(s,R.course('final')),false);
 s.rewards.trail.mixed=s.ordered.flatMap(a=>Array.from({length:9},(_,i)=>L.key(a,i+1)));
 assert.equal(R.available(s,R.course('final')),true);
 const run=answers('final');for(let i=0;i<6;i++)run[i].ok=false;R.recordRun(s,'final',run);assert.equal(s.rewards.trail.passed,false);
 run[5].ok=true;R.recordRun(s,'final',run);assert.equal(s.rewards.trail.passed,true);assert.deepEqual(s.problems,{});
 s.rewards=R.restore(JSON.parse(JSON.stringify(s.rewards)),s);assert.equal(s.rewards.trail.passed,true);assert.equal(R.finalReady(s),true);assert.equal(s.rewards.bests.final.correct,45);
});
test('existing daily-ready rows and perfect records carry into the new route',()=>{
 const s=state();for(let b=1;b<=9;b++)L.record(s,{a:8,b}).everReady=true;
 s.rewards=R.restore({version:1,bests:{'dan-3':{date:'2026-09-29',count:9,score:9300,correct:9,answerMs:12000}},days:{}},s);
 assert.deepEqual(R.cleared(s),[3,8]);assert.deepEqual(s.rewards.trail.mixed,[]);
});

test('eight-row mixing stays balanced and legacy cleared rows can unlock the final without ordered flags',()=>{
 const s=state();for(let a=2;a<=9;a++)for(let b=1;b<=9;b++)L.record(s,{a,b}).everReady=true;
 const p=R.mixPlan(s);assert.equal(new Set(p.queue.map(q=>q.a)).size,8);
 const sizes=p.dans.map(a=>p.queue.filter(q=>q.a===a).length);assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);
 s.rewards.trail.mixed=p.dans.flatMap(a=>Array.from({length:9},(_,i)=>L.key(a,i+1)));
 assert.equal(R.available(s,R.course('final')),true);
});


test('one and three finished rounds have independent milestones',()=>{
 const s=state(),date='2026-10-06';
 R.event(s,date,{type:'finish'});
 assert.equal(R.missions(s,date).find(m=>m.id==='play').done,true);
 assert.equal(R.missions(s,date).find(m=>m.id==='play-three').done,false);
 R.event(s,date,{type:'finish'});
 assert.equal(R.missions(s,date).find(m=>m.id==='play-three').done,false);
 R.event(s,date,{type:'finish'});
 assert.equal(R.missions(s,date).find(m=>m.id==='play-three').done,true);
});
test('three correct answers must come from one round, without requiring a streak',()=>{
 const s=state(),date='2026-10-06';
 for(let round=0;round<3;round++) {
  R.event(s,date,{type:'answer',ok:true,roundCorrect:1});
  R.event(s,date,{type:'answer',ok:false,roundCorrect:1});
  R.event(s,date,{type:'answer',ok:true,roundCorrect:2});
 }
 assert.equal(s.rewards.days[date].correct,6);
 assert.equal(R.missions(s,date).find(m=>m.id==='round-correct').done,false);
 R.event(s,date,{type:'answer',ok:false,roundCorrect:2});
 R.event(s,date,{type:'answer',ok:true,roundCorrect:3});
 assert.equal(R.missions(s,date).find(m=>m.id==='round-correct').done,true);
 s.rewards=R.restore(JSON.parse(JSON.stringify(s.rewards)),s);
 assert.equal(R.missions(s,date).find(m=>m.id==='round-correct').done,true);
 assert.equal(R.missions(s,'2026-10-07').find(m=>m.id==='round-correct').done,false);
});
test('legacy mission days keep flowers and completed rounds without inventing a round record',()=>{
 const s=state(),date='2026-10-06';
 s.rewards=R.restore({version:1,days:{[date]:{finished:3,correct:12,missions:['play','recite','correct'],reviewKeys:[],seal:true}}},s);
 const list=R.missions(s,date);
 assert.deepEqual(list.map(m=>m.id),['play','play-three','round-correct']);
 assert.equal(list[0].done,true);assert.equal(list[1].done,true);assert.equal(list[2].done,false);
 assert.equal(s.rewards.days[date].seal,true);
});
test('review is an additional fourth mission and is required for the daily flower',()=>{
 const s=state(),date='2026-10-06';s.problems['2x3']={lastAt:at('2026-10-05'),due:date};
 assert.equal(R.missions(s,date).length,4);
 for(let i=0;i<3;i++) R.event(s,date,{type:'finish'});
 R.event(s,date,{type:'answer',ok:true,roundCorrect:3});
 assert.equal(s.rewards.days[date].seal,false);
 const result=R.event(s,date,{type:'recite',review:true});assert.equal(result.sealed,true);
});
test('slow correct answers still clear a row and preserve their time after reload',()=>{
 const s=state();const run=R.recordRun(s,'dan-2',answers('dan-2',60000),'2026-10-06');
 assert.equal(run.current.correct,9);assert.equal(run.current.answerMs,540000);
 assert.deepEqual(R.cleared(s),[2]);
 s.rewards=R.restore(JSON.parse(JSON.stringify(s.rewards)),s);
 assert.equal(s.rewards.bests['dan-2'].answerMs,540000);
 assert.equal(s.rewards.bests['dan-2'].last.answerMs,540000);
 assert.equal(R.points(true,60000,1).speed,0);
});

test('81-question test covers all facts and requires all 81 correct in one complete run',()=>{
 const s=state(),c=R.course('all-81');
 assert.equal(c.pass,81);assert.equal(R.available(s,c),false);
 s.rewards.trail.cleared=[2,3,4,5,6,7,8,9];
 s.rewards.trail.mixed=s.rewards.trail.cleared.flatMap(a=>Array.from({length:9},(_,i)=>L.key(a,i+1)));
 assert.equal(R.available(s,c),true);
 const run=answers('all-81');
 assert.equal(new Set(run.map(q=>L.key(q.a,q.b))).size,81);
 for(let a=1;a<=9;a++)assert.equal(run.filter(q=>q.a===a).length,9);
 assert.equal(R.recordRun(s,c.id,run.slice(1)),null);assert.equal(s.rewards.trail.passedAll,false);
 run[0].ok=false;R.recordRun(s,c.id,run);assert.equal(s.rewards.trail.passedAll,false);
 run[0].ok=true;R.recordRun(s,c.id,run);assert.equal(s.rewards.trail.passedAll,true);
 assert.equal(s.rewards.trail.passed,false);assert.equal(s.rewards.bests.final,undefined);
 s.rewards=R.restore(JSON.parse(JSON.stringify(s.rewards)),s);
 assert.equal(s.rewards.trail.passedAll,true);assert.equal(s.rewards.bests[c.id].correct,81);
 assert.equal(s.rewards.bests[c.id].score,run.reduce((n,q,i)=>n+R.points(true,q.ms,i+1,81).total,0));
});
test('two-row courses contain ten balanced facts and retain old eighteen-question records separately',()=>{
 const s=state();
 for(const c of R.courses.filter(c=>c.id.startsWith('pair-'))){
  const run=R.questions(c);assert.equal(run.length,10);
  for(const a of c.dans)assert.equal(run.filter(q=>q.a===a).length,5);
 }
 s.rewards=R.restore({version:1,bests:{'pair-2':{date:'2026-10-06',count:18,score:18000,correct:18,answerMs:36000,runs:2}}},s);
 assert.equal(s.rewards.bests['pair-2'],undefined);assert.equal(s.rewards.legacyBests['pair-2'].score,18000);
 R.recordRun(s,'pair-2',answers('pair-2'));
 s.rewards=R.restore(JSON.parse(JSON.stringify(s.rewards)),s);
 assert.equal(s.rewards.bests['pair-2'].count,10);assert.equal(s.rewards.legacyBests['pair-2'].count,18);
});

test('records retain the selected answer time for the best and most recent run',()=>{
 const s=state();R.recordRun(s,'all-81',answers('all-81',1000),'2026-10-07','normal');
 R.recordRun(s,'all-81',answers('all-81',8000),'2026-10-07','easy');
 s.rewards=R.restore(JSON.parse(JSON.stringify(s.rewards)),s);
 assert.equal(s.rewards.bests['all-81'].pace,'normal');assert.equal(s.rewards.bests['all-81'].last.pace,'easy');
});
