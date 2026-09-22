
/* ---------- play: jump, emotes, weather, collecting, scores ---------- */
const GAME = { score:0, best:0, emote:'', emoteAt:0, weather:'day' };
try { GAME.best = +(localStorage.getItem('ndk.best')||0) || 0; } catch(e){}
player.jy = 0; player.vy = 0;

// ---- small sounds, made on the fly (no files to fetch)
let AC = null;
function ac(){ try { if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} return AC; }
function blip(freq, len){
  const a=ac(); if(!a) return;
  const o=a.createOscillator(), g=a.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(freq, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq*1.9, a.currentTime+len*0.6);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.16, a.currentTime+0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+len);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime+len+0.02);
}
let rainNode = null;
function rainSound(on){
  const a=ac(); if(!a) return;
  if(on && !rainNode){
    const buf=a.createBuffer(1, a.sampleRate*2, a.sampleRate), d=buf.getChannelData(0);
    let last=0;
    for(let i=0;i<d.length;i++){ const w=Math.random()*2-1; last=(last+0.045*w)/1.045; d[i]=last*3.2; }
    const src=a.createBufferSource(); src.buffer=buf; src.loop=true;
    const f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1300;
    const g=a.createGain(); g.gain.value=0.0001;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start();
    g.gain.exponentialRampToValueAtTime(0.35, a.currentTime+1.2);
    rainNode={src:src, g:g};
  } else if(!on && rainNode){
    const n=rainNode; rainNode=null;
    n.g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+0.8);
    setTimeout(function(){ try{ n.src.stop(); }catch(e){} }, 900);
  }
}

// ---- toast
const toastEl=document.getElementById('toast');
function toast(t){
  if(!toastEl) return;
  toastEl.textContent=t; toastEl.classList.add('on');
  clearTimeout(toast._t); toast._t=setTimeout(function(){ toastEl.classList.remove('on'); }, 1500);
}

// ---- jump
function jump(){ if(player.jy <= 0.001){ player.vy = 4.6; } }

// ---- emotes: carried in presence so everyone here sees them
const EMOTES = { wave:'Waved', namaskaram:'Namaskaram', dance:'Dancing', sit:'Sitting down' };
function emote(e){
  if(!EMOTES[e]) return;
  GAME.emote = (GAME.emote===e && e==='sit') ? '' : e;
  GAME.emoteAt = Date.now();
  toast(GAME.emote ? EMOTES[e] : 'Stood up');
}

// ---- weather and time of day
const HEMI = scene.children.filter(function(o){ return o.isHemisphereLight; })[0];
const RAIN = (function(){
  const N=1600, pos=new Float32Array(N*6), spd=new Float32Array(N);
  for(let i=0;i<N;i++){
    const x=(Math.random()-0.5)*70, y=Math.random()*30, z=(Math.random()-0.5)*70;
    pos.set([x,y,z, x+0.04,y-0.55,z+0.02], i*6); spd[i]=16+Math.random()*8;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const m=new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:0xC9D6DC, transparent:true, opacity:0.5}));
  m.visible=false; m.frustumCulled=false; scene.add(m);
  return {mesh:m, pos:pos, spd:spd, N:N};
})();
const LOOKS = {
  day:    {bg:0xA9C6D2, near:220, far:1500, hemi:1.05, sun:1.0,  sky:0xDCEBF2, gnd:0x9C7E5C, rain:false, lamps:false},
  monsoon:{bg:0x7F8C93, near:50,  far:480,  hemi:0.78, sun:0.32, sky:0xB8C4CA, gnd:0x6A5A48, rain:true,  lamps:false},
  night:  {bg:0x0F1B27, near:34,  far:400,  hemi:0.38, sun:0.13, sky:0x4A5F84, gnd:0x1A1410, rain:false, lamps:true}
};
function setWeather(w){
  const L=LOOKS[w]; if(!L) return;
  GAME.weather=w;
  scene.background.setHex(L.bg); scene.fog.color.setHex(L.bg);
  scene.fog.near=L.near; scene.fog.far=L.far;
  if(HEMI){ HEMI.intensity=L.hemi; HEMI.color.setHex(L.sky); HEMI.groundColor.setHex(L.gnd); }
  sun.intensity=L.sun; sun.color.setHex(w==='night' ? 0x9DB4E0 : 0xFFF6E6);
  RAIN.mesh.visible=L.rain; rainSound(L.rain);
  for(const s of LAMP_GLOWS) s.visible=L.lamps;
  const btn=document.getElementById('wx');
  if(btn) btn.textContent = w==='day' ? 'Day' : w==='monsoon' ? 'Monsoon' : 'Night';
}
function cycleWeather(){
  setWeather(GAME.weather==='day' ? 'monsoon' : GAME.weather==='monsoon' ? 'night' : 'day');
}

// ---- things to collect: mangoes under the fruit trees, jackfruit on the
//      trunks, chembarathi (hibiscus) by the homesteads
const ITEMS=[];
(function(){
  const mango=new THREE.SphereGeometry(0.16,10,8); mango.scale(1,1.25,0.9);
  const jackG=new THREE.DodecahedronGeometry(0.34,1); jackG.scale(1,1.35,1);
  const petal=new THREE.SphereGeometry(0.11,8,6); petal.scale(1.6,0.35,0.9);
  const mMat=plainMat(0xE9A52A), jMat=plainMat(0x7E8F2E), fMat=plainMat(0xD2202C), cMat=plainMat(0xF3D04A);
  const flowerG=new THREE.CylinderGeometry(0.2,0.04,0.1,5);
  function flower(){ return new THREE.Mesh(flowerG, fMat); }
  function put(kind, x, z, yOff){
    if(insideAny(x,z,1.2)) return;
    const y=surfaceHeight(x,z)+yOff;
    const m = kind==='mango' ? new THREE.Mesh(mango,mMat)
            : kind==='jack'  ? new THREE.Mesh(jackG,jMat) : flower();
    m.position.set(x,y,z); scene.add(m);
    ITEMS.push({kind:kind, m:m, x:x, z:z, y:y, gone:0, ph:rnd()*6.28});
  }
  FRUIT_TREES.forEach(function(t,i){
    if(ITEMS.length>120) return;
    if(i%5===0) put('jack', t[0]+0.35, t[1]+0.2, 1.05);
    if(i%2===0) put('mango', t[0]+(rnd()-0.5)*3, t[1]+(rnd()-0.5)*3, 0.25);
  });
  PLANTAIN.forEach(function(t,i){
    if(i%2===0 && ITEMS.length<180) put('flower', t[0]+(rnd()-0.5)*4, t[1]+(rnd()-0.5)*4, 0.35);
  });
})();
const POINTS = { mango:1, flower:1, jack:5 };
const NAMES  = { mango:'Mango', flower:'Chembarathi', jack:'Chakka (jackfruit)' };

// ---- scoreboard: whoever is here right now, plus you
const scoreEl=document.getElementById('scores');
function drawScores(){
  if(!scoreEl) return;
  const rows=[{n:(window.__ME__&&__ME__.n)||'You', sc:GAME.score, me:true}];
  if(typeof room!=='undefined' && room){
    for(const p of room.peers()){
      if(p.sameTab || p.kind==='agent' || !p.presence) continue;
      const pr=p.presence;
      rows.push({n:String(pr.n||'Someone').slice(0,18), sc:(typeof pr.sc==='number'?pr.sc:0), me:false});
    }
  }
  rows.sort(function(a,b){ return b.sc-a.sc; });
  scoreEl.textContent='';
  const h=document.createElement('div'); h.className='sh';
  h.textContent = rows.length>1 ? 'Here now' : 'Your score';
  scoreEl.appendChild(h);
  rows.slice(0,6).forEach(function(r){
    const d=document.createElement('div'); d.className='sr'+(r.me?' me':'');
    const n=document.createElement('span'); n.textContent = r.me ? r.n+' (you)' : r.n;
    const s=document.createElement('b'); s.textContent = r.sc;
    d.appendChild(n); d.appendChild(s); scoreEl.appendChild(d);
  });
  const b=document.createElement('div'); b.className='sb';
  b.textContent='Your best: '+GAME.best;
  scoreEl.appendChild(b);
}
drawScores();

// ---- per frame
let scoreTick=0;
function gameUpdate(dt, now){
  // jump
  if(player.jy>0 || player.vy>0){
    player.vy -= 13*dt; player.jy += player.vy*dt;
    if(player.jy<=0){ player.jy=0; player.vy=0; }
  }
  // collecting
  const t=now/1000;
  for(let i=0;i<ITEMS.length;i++){
    const it=ITEMS[i];
    if(it.gone){
      if(now > it.gone){ it.gone=0; it.m.visible=true; }
      continue;
    }
    const dx=it.x-player.x, dz=it.z-player.z;
    if(dx>40||dx<-40||dz>40||dz<-40){ continue; }
    it.m.rotation.y = t*1.3+it.ph;
    it.m.position.y = it.y + Math.sin(t*2.2+it.ph)*0.06;
    if(dx*dx+dz*dz < 1.7*1.7 && player.jy < 1.2){
      it.gone = now + 120000; it.m.visible=false;
      GAME.score += POINTS[it.kind];
      if(GAME.score > GAME.best){ GAME.best=GAME.score; try{ localStorage.setItem('ndk.best', GAME.best); }catch(e){} }
      blip(it.kind==='jack' ? 330 : 520, it.kind==='jack' ? 0.28 : 0.16);
      toast('+'+POINTS[it.kind]+'  '+NAMES[it.kind]);
      drawScores();
    }
  }
  // rain follows you
  if(RAIN.mesh.visible){
    const P=RAIN.pos;
    for(let i=0;i<RAIN.N;i++){
      const k=i*6, d=RAIN.spd[i]*dt;
      P[k+1]-=d; P[k+4]-=d;
      if(P[k+1] < -2){ const y=26+Math.random()*6; P[k+4]=y-0.55; P[k+1]=y; }
    }
    RAIN.mesh.geometry.attributes.position.needsUpdate=true;
    RAIN.mesh.position.set(player.x, surfaceHeight(player.x,player.z)-2, player.z);
  }
  if(now - scoreTick > 700){ scoreTick=now; drawScores(); }
}

// ---- controls
addEventListener('keydown', function(e){
  if(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if(!document.getElementById('gate').classList.contains('off')) return;
  if(e.code==='Space'){ e.preventDefault(); jump(); }
  else if(e.code==='Digit1') emote('wave');
  else if(e.code==='Digit2') emote('namaskaram');
  else if(e.code==='Digit3') emote('dance');
  else if(e.code==='Digit4') emote('sit');
  else if(e.code==='KeyN') cycleWeather();
});
(function(){
  const bind=function(id,fn){ const el=document.getElementById(id);
    if(el) el.addEventListener('click', function(ev){ ev.preventDefault(); fn(); el.blur(); }); };
  bind('wx', cycleWeather);
  bind('jumpbtn', jump);
  bind('emobtn', function(){ const p=document.getElementById('emorow'); if(p) p.classList.toggle('on'); });
  ['wave','namaskaram','dance','sit'].forEach(function(e){
    bind('em-'+e, function(){ emote(e); const p=document.getElementById('emorow'); if(p) p.classList.remove('on'); });
  });
})();
