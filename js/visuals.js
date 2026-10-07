window.KukuVisuals = (() => {
    // Independent SVG character, with separate body, face, wings and feet.
    const svg = `<svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg"><ellipse cx="100" cy="160" rx="49" ry="7" fill="#263b43" opacity=".09"/><g class="bird"><g class="foot-left"><path d="M80 137v17l-16 4" fill="none" stroke="#d28343" stroke-width="8" stroke-linecap="round"/></g><g class="foot-right"><path d="M121 137v17l15 4" fill="none" stroke="#d28343" stroke-width="8" stroke-linecap="round"/></g><path d="M64 58Q50 27 78 35L89 52Q101 19 117 38L111 58" fill="#e9765f" stroke="#263b43" stroke-width="3" stroke-linejoin="round"/><path d="M45 101Q39 50 97 49Q152 42 156 103Q160 146 105 149Q50 151 45 101" fill="#ffcd62" stroke="#263b43" stroke-width="3"/><ellipse cx="101" cy="115" rx="34" ry="25" fill="#fff4d3"/><g class="wing-left"><path d="M52 90Q19 81 26 112Q33 127 56 113" fill="#f5b747" stroke="#263b43" stroke-width="3"/></g><g class="wing-right"><path d="M149 91Q180 74 177 107Q171 125 149 113" fill="#f5b747" stroke="#263b43" stroke-width="3"/></g><g class="face"><g class="smile-eyes" fill="none" stroke="#263b43" stroke-width="5" stroke-linecap="round" opacity="0"><path d="M72 87q6-12 12 0M115 87q6-12 12 0"/></g><ellipse cx="78" cy="85" rx="5" ry="7" fill="#263b43"/><ellipse cx="121" cy="85" rx="5" ry="7" fill="#263b43"/><ellipse cx="65" cy="98" rx="10" ry="5" fill="#ed8965"/><ellipse cx="134" cy="98" rx="10" ry="5" fill="#ed8965"/><path class="beak" d="M89 96L101 106L112 96Z" fill="#e9765f" stroke="#263b43" stroke-width="2.5" stroke-linejoin="round"/></g><g class="parade-crown"><path d="M66 53 60 20 82 33 100 11 119 33 141 20 134 53Q100 62 66 53Z" fill="#ffe146" stroke="#72516e" stroke-width="3" stroke-linejoin="round"/><path d="M72 49Q101 55 129 49" fill="none" stroke="#fff8b7" stroke-width="5"/><path d="m100 31 5 6-5 6-5-6Z" fill="#ef5d9c"/></g></g></svg>`;

    const $ = id => document.getElementById(id);
    const hosts = [...document.querySelectorAll('.mascot-host')];
    const parts = el => ({el, body:el.querySelector('.bird'), left:el.querySelector('.wing-left'),
        right:el.querySelector('.wing-right'), eyes:[...el.querySelectorAll('.face > ellipse')].slice(0,2),
        smile:el.querySelector('.smile-eyes'), beak:el.querySelector('.beak')});
    hosts.forEach(h => h.innerHTML=svg);
    const birds=hosts.map(parts), audience=document.querySelector('.audience');
    // Rasterize small repeated characters once, retaining the articulated lead SVG.
    function raster(svgText, done) {
        const img = new Image();
        img.onload = () => { const bitmap = document.createElement('canvas');bitmap.width=160;bitmap.height=144;bitmap.getContext('2d').drawImage(img,0,0,160,144);done(bitmap); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText.replace('<svg ', '<svg style="overflow:visible" ').replace('<g class="parade-crown">','<g class="parade-crown" style="display:none">'));
    }
    let sprite = null;
    raster(svg, bitmap => sprite = bitmap);
    const guestColors = ['#ffc76a','#a7dfbe','#d6a4ee','#ffaecf','#a1dce9','#e0e99c'];
    const guests=Array.from({length:6},(_,i)=>{
        const el=document.createElement('div');el.className='parade-guest';
        let art=svg.replaceAll('#ffcd62',guestColors[i]);
        if(i<2) art=art.replace('</g></svg>', '<g fill="#f9f0cd" stroke="#694b70" stroke-width="3"><path d="M67 120h66v22q-33 16-66 0z"/><ellipse cx="100" cy="120" rx="33" ry="9"/></g></g></svg>');
        raster(art, bitmap => { const img=new Image();img.alt='';img.src=bitmap.toDataURL();el.append(img); });
        audience.append(el);return {el};
    });
    const canvas=$('particles'),c=canvas.getContext('2d'),front=$('foreground'),f=front.getContext('2d'),bg=$('background');
    const stage=document.querySelector('.stage'),cheer=$('stage-cheer'),seal=$('answer-seal');
    const colors=['#ff4b8a','#ffd437','#49dbc5','#8652e5','#ff9738','#ffffff'];
    let gl,timeLoc,energyLoc,resolutionLoc,beatLoc,hitLoc;
    let frame,last=0,lastPaint=0,clock=0,paused=false,scene='home',energy=.08,smoothed=.08;
    let particles=[],rings=[],ribbons=[],flights=[],deliveries=[],gains=[],scheduled=[],animations=new Set();
    let action=null,reciting=false,impact=0,celebration=0,finaleUntil=0,nextAmbient=0,nextFirework=0;
    let completed=0,total=10,level=0,beat=0;
    let geometry = {}, geometryDirty = true, lastBackground = 0, lastMotion = null;
    let frameCost = 0, quality = 1, lastQualityChange = 0;
    const coarse = matchMedia('(pointer:coarse)').matches;
    const pixelScale = () => Math.min(devicePixelRatio||1,coarse ? 1.1 : 1.5) * quality;
    function measureGeometry() {
        geometryDirty=false;
        const host=birds.find(b=>!b.el.closest('[hidden]'))?.el;
        const r=host?.getBoundingClientRect();
        geometry.center=r?{x:r.left+r.width/2,y:r.top+r.height*.55}:{x:innerWidth/2,y:innerHeight*.28};
        geometry.answer=$('answer').getBoundingClientRect();geometry.score=$('game-score').getBoundingClientRect();
        geometry.question=document.querySelector('.question-card').getBoundingClientRect();
        geometry.keys=new Map([...document.querySelectorAll('[data-digit]')].map(el=>[el.dataset.digit,el.getBoundingClientRect()]));
        geometry.lights=[...$('parade-lights').children].map(el=>el.getBoundingClientRect());
    }
    const motion=()=>KukuStore.state.settings.motion;
    const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
    function animate(el,frames,options){
        if(!motion()||!el) return;
        const a=el.animate(frames,options);animations.add(a);
        a.onfinish=()=>animations.delete(a);a.oncancel=()=>animations.delete(a);
        if(paused)a.pause();return a;
    }
    function later(delay,fn){scheduled.push({at:clock+delay,fn});}
    function center(){return geometry.center || {x:innerWidth/2,y:innerHeight*.28};}
    function resize(){
        const scale=pixelScale(), height=window.visualViewport?.scale === 1 ? window.visualViewport.height : innerHeight;
        for(const [cv,ctx] of [[canvas,c],[front,f]]){
            const w=Math.round(innerWidth*scale),h=Math.round(height*scale);
            if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;ctx?.setTransform(scale,0,0,scale,0,0);}
        }
        const bgScale=(coarse ? .48 : .6)*quality;
        const width=Math.round(innerWidth*bgScale), backgroundHeight=Math.round(height*bgScale);
        if(bg.width!==width||bg.height!==backgroundHeight){bg.width=width;bg.height=backgroundHeight;}
        if(gl)gl.viewport(0,0,bg.width,bg.height);
        geometryDirty=true;
    }
    function initGL() {
        try {
            gl = bg.getContext('webgl', { alpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
            if (!gl)
                throw Error('unavailable');
            const shader = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
                throw Error('shader'); return sh; };
            const vs = shader(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
            const fs = shader(gl.FRAGMENT_SHADER, `
                precision mediump float;
                uniform float t,e,b,h; uniform vec2 r;
                void main(){
                    vec2 uv=gl_FragCoord.xy/r;
                    float strength=smoothstep(.12,.85,e);
                    vec3 top=mix(vec3(.89,.84,1.),vec3(.57,.65,.98),strength);
                    vec3 bottom=mix(vec3(1.,.91,.84),vec3(1.,.67,.82),strength);
                    float ribbon=uv.y+.055*sin(uv.x*5.+t*.3);
                    vec3 col=mix(bottom,top,smoothstep(.12,.95,ribbon));
                    // Floating candy tiles, with no radial spokes or tunnel rings.
                    vec2 grid=vec2(gl_FragCoord.x/r.y,uv.y)*12.;
                    grid.y+=t*(.12+e*.16);
                    vec2 cell=floor(grid),q=fract(grid)-.5;
                    float seed=fract(sin(dot(cell,vec2(17.17,91.7)))*437.5);
                    float tile=1.-smoothstep(.10,.16,max(abs(q.x),abs(q.y)));
                    tile*=step(.64,seed);
                    vec3 candy=mix(vec3(1.,.96,.62),vec3(.74,1.,.93),step(.82,seed));
                    col=mix(col,candy,tile*(.18+strength*.3+b*.08));
                    float sweep=1.-smoothstep(.0,.27,abs(uv.y-h*1.3));
                    col=mix(col,vec3(1.,.93,.62),sweep*h*.30);
                    col=mix(col,vec3(1.,.86,.53),smoothstep(.80,1.,e)*(.15+.10*uv.y));
                    col=mix(vec3(1.,.975,.93),col,smoothstep(0.,.15,e));
                    gl_FragColor=vec4(col,1.);
                }`);
            const program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS))
                throw Error('link');
            gl.useProgram(program);
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
            const p = gl.getAttribLocation(program, 'p');
            gl.enableVertexAttribArray(p);
            gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
            timeLoc = gl.getUniformLocation(program, 't');
            energyLoc = gl.getUniformLocation(program, 'e');
            beatLoc = gl.getUniformLocation(program, 'b');
            hitLoc = gl.getUniformLocation(program, 'h');
            resolutionLoc = gl.getUniformLocation(program, 'r');
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            document.body.classList.remove('backdrop-fallback');
        }
        catch (_) {
            gl = null;
            document.body.classList.add('backdrop-fallback');
        }
    }

    function emit(x,y,count,power=240,kind='paper'){
        const n=Math.round(count*motion());
        for(let i=0;i<n;i++){
            if(particles.length>=260)particles.shift();
            const a=Math.random()*Math.PI*2,v=power*(.4+Math.random()*.6),life=kind==='spark'?.65:1.2+Math.random()*.7;
            particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-80,life,max:life,
                angle:a,spin:(Math.random()-.5)*12,color:colors[i%colors.length],
                kind:kind==='paper'?(i%9===0?'bird':i%3===0?'star':'paper'):kind,size:5+Math.random()*5});
        }
    }
    function ring(x,y,radius=160){if(motion())rings.push({x,y,radius,life:.6});rings=rings.slice(-8);}
    function cannons(){
        if(!motion())return;
        const y=Math.min(innerHeight*.48,(geometry.question?.top || innerHeight*.3)+30);
        for(const side of [-1,1])for(let i=0;i<3;i++)ribbons.push({x:side<0?-8:innerWidth+8,y,
            vx:-side*(180+i*55),vy:-260-i*60,life:1.65,color:colors[i+(side>0?2:0)],trail:[]});
        ribbons=ribbons.slice(-18);
    }
    function announce(text){
        cheer.textContent=text;cheer.classList.add('visible');celebration=clock+2.1;
        animate(cheer,[{scale:.45,rotate:'-14deg'},{scale:1.16,rotate:'3deg',offset:.55},{scale:1,rotate:'0deg'}],{duration:360,easing:'cubic-bezier(.2,.8,.2,1)'});
    }
    function setEnergy(e){
        energy=clamp(e);document.documentElement.style.setProperty('--energy',String(energy));
        level=energy<.38?0:energy<.65?1:energy<.82?2:3;
        document.body.dataset.tier=String(level);
    }
    function progress(done,count){
        const old=completed;completed=done;total=count;
        const lights=$('parade-lights');
        const lamps=Math.min(10,total),lit=Math.floor(completed/total*lamps);
        if(lights.children.length!==lamps){geometryDirty=true;lights.replaceChildren();for(let i=0;i<lamps;i++)lights.append(document.createElement('i'));}
        [...lights.children].forEach((el,i)=>el.classList.toggle('lit',i<lit));
        $('parade-count').textContent=`${completed} / ${total}`;
        $('parade-label').textContent=['ぱれーど はじまるよ','なかまが きたよ！','みんなで おどろう！','おまつり ぜんかい！'][level];
        if(completed>old&&motion()){
            const from=geometry.answer,to=geometry.lights?.[Math.min(lamps-1,Math.floor((completed-1)/total*lamps))];
            if(from&&to)deliveries.push({x:from.left+from.width/2,y:from.top+from.height/2,tx:to.left+to.width/2,ty:to.top+to.height/2,start:clock});
        }
    }
    function burst(big=false,combo=0){
        const p=center();impact=1;reciting=!big;
        action={kind:'correct',start:clock,spin:combo>0&&combo%3===0};
        emit(p.x,p.y,big?95:34+level*10,220+level*40);ring(p.x,p.y,big?270:150);
        // The first hit is immediate; a second accent makes the reward land in two beats.
        later(.17,()=>{emit(p.x,p.y,18+level*6,300,'spark');if(big||level>=1)cannons();});
        if(big){
            finaleUntil=clock+5.5;nextFirework=clock+.5;
            animate($('result-title'),[{scale:.6},{scale:1.1,offset:.6},{scale:1}],{duration:600});
            return;
        }
        seal.textContent=combo>=3?`${combo}れんぞく！`:'できた！';
        animate(seal,[{scale:2.2,opacity:0,rotate:'-15deg'},{scale:.92,opacity:1,rotate:'2deg',offset:.7},{scale:1,opacity:1,rotate:'0deg'}],{duration:300});
        animate($('answer'),[{scale:1},{scale:1.38,offset:.3},{scale:.95,offset:.7},{scale:1}],{duration:380});
        const milestone=completed===Math.ceil(total*.3)||completed===Math.ceil(total*.6)||completed===Math.ceil(total*.8);
        announce(milestone?['','なかまが きた！','みんなで おどろう！','おまつり ぜんかい！'][level]||'やった！':combo>=3?`${combo}もん れんぞく！`:['やったー！','いいねっ！','そのちょうし！'][completed%3]);
        if(milestone||combo>0&&combo%3===0){
            later(.38,()=>{const q=center();ring(q.x,q.y,230);emit(q.x,q.y,28,340,'star');});
        }
    }
    function digit(text){
        const key=document.querySelector(`[data-digit="${text}"]`),from=geometry.keys?.get(text),to=geometry.answer;
        animate(key,[{transform:'translateY(5px) scale(.88)',background:'#ffd34f'},{transform:'translateY(-2px) scale(1.05)',offset:.6},{transform:'translateY(0) scale(1)'}],{duration:250});
        if(from&&to&&motion())flights.push({text,x:from.left+from.width/2,y:from.top+from.height/2,tx:to.left+to.width/2,ty:to.top+to.height/2,start:clock});
        flights=flights.slice(-3);
    }
    function star(ctx,x,y,size){
        ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?size*.45:size;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.closePath();ctx.fill();
    }
    function paintBird(b,i,dt){
        const m=motion(),age=action?clock-action.start:99;
        const groove=(window.KukuSound?.isPlaying()?beat:Math.max(0,Math.sin(clock*Math.PI*4)))*m;
        let hop=-groove*(3+level*2),rotate=Math.sin(clock*3+i)*2,sx=1,sy=1;
        const dance=reciting||scene==='result'||level>=2;
        if(dance){hop-=Math.abs(Math.sin(clock*7+i))*(6+level*2);rotate=Math.sin(clock*5+i)*9;sx=1+groove*.04;sy=1-groove*.05;}
        if(age<.14){hop=10*age/.14;sx=1.18;sy=.78;}
        else if(age<.85){const p=(age-.14)/.71;hop=-Math.sin(p*Math.PI)*(action.kind==='reveal'?14:48+level*8);sx=1-.13*Math.sin(p*Math.PI*2);sy=1+.18*Math.sin(p*Math.PI*2);rotate=action.spin&&m>.3?360*(1-(1-p)**3):Math.sin(p*Math.PI*2)*18;}
        const size=scene==='game'?1.06+level*.025:scene==='result'?1.15:1;
        b.body.setAttribute('transform',`translate(100 ${130+hop*m}) rotate(${action?.spin&&m>.3&&age<.85?rotate:rotate*m}) scale(${size*(1+(sx-1)*m)} ${size*(1+(sy-1)*m)}) translate(-100 -130)`);
        const flap=(Math.sin(clock*(dance?12:5)+i)*(dance?40:10)+groove*20)*m;
        b.left.setAttribute('transform',`rotate(${flap} 52 100)`);b.right.setAttribute('transform',`rotate(${-flap} 149 100)`);
        const happy=reciting&&action?.kind!=='reveal'||scene==='result';
        b.smile.setAttribute('opacity',happy?'1':'0');
        b.eyes.forEach(eye=>{eye.setAttribute('opacity',happy?'0':'1');eye.setAttribute('ry',m&&clock%4.5>4.36?'1':'7');});
        const mouth=reciting?1+Math.max(0,Math.sin(clock*12))*.9*m:1;
        b.beak.setAttribute('transform',`translate(101 98) scale(1 ${mouth}) translate(-101 -98)`);
    }
    function clearCanvas(ctx,cv){
        if(!ctx)return;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.restore();
    }
    function paintParticles(dt){
        if(!c)return;clearCanvas(c,canvas);
        particles=particles.filter(p=>p.life>0&&motion());
        for(const p of particles){
            p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.kind==='note'?-15:220)*dt;p.angle+=p.spin*dt;
            c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.globalAlpha=clamp(p.life/.4);c.fillStyle=p.color;c.strokeStyle='#49345b';c.lineWidth=1.2;
            if(p.kind==='bird'&&sprite)c.drawImage(sprite,-17,-16,34,31);
            else if(p.kind==='note'){c.rotate(-p.angle);c.font='900 24px sans-serif';c.fillText('♪',0,0);}
            else if(p.kind==='star')star(c,0,0,p.size+2);
            else if(p.kind==='spark'){c.strokeStyle=p.color;c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(-p.vx*.035,-p.vy*.035);c.stroke();}
            else{c.scale(1,Math.cos(p.angle));c.fillRect(-p.size/2,-p.size/2,p.size,p.size*.6);c.strokeRect(-p.size/2,-p.size/2,p.size,p.size*.6);}
            c.restore();
        }
        ribbons=ribbons.filter(r=>r.life>0&&motion());
        for(const r of ribbons){
            r.life-=dt;r.x+=r.vx*dt;r.y+=r.vy*dt;r.vy+=340*dt;
            if(dt)r.trail.push({x:r.x,y:r.y});if(r.trail.length>18)r.trail.shift();
            c.save();c.globalAlpha=clamp(r.life/.5);c.lineCap='round';c.lineJoin='round';c.strokeStyle=r.color;c.lineWidth=5;
            c.beginPath();r.trail.forEach((p,i)=>i?c.lineTo(p.x,p.y+Math.sin(i*.6+clock*8)*4):c.moveTo(p.x,p.y));c.stroke();c.restore();
        }
        rings=rings.filter(r=>r.life>0&&motion());
        for(const r of rings){r.life-=dt;const k=clamp(1-r.life/.6);c.save();c.globalAlpha=(1-k)*.9;c.strokeStyle='#fff6af';c.lineWidth=(1-k)*12;c.beginPath();c.arc(r.x,r.y,12+(1-(1-k)**3)*r.radius,0,Math.PI*2);c.stroke();c.restore();}
    }
    function scoreGain(points,label,best){
        const r=geometry.score;
        animate($('game-score'),[{scale:1.5,color:'#d33583'},{scale:1,color:'#52326f'}],{duration:450});
        if(r&&motion()) gains.push({x:r.left+r.width/2,y:r.bottom+26,text:`+${points}`,label,start:clock,best});
        gains=gains.slice(-3);
    }
    function paintForeground(){
        if(!f)return;clearCanvas(f,front);
        gains=gains.filter(p=>clock-p.start<1.1&&motion());
        for(const p of gains){
            const k=clamp((clock-p.start)/1.1);
            f.save();f.globalAlpha=clamp((1-k)*3);f.translate(p.x,p.y-k*30);f.scale(1+Math.sin(k*Math.PI)*.12,1+Math.sin(k*Math.PI)*.12);
            f.font='900 25px sans-serif';f.textAlign='center';f.lineJoin='round';f.lineWidth=5;f.strokeStyle='#fff';f.strokeText(p.text,0,0);f.fillStyle=p.best?'#ae6417':'#c93280';f.fillText(p.text,0,0);
            f.font='900 12px sans-serif';f.strokeText(p.label,0,18);f.fillText(p.label,0,18);f.restore();
        }
        flights=flights.filter(p=>clock-p.start<.46&&motion());
        for(const p of flights){
            const k=clamp((clock-p.start)/.46),q=1-(1-k)**2,x=p.x+(p.tx-p.x)*q,y=p.y+(p.ty-p.y)*q-Math.sin(k*Math.PI)*45;
            f.save();f.globalAlpha=clamp((1-k)*5);f.translate(x,y);f.rotate(Math.sin(k*Math.PI)*.15);
            if(sprite)f.drawImage(sprite,-26,-15,52,47);
            f.fillStyle='#ffda4b';f.strokeStyle='#654081';f.lineWidth=2;f.beginPath();f.roundRect(-16,-31,32,32,9);f.fill();f.stroke();
            f.fillStyle='#422857';f.font='900 24px sans-serif';f.textAlign='center';f.fillText(p.text,0,-6);f.restore();
        }
        deliveries=deliveries.filter(p=>clock-p.start<.85&&motion());
        for(const p of deliveries){
            const k=clamp((clock-p.start)/.85),q=k*k,x=p.x+(p.tx-p.x)*q+Math.sin(k*Math.PI)*70,y=p.y+(p.ty-p.y)*q;
            f.save();f.globalAlpha=Math.sin(Math.PI*k);f.fillStyle='#ffc62f';star(f,x,y,11);f.restore();
        }
    }
    function tick(t){
        frame=requestAnimationFrame(tick);if(t-lastPaint<16)return;lastPaint=t;
        const started=performance.now();
        const measured=window.KukuDiagnostics?.begin('visual.frame');
        if(geometryDirty)measureGeometry();
        if(paused){last=t;measured?.();return;}
        const dt=paused?0:Math.min((t-(last||t))/1000,.04);last=t;clock+=dt;
        if(lastMotion!==motion()){lastMotion=motion();document.body.dataset.motion=motion()?'on':'off';}
        if(!motion()){animations.forEach(a=>a.cancel());scheduled=[];}
        if(!paused){const due=scheduled.filter(s=>s.at<=clock);scheduled=scheduled.filter(s=>s.at>clock);due.forEach(s=>s.fn());}
        beat=paused?beat:(window.KukuSound?.pulse()||0);impact=Math.max(0,impact-dt*2);
        smoothed+=(energy-smoothed)*Math.min(1,dt*5);
        stage.style.setProperty('--beat',String(beat*motion()));stage.style.setProperty('--impact',String(impact*motion()));stage.style.setProperty('--sway',String(Math.sin(clock*1.3)*motion()));
        birds.forEach((b,i)=>{if(!b.el.closest('[hidden]'))paintBird(b,i,dt);});
        guests.forEach((b,i)=>{
            const visible=scene==='game'&&i<(level+1)*2;
            if(b.visible!==visible){b.visible=visible;b.el.style.opacity=visible?'1':'0';}
            if(!visible)return;
            const m=motion(),age=action?clock-action.start:99;
            const jump=age<.85?Math.sin(Math.min(1,age/.85)*Math.PI)*(14+level*3):0;
            b.el.style.transform=`translateY(${(-Math.abs(Math.sin(clock*7+i))*(4+level*2)-jump)*m}px) rotate(${Math.sin(clock*5+i)*9*m}deg) scale(${1+beat*.04*m})`;
        });
        if(clock>celebration)cheer.classList.remove('visible');
        if(!paused&&scene==='game'&&reciting&&clock>nextAmbient&&motion()){
            const p=center();emit(p.x+(Math.random()-.5)*130,p.y,2,60,'note');nextAmbient=clock+.45;
        }
        if(!paused&&((scene==='result'&&clock<finaleUntil)||(scene==='game'&&level===3))&&clock>nextFirework&&motion()){
            const p=center();emit(p.x+(Math.random()-.5)*innerWidth*.7,p.y-45,22,180,'spark');nextFirework=clock+(scene==='result'?.55:1.3);
        }
        paintParticles(dt);paintForeground();
        if(gl&&(t-lastBackground>33||impact>.85)){lastBackground=t;gl.uniform1f(timeLoc,motion()?clock:0);gl.uniform1f(energyLoc,smoothed);gl.uniform1f(beatLoc,beat*motion());gl.uniform1f(hitLoc,impact*motion());gl.uniform2f(resolutionLoc,bg.width,bg.height);gl.drawArrays(gl.TRIANGLES,0,6);}
        frameCost=frameCost*.95+(performance.now()-started)*.05;
        if(frameCost>11&&quality>.65&&clock-lastQualityChange>3){quality=Math.max(.65,quality-.15);lastQualityChange=clock;resize();}
        measured?.();
    }
    function clear(){
        particles=[];rings=[];ribbons=[];flights=[];deliveries=[];gains=[];scheduled=[];animations.forEach(a=>a.cancel());animations.clear();
        action=null;reciting=false;impact=0;celebration=0;finaleUntil=0;completed=0;nextAmbient=0;nextFirework=0;cheer.classList.remove('visible');
        clearCanvas(c,canvas);clearCanvas(f,front);
    }
    function setScene(id){geometryDirty=true;scene=id;flights=[];deliveries=[];gains=[];scheduled=[];reciting=false;paused=false;document.body.dataset.scene=id;document.body.dataset.paused='false';if(id!=='game'&&id!=='result'){clear();setEnergy(.08);smoothed=.08;}}
    function setPaused(value){paused=value;document.body.dataset.paused=String(value);animations.forEach(a=>value?a.pause():a.play());}
    function nextQuestion(){geometryDirty=true;flights=[];deliveries=[];gains=[];scheduled=[];reciting=false;action=null;}
    function lessonStep(name){
        reciting=name==='repeat';
        if(name==='cue'){announce('せーのっ！');action={kind:'reveal',start:clock};}
        if(name==='repeat'){action={kind:'correct',start:clock};const p=center();emit(p.x,p.y,12,100,'note');}
    }
    bg.addEventListener('webglcontextlost',e=>{e.preventDefault();gl=null;document.body.classList.add('backdrop-fallback');});
    bg.addEventListener('webglcontextrestored',()=>{initGL();resize();});
    window.addEventListener('kuku:viewport',resize);
    window.addEventListener('resize',resize);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=null;}else if(!frame){last=0;frame=requestAnimationFrame(tick);}});
    document.fonts?.ready.then(()=>{geometryDirty=true;});
    initGL();resize();frame=requestAnimationFrame(tick);
    return {clear,setScene,setEnergy,progress,burst,digit,scoreGain,nextQuestion,setPaused,lessonStep,
        reveal(){reciting=false;action={kind:'reveal',start:clock};}};
})();
