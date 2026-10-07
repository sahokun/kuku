window.KukuSound = (() => {
    let ctx,master,music,drums,echo,noise,voiceGain,timer=null,next=0,step=0,energy=0,playing=false;
    let beats=[],lastBeat=-10,phrase=0,speaking=false;
    const voices=new Set(),settings=()=>KukuStore.state.settings;
    const hz=n=>440*2**((n-69)/12);
    const chords=[[60,64,67],[65,69,72],[57,60,64],[55,59,62]];
    // Original four-bar hook; the opening motif becomes a full lead at the last stage.
    const melody=[[72,76,79,76,74,76,79,84],[81,79,77,76,77,81,79,77],[76,72,76,79,81,79,76,72],[74,79,83,81,79,74,71,74]];
    function init(){
        try{
            if(!ctx){
                const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
                ctx=new Audio({latencyHint:'interactive'});
                master=ctx.createGain();music=ctx.createGain();drums=ctx.createGain();
                const compressor=ctx.createDynamicsCompressor(),limiter=ctx.createDynamicsCompressor();
                compressor.threshold.value=-18;compressor.knee.value=16;compressor.ratio.value=3;compressor.attack.value=.006;compressor.release.value=.16;
                limiter.threshold.value=-2;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.08;
                music.connect(master);drums.connect(master);master.connect(compressor);compressor.connect(limiter);limiter.connect(ctx.destination);
                // Voice has its own mute/volume, but uses the same context as music.
                voiceGain=ctx.createGain();voiceGain.connect(limiter);
                echo=ctx.createDelay(.5);echo.delayTime.value=.21;
                const wet=ctx.createGain();wet.gain.value=.16;echo.connect(wet);wet.connect(music);
                noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.5),ctx.sampleRate);
                const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
                duck(speaking);
            }
            if(ctx.state==='suspended')ctx.resume().catch(()=>{});
            update();return true;
        }catch(_){return false;}
    }
    function register(source,nodes,at,length){
        voices.add(source);source.onended=()=>{source.disconnect();nodes.forEach(n=>n.disconnect());voices.delete(source);};
        source.start(at);source.stop(at+length+.03);
    }
    function tone(note,at,length,gain,type='triangle',target=music,pan=0,bright=3000){
        if(!ctx||voices.size>=64)return;
        const o=ctx.createOscillator(),g=ctx.createGain(),filter=ctx.createBiquadFilter(),stereo=ctx.createStereoPanner();
        o.type=type;o.frequency.value=hz(note);stereo.pan.value=pan;
        filter.type='lowpass';filter.frequency.setValueAtTime(bright,at);filter.frequency.exponentialRampToValueAtTime(Math.max(300,bright*.25),at+length);filter.Q.value=.6;
        g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+.007);g.gain.exponentialRampToValueAtTime(.0001,at+length);
        o.connect(filter);filter.connect(g);g.connect(stereo);stereo.connect(target);
        if(target===music&&note>65)stereo.connect(echo);
        register(o,[g,filter,stereo],at,length);
    }
    function percussion(kind,at,volume=1,target=drums){
        if(!ctx||voices.size>=64)return;
        const o=kind==='kick'?ctx.createOscillator():ctx.createBufferSource(),g=ctx.createGain();
        let length;
        const nodes=[g];
        if(kind==='kick'){
            length=.26;o.frequency.setValueAtTime(175,at);o.frequency.exponentialRampToValueAtTime(48,at+.13);o.connect(g);
        }else{
            length=kind==='crash'?.45:kind==='hat'?.055:.14;o.buffer=noise;
            const filter=ctx.createBiquadFilter();filter.type=kind==='clap'?'bandpass':'highpass';filter.frequency.value=kind==='hat'?7500:kind==='clap'?1700:4200;filter.Q.value=.6;
            o.connect(filter);filter.connect(g);nodes.push(filter);
        }
        const peak={kick:.55,clap:.24,hat:.08,crash:.15}[kind]*volume;
        g.gain.setValueAtTime(peak,at);g.gain.exponentialRampToValueAtTime(.0001,at+length);g.connect(target);
        register(o,nodes,at,length);
    }
    function schedule(){
        if(!playing||!ctx||!settings().sound)return;
        const measured=window.KukuDiagnostics?.begin('audio.schedule');
        const duration=60/(116+energy*20)/4;
        if(next<ctx.currentTime-.2)next=ctx.currentTime;
        while(next<ctx.currentTime+.12){
            phrase=Math.floor(step/16)%4;
            const chord=chords[phrase],s=step%16,shift=energy>=.82?2:0;
            if(s%4===0){percussion('kick',next,.85);beats.push(next);}
            if(s%2===0){
                const note=chord[[0,2,1,2,0,1,2,1][s/2]]+12+shift;
                tone(note,next,.20,energy<.65?.15:.06,'triangle',music,s%4?-.3:.3,4000);
            }
            // Bass starts with the first response, followed by clap, chords and lead.
            if(energy>=.2&&s%4===2)tone(chord[s%8===2?0:2]-24+shift,next,.25,.29,'sawtooth',music,0,650);
            if(energy>=.38&&s%8===4){percussion('clap',next);percussion('clap',next+.018,.6);}
            if(energy>=.38&&s%2===0)percussion('hat',next,s%4===2?.8:.4);
            if(energy>=.65&&[0,6,10].includes(s))chord.forEach((n,i)=>tone(n+shift,next,.19,.065,'sawtooth',music,(i-1)*.3,2400));
            if(energy>=.82&&s%2===0){
                const lead=melody[phrase][s/2]+shift;
                tone(lead,next,duration*1.65,.12,'sawtooth',music,-.12,3800);
                tone(lead+12,next,duration*1.4,.028,'triangle',music,.18,4500);
            }
            if(energy>=.65&&phrase===3&&s>=12)percussion('clap',next,.3+(s-12)*.12);
            if(energy>=.82&&s===0)percussion('crash',next,.8);
            step++;next+=duration;
        }
        beats=beats.filter(t=>t>=ctx.currentTime-.3);
        measured?.();
    }
    function pulse(){
        if(!playing||!settings().sound||!ctx||ctx.state!=='running')return 0;
        while(beats.length&&beats[0]<=ctx.currentTime)lastBeat=beats.shift();
        return Math.max(0,1-(ctx.currentTime-lastBeat)/.25);
    }
    function start(){
        stop();playing=true;step=0;phrase=0;
        if(!settings().sound||!init())return;
        next=ctx.currentTime+.04;schedule();timer=setInterval(schedule,30);
    }
    function stop(){
        playing=false;clearInterval(timer);timer=null;beats=[];lastBeat=-10;
        voices.forEach(o=>{try{o.stop();}catch(_){}});
    }
    function effect(kind,combo=0){
        if(!settings().sound||!init())return;
        const chord=chords[phrase],t=ctx.currentTime,shift=energy>=.82?2:0;
        if(kind==='ready'){tone(79,t,.09,.10,'sine',master);tone(84,t+.055,.12,.085,'triangle',master);}
        if(kind==='key')tone(chord[Math.abs(combo)%3]+12+shift,t,.085,.14,'triangle',master);
        if(kind==='correct'){
            // A low impact, bright octave and rising answer flourish form one chord.
            percussion('kick',t,.65,master);
            [0,1,2,0].forEach((v,i)=>tone(chord[v]+12+shift+(i===3?12:0),t+i*.045,.28,.18,'triangle',master));
            if(combo>0&&combo%3===0){
                percussion('crash',t+.14,.7,master);
                chord.forEach((n,i)=>tone(n+24+shift,t+.18+i*.055,.35,.10,'sine',master,(i-1)*.4));
            }
        }
        if(kind==='reveal'){tone(chord[1]+shift,t,.15,.10,'triangle',master);tone(chord[2]+shift,t+.1,.18,.10,'triangle',master);}
        if(kind==='lift'){
            [0,1,2,0].forEach((v,i)=>tone(chord[v]+12+shift+(i===3?12:0),t+i*.07,.22,.10,'sawtooth',master,0,2400));
            percussion('crash',t+.22,.7,master);
        }
        if(kind==='finish'){
            // A complete cadence instead of stopping on an arbitrary accompaniment chord.
            [72,76,79,84,79,84].forEach((n,i)=>tone(n,t+i*.13,.55,.18,'triangle',master));
            [60,64,67,72].forEach(n=>tone(n,t+.8,.9,.10,'sawtooth',master,0,2600));
            percussion('crash',t+.8,1,master);
        }
    }
    function duck(value){
        speaking=value;if(!ctx)return;
        music.gain.setTargetAtTime(value?.24:1,ctx.currentTime,value?.04:.18);
        drums.gain.setTargetAtTime(value?.42:.9,ctx.currentTime,value?.04:.18);
    }
    let speechGeneration = 0, recording = null, voiceAvailable = true;
    function ready(banks) { return !settings().voice || voiceAvailable && !!window.KukuVoiceFiles?.ready(banks); }
    function warm(banks) {
        if (settings().voice) window.KukuVoiceFiles?.prefetch(banks).catch(() => {});
    }
    function voiceText(id) { return window.KukuVoiceManifest?.phrases?.[id]; }
    function message(id, onDone) {
        const text = voiceText(id);
        return text ? speak(text, onDone) : false;
    }
    async function prepare(banks) {
        voiceAvailable = true;
        if (!settings().voice) return true;
        if (!init() || !window.KukuVoiceFiles) return false;
        try { await window.KukuVoiceFiles.prepare(ctx, banks); return true; }
        catch (_) { voiceAvailable = false; return false; }
    }
    function speak(text, onDone) {
        cancelSpeech();
        if (!settings().voice || !voiceAvailable || !window.KukuVoiceFiles?.clip(text) || !init())
            return false;
        const token = speechGeneration;
        let finished = false;
        const release = ended => {
            if (token !== speechGeneration || finished) return;
            finished = true;
            recording?.disconnect(); recording = null;
            duck(false);
            window.KukuDiagnostics?.voice(ended ? 'end' : 'error', { id: token, text });
            onDone?.(ended);
        };
        window.KukuVoiceFiles.get(ctx, text).then(clip => {
            if (token !== speechGeneration || !settings().voice) return;
            const source = ctx.createBufferSource();
            source.buffer = clip.buffer; source.connect(voiceGain);
            source.onended = () => release(true);
            recording = source;
            duck(true);
            source.start(0, clip.offset, clip.duration);
            window.KukuDiagnostics?.voice('start', { id: token, text, duration: clip.duration });
        }).catch(() => release(false));
        return true;
    }
    function cancelSpeech() {
        speechGeneration++;
        if (recording) {
            recording.onended = null;
            try { recording.stop(); } catch (_) { /* Already ended. */ }
            recording.disconnect(); recording = null;
        }
        duck(false);
    }
    function update(){if(ctx){master.gain.setTargetAtTime(settings().sound?settings().volume*.78:0,ctx.currentTime,.03);voiceGain.gain.setTargetAtTime(settings().voice?settings().volume:0,ctx.currentTime,.03);}}
    function setEnergy(e){energy=Math.max(0,Math.min(1,e));}
    return {start,stop,pulse,effect,speak,cancelSpeech,prepare,ready,warm,phrase:voiceText,message,update,setEnergy,isPlaying(){return playing&&settings().sound&&ctx?.state==='running';}};
})();
