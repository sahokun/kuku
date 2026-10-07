const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../js/results.js');
test('result pages retain question order and cover all 81 responses without omission',()=>{
 const responses=Array.from({length:81},(_,i)=>({a:Math.floor(i/9)+1,b:i%9+1,ok:i%2===0,given:'0'}));
 const pages=Array.from({length:17},(_,i)=>R.page(responses,i));
 assert.deepEqual(pages.flatMap(p=>p.rows.map(r=>r.number)),Array.from({length:81},(_,i)=>i+1));
 assert.equal(pages[16].rows[0].equation,'9 × 9 = 81');assert.equal(pages[16].rows.length,1);
 assert.equal(R.page(responses,100).index,16);assert.equal(R.page(responses,-1).index,0);
});
test('results distinguish correct, wrong, revealed, timed out and listening responses',()=>{
 const rows=R.page([{a:4,b:7,ok:true},{a:4,b:4,ok:false,given:'14'},{a:2,b:3,ok:false,reason:'shown'},{a:3,b:3,ok:false,reason:'timeout'},{a:1,b:1,ok:null,kind:'listen'}]).rows;
 assert.deepEqual(rows.map(r=>r.mark),['○','×','×','×','♪']);
 assert.equal(rows[1].equation,'4 × 4 = 16');assert.ok(rows[1].note.includes('14'));
 assert.ok(rows[2].note.includes('みた'));assert.equal(rows[3].note,'じかんぎれ');
 assert.equal(rows[4].state,'listen');
 const empty=R.page([],5);assert.equal(empty.index,0);assert.equal(empty.pages,1);assert.deepEqual(empty.rows,[]);
});
