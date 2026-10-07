const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const L=require('../js/learning.js'),R=require('../js/rewards.js');
function setup(idle=true){
 const pending=new Map();let serial=0,writes=0,saved=null,fail=false;
 const schedule=fn=>{const id=++serial;pending.set(id,fn);return id;};
 const window={matchMedia:()=>({matches:false})};
 if(idle){window.requestIdleCallback=schedule;window.cancelIdleCallback=id=>pending.delete(id);}
 const context={window,KukuLearning:L,KukuRewards:R,localStorage:{getItem:()=>saved,setItem(key,value){if(fail)throw Error('quota');writes++;saved=value;}},setTimeout:schedule,clearTimeout:id=>pending.delete(id)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/store.js'),'utf8'),context);
 return {store:window.KukuStore,pending,flush(){for(const [id,fn] of [...pending]){pending.delete(id);fn();}},get writes(){return writes;},get saved(){return JSON.parse(saved);},fail(){fail=true;}};
}
test('answer saves are coalesced outside input handling and persist the latest state',()=>{
 const s=setup();let notified=0;s.store.queueSave(()=>notified++);s.store.state.focusDan=7;s.store.queueSave();
 assert.equal(s.writes,0);assert.equal(s.pending.size,1);s.flush();assert.equal(s.writes,1);assert.equal(s.saved.focusDan,7);assert.equal(notified,1);
});
test('explicit pause or page-exit save flushes current progress and cancels the pending save',()=>{
 const s=setup();s.store.queueSave();s.store.state.focusDan=8;s.store.save();
 assert.equal(s.saved.focusDan,8);assert.equal(s.pending.size,0);s.flush();assert.equal(s.writes,1);
});
test('the delayed-save fallback works without idle callbacks and reports storage failure',()=>{
 const s=setup(false);let notified=false;s.store.queueSave(()=>notified=true);assert.equal(s.writes,0);s.fail();s.flush();
 assert.equal(s.store.available,false);assert.equal(notified,true);assert.equal(s.pending.size,0);assert.equal(s.store.state.version,1);
});
test('diagnostic sessions copy normal progress but never overwrite normal learning data',()=>{
 const initial=L.fresh();initial.focusDan=6;initial.settings.sound=true;
 const raw=JSON.stringify(initial),values=new Map([['kuku:learning:v1',raw],['kuku:diagnostics:learning:v1','{"focusDan":9}']]);
 const window={location:{hash:'#diagnostics'},matchMedia:()=>({matches:false})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/store.js'),'utf8'),{window,KukuLearning:L,KukuRewards:R,
  localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},clearTimeout});
 const store=window.KukuStore;
 assert.equal(store.state.focusDan,6);assert.equal(store.state.settings.sound,true);
 store.state.focusDan=4;store.save();
 assert.equal(values.get('kuku:learning:v1'),raw);
 assert.equal(JSON.parse(values.get('kuku:diagnostics:learning:v1')).focusDan,4);
});
test('diagnostic instrumentation does not access browser APIs during ordinary play',()=>{
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/diagnostics.js'),'utf8'),{location:{hash:''}});
});
