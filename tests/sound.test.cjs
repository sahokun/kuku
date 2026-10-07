const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function audioSetup(){
 const nodes=[],sources=[],intervals=new Set(),settings={sound:true,voice:true,volume:.55};
 const param=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;}});
 function node(kind){const n={kind,links:[],disconnected:false,connect(to){this.links.push(to);},disconnect(){this.disconnected=true;},gain:param(),frequency:param(),Q:param(),pan:param(),delayTime:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};nodes.push(n);return n;}
 function source(kind){const n=node(kind);n.start=()=>{n.started=true;};n.stop=at=>{if(at===undefined){n.ended=true;n.onended?.();}};sources.push(n);return n;}
 class Audio{
  constructor(){this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination=node('destination');}
  createGain(){return node('gain');}createDynamicsCompressor(){return node('compressor');}
  createDelay(){return node('delay');}createBiquadFilter(){return node('filter');}createStereoPanner(){return node('panner');}
  createOscillator(){return source('oscillator');}createBufferSource(){return source('noise');}
  createBuffer(_channels,length){return {getChannelData:()=>new Float32Array(length)};}
 }
 const pending=[], files={clip:text=>text!=='missing', prepare:async()=>{}, get:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
 const synth={cancel(){throw Error('Native speech must not be used');},speak(){throw Error('Native speech must not be used');}};
 class Utterance{constructor(text){this.text=text;}}
 const context={window:{AudioContext:Audio,KukuVoiceFiles:files,speechSynthesis:synth,SpeechSynthesisUtterance:Utterance},speechSynthesis:synth,SpeechSynthesisUtterance:Utterance,KukuStore:{state:{settings}},setInterval(fn){intervals.add(fn);return fn;},clearInterval(fn){intervals.delete(fn);}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/sound.js'),'utf8'),context);
 return {sound:context.window.KukuSound,nodes,sources,intervals,settings,pending,files};
}
test('restarting music releases previous voices and keeps one scheduler',()=>{
 const r=audioSetup();r.sound.setEnergy(.95);r.sound.start();const first=[...r.sources];assert.ok(first.length>0);assert.equal(r.intervals.size,1);
 r.sound.start();assert.ok(first.every(s=>s.ended&&s.disconnected));assert.equal(r.intervals.size,1);
 r.sound.stop();assert.equal(r.intervals.size,0);assert.ok(r.sources.every(s=>s.ended&&s.disconnected));assert.equal(r.sound.pulse(),0);
});
test('rapid celebrations have a bounded voice count and recover after stopping',()=>{
 const r=audioSetup();for(let i=0;i<30;i++)r.sound.effect('correct',3);assert.equal(r.sources.length,64);
 r.sound.stop();assert.ok(r.sources.every(s=>s.disconnected));r.sound.effect('correct',1);assert.ok(r.sources.length>64);
});
test('muting prevents effects and silences the active master gain',()=>{
 const r=audioSetup();r.settings.sound=false;r.sound.effect('correct');assert.equal(r.nodes.length,0);
 r.settings.sound=true;r.sound.start();const master=r.nodes.find(n=>n.kind==='gain');assert.ok(master.gain.value>0);
 r.settings.sound=false;r.sound.update();assert.equal(master.gain.value,0);assert.equal(r.sound.isPlaying(),false);
});
test('recitation lowers melody and drums independently then restores both',async()=>{
 const r=audioSetup();r.sound.start();const [,music,drums]=r.nodes.filter(n=>n.kind==='gain');
 r.sound.speak('にさんがろく');r.pending[0].resolve({buffer:{},offset:0,duration:1});await Promise.resolve();assert.equal(music.gain.value,.24);assert.equal(drums.gain.value,.42);
 r.sources.at(-1).onended();assert.equal(music.gain.value,1);assert.equal(drums.gain.value,.9);
 r.sound.stop();
});

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const clip={buffer:{},offset:2,duration:1.5};
test('recording completes only when the buffer finishes, exactly once',async()=>{
 const r=audioSetup(),results=[];
 assert.equal(r.sound.speak('にさんがろく',ok=>results.push(ok)),true);
 r.pending[0].resolve(clip);await flush();assert.deepEqual(results,[]);
 const source=r.sources.at(-1);source.onended();source.onended();assert.deepEqual(results,[true]);assert.equal(source.disconnected,true);
});
test('cancelling pending loads and replacing playback cannot finish the next exercise',async()=>{
 const r=audioSetup(),results=[];
 r.sound.speak('にさんがろく',ok=>results.push(ok));r.sound.cancelSpeech();
 r.pending[0].resolve(clip);await flush();assert.equal(r.sources.length,0);
 r.sound.speak('にしがはち',ok=>results.push(ok));r.pending[1].resolve(clip);await flush();
 const old=r.sources.at(-1),ended=old.onended;
 r.sound.speak('ししじゅうろく',ok=>results.push(ok));ended();
 assert.equal(old.ended,true);assert.equal(old.disconnected,true);assert.deepEqual(results,[]);
 r.pending[2].resolve(clip);await flush();r.sources.at(-1).onended();assert.deepEqual(results,[true]);
});
test('voice works without music and mute controls stay independent',async()=>{
 const r=audioSetup();r.settings.sound=false;
 r.sound.speak('にさんがろく');r.pending[0].resolve(clip);await flush();
 const [master,,,voice]=r.nodes.filter(n=>n.kind==='gain');
 assert.equal(master.gain.value,0);assert.equal(voice.gain.value,.55);assert.equal(r.sources.at(-1).started,true);
 r.settings.sound=true;r.settings.voice=false;r.sound.update();
 assert.ok(master.gain.value>0);assert.equal(voice.gain.value,0);assert.equal(r.sound.speak('にさんがろく'),false);
});
test('missing recordings and decode failures allow the lesson fallback',async()=>{
 const r=audioSetup(),results=[];
 assert.equal(r.sound.speak('missing'),false);
 r.sound.speak('にさんがろく',ok=>results.push(ok));r.pending[0].reject(Error('decode failed'));await flush();assert.deepEqual(results,[false]);
 r.files.prepare=async()=>{throw Error('offline');};assert.equal(await r.sound.prepare(),false);assert.equal(r.sound.speak('にさんがろく'),false);
 r.files.prepare=async()=>{};assert.equal(await r.sound.prepare(),true);assert.equal(r.sound.speak('にさんがろく'),true);
});
