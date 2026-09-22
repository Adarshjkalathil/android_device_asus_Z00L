/* ---------- controls ---------- */
const keys = {};
addEventListener('keydown', e=>{ keys[e.code]=true; });
addEventListener('keyup',   e=>{ keys[e.code]=false; });
// Pointer lock is unavailable in a sandboxed frame, so looking around must also
// work by dragging. Both paths are live; whichever the browser allows is used.
function look(dx,dy){
  player.yaw  -= dx*0.0032;
  player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch - dy*0.0032));
}
let dragging=false, lastX=0, lastY=0;
cv.addEventListener('mousedown', e=>{
  if(isTouch) return;
  dragging=true; lastX=e.clientX; lastY=e.clientY;
  cv.style.cursor='grabbing';
  try { const r=cv.requestPointerLock(); if(r && r.catch) r.catch(()=>{}); } catch(err){}
  e.preventDefault();
});
addEventListener('mouseup', ()=>{ dragging=false; cv.style.cursor=''; });
addEventListener('mouseleave', ()=>{ dragging=false; });
addEventListener('mousemove', e=>{
  if(document.pointerLockElement===cv){ look(e.movementX, e.movementY); return; }
  if(!dragging) return;
  look(e.clientX-lastX, e.clientY-lastY);
  lastX=e.clientX; lastY=e.clientY;
});

const isTouch = matchMedia('(pointer:coarse)').matches;
let move = {x:0,y:0};
if(isTouch){
  document.body.classList.add('touch');
  const ci=document.getElementById('chatin');
  if(ci) ci.placeholder='Say something to people near you';
  document.querySelectorAll('.touchonly').forEach(el=>el.style.display='');
  const stick = document.getElementById('stick'), nub = document.getElementById('nub');
  let sid=null, lid=null, lx=0, ly=0;
  stick.addEventListener('touchstart', e=>{ sid = e.changedTouches[0].identifier; e.preventDefault(); }, {passive:false});
  addEventListener('touchmove', e=>{
    for(const t of e.changedTouches){
      if(t.identifier===sid){
        const r = stick.getBoundingClientRect();
        let dx = t.clientX-(r.left+r.width/2), dy = t.clientY-(r.top+r.height/2);
        const L = Math.hypot(dx,dy), M = r.width/2-18;
        if(L>M){ dx*=M/L; dy*=M/L; }
        nub.style.transform = 'translate('+dx+'px,'+dy+'px)';
        move.x = dx/M; move.y = dy/M;
      } else if(t.identifier===lid){
        player.yaw  -= (t.clientX-lx)*0.005;
        player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch-(t.clientY-ly)*0.005));
        lx=t.clientX; ly=t.clientY;
      }
    }
  }, {passive:false});
  // Any touch that did not start on the thumbstick looks around. The stick's own
  // listener runs first (it is on a descendant), so sid is already set by then.
  addEventListener('touchstart', e=>{
    for(const t of e.changedTouches)
      if(lid===null && sid!==t.identifier){ lid=t.identifier; lx=t.clientX; ly=t.clientY; }
  }, {passive:false});
  addEventListener('touchend', e=>{
    for(const t of e.changedTouches){
      if(t.identifier===sid){ sid=null; move.x=move.y=0; nub.style.transform=''; }
      if(t.identifier===lid) lid=null;
    }
  });
}

/* ---------- HUD ---------- */
const focusEl = document.getElementById('focus');
const focusNm = focusEl.querySelector('.nm'), focusMt = focusEl.querySelector('.mt');
const mapc = document.getElementById('mapc'), mx = mapc.getContext('2d');
const MAP_R = 110;
function drawMap(){
  const S = mapc.width, k = S/(MAP_R*2);
  mx.clearRect(0,0,S,S);
  const tx = v => (v-player.x)*k + S/2, tz = v => (v-player.z)*k + S/2;
  mx.strokeStyle='rgba(240,231,214,.42)'; mx.lineWidth=2;
  for(const r of SITE.r){
    mx.beginPath();
    r.p.forEach((q,i)=> i?mx.lineTo(tx(q[0]),tz(q[1])):mx.moveTo(tx(q[0]),tz(q[1])));
    mx.stroke();
  }
  for(const b of BUILDINGS){
    mx.beginPath();
    b.poly.forEach((q,i)=> i?mx.lineTo(tx(q[0]),tz(q[1])):mx.moveTo(tx(q[0]),tz(q[1])));
    mx.closePath();
    mx.fillStyle = b===hsb ? '#E0A13C' : 'rgba(240,231,214,.66)';
    mx.fill();
  }
  mx.save(); mx.translate(S/2,S/2); mx.rotate(-player.yaw);
  mx.fillStyle='#E0A13C'; mx.beginPath();
  mx.moveTo(0,-8); mx.lineTo(5.5,6); mx.lineTo(0,3); mx.lineTo(-5.5,6); mx.closePath(); mx.fill();
  mx.restore();
}

/* ---------- loop ---------- */
function resize(){
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w,h,false); camera.aspect = w/h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

function blocked(x,z){ return solidAt(x,z) || Math.abs(x)>HX-12 || Math.abs(z)>HZ-12; }

let last = performance.now();
function frame(now){
  const dt = Math.min((now-last)/1000, 0.05); last = now;
  let f=0, s=0;
  if(keys.KeyW||keys.ArrowUp) f+=1;
  if(keys.KeyS||keys.ArrowDown) f-=1;
  if(keys.KeyA) s-=1;
  if(keys.KeyD) s+=1;
  let turn=0;
  if(keys.ArrowLeft ||keys.KeyQ) turn+=1;
  if(keys.ArrowRight||keys.KeyE) turn-=1;
  if(turn) player.yaw += turn*1.9*dt;
  f -= move.y; s += move.x;
  const L = Math.hypot(f,s);
  if(L>1){ f/=L; s/=L; }
  const spd = (keys.ShiftLeft||keys.ShiftRight ? 6.4 : 2.6) * dt;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const nx = player.x + (-sy*f + cy*s)*spd*10;
  const nz = player.z + (-cy*f - sy*s)*spd*10;
  if(!blocked(nx, player.z)) player.x = nx;
  if(!blocked(player.x, nz)) player.z = nz;

  camera.position.set(player.x, surfaceHeight(player.x,player.z) + player.eye + (player.jy||0), player.z);
  camera.rotation.set(0,0,0);
  camera.rotateY(player.yaw); camera.rotateX(player.pitch);

  // nearest building ahead
  let hit=null, bestd=1e9;
  for(const b of BUILDINGS){
    const dx=b.c[0]-player.x, dz=b.c[1]-player.z, d=Math.hypot(dx,dz);
    if(d>60) continue;
    const dot = (-sy*dx - cy*dz)/d;
    if(dot>0.75 && d<bestd){ bestd=d; hit=b; }
  }
  if(hit){ focusNm.textContent=hit.name; focusMt.textContent=hit.meta+' \u00B7 '+Math.round(bestd)+' m'; focusEl.classList.add('on'); }
  else focusEl.classList.remove('on');

  if(typeof gameUpdate === 'function') gameUpdate(dt, now);
  if(typeof mpUpdate === 'function') mpUpdate(now);
  drawMap();
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}

renderer.render(scene,camera); drawMap();

return function start(){
  const sc=document.getElementById('scores'), hud=document.getElementById('hud');
  if(sc) sc.classList.add('on'); if(hud) hud.classList.add('on');
  if(!isTouch){ try { const p = cv.requestPointerLock(); if(p && p.catch) p.catch(()=>{}); } catch(e){} }
  last = performance.now();
  requestAnimationFrame(frame);
};
};
