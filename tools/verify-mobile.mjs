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

const original=await evaluate(`localStorage.getItem('kuku:learning:v1')`);
let injected;
const sizes=[[320,480],[375,548],[320,568],[360,640],[390,664],[390,844],[430,740],[844,390]];
async function fit(label) {
 const out=await evaluate(`(()=>{
  const screen=document.querySelector('.screen:not([hidden])'),dock=document.getElementById('main-nav'),bottom=dock.hidden?visualViewport.height:Math.min(visualViewport.height,dock.getBoundingClientRect().top);
  const bad=[...screen.querySelectorAll('button,select,input,h1,h2,p,progress,.detail-card,.route-node')].filter(el=>el.getClientRects().length && !el.closest('[hidden]')).map(el=>{const r=el.getBoundingClientRect();return {id:el.id||el.className||el.tagName,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}).filter(r=>r.x < -1 || r.y < -1 || r.right > innerWidth+1 || r.bottom > bottom-3);
  return {bad,limit:bottom,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewport:[innerWidth,visualViewport.height,visualViewport.scale]};
 })()`);
 if(out.bad.length||out.width>out.viewport[0]+1||out.height>out.viewport[1]+1||out.viewport[2]!==1)throw Error('FIT '+label+' '+JSON.stringify(out));
 console.log('PASS viewport '+label);
}
try {
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  localStorage.removeItem('kuku:learning:v1');
  window.__long=[];try{new PerformanceObserver(list=>__long.push(...list.getEntries().map(e=>e.duration))).observe({entryTypes:['longtask']});}catch{}
 `});
 await send('Page.reload');await sleep(450);
 for(const [width,height] of [[320,480],[390,664]]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(100);await fit('first visit home '+width+'x'+height);
 }
 await evaluate(`KukuStore.state.tutorial=true;KukuStore.state.introduced=[2,3,4,5,6,7,8,9];KukuStore.state.ordered=[2,3,4,5,6,7,8,9];KukuStore.state.rewards.trail.cleared=[2,3,4,5,6,7,8,9];KukuStore.state.rewards.trail.mixed=KukuStore.state.ordered.flatMap(a=>Array.from({length:9},(_,i)=>a+'x'+(i+1)));KukuStore.state.settings.voice=false;KukuStore.state.settings.motion=.85;document.getElementById('brand').click();`);
 for(const [width,height] of sizes){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(150);
  await click('brand');await fit('home '+width+'x'+height);
  for(const id of ['menu','missions','records','route','challenge','calendar','manual','custom','map','table','settings']){
   await evaluate(`document.querySelector('[data-open="${id}"]').click()`);await sleep(40);await fit(id+' '+width+'x'+height);
   if(id==='manual') for(const page of ['range','rows']){await evaluate(`document.querySelector('[data-manual-page="${page}"]').click()`);await fit('manual '+page+' '+width+'x'+height);}
   if(id==='route') for(const page of ['mix','final','rows']){await evaluate(`document.querySelector('[data-route-page="${page}"]').click()`);await fit('route '+page+' '+width+'x'+height);}
   if(id==='challenge')for(const page of ['mixed','rows']){await evaluate(`document.querySelector('[data-course-page="${page}"]').click()`);await fit('challenge '+page+' '+width+'x'+height);}
  }
  acceptRoundSetup=false;
  await evaluate(`document.querySelector('[data-open="manual"]').click();document.getElementById('manual-start').click()`);
  await check(`(()=>{const d=document.getElementById('round-setup'),r=d.getBoundingClientRect();return d.open && r.top>=0 && r.bottom<=visualViewport.height && d.scrollHeight<=d.clientHeight+1 && [...d.querySelectorAll('button,select')].every(e=>e.getBoundingClientRect().bottom<=r.bottom);})()`, 'round setup fits '+width+'x'+height);
  await click('round-go');acceptRoundSetup=true;await sleep(100);await fit('game first frame '+width+'x'+height);
  await click('pause');await click('quit');
  await evaluate(`document.querySelector('[data-open="settings"]').click();document.getElementById('tutorial-replay').click()`);await sleep(60);await fit('lecture '+width+'x'+height);await click('pause');await click('quit');
 }
 const missionSnapshot=await evaluate(`JSON.stringify(KukuStore.state.rewards.days)`);
 await evaluate(`const d=KukuRewards.ensureDay(KukuStore.state);d.reviewKeys=['2x3'];document.querySelector('[data-open="missions"]').click()`);
 for(const [width,height] of sizes){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(100);await fit('four daily missions '+width+'x'+height);
 }
 await check(`document.querySelectorAll('#home-missions .mission').length===4 && document.getElementById('mission-reward').textContent.startsWith('4つ')`, 'four missions and reward requirement agree');
 await evaluate(`KukuStore.state.rewards.days=JSON.parse(${JSON.stringify(missionSnapshot)});document.getElementById('brand').click()`);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:664,deviceScaleFactor:2,mobile:true});
 await evaluate(`KukuStore.state.settings.voice=true;KukuSound.prepare()`);
 await send('Emulation.setCPUThrottlingRate',{rate:4});
 await evaluate(`KukuStore.state.settings.sound=true;KukuStore.state.settings.voice=true;KukuSound.speak=(text,end)=>{setTimeout(()=>end?.(true),60);return true;};document.querySelector('[data-open="manual"]').click();document.getElementById('manual-start').click();__long=[];window.__frames=[];window.__prev=0;window.__sample=true;requestAnimationFrame(function sample(t){if(__prev)__frames.push(t-__prev);__prev=t;if(__sample)requestAnimationFrame(sample);});`);
 await evaluate(`window.__costs=[];for(const [name,object,keys] of [['visual',KukuVisuals,['digit','burst','progress','scoreGain']],['sound',KukuSound,['effect','cancelSpeech']]]) for(const key of keys){const fn=object[key];object[key]=(...args)=>{const t=performance.now();const r=fn(...args);__costs.push([name+'.'+key,Math.round((performance.now()-t)*10)/10]);return r;};}`);
 const answerCosts=[];
 for(let i=0;i<10;i++){
  answerCosts.push(await evaluate(`(()=>{const n=document.getElementById('equation').textContent.match(/[0-9]+/g).map(Number),start=performance.now();String(n[0]*n[1]).split('').forEach(d=>document.querySelector('[data-digit="'+d+'"]').click());return performance.now()-start;})()`));
  await sleep(150);await fit('answer reward '+(i+1));
  if([0,5,8].includes(i))await shot('mobile-reward-'+(i+1));
  await sleep(1100);
 }
 await check(`!document.getElementById('result').hidden`,'ten-answer result');
 const metrics=await evaluate(`__sample=false;({long:__long,frames:__frames})`);
 const sorted=metrics.frames.slice().sort((a,b)=>a-b);
 console.log('ANSWER COMPONENT MAX MS '+JSON.stringify(await evaluate(`Object.fromEntries([...new Set(__costs.map(c=>c[0]))].map(name=>[name,Math.max(...__costs.filter(c=>c[0]===name).map(c=>c[1]))]))`)));
 console.log('PERFORMANCE '+JSON.stringify({answerMs:answerCosts.map(x=>Math.round(x)),longTasks:metrics.long.map(x=>Math.round(x)),frameP95:sorted[Math.floor(sorted.length*.95)],frames:sorted.length}));
 await send('Emulation.setCPUThrottlingRate',{rate:1});
 for(const [width,height] of sizes){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(100);
  await evaluate(`document.querySelector('[data-open="result"]').click()`);await fit('result '+width+'x'+height);
  if(width===390&&height===664)await shot('mobile-result');
  await evaluate(`document.querySelector('[data-open="result-answers"]').click()`);await fit('result-answers '+width+'x'+height);
  await click('answers-next');await fit('result-answers page 2 '+width+'x'+height);
  await evaluate(`document.querySelector('[data-open="result-details"]').click()`);await fit('result-details '+width+'x'+height);
 }
 await click('brand');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:664,deviceScaleFactor:1,mobile:true});
 for(const id of ['home','missions','route','records']){if(id==='home')await click('brand');else await evaluate(`document.querySelector('[data-open="${id}"]').click()`);await shot('mobile-'+id);}
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log('PASS all mobile screens and reward performance');
} finally {
 await send('Emulation.setCPUThrottlingRate',{rate:1});
 if(injected)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
 await evaluate(`KukuStore.save();KukuStore.save=()=>true;KukuStore.queueSave=()=>{};`);
 await evaluate(original===null?`localStorage.removeItem('kuku:learning:v1')`:`localStorage.setItem('kuku:learning:v1',${JSON.stringify(original)})`);
 await send('Emulation.setFocusEmulationEnabled',{enabled:false});await send('Emulation.clearDeviceMetricsOverride');await send('Page.reload');ws.close();
}
