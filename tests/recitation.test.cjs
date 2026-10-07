const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../js/recitation.js');
function setup(started=true){
 const spoken=[],steps=[];let done=0,stops=0;
 const flow=create({text:'にさんがろく',say(text,end){spoken.push({text,end});return started;},stop(){stops++;},onStep(name){steps.push(name);},onDone(){done++;}});
 const advance=ms=>{for(let i=0;i<ms;i+=50)flow.tick(50);};
 return {flow,spoken,steps,advance,get done(){return done;},get stops(){return stops;}};
}
test('recitation waits for the first voice to end rather than a fixed two-second timer',()=>{
 const r=setup();r.flow.start();r.advance(10000);assert.deepEqual(r.steps,['listen']);assert.equal(r.done,0);
 r.spoken[0].end(true);r.advance(400);assert.deepEqual(r.steps,['listen','cue']);
});
test('the full sequence is reading, spoken cue, reading again, then breathing room',()=>{
 const r=setup();r.flow.start();r.spoken[0].end(true);r.advance(400);
 assert.equal(r.spoken[1].text,'いってみよう。せーのっ！');r.spoken[1].end(true);r.advance(500);
 assert.equal(r.spoken[2].text,'にさんがろく');r.advance(8000);assert.equal(r.done,0);
 r.spoken[2].end(true);r.advance(850);assert.equal(r.done,0);r.advance(50);assert.equal(r.done,1);r.advance(5000);assert.equal(r.done,1);
});
test('pause excludes elapsed time and ignores stale audio completion',()=>{
 const r=setup();r.flow.start();const first=r.spoken[0];r.flow.pause();first.end(true);r.advance(20000);assert.equal(r.done,0);assert.equal(r.spoken.length,1);
 r.flow.resume();assert.equal(r.spoken.length,2);assert.equal(r.spoken[1].text,first.text);first.end(true);r.advance(1000);assert.equal(r.spoken.length,2);
 r.spoken[1].end(true);r.advance(400);assert.equal(r.spoken[2].text,'いってみよう。せーのっ！');
});
test('cancelling a question suppresses every remaining step',()=>{
 const r=setup();r.flow.start();r.flow.cancel();r.spoken[0].end(true);r.advance(60000);r.flow.resume();assert.equal(r.spoken.length,1);assert.equal(r.done,0);
});
test('voice-off mode keeps the same visual sequence with time to speak',()=>{
 const r=setup(false);r.flow.start();r.advance(2000);assert.deepEqual(r.steps,['listen']);r.advance(7000);assert.deepEqual(r.steps,['listen','cue','repeat']);assert.equal(r.done,1);
});
test('speech errors use paced fallback instead of skipping the exercise',()=>{
 const r=setup();r.flow.start();r.spoken[0].end(false);r.advance(2000);assert.equal(r.spoken.length,1);r.advance(800);assert.equal(r.spoken.length,2);
});
test('a speech engine that never finishes cannot trap the game forever',()=>{
 const r=setup();r.flow.start();r.advance(60000);assert.equal(r.done,1);assert.equal(r.stops,3);
});

test('correct answer repeats the full reading once and waits for completion and breathing room',()=>{
 const spoken=[];let done=0;
 const flow=create({text:'にさんがろく',repeatOnly:true,say(text,end){spoken.push({text,end});return true;},stop(){},onStep(){},onDone(){done++;}});
 flow.start();flow.tick(3000);assert.equal(done,0);assert.equal(spoken[0].text,'にさんがろく');
 spoken[0].end(true);flow.tick(850);assert.equal(done,0);flow.tick(50);assert.equal(done,1);assert.equal(spoken.length,1);
});
test('praise follows the complete reading without overlapping, and can be paused',()=>{
 const spoken=[];let done=0;
 const flow=create({text:'にさんがろく',repeatOnly:true,encouragement:'やったね！',say(text,end){spoken.push({text,end});return true;},stop(){},onStep(){},onDone(){done++;}});
 flow.start();flow.tick(2000);assert.equal(spoken.length,1);
 spoken[0].end(true);flow.tick(160);assert.equal(spoken[1].text,'やったね！');assert.equal(done,0);
 flow.pause();spoken[1].end(true);flow.tick(5000);assert.equal(done,0);
 flow.resume();assert.equal(spoken[2].text,'やったね！');spoken[2].end(true);flow.tick(180);assert.equal(done,1);
});
