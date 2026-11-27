const {test}=require('node:test');
const assert=require('node:assert/strict');
const V=require('../js/version.js');
test('the current version is the newest change note and every note is well formed',()=>{
 assert.equal(V.version,V.notes[0].version);
 const seen=new Set();
 for(const n of V.notes){
  assert.match(n.version,/^\d{4}\.\d{2}\.\d{2}(\.\d+)?$/);
  assert.match(n.date,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(n.version.startsWith(n.date.replaceAll('-','.')),n.version);
  assert.ok(Array.isArray(n.items)&&n.items.length>0&&n.items.every(t=>typeof t==='string'&&t.trim()));
  assert.ok(!seen.has(n.version));seen.add(n.version);
 }
 const order=V.notes.map(n=>n.version.split('.').map(Number));
 for(let i=1;i<order.length;i++){
  const a=order[i-1],b=order[i];let cmp=0;
  for(let k=0;k<4&&!cmp;k++)cmp=(a[k]||0)-(b[k]||0);
  assert.ok(cmp>0,'notes must be newest first');
 }
});
