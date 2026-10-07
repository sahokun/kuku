import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const endpoint = process.argv[2] || 'http://127.0.0.1:9223';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = pathToFileURL(path.join(root, 'index.html')).href;
console.log('Connecting to existing Chrome');
const tabs = await (await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
const tab = tabs.find(t => t.type === 'page' && t.url.split('#')[0] === target);
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
function send(method, params = {}) { return new Promise((ok, no) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); no(Error('timeout ' + method)); }, 20000); pending.set(id, { ok, no: error => no(Error(method + ': ' + error.message)), timer }); ws.send(JSON.stringify({ id, method, params })); }); }
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

await send('Page.bringToFront');
await sleep(300);
const originalURL=tab.url;
const original=await evaluate("localStorage.getItem('kuku:learning:v1')");
const diagnosticOriginal=await evaluate("localStorage.getItem('kuku:diagnostics:learning:v1')");
let injected;
try {
 await send('Page.enable');await send('Runtime.enable');await send('Page.bringToFront');
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 const {windowId}=await send('Browser.getWindowForTarget',{targetId:tab.id});
 await send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  const nativeFrame=window.requestAnimationFrame.bind(window);
  window.__holdFrames=false;
  window.requestAnimationFrame=fn=>nativeFrame(function deliver(t){if(window.__holdFrames)nativeFrame(deliver);else fn(t);});
 `});
 await send('Page.navigate',{url:target+'#diagnostics'});await sleep(500);await send('Page.reload');await sleep(700);
 await check(`document.getElementById('diag-panel').open`,'diagnostic panel enabled by hash');
 await check(`KukuDiagnostics.report().version==='input-20261006-3'`,'report version');
 for(const [width,height] of [[320,568],[390,844]]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});await sleep(100);
  await check(`(()=>{const p=document.getElementById('diag-panel'),r=p.getBoundingClientRect();return p.scrollHeight<=p.clientHeight+1&&r.top>=0&&r.bottom<=visualViewport.height;})()`,'panel fits '+width+'x'+height);
 }
 await shot('diagnostic-panel');
 await check(`KukuSound.prepare()`, 'recordings are ready before measurements');
 await evaluate(`document.getElementById('diag-mode').value='normal'`);
 await click('diag-start');await sleep(250);
 await check(`document.getElementById('equation').textContent==='4 × 9 =' && KukuSound.isPlaying()`,'baseline starts fixed questions with sound');
 await evaluate(`document.querySelector('[data-digit="3"]').click();__holdFrames=true`);await sleep(350);
 await evaluate('__holdFrames=false');await sleep(120);
 await check(`KukuDiagnostics.report().events.some(e=>e.type==='frame-gap'&&e.ms>=300)`,'rendering-only gap detected');
 await check(`KukuDiagnostics.report().events.filter(e=>e.type==='timer').every(e=>e.ms<200)`,'timer continues during simulated rendering-only gap');
 await evaluate(`(()=>{const end=performance.now()+230;while(performance.now()<end){};})()`);await sleep(150);
 await check(`KukuDiagnostics.report().events.some(e=>e.type==='timer'&&e.ms>=200)`,'main-thread stall detected by timer');
 await check(`KukuDiagnostics.report().events.some(e=>e.type==='input-done'&&e.before==='?'&&e.after==='3'&&e.question==='4 × 9 =')`,'first-digit input logged without submitting answer');
 await click('diag-open');
 const count=await evaluate('KukuDiagnostics.report().events.length');await sleep(250);
 await check(`KukuDiagnostics.report().events.length===${count}`,'paused measurements excluded');
 await evaluate(`document.getElementById('diag-mode').value='silent'`);await click('diag-start');await sleep(200);
 await check(`!KukuSound.isPlaying() && KukuSound.speak('test')===false`,'silent condition disables music effects and speech');
 await evaluate(`document.querySelector('[data-digit="3"]').click()`);
 await check(`document.querySelector('[data-digit="3"]').getAnimations().length>0`,'silent condition keeps input animation');
 await click('diag-open');await evaluate(`document.getElementById('diag-mode').value='no-input-fx'`);await click('diag-start');await sleep(200);
 await evaluate(`document.querySelector('[data-digit="3"]').click()`);
 await check(`KukuSound.isPlaying()&&document.querySelector('[data-digit="3"]').getAnimations().length===0&&document.getElementById('answer').textContent==='3'`,'no-input-animation condition keeps sound and input');
 await check(`KukuDiagnostics.report().runs.length===3`,'all conditions retained in one report');
 await check(`localStorage.getItem('kuku:learning:v1')===${JSON.stringify(original)}`,'normal learning data untouched');
 await click('diag-open');await shot('diagnostic-results');
 await check(`document.getElementById('diag-output').value.includes('A 通常')&&document.getElementById('diag-output').value.includes('C 入力演出なし')`,'copyable summary has all conditions');
 await evaluate(`document.getElementById('diag-mode').value='voice-only'`);await click('diag-start');await sleep(150);
 await check(`!KukuSound.isPlaying()`,'voice-only condition has no music');
 await evaluate(`document.querySelector('[data-digit="3"]').click();document.querySelector('[data-digit="6"]').click()`);
 const speechDeadline=Date.now()+10000;
 while(!await evaluate(`KukuDiagnostics.report().events.some(e=>e.run===4&&e.type==='recording-end')`)) {
  if(Date.now()>speechDeadline)throw Error('recording completion timeout');await sleep(100);
 }
 await check(`KukuDiagnostics.report().events.some(e=>e.run===4&&e.type==='recording-start')&&KukuDiagnostics.report().events.some(e=>e.run===4&&e.type==='audio-call'&&e.name==='effect'&&e.skipped)`,'recording lifecycle recorded while effects are bypassed');
 await click('diag-open');await evaluate(`document.getElementById('diag-mode').value='synth-only'`);await click('diag-start');await sleep(150);
 await evaluate(`document.querySelector('[data-digit="3"]').click();document.querySelector('[data-digit="6"]').click()`);
 await check(`KukuSound.isPlaying()&&!KukuDiagnostics.report().events.some(e=>e.run===5&&e.type==='speech-created')&&KukuDiagnostics.report().events.some(e=>e.run===5&&e.type==='audio-call'&&e.name==='speak'&&e.skipped)`,'music and effects remain active without creating speech utterances');
 await click('diag-open');
 await check(`localStorage.getItem('kuku:learning:v1')===${JSON.stringify(original)}`,'speech experiments preserve normal learning data');
 console.log('PASS diagnostic report',JSON.stringify(await evaluate(`({runs:KukuDiagnostics.report().runs.length,events:KukuDiagnostics.report().events.length,capabilities:KukuDiagnostics.report().capabilities})`)));
} finally {
 if(injected)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
 await send('Emulation.clearDeviceMetricsOverride');
 await send('Page.navigate',{url:target});await sleep(500);await send('Page.reload');await sleep(400);
 await evaluate(`${diagnosticOriginal===null?"localStorage.removeItem('kuku:diagnostics:learning:v1')":`localStorage.setItem('kuku:diagnostics:learning:v1',${JSON.stringify(diagnosticOriginal)})`}`);
 await check(`!window.KukuDiagnostics&&!document.getElementById('diag-panel')`,'ordinary play has no diagnostic instrumentation');
 if(originalURL!==target)await send('Page.navigate',{url:originalURL});
 ws.close();
}
if(errors.length)throw Error(JSON.stringify(errors));
