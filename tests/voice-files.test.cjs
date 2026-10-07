const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'audio/tsumugi/manifest.json')));
test('every question, full answer and cue has a recording with matching local fallback bytes',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/data.js'),'utf8'),context);
 const texts=['いってみよう。せーのっ！',...Object.values(manifest.phrases)];
 for(const q of context.window.KukuData){const prefix=q.q_speak||q.q_read;texts.push(prefix,prefix+(q.a_speak||q.a_read));}
 assert.equal(texts.length,189);assert.equal(Object.keys(manifest.clips).length,189);
 for(const text of texts){const clip=manifest.clips[text];assert.ok(clip,text);assert.ok(clip.duration>0&&clip.duration<8);assert.ok(clip.offset>=0);assert.ok(manifest.banks[clip.bank]);}
 for(const [bank,info] of Object.entries(manifest.banks)){
  const binary=fs.readFileSync(path.join(root,info.file));assert.equal(binary.length,info.bytes);
  let received;vm.runInNewContext(fs.readFileSync(path.join(root,info.file.replace('.mp3','.js')),'utf8'),{KukuVoiceFiles:{receive(id,encoded){assert.equal(id,bank);received=Buffer.from(encoded,'base64');}}});
  assert.deepEqual(received,binary);
 }
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/voice-manifest.js'),'utf8'),context);
 assert.equal(JSON.stringify(context.window.KukuVoiceManifest),JSON.stringify(manifest));
});
function setup(){
 let fetches=0,decodes=0,fail=false;
 const context={window:{KukuVoiceManifest:manifest},location:{protocol:'https:'},AbortSignal,
  fetch:async()=>{fetches++;return {ok:!fail,arrayBuffer:async()=>new ArrayBuffer(1)};}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/voice-files.js'),'utf8'),context);
 const audio={decodeAudioData:async()=>{decodes++;return {duration:30};}};
 return {files:context.window.KukuVoiceFiles,audio,counts:()=>({fetches,decodes}),fail(value){fail=value;}};
}
test('preparation caches all banks so repeated answers do not fetch or decode',async()=>{
 const r=setup();await r.files.prepare(r.audio);const counts=r.counts();assert.equal(counts.fetches,11);assert.equal(counts.decodes,11);
 for(let i=0;i<3;i++){await r.files.get(r.audio,'ししちにじゅうはち');await r.files.get(r.audio,'ししじゅうろく');}
 await r.files.prepare(r.audio);assert.deepEqual(r.counts(),counts);
});
test('concurrent reads share decoding and a failed read can be retried',async()=>{
 const r=setup();r.fail(true);await assert.rejects(r.files.get(r.audio,'ししじゅうろく'));
 r.fail(false);await Promise.all([r.files.get(r.audio,'ししじゅうろく'),r.files.get(r.audio,'ししちにじゅうはち')]);
 assert.deepEqual(r.counts(),{fetches:2,decodes:1});
 await assert.rejects(r.files.get(r.audio,'unknown'));
});
test('prefetch does not decode or open audio; a single-row round only prepares three banks',async()=>{
 const r=setup(),banks=['messages','cue','dan-4'];
 await r.files.prefetch(banks);assert.deepEqual(r.counts(),{fetches:3,decodes:0});assert.equal(r.files.ready(banks),false);
 await r.files.prepare(r.audio,banks);assert.deepEqual(r.counts(),{fetches:3,decodes:3});assert.equal(r.files.ready(banks),true);
 await r.files.prepare(r.audio,banks);assert.deepEqual(r.counts(),{fetches:3,decodes:3});
 await r.files.prepare(r.audio,['messages','cue','dan-4','dan-7']);assert.deepEqual(r.counts(),{fetches:4,decodes:4});
});
