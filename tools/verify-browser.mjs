import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const endpoint = process.argv[2] || 'http://127.0.0.1:9223';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = pathToFileURL(path.join(root, 'index.html')).href;
console.log('Connecting to existing Chrome');
const tabs = await (await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
const tab = tabs.find(t => t.type === 'page' && t.url === target);
if (!tab)
    throw Error('Open index.html in the existing debugging Chrome before running this check. No browser or tab will be created.');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((ok, no) => { const timer = setTimeout(() => no(Error('Chrome connection timeout')), 5000); ws.onopen = () => { clearTimeout(timer); ok(); }; ws.onerror = e => { clearTimeout(timer); no(e); }; });
let sequence = 0;
const pending = new Map(), errors = [];
ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown')
        errors.push(m.params.exceptionDetails);
    if (pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        clearTimeout(p.timer);
        m.error ? p.no(Error(JSON.stringify(m.error))) : p.ok(m.result);
    }
};
function send(method, params = {}) { return new Promise((ok, no) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); no(Error('timeout ' + method)); }, 20000); pending.set(id, { ok, no, timer }); ws.send(JSON.stringify({ id, method, params })); }); }
let acceptRoundSetup = true;
async function evaluate(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails)
        throw Error(JSON.stringify(r.exceptionDetails));
    if (acceptRoundSetup) {
        const setup = await send('Runtime.evaluate', { expression: `if(document.getElementById('round-setup')?.open) document.getElementById('round-go').click()`, userGesture: true });
        if (setup.exceptionDetails) throw Error(JSON.stringify(setup.exceptionDetails));
    }
    return r.result.value;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function check(expression, label) {
    if (!await evaluate(expression))
        throw Error('FAIL ' + label);
    console.log('PASS ' + label);
}
async function click(id) { await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`); }
async function shot(name) { const r = await send('Page.captureScreenshot', { format: 'png' }); const dir = process.platform === 'win32' ? path.join(process.env.TEMP, 'kuku-check') : '/tmp/kuku-check'; await fs.mkdir(dir, { recursive: true }); const out = path.join(dir, name + '.png'); await fs.writeFile(out, Buffer.from(r.data, 'base64')); console.log('SCREENSHOT ' + out); }
let injected;
const original = await evaluate(`localStorage.getItem('kuku:learning:v1')`);
try {
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.bringToFront');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    injected = await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      const NativeAudio=window.AudioContext;
      window.AudioContext=class extends NativeAudio{constructor(...args){super(...args);window.__audio=this;}};
      localStorage.removeItem('kuku:learning:v1');
      window.__clock=0;window.__timers=[];window.__spoken=[];window.__pendingSpeech=null;window.__holdSpeech=false;
      document.addEventListener('DOMContentLoaded',()=>{
        KukuSound.prepare=async()=>true;
        KukuSound.speak=(text,onDone)=>{window.__spoken.push(text);window.__pendingSpeech={u:{onend:()=>onDone?.(true)},left:1400};return true;};
        KukuSound.cancelSpeech=()=>{window.__pendingSpeech=null;};
      });
      const nativeNow=Date.now;Date.now=()=>nativeNow()+window.__clock;
      Object.defineProperty(performance,'now',{value:()=>window.__clock});
      window.setInterval=(fn,ms)=>{window.__timers.push({fn,ms,last:0});return window.__timers.length;};
      window.clearInterval=id=>{if(window.__timers[id-1])window.__timers[id-1].fn=()=>{};};
      window.__advance=ms=>{for(let i=0;i<ms;i+=50){
        window.__clock+=50;
        const pending=window.__pendingSpeech;
        if(pending&&!window.__holdSpeech){pending.left-=50;if(pending.left<=0){window.__pendingSpeech=null;pending.u.onend?.();}}
        for(const t of window.__timers){if(window.__clock-t.last>=t.ms){t.last=window.__clock;t.fn();}}
      }};
      window.__finishFeedback=()=>{let left=300;const game=document.getElementById('game');while(left-->0&&!game.hidden&&(game.classList.contains('correct')||game.classList.contains('revealed')))window.__advance(50);if(left<0)throw Error('Feedback did not complete');};
    ` });
    await send('Page.reload');
    await sleep(900);
    await check(`document.title==='九九ぱれーど' && !document.getElementById('home').hidden`, 'initial home');
    await shot('home');
    await evaluate(`document.querySelector('[data-nav="menu"]').click();document.querySelector('[data-open="settings"]').click();document.querySelector('#settings .back').click()`);
    await check(`!document.getElementById('menu').hidden && document.querySelector('[data-nav="menu"]').getAttribute('aria-current')==='page'`, 'settings returns to menu and keeps current destination');
    await evaluate(`document.querySelector('[data-nav="records"]').click();document.querySelector('[data-open="calendar"]').click();document.querySelector('#calendar .back').click()`);
    await check(`!document.getElementById('records').hidden`, 'calendar returns to records');
    await click('brand');
    await evaluate(`document.querySelector('[data-open="missions"]').click();document.querySelector('#missions [data-open="calendar"]').click();document.querySelector('#calendar .back').click()`);
    await check(`!document.getElementById('missions').hidden`, 'calendar also returns to its mission entry point');
    await check(`document.querySelector('[data-nav="home"]').hasAttribute('aria-current')`, 'mission path keeps home highlighted');
    await evaluate(`document.querySelector('[data-nav="menu"]').click();document.querySelector('[data-open="manual"]').click();document.querySelector('[data-manual-page="range"]').click();document.getElementById('range-from').value=3;document.getElementById('range-to').value=5;document.getElementById('range-apply').click();document.querySelector('[data-manual-page="rows"]').click()`);
    await check(`document.querySelectorAll('#dan-buttons [aria-pressed="true"]').length===3 && document.getElementById('manual-summary').textContent.includes('3・4・5')`, 'range selection is preserved when switching to row buttons');
    await evaluate(`document.querySelector('[data-open="custom"]').click();document.querySelector('#custom .back').click();document.querySelector('#manual .back').click()`);
    await check(`!document.getElementById('menu').hidden`, 'custom selection returns through manual to menu without a back loop');
    await evaluate(`document.querySelector('[data-open="manual"]').click()`);

    await evaluate(`document.getElementById('range-from').value=2;document.getElementById('range-to').value=2;document.getElementById('range-apply').click()`);
    await click('brand');
    await check(`document.querySelectorAll('[data-nav][aria-current="page"]').length===1 && document.querySelector('[data-nav="home"]').hasAttribute('aria-current')`, 'one current destination on home');

    const beforePace = await evaluate(`JSON.stringify(KukuStore.state)`);
    await evaluate(`window.__effectOriginal=KukuSound.effect;window.__readyCount=0;KukuSound.effect=(kind,...args)=>{if(kind==='ready')__readyCount++;return __effectOriginal(kind,...args);};KukuStore.state.settings.voice=false;document.querySelector('[data-open="custom"]').click();document.querySelector('#problem-picker [aria-label="2かける6"]').click()`);
    for (const [pace,limit] of [['first',Infinity],['easy',10000],['normal',5000],['hard',3000],['robot',1500]]) {
        await evaluate(`document.querySelector('[data-open="settings"]').click();document.getElementById('setting-pace').value='${pace}';document.getElementById('setting-pace').dispatchEvent(new Event('change'));document.getElementById('custom-start').click()`);
        await check(`JSON.parse(localStorage.getItem('kuku:learning:v1')).settings.pace==='${pace}'`, pace+' setting is saved');
        const cues=await evaluate('__readyCount');
        await evaluate(`__advance(${Number.isFinite(limit)?limit-50:60000})`);
        await check(`!document.getElementById('game').classList.contains('revealed') && document.getElementById('counter').textContent==='1 / 10'`, pace+' waits for its deadline');
        await click('pause');await evaluate('__advance(10000)');await click('resume');
        await check(`__readyCount===${cues}`, pace+' resume does not repeat ready sound');
        if (pace==='first') await click('reveal'); else await evaluate('__advance(50)');
        await check(`document.getElementById('game').classList.contains('revealed')`, pace+' shows answer at the expected time');
        await evaluate('__finishFeedback()');
        await check(`__readyCount===${cues+1} && document.getElementById('counter').textContent==='2 / 10'`, pace+' next question has one ready sound');
        if (Number.isFinite(limit)) {
            await evaluate(`__advance(${limit-50});document.querySelector('[data-digit="1"]').click();__advance(50)`);
            await check(`!document.getElementById('game').classList.contains('revealed')`, pace+' late first digit has time for the second');
            await evaluate(`document.querySelector('[data-digit="2"]').click()`);
            await check(`document.getElementById('game').classList.contains('correct')`, pace+' second digit can complete the answer');
        }
        await click('pause');await click('quit');
    }
    await evaluate(`document.querySelector('[data-open="custom"]').click();document.querySelector('#problem-picker [aria-label="2かける6"]').click();KukuSound.effect=__effectOriginal;Object.assign(KukuStore.state,JSON.parse(${JSON.stringify(beforePace)}));KukuStore.save();document.getElementById('brand').click()`);
    acceptRoundSetup = false;
    await evaluate(`document.querySelector('[data-open="manual"]').click();document.getElementById('manual-start').click()`);
    await check(`document.getElementById('round-setup').open && document.getElementById('round-pace-preview').textContent.includes('はじめて')`, 'new facts default to unlimited automatic pace');
    await evaluate(`document.getElementById('round-pace').value='easy';document.getElementById('round-pace').dispatchEvent(new Event('change'))`);
    await check(`document.getElementById('round-pace-preview').textContent.includes('10びょう')`, 'round pace can be changed before starting');
    await click('round-go');
    await check(`document.getElementById('mode-note').textContent.includes('10びょう') && KukuStore.state.settings.pace==='auto'`, 'one-round override preserves automatic preference');
    await click('pause');await click('quit');acceptRoundSetup = true;
    await click('sound');
    await sleep(150);
    await check(`window.__audio?.state==='running'`, 'audio starts after activation');
    await click('sound');
    await click('auto-start');
    await check(`!document.getElementById('game').hidden`, 'tutorial starts');
    await check(`document.getElementById('main-nav').hidden`, 'play hides menu navigation');
    await evaluate('__holdSpeech=true;__advance(10000)');
    await check(`document.getElementById('counter').textContent==='1 / 9' && document.getElementById('game').dataset.recitation==='listen'`, 'lecture waits for voice completion');
    await click('pause');await evaluate('__advance(5000)');
    await check(`document.getElementById('counter').textContent==='1 / 9'`, 'lecture pause holds the problem');
    await evaluate('__holdSpeech=false;__spoken=[]');await click('resume');
    await evaluate('__advance(100000)');
    await check(`__spoken[0]===__spoken[2] && __spoken[1]==='いってみよう。せーのっ！'`, 'lecture reads, cues, then repeats');
    await check(`KukuStore.state.tutorial && !document.getElementById('result').hidden`, 'tutorial completes');
    await click('continue');
    await check(`document.getElementById('round-name').textContent.includes('2のだん')`, 'second dan introduction');
    await evaluate('__advance(60000)');
    await click('continue');
    await check(`document.getElementById('round-name').textContent.includes('じゅんばん')`, 'ordered recall');
    await evaluate('__advance(110000)');
    await click('continue');
    await shot('game');
    await check(`document.getElementById('reveal').getBoundingClientRect().bottom<=innerHeight`, '390x844 keypad and reveal fit');
    await check(`!document.getElementById('input-controls').hidden`, 'practice input');
    await click('sound');
    await sleep(100);
    await evaluate('__advance(500)');
    await check(`window.__audio?.state==='running'`, 'music engine runs during a game');
    await click('sound');
    await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: true });
    await sleep(200);
    await check(`document.getElementById('reveal').getBoundingClientRect().bottom<=innerHeight && document.documentElement.scrollWidth<=innerWidth`, '320x640 keypad fits');
    await shot('small-game');
    await click('pause');
    const before = await evaluate(`KukuLearning.daily(KukuStore.state,KukuLearning.day()).ms`);
    await evaluate('__advance(10000)');
    await check(`KukuLearning.daily(KukuStore.state,KukuLearning.day()).ms===${before}`, 'pause excludes elapsed time');
    await click('resume');
    await evaluate('__spoken=[]');
    await click('reveal');
    await check(`document.getElementById('game').classList.contains('revealed')`, 'show answer');
    const wrongCounter=await evaluate(`document.getElementById('counter').textContent`);
    await evaluate('__advance(2100)');
    await check(`document.getElementById('counter').textContent===${JSON.stringify(wrongCounter)} && document.getElementById('game').dataset.recitation==='cue'`, 'wrong answer is held for the spoken cue');
    await evaluate('__advance(4000)');
    await check(`__spoken[0]===__spoken[2] && __spoken[1]==='いってみよう。せーのっ！'`, 'wrong answer reads, cues, then repeats');
    await evaluate('__finishFeedback()');
    await evaluate(`(()=>{const text=document.getElementById('equation').textContent;const n=text.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());})()`);
    await check(`document.getElementById('game').classList.contains('correct')`, 'number keys submit correct answer');
    const correctCounter = await evaluate(`document.getElementById('counter').textContent`);
    await evaluate('__holdSpeech=true;__advance(3000)');
    await check(`document.getElementById('counter').textContent===${JSON.stringify(correctCounter)} && document.getElementById('game').dataset.recitation==='repeat'`, 'correct answer waits for full recitation');
    await evaluate('__holdSpeech=false;__finishFeedback()');
    await check(`document.getElementById('counter').textContent!==${JSON.stringify(correctCounter)}`, 'correct answer advances after recitation');
    await evaluate('__advance(8000)');
    await check(`Object.values(KukuStore.state.problems).some(r=>r.history.some(h=>h.kind==='random'&&!h.ok))`, 'timeout recorded');
    await click('pause');
    await click('quit');
    await evaluate(`document.querySelector('[data-open="manual"]').click()`);
    await click('range-apply');
    await click('manual-start');
    await check(`document.getElementById('round-name').textContent==='じぶんの れんしゅう'`, 'manual range');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    for (let i = 0; i < 9; i++) {
        await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());__finishFeedback();})()`);
    }
    await sleep(450);
    await shot('late-round');
    await check(`document.body.dataset.tier==='3' && [...document.querySelectorAll('.parade-guest')].filter(e=>getComputedStyle(e).opacity==='1').length===6`, 'late-game audience and stage');
    await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());__finishFeedback();})()`);
    await sleep(450);
    await shot('finale');
    await check(`document.body.dataset.scene==='result'`, 'finale scene');
    await click('finish');
    await check(`!document.getElementById('dan-progress-card').hidden`, 'dan progress is visible');
    await shot('progress');
    await click('next-dan');
    await check(`!document.getElementById('route').hidden && document.querySelectorAll('[data-row-start]').length===8`, 'choose any row without a sequential gate');
    await evaluate(`document.querySelector('[data-row-start="7"]').click()`);
    await check(`KukuStore.state.focusDan===7 && document.getElementById('round-name').textContent.includes('7のだん')`, 'freely chosen seventh row starts directly');
    await click('pause');await click('quit');
    await evaluate(`document.querySelector('[data-open="manual"]').click()`);
    await click('manual-start');
    await click('pause');
    await click('quit');
    await evaluate(`document.querySelector('[data-open="map"]').click()`);
    await shot('map');
    await check(`document.querySelectorAll('#map-grid button').length===72`, 'map cells');
    await check(`Object.keys(KukuStore.state.problems).length>0 && JSON.parse(localStorage.getItem('kuku:learning:v1')).tutorial`, 'saved learning state');
    await evaluate(`document.querySelector('#map .back').click();document.querySelector('[data-open="settings"]').click();document.getElementById('setting-motion').value=0;document.getElementById('setting-motion').dispatchEvent(new Event('input'));`);
    await check(`KukuStore.state.settings.motion===0`, 'motion setting');
    await evaluate(`document.querySelector('#settings .back').click();KukuLearning.daily(KukuStore.state,KukuLearning.day()).ms=600000;document.getElementById('brand').click();`);
    await check(`document.getElementById('daily-note').textContent.includes('また あした')`, 'ten-minute target');
    await evaluate(`document.getElementById('brand').click();`);
    await check(`document.querySelectorAll('#home-missions .done').length===3 && KukuStore.state.rewards.days[KukuLearning.day()].seal`, 'daily missions produce one calendar flower');
    await evaluate(`document.querySelector('[data-open="route"]').click()`);
    await shot('learning-route');
    await check(`document.documentElement.scrollWidth<=innerWidth`, 'route fits viewport');
    await check(`document.querySelectorAll('.route-node').length===8 && !document.querySelector('.route-node.mastered')`, 'learning route separates row progress from mastery');
    const routeRecords = await evaluate(`JSON.stringify(KukuStore.state.problems)`);
    await evaluate(`for(let b=1;b<=9;b++)KukuLearning.record(KukuStore.state,{a:2,b}).everReady=true;document.querySelector('#route .back').click();document.querySelector('[data-open="route"]').click();document.querySelector('[data-row-start="2"]').click()`);
    await check(`document.getElementById('round-name').textContent.includes('2のだん') && document.getElementById('equation').textContent.startsWith('2 ×')`, 'completed route row starts that row review');
    await click('pause');await click('quit');
    await evaluate(`KukuStore.state.problems=JSON.parse(${JSON.stringify(routeRecords)});document.querySelector('[data-open="route"]').click()`);
    await evaluate(`document.querySelector('#route .back').click();document.querySelector('[data-open="challenge"]').click()`);
    await check(`!document.querySelector('[data-course="dan-2"]').disabled && document.querySelector('[data-course="pair-2"]').disabled`, 'challenge courses follow ordered learning');
    await shot('challenges');
    await evaluate(`document.querySelector('[data-course="dan-2"]').click()`);
    await click('pause');await evaluate('__advance(10000)');await click('resume');
    const covered=[];
    for(let i=0;i<9;i++){
        covered.push(await evaluate(`document.getElementById('equation').textContent`));
        await evaluate(`__advance(3000);(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());__finishFeedback();})()`);
    }
    if(new Set(covered).size!==9)throw Error('Challenge repeated a question');
    await check(`KukuStore.state.rewards.bests['dan-2'].correct===9 && KukuStore.state.rewards.bests['dan-2'].answerMs>=27000 && KukuStore.state.rewards.bests['dan-2'].answerMs<35000`, 'challenge scores exclude pauses and recitation');
    const slowBest=await evaluate(`KukuStore.state.rewards.bests['dan-2'].score`);
    await click('challenge-again');
    for(let i=0;i<9;i++){
        await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());})()`);
        if(i===0)await evaluate('__holdSpeech=true;__advance(4000);__holdSpeech=false');
        await evaluate('__finishFeedback()');
    }
    await check(`KukuStore.state.rewards.bests['dan-2'].score>${slowBest} && KukuStore.state.rewards.bests['dan-2'].answerMs<2000 && document.getElementById('result-score-label').textContent.includes('ベスト こうしん')`, 'faster same-course run earns a new personal best');
    await check(`document.getElementById('result-score').getBoundingClientRect().bottom<innerHeight`, 'personal best is visible without scrolling');
    await shot('personal-best');
    await click('challenge-again');
    await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());__finishFeedback();})()`);
    await click('pause');await click('quit');
    await check(`KukuStore.state.rewards.bests['dan-2'].runs===2`, 'incomplete challenge does not save a best');
    await evaluate(`KukuStore.state.days[KukuLearning.day(new Date(new Date().getFullYear(),new Date().getMonth()-1,15,12).getTime())]={ms:90000,games:1,answers:9};document.querySelector('[data-open="calendar"]').click()`);
    await shot('calendar');
    await check(`document.querySelector('#calendar-grid .sealed.today') && document.getElementById('calendar-next').disabled`, 'calendar shows today flower and blocks future months');
    await evaluate(`document.querySelector('#calendar-grid .today').click()`);
    await check(`document.getElementById('calendar-detail').textContent.includes('めあて、ぜんぶ できた')`, 'calendar day opens its learning record');
    await click('calendar-prev');
    await check(`document.querySelector('#calendar-grid .played')`, 'calendar preserves earlier learning days');
    await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: true });
    await check(`document.documentElement.scrollWidth<=innerWidth`, 'calendar fits 320px width');
    await evaluate(`document.querySelector('#calendar .back').click();document.querySelector('[data-open="challenge"]').click()`);
    await check(`document.documentElement.scrollWidth<=innerWidth`, 'challenge list fits 320px width');
    await evaluate(`KukuStore.state.ordered.push(3);KukuStore.state.introduced.push(3);document.querySelector('#challenge .back').click();document.querySelector('[data-open="challenge"]').click();document.querySelector('[data-course="pair-2"]').click()`);
    const mixed=[];
    for(let i=0;i<10;i++){
      mixed.push(await evaluate(`document.getElementById('equation').textContent`));
      await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());__finishFeedback();})()`);
    }
    if(new Set(mixed).size!==10)throw Error('Mixed challenge repeated a question');
    await check(`KukuStore.state.rewards.bests['pair-2'].correct===10 && KukuStore.state.rewards.bests['dan-2'].count===9`, 'mixed course saves a separate complete 10-question record');
    await click('result-next-dan');
    await check(`document.getElementById('mix-start').disabled && document.getElementById('final-start').disabled`, 'mix requires two cleared rows and final stays locked');
    await evaluate(`document.querySelector('[data-row-start="3"]').click()`);
    for(let i=0;i<9;i++) await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());__finishFeedback();})()`);
    await click('result-next-dan');
    await check(`!document.getElementById('mix-start').disabled && document.querySelector('[data-mix-dan="7"]').disabled`, 'only cleared rows can be selected for mixed practice');
    await click('mix-start');
    const mixTen=[];
    for(let i=0;i<10;i++) {
      mixTen.push(await evaluate(`document.getElementById('equation').textContent`));
      await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());__finishFeedback();})()`);
    }
    if(new Set(mixTen).size!==10 || mixTen.filter(q=>q.startsWith('2 ×')).length!==5) throw Error('Mixed ten must be balanced and unique');
    await check(`KukuStore.state.rewards.trail.rounds===1 && KukuStore.state.rewards.trail.mixed.length===10`, 'ten-question mix saves route progress');
    await click('result-next-dan');await shot('mixed-route');
    await check(`document.documentElement.scrollWidth<=innerWidth`, 'branching route fits 320px');
    await click('mix-start');await click('pause');await click('quit');
    await check(`KukuStore.state.rewards.trail.rounds===1`, 'unfinished mix does not add a completed round');
    await evaluate(`const ss=KukuStore.state;ss.rewards.trail.cleared=[2,3,4,5,6,7,8,9];ss.ordered=[2,3,4,5,6,7,8,9];ss.introduced=[...ss.ordered];ss.rewards.trail.mixed=ss.ordered.flatMap(a=>Array.from({length:9},(_,i)=>a+'x'+(i+1)));document.querySelector('[data-open="route"]').click()`);
    await click('final-start');
    await check(`document.getElementById('counter').textContent==='1 / 50' && document.querySelectorAll('#parade-lights i').length===10`, 'final starts fifty questions with ten progress lamps');
    const finalRows=new Set();
    for(let i=0;i<50;i++) {
      finalRows.add(await evaluate(`document.getElementById('equation').textContent[0]`));
      if(i<5) { await click('reveal');await evaluate('__finishFeedback()'); }
      else await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());__finishFeedback();})()`);
    }
    if(finalRows.size!==8)throw Error('Final must include all eight rows');
    await check(`KukuStore.state.rewards.trail.passed && KukuStore.state.rewards.bests.final.correct===45 && document.getElementById('result-dan-progress').textContent.includes('クリア')`, '45 out of 50 passes final and stores its separate record');
    await shot('final-test-result');
    await evaluate(`document.querySelector('[data-open="result-answers"]').click()`);
    await check(`document.querySelectorAll('#answer-list .wrong').length===5 && document.getElementById('answers-page').textContent==='1〜5 / 50もん'`, 'results show each revealed question and correct answer');
    await click('answers-next');
    await check(`document.querySelectorAll('#answer-list .correct').length===5`, 'results paginate correct answers');
    for(const mistakes of [1,0]) {
      await evaluate(`document.querySelector('[data-open="result"]').click();document.getElementById('result-next-dan').click();document.getElementById('all-start').click()`);
      await check(`document.getElementById('counter').textContent==='1 / 81'`, 'all-facts test starts 81 questions');
      for(let i=0;i<81;i++) {
        if(i<mistakes) { await click('reveal');await evaluate('__finishFeedback()'); }
        else await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());__finishFeedback();})()`);
      }
      await check(`KukuStore.state.rewards.trail.passedAll===${mistakes===0} && KukuStore.state.rewards.bests['all-81'].correct===${81-mistakes} && KukuStore.state.rewards.bests.final.correct===45`, '81 test needs a perfect run and preserves 50-question record');
    }

    await evaluate(`document.getElementById('brand').click();KukuStore.save()`);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    // Reload with real clocks and confirm that saved learning is restored.
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier });
    injected = null;
    await send('Page.reload');
    await sleep(350);
    await check(`KukuStore.state.tutorial && KukuStore.state.ordered.includes(2)`, 'learning restored after reload');
    await check(`KukuStore.state.rewards.bests['dan-2'].runs===2 && KukuStore.state.rewards.days[KukuLearning.day()].seal`, 'personal best and mission flower survive reload');
    const rhythm = await evaluate(`new Promise(resolve=>{
      const wasSound=KukuStore.state.settings.sound;
      KukuStore.state.settings.sound=true;KukuSound.setEnergy(.95);KukuSound.start();
      let peak=0;
      const sample=setInterval(()=>{peak=Math.max(peak,KukuSound.pulse());},20);
      setTimeout(()=>{clearInterval(sample);KukuSound.stop();KukuStore.state.settings.sound=wasSound;KukuSound.update();resolve(peak);},1100);
    })`);
    if (!(rhythm > .5)) throw Error('Music beat did not reach the visual engine');
    console.log('PASS full music layers and synchronized beat');
    await check(`KukuSound.prepare()`, 'all recordings preload and decode');
    const nativeSpeech = await evaluate(`new Promise(resolve=>{
      const steps=[],startedAt=Date.now();let interval,timeout;
      const finish=status=>{clearInterval(interval);clearTimeout(timeout);resolve({status,steps,ms:Date.now()-startedAt});};
      const flow=KukuRecitation.create({text:'にさんがろく',say:KukuSound.speak,stop:KukuSound.cancelSpeech,onStep:name=>steps.push(name),onDone:()=>finish('complete')});
      interval=setInterval(()=>flow.tick(50),50);
      timeout=setTimeout(()=>{flow.cancel();finish('unavailable');},18000);
      flow.start();
    })`);
    console.log('Recorded Windows recitation: '+JSON.stringify(nativeSpeech));
    if(nativeSpeech.status!=='complete') throw Error('Recorded recitation did not complete');
    await evaluate(`KukuStore.state.settings.motion=.85;KukuStore.state.settings.voice=true;
      KukuLearning.daily(KukuStore.state,KukuLearning.day()).ms=0;
      if(!KukuStore.state.settings.sound)document.getElementById('sound').click();
      document.querySelector('[data-open="manual"]').click();document.getElementById('manual-start').click();`);
    const stages = new Set();
    for(let i=0;i<10;i++){
        await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());})()`);
        await sleep(180);
        await check(`document.getElementById('game').classList.contains('correct') && document.getElementById('parade-lights').querySelectorAll('.lit').length===${i+1}`, 'real-time answer reward '+(i+1));
        stages.add(await evaluate(`document.body.dataset.tier`));
        if(i>0)await check(`document.getElementById('combo').textContent==='${i+1}もん れんぞく！'`, 'combo updates on the answer');
        if([0,2,5,7].includes(i)){
            await shot('reward-'+(i+1)+'-hit');await sleep(600);
            await check(`document.getElementById('answer-seal').getBoundingClientRect().bottom<=document.getElementById('equation').getBoundingClientRect().top`, 'reward badge clears the equation');
            await shot('reward-'+(i+1)+'-sing');
        }
        if(i===2){
            await click('pause');
            const frozen=await evaluate(`document.getElementById('mascot-game').querySelector('.bird').getAttribute('transform')`);
            await sleep(350);
            await check(`document.getElementById('mascot-game').querySelector('.bird').getAttribute('transform')===${JSON.stringify(frozen)}`, 'celebration freezes during pause');
            await click('resume');
        }
        const until=Date.now()+14000;
        while(await evaluate(`document.getElementById('game').classList.contains('correct') && !document.getElementById('game').hidden`)){
            if(Date.now()>until)throw Error('Correct recitation did not finish in real-time round');
            await sleep(100);
        }
    }
    if(stages.size!==4)throw Error('All four stage arrangements were not reached');
    await shot('real-finale');
    await check(`!document.getElementById('result').hidden`, 'real-time voiced round completes');
    await click('finish');
    await evaluate(`KukuStore.state.settings.motion=0;document.querySelector('[data-open="manual"]').click();document.getElementById('manual-start').click();`);
    await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number);String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());})()`);
    await sleep(100);
    await check(`document.body.dataset.motion==='off' && document.getAnimations().filter(a=>a.playState==='running').length===0`, 'zero-motion answer has no running animations');
    await click('pause');await click('quit');
    // Exercise graceful degradation without changing the product runtime.
    injected = await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')};
      const nativeGetContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl'?null:nativeGetContext.call(this,kind,...args)};
    ` });
    await send('Page.reload');
    await sleep(350);
    await check(`document.body.classList.contains('backdrop-fallback')`, 'CSS fallback without WebGL');
    await click('auto-start');
    await click('pause');
    await check(`!KukuStore.available && !document.getElementById('storage-warning').hidden`, 'storage failure keeps game usable and shows notice');
    await click('quit');
    // Remove failure injection before restoring the original persistent data.
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier });
    injected = null;
    await send('Page.reload');
    await sleep(300);
    if (errors.length)
        throw Error(JSON.stringify(errors));
    console.log('PASS no browser exceptions');
}
finally {
    if (injected)
        await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier });
    await send('Page.reload');
    await sleep(350);
    await evaluate(`if(window.KukuStore) { KukuStore.save();KukuStore.save=()=>true;KukuStore.queueSave=()=>{}; }`);
    await evaluate(original === null ? `localStorage.removeItem('kuku:learning:v1')` : `localStorage.setItem('kuku:learning:v1',${JSON.stringify(original)})`);
    await send('Emulation.setFocusEmulationEnabled', { enabled: false });
    await send('Emulation.clearDeviceMetricsOverride');
    await send('Page.reload');
    ws.close();
}
