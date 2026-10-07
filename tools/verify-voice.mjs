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

const preview=process.argv[3]||target;
if(preview!==target){await send('Page.navigate',{url:preview});await sleep(500);}
const original=await evaluate("localStorage.getItem('kuku:learning:v1')");
let injected;
try {
 await send('Runtime.enable');await send('Page.enable');
 injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__nativeSpeechCalls=0;
  for(const name of ['speak','cancel'])speechSynthesis[name]=()=>{__nativeSpeechCalls++;throw Error('Unexpected native speech');};
  const Audio=window.AudioContext;
  window.AudioContext=class extends Audio {constructor(...args){super(...args);window.__context=this;window.__decoded=[];}
   async decodeAudioData(bytes){const b=await super.decodeAudioData(bytes);__decoded.push(b);return b;}
  };
 `});
 await send('Page.reload');await sleep(400);
 await evaluate(`KukuStore.state.settings.voice=true;KukuStore.state.settings.sound=true;window.__originalPrepare=KukuVoiceFiles.prepare;window.__originalReady=KukuSound.ready;KukuSound.ready=()=>false;
 KukuVoiceFiles.prepare=()=>new Promise(resolve=>window.__releaseVoice=resolve);document.getElementById('tutorial-replay').click();`);
 await check(`!document.getElementById('voice-loading').hidden&&document.getElementById('input-controls').hidden`,'cold start waits before enabling answers');
 const time=await evaluate(`KukuLearning.daily(KukuStore.state,KukuLearning.day()).ms`);
 await sleep(450);
 await check(`KukuLearning.daily(KukuStore.state,KukuLearning.day()).ms===${time}`,'loading is excluded from learning time');
 await click('pause');await evaluate('__releaseVoice()');await sleep(50);
 await check(`document.getElementById('pause-dialog').open&&!KukuSound.isPlaying()`,'loading completion respects pause');
 await click('quit');
 await evaluate(`KukuVoiceFiles.prepare=async()=>{throw Error('Unavailable file')};document.getElementById('tutorial-replay').click()`);
 await sleep(30);
 await check(`!document.getElementById('voice-load-actions').hidden`,'failed loading offers retry and voice-free continuation');
 await click('voice-skip');await sleep(50);
 await check(`document.getElementById('voice-loading').hidden&&KukuSound.speak('にさんがろく')===false`,'failed recordings do not invoke native speech');
 await click('pause');await click('quit');
 await evaluate(`document.getElementById('tutorial-replay').click()`);await sleep(30);
 await evaluate(`KukuVoiceFiles.prepare=__originalPrepare`);await click('voice-retry');
 const deadline=Date.now()+15000;
 while(await evaluate(`!document.getElementById('voice-loading').hidden`)){if(Date.now()>deadline)throw Error('Voice retry timeout');await sleep(100);}
 await check(`__decoded.length===3`,'single-row round decodes only messages, cue and that row');
 await check(`Promise.all(Object.entries(KukuVoiceManifest.clips).map(async([text,clip])=>{const file=await KukuVoiceFiles.get(__context,text);return clip.offset+clip.duration<=file.buffer.duration+.005;})).then(values=>values.every(Boolean))`,'every recording lies inside its decoded bank');
 const count=await evaluate('__decoded.length');
 await click('pause');await click('quit');
 await check(`KukuSound.prepare().then(()=>__decoded.length===${count})`,'restarting uses cached decoded recordings');
 await evaluate(`KukuSound.ready=__originalReady;document.getElementById('tutorial-replay').click()`);
 await check(`document.getElementById('voice-loading').hidden&&document.getElementById('counter').textContent==='1 / 9'`,'cached round starts without a loading screen');
 await click('pause');await click('quit');
 await evaluate(`KukuSound.ready=()=>false;KukuVoiceFiles.prepare=()=>new Promise(resolve=>window.__releaseVoice=resolve);document.getElementById('tutorial-replay').click()`);
 await click('pause');await click('quit');await evaluate('__releaseVoice()');await sleep(50);
 await check(`!document.getElementById('home').hidden&&!KukuSound.isPlaying()`,'abandoned loading cannot restart a game');
 await check('__nativeSpeechCalls===0','no native speech calls in playback or cancellation');
 if(errors.length)throw Error(JSON.stringify(errors));
} finally {
 if(injected)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
 await evaluate(`KukuSound.cancelSpeech();KukuSound.stop();KukuStore.save();KukuStore.save=()=>true;KukuStore.queueSave=()=>{};`);
 await evaluate(original===null?`localStorage.removeItem('kuku:learning:v1')`:`localStorage.setItem('kuku:learning:v1',${JSON.stringify(original)})`);
 await send('Page.reload');
 if(preview!==target)await send('Page.navigate',{url:target});
 ws.close();
}
