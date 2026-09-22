
/* ---------- other people: avatars, presence and proximity chat ----------
   Uses the room capability. The page is complete on its own; if the room
   cannot connect (use() resolves null) everything below simply stays off. */
const ME = window.__ME__ || {n:'Guest', s:0x2E5B9E, t:0x33383E, k:0xC9A184};

function labelSprite(text, sub){
  const c=document.createElement('canvas'); c.width=512; c.height=128;
  const x=c.getContext('2d');
  const t=String(text||'').slice(0,22);
  x.font='700 54px "IBM Plex Sans",sans-serif';
  const w=Math.min(500, x.measureText(t).width+44);
  x.fillStyle='rgba(18,24,28,.74)';
  x.beginPath();
  const X=(512-w)/2, Y=sub?6:20, H=sub?78:66, R=16;
  x.moveTo(X+R,Y); x.arcTo(X+w,Y,X+w,Y+H,R); x.arcTo(X+w,Y+H,X,Y+H,R);
  x.arcTo(X,Y+H,X,Y,R); x.arcTo(X,Y,X+w,Y,R); x.fill();
  x.fillStyle='#F4F0E6'; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(t, 256, sub?38:53);
  if(sub){
    x.font='500 30px "IBM Plex Sans",sans-serif';
    x.fillStyle='rgba(244,240,230,.7)';
    x.fillText(String(sub).slice(0,30), 256, 70);
  }
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, depthTest:false, transparent:true}));
  sp.scale.set(1.5,0.375,1); sp.renderOrder=999;
  return sp;
}
function bubbleSprite(text){
  const c=document.createElement('canvas'); c.width=512; c.height=160;
  const x=c.getContext('2d');
  const words=String(text||'').slice(0,90).split(/\s+/);
  const lines=[]; let cur='';
  x.font='500 40px "IBM Plex Sans",sans-serif';
  for(const w of words){
    const tryl = cur ? cur+' '+w : w;
    if(x.measureText(tryl).width > 460 && cur){ lines.push(cur); cur=w; } else cur=tryl;
  }
  if(cur) lines.push(cur);
  const H = 22 + lines.length*46;
  x.fillStyle='rgba(247,244,236,.94)';
  const X=8, Y=(160-H)/2, W=496, R=18;
  x.beginPath(); x.moveTo(X+R,Y); x.arcTo(X+W,Y,X+W,Y+H,R); x.arcTo(X+W,Y+H,X,Y+H,R);
  x.arcTo(X,Y+H,X,Y,R); x.arcTo(X,Y,X+W,Y,R); x.fill();
  x.fillStyle='#1A2228'; x.textAlign='center'; x.textBaseline='middle';
  lines.forEach((ln,i)=> x.fillText(ln, 256, Y+34+i*46));
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, depthTest:false, transparent:true}));
  sp.scale.set(2.1, 2.1*160/512, 1); sp.renderOrder=1000;
  return sp;
}
function buildAvatar(p){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const skin=plainMat(p.k||0xC9A184), shirt=plainMat(p.s||0x2E5B9E), trou=plainMat(p.t||0x33383E);
  const shoe=plainMat(0x241C16), hair=plainMat(0x2A2119);
  const add=(par,geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); par.add(m); return m; };
  add(body, new THREE.SphereGeometry(0.115,10,8), skin, 0, 1.63, 0);
  add(body, new THREE.SphereGeometry(0.122,10,8,0,6.283,0,1.5), hair, 0, 1.645, 0);
  add(body, new THREE.BoxGeometry(0.36,0.52,0.21), shirt, 0, 1.20, 0);
  const limb=(x,y,len,w,mat,endMat,endGeo)=>{
    const piv=new THREE.Group(); piv.position.set(x,y,0); body.add(piv);
    add(piv, new THREE.BoxGeometry(w,len,w), mat, 0, -len/2, 0);
    add(piv, endGeo, endMat, 0, -len-0.02, endGeo===null?0:0.02);
    return piv;
  };
  const hand=new THREE.SphereGeometry(0.055,7,6), foot=new THREE.BoxGeometry(0.135,0.07,0.21);
  const armL=limb(-0.225, 1.43, 0.44, 0.09, shirt, skin, hand);
  const armR=limb( 0.225, 1.43, 0.44, 0.09, shirt, skin, hand);
  const legL=limb(-0.085, 0.93, 0.70, 0.13, trou, shoe, foot);
  const legR=limb( 0.085, 0.93, 0.70, 0.13, trou, shoe, foot);
  return {g:g, body:body, armL:armL, armR:armR, legL:legL, legR:legR};
}
const EMO_ICON = { wave:'\uD83D\uDC4B', namaskaram:'\uD83D\uDE4F', dance:'\uD83D\uDC83' };
function iconSprite(t){
  const c=document.createElement('canvas'); c.width=c.height=96;
  const x=c.getContext('2d'); x.font='64px sans-serif'; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(t,48,52);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), depthTest:false, transparent:true}));
  s.scale.set(0.5,0.5,1); s.renderOrder=1001; return s;
}
// pose a figure: walk cycle from speed, then any emote on top
function pose(a, speed, phase, e, t){
  const k=Math.min(speed/2.6, 1.2), sw=Math.sin(phase)*0.62*k;
  a.legL.rotation.set(sw,0,0);  a.legR.rotation.set(-sw,0,0);
  a.armL.rotation.set(-sw*0.8,0,0); a.armR.rotation.set(sw*0.8,0,0);
  a.body.position.y = Math.abs(Math.sin(phase))*0.035*k;
  a.body.rotation.y = 0;
  if(e==='wave'){
    a.armR.rotation.set(0, 0, 2.75 + Math.sin(t*10)*0.28);
  } else if(e==='namaskaram'){
    a.armL.rotation.set(1.15, 0,  0.42);
    a.armR.rotation.set(1.15, 0, -0.42);
    a.body.rotation.x = 0.08;
  } else if(e==='dance'){
    a.body.position.y = Math.abs(Math.sin(t*6))*0.09;
    a.body.rotation.y = Math.sin(t*3)*0.45;
    a.armL.rotation.set(0, 0, -(2.3 + Math.sin(t*6)*0.5));
    a.armR.rotation.set(0, 0,  2.3 + Math.cos(t*6)*0.5);
    a.legL.rotation.set(Math.max(0,Math.sin(t*6))*0.5,0,0);
    a.legR.rotation.set(Math.max(0,-Math.sin(t*6))*0.5,0,0);
  } else if(e==='sit'){
    a.body.position.y = -0.47;
    a.legL.rotation.set(1.45,0,0); a.legR.rotation.set(1.45,0,0);
    a.armL.rotation.set(0.5,0,0);  a.armR.rotation.set(0.5,0,0);
  }
  if(e!=='namaskaram') a.body.rotation.x = 0;
}

const NEAR_M = 14;                       // proximity radius, metres
let room = null, peersMesh = new Map(), nearbyCount = 0;
const nearEl = document.getElementById('nearby');
const chatLog = document.getElementById('chatlog');
const chatIn  = document.getElementById('chatin');

function chatLine(who, text, mine){
  if(!chatLog) return;
  const d=document.createElement('div');
  d.className = 'cl' + (mine ? ' me' : '');
  const s=document.createElement('span'); s.className='who'; s.textContent = who + ': ';
  d.appendChild(s);
  d.appendChild(document.createTextNode(String(text)));   // text node: never HTML
  chatLog.appendChild(d);
  while(chatLog.children.length > 7) chatLog.removeChild(chatLog.firstChild);
  chatLog.classList.add('on');
  clearTimeout(chatLine._t);
  chatLine._t = setTimeout(()=>chatLog.classList.remove('on'), 14000);
}

function mpStart(){
  if(!window.claude || !claude.use) return;
  claude.use('room').then(function(r){
    if(!r) return;                                        // solo: nothing lights up
    room = r;
    room.onPeers(function(){ /* read in the frame loop */ }, function(){ room = null; });
    room.on('chat', function(msg){
      if(msg.sameTab) return;
      const d = msg && msg.data;
      if(!d || typeof d.text !== 'string') return;
      const peer = room.peers().find(function(p){ return p.peer === msg.peer; });
      const pr = peer && peer.presence || {};
      if(typeof pr.x === 'number'){                       // proximity gate
        if(Math.hypot(pr.x-player.x, pr.z-player.z) > NEAR_M*2.2) return;
      }
      const rec = peersMesh.get(msg.peer);
      if(rec) showBubble(rec, d.text);
      chatLine(String(pr.n || 'Someone').slice(0,22), d.text.slice(0,90), false);
    }, function(){});
    if(nearEl) nearEl.classList.add('on');
  }).catch(function(){});
}
function showBubble(rec, text){
  if(rec.bubble){ rec.g.remove(rec.bubble); rec.bubble=null; }
  const b=bubbleSprite(text);
  b.position.y = 2.8; rec.g.add(b); rec.bubble=b;
  clearTimeout(rec.bt);
  rec.bt=setTimeout(function(){ if(rec.bubble){ rec.g.remove(rec.bubble); rec.bubble=null; } }, 8000);
}

let lastSent = 0, lastPX = 1e9, lastPZ = 1e9, lastYaw = 1e9;
function mpUpdate(now){
  if(!room) return;
  // send my own position as absolute state
  if(now - lastSent > 70){
    const dx=Math.abs(player.x-lastPX), dz=Math.abs(player.z-lastPZ),
          dy=Math.abs(player.yaw-lastYaw);
    const jy=player.jy||0, emo=(GAME.emote||'')+GAME.emoteAt+'|'+GAME.score;
    if(dx>0.04 || dz>0.04 || dy>0.02 || jy>0 || emo!==mpUpdate.lastEmo || now-lastSent > 4000){
      mpUpdate.lastEmo = emo;
      lastSent=now; lastPX=player.x; lastPZ=player.z; lastYaw=player.yaw;
      room.presence({ n:ME.n, s:ME.s, t:ME.t, k:ME.k,
                      x:+player.x.toFixed(2), z:+player.z.toFixed(2),
                      y:+surfaceHeight(player.x,player.z).toFixed(2),
                      a:+player.yaw.toFixed(3),
                      j:+(player.jy||0).toFixed(2),
                      sc:GAME.score, e:GAME.emote||'', et:GAME.emoteAt||0 }).catch(function(){});
    }
  }
  // draw everyone else
  const list = room.peers();
  const seen = new Set();
  let near = 0;
  for(let i=0;i<list.length;i++){
    const p=list[i];
    if(p.sameTab || p.kind==='agent') continue;
    const pr=p.presence;
    if(!pr || typeof pr.x!=='number' || typeof pr.z!=='number') continue;
    seen.add(p.peer);
    let rec=peersMesh.get(p.peer);
    if(!rec || rec.sig !== (pr.s+'|'+pr.t+'|'+pr.k+'|'+pr.n)){
      if(rec) scene.remove(rec.g);
      const av=buildAvatar(pr), g=av.g;
      const lab=labelSprite(pr.n||'Someone'); lab.position.y=1.94; g.add(lab);
      scene.add(g);
      rec={g:g, av:av, lab:lab, sig:(pr.s+'|'+pr.t+'|'+pr.k+'|'+pr.n),
           x:pr.x, z:pr.z, y:pr.y||0, a:pr.a||0, bubble:null, bt:0,
           phase:0, spd:0, icon:null, iconFor:''};
      peersMesh.set(p.peer, rec);
    }
    const ox=rec.x, oz=rec.z;
    rec.x += (pr.x-rec.x)*0.22;                            // smooth between updates
    rec.z += (pr.z-rec.z)*0.22;
    const fdt = Math.max(0.001, Math.min(0.1, (now-(mpUpdate.lastNow||now))/1000));
    rec.spd += (Math.hypot(rec.x-ox, rec.z-oz)/fdt - rec.spd)*0.2;
    rec.y += ((typeof pr.y==='number'?pr.y:surfaceHeight(pr.x,pr.z))-rec.y)*0.22;
    let da = (pr.a||0) - rec.a;
    while(da >  Math.PI) da -= 6.283;
    while(da < -Math.PI) da += 6.283;
    rec.a += da*0.22;
    rec.g.position.set(rec.x, rec.y + (typeof pr.j==='number' ? pr.j : 0), rec.z);
    rec.g.rotation.y = rec.a;
    // emotes last 8 s, except sitting, which holds until they stand
    const e = (typeof pr.e==='string' && (pr.e==='sit' || Date.now()-(+pr.et||0) < 8000)) ? pr.e : '';
    rec.phase += rec.spd*fdt*2.4;
    pose(rec.av, rec.spd, rec.phase, e, now/1000);
    const ic = EMO_ICON[e] || '';
    if(ic !== rec.iconFor){
      if(rec.icon){ rec.g.remove(rec.icon); rec.icon=null; }
      if(ic){ rec.icon=iconSprite(ic); rec.icon.position.y=2.28; rec.g.add(rec.icon); }
      rec.iconFor = ic;
    }
    const d = Math.hypot(rec.x-player.x, rec.z-player.z);
    if(d < NEAR_M) near++;
    rec.lab.material.opacity = d < NEAR_M ? 1 : 0.45;
  }
  mpUpdate.lastNow = now;
  for(const k of Array.from(peersMesh.keys())) if(!seen.has(k)){
    scene.remove(peersMesh.get(k).g); peersMesh.delete(k);
  }
  if(near !== nearbyCount){
    nearbyCount = near;
    if(nearEl) nearEl.textContent = near ? (near===1 ? '1 person nearby' : near+' people nearby')
                                         : 'no one nearby';
  }
}
if(chatIn){
  chatIn.addEventListener('keydown', function(e){
    e.stopPropagation();
    if(e.key === 'Enter'){
      const v = chatIn.value.trim().slice(0,90);
      chatIn.value='';
      chatIn.blur();
      if(!v) return;
      chatLine(ME.n, v, true);
      if(room) room.emit('chat', {text:v}).catch(function(){});
    } else if(e.key === 'Escape'){ chatIn.value=''; chatIn.blur(); }
  });
}
addEventListener('keydown', function(e){
  if(e.code !== 'KeyT' || !chatIn) return;
  if(document.activeElement === chatIn) return;
  if(!document.getElementById('gate').classList.contains('off')) return;  // still at the gate
  e.preventDefault();
  // pointer lock captures the mouse, so the field cannot be clicked while held
  if(document.pointerLockElement) document.exitPointerLock();
  chatIn.focus();
});
mpStart();
