
/* ---------- Kerala street life: KSEB poles and sagging lines, the bus
   shelter, a chaya kada, flex boards and a PWD milestone ---------- */
function roadSide(p0, p1, off){           // a point beside a road segment
  const dx=p1[0]-p0[0], dz=p1[1]-p0[1], L=Math.hypot(dx,dz)||1;
  return [p0[0] - dz/L*off, p0[1] + dx/L*off, Math.atan2(-dz/L, dx/L)];
}
function clearSpot(x,z,pad){ return !insideAny(x,z,pad) && Math.abs(x)<HX-15 && Math.abs(z)<HZ-15; }

// ---- poles every ~34 m along the vehicle roads, lines strung between them
const POLES=[], LAMPS=[], wirePts=[];
for(const r of SITE.r){
  if(!/secondary|tertiary|unclassified|residential/.test(r.k)) continue;
  let carry=12, prev=null;
  for(let i=0;i<r.p.length-1;i++){
    const a=r.p[i], b=r.p[i+1];
    const L=Math.hypot(b[0]-a[0], b[1]-a[1]);
    let t=carry;
    while(t < L){
      const f=t/L, px=a[0]+(b[0]-a[0])*f, pz=a[1]+(b[1]-a[1])*f;
      const s=roadSide([px,pz], b, r.k==='secondary'?5.2:4.0);
      if(clearSpot(s[0], s[1], 2.5)){
        const y=groundAt(s[0], s[1]);
        const pole={x:s[0], z:s[1], y:y, th:s[2]};
        POLES.push(pole);
        if(POLES.length % 3 === 0) LAMPS.push(pole);
        if(prev && Math.hypot(prev.x-pole.x, prev.z-pole.z) < 60){
          for(const off of [-0.72, 0, 0.72]){
            const ax=prev.x+Math.sin(prev.th)*off, az=prev.z+Math.cos(prev.th)*off, ay=prev.y+8.35;
            const bx=pole.x+Math.sin(pole.th)*off, bz=pole.z+Math.cos(pole.th)*off, by=pole.y+8.35;
            const span=Math.hypot(bx-ax, bz-az), sag=0.018*span+0.25;
            let lx=ax, ly=ay, lz=az;
            for(let k=1;k<=8;k++){
              const u=k/8, nx=ax+(bx-ax)*u, nz=az+(bz-az)*u;
              const ny=ay+(by-ay)*u - sag*4*u*(1-u);
              wirePts.push(lx,ly,lz, nx,ny,nz); lx=nx; ly=ny; lz=nz;
            }
          }
        }
        prev=pole;
      } else prev=null;
      t+=34;
    }
    carry=t-L;
  }
}
(function(){
  const shaft=[], arm=[];
  for(const p of POLES){
    shaft.push([p.x, p.y, p.z, p.th+Math.PI/4, 1, 9.0, 1]);
    arm.push([p.x, p.y+8.3, p.z, p.th, 1, 1, 1]);
  }
  instance(new THREE.CylinderGeometry(0.085,0.15,1,4).translate(0,0.5,0), plainMat(0xA7A39A), shaft);
  instance(new THREE.BoxGeometry(0.1,0.1,1.7), plainMat(0x6E6B66), arm);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(wirePts,3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:0x2A2B2C})));
})();

// street lamps: arm, head, and a glow that only shows at night
const LAMP_GLOWS=[];
(function(){
  const tex=(function(){
    const c=document.createElement('canvas'); c.width=c.height=64;
    const x=c.getContext('2d'), gr=x.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(255,236,190,1)'); gr.addColorStop(0.35,'rgba(255,214,140,.55)');
    gr.addColorStop(1,'rgba(255,200,120,0)');
    x.fillStyle=gr; x.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
  })();
  const arms=[], heads=[];
  for(const p of LAMPS){
    const hx=p.x + Math.cos(p.th)*0 - Math.sin(p.th)*0, fx=-Math.cos(p.th+Math.PI/2)*1.1, fz=Math.sin(p.th+Math.PI/2)*1.1;
    arms.push([p.x+fx*0.5, p.y+7.4, p.z+fz*0.5, p.th+Math.PI/2, 1,1,1]);
    heads.push([p.x+fx, p.y+7.32, p.z+fz, 0, 1,1,1]);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false,
                                   blending:THREE.AdditiveBlending}));
    s.position.set(p.x+fx, p.y+7.2, p.z+fz); s.scale.set(3.2,3.2,1); s.visible=false;
    scene.add(s); LAMP_GLOWS.push(s);
  }
  instance(new THREE.BoxGeometry(0.06,0.06,1.2), plainMat(0x6E6B66), arms);
  instance(new THREE.BoxGeometry(0.34,0.12,0.2), plainMat(0xDCD6C4), heads);
})();

// ---- painted boards
function boardTex(w, h, bg, lines){
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const x=c.getContext('2d');
  x.fillStyle=bg; x.fillRect(0,0,w,h);
  let y=0;
  for(const L of lines){
    x.font=L.f; x.fillStyle=L.c; x.textAlign='center'; x.textBaseline='middle';
    let fs=parseInt(L.f.match(/(\d+)px/)[1],10);
    while(x.measureText(L.t).width > w*0.92 && fs>10){
      fs-=2; x.font=L.f.replace(/\d+px/, fs+'px');
    }
    x.fillText(L.t, w/2, L.y*h);
  }
  return new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(c)});
}
function placeNear(cx, cz, want, pad){
  for(let r=0;r<60;r+=3){
    for(let k=0;k<12;k++){
      const a=k/12*6.283 + r*0.1, x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r;
      const nr=nearestRoad(x,z);
      if(nr[2] > want-2 && nr[2] < want+3 && clearSpot(x,z,pad)){
        return {x:x, z:z, y:groundAt(x,z), face:Math.atan2(nr[0]-x, nr[1]-z)};
      }
    }
  }
  return null;
}
function flexBoard(spot, W, H, mat){
  if(!spot) return;
  const g=new THREE.Group();
  for(const s of [-1,1]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(0.12,H+2.4,0.12), plainMat(0x5A5550));
    post.position.set(s*(W/2-0.2), (H+2.4)/2, -0.05); g.add(post);
  }
  const face=new THREE.Mesh(new THREE.PlaneGeometry(W,H), mat);
  face.position.set(0, 2.4+H/2, 0); g.add(face);
  const back=new THREE.Mesh(new THREE.PlaneGeometry(W,H), plainMat(0x3A3A38));
  back.position.set(0, 2.4+H/2, -0.02); back.rotation.y=Math.PI; g.add(back);
  g.position.set(spot.x, spot.y, spot.z); g.rotation.y=spot.face;
  scene.add(g);
}
// the junction where the Karukachal-Manimala road meets the south road
const JX=54.5, JZ=-7.0;

flexBoard(placeNear(JX+18, JZ-6, 6.5, 2.5), 6.0, 2.6, boardTex(900, 390, '#7A1F1B', [
  {t:'PUZHUKKU NERCHA', f:'800 92px "IBM Plex Sans",sans-serif', c:'#F6D35B', y:0.30},
  {t:"St John the Baptist's Forane Church, Nedumkunnam", f:'600 40px "IBM Plex Sans",sans-serif', c:'#FFFFFF', y:0.60},
  {t:'Feast of the parish \u00B7 all are welcome', f:'500 34px "IBM Plex Sans",sans-serif', c:'#F2D9C0', y:0.82}]));
flexBoard(placeNear(JX-26, JZ+4, 6.0, 2.5), 5.6, 2.4, boardTex(900, 386, '#123E7C', [
  {t:'SJB HSS NEDUMKUNNAM', f:'800 76px "IBM Plex Sans",sans-serif', c:'#FFFFFF', y:0.28},
  {t:'100% SSLC RESULTS', f:'800 70px "IBM Plex Sans",sans-serif', c:'#F6D35B', y:0.56},
  {t:'Congratulations to every one of our students', f:'500 32px "IBM Plex Sans",sans-serif', c:'#DCE6F4', y:0.82}]));
flexBoard(placeNear(JX+6, JZ+22, 6.0, 2.5), 5.0, 2.0, boardTex(900, 360, '#1F6B3A', [
  {t:'Nedumkunnam Grama Panchayat', f:'700 60px "IBM Plex Sans",sans-serif', c:'#FFFFFF', y:0.32},
  {t:'\u0D28\u0D46\u0D1F\u0D41\u0D02\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D02', f:'700 64px sans-serif', c:'#F6D35B', y:0.60},
  {t:'Keep our village clean', f:'500 36px "IBM Plex Sans",sans-serif', c:'#DDEFD9', y:0.84}]));

// ---- bus shelter at the junction
(function(){
  const s=placeNear(JX-10, JZ-10, 5.0, 3.5); if(!s) return;
  const g=new THREE.Group(), W=5.2, D=2.2, H=2.7;
  const add=(geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); g.add(m); return m; };
  add(new THREE.BoxGeometry(W+0.6,0.16,D+0.7), plainMat(0xCFC8B8), 0, H, -0.2);
  add(new THREE.BoxGeometry(W,H,0.16), plainMat(0xE9E2D2), 0, H/2, -D/2);
  for(const x of [-W/2, W/2]) add(new THREE.BoxGeometry(0.16,H,D), plainMat(0xE9E2D2), x, H/2, 0);
  add(new THREE.BoxGeometry(W-0.6,0.08,0.42), plainMat(0x7A5A3A), 0, 0.46, -D/2+0.3);
  for(const x of [-W/2+0.6, W/2-0.6]) add(new THREE.BoxGeometry(0.08,0.46,0.3), plainMat(0x6E6A62), x, 0.23, -D/2+0.3);
  add(new THREE.BoxGeometry(W+0.4,0.2,D+0.4), plainMat(0xB9B2A2), 0, 0.1, 0);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(W,0.62), boardTex(900,108,'#1F3F6E',[
    {t:'NEDUMKUNNAM  \u00B7  \u0D28\u0D46\u0D1F\u0D41\u0D02\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D02', f:'700 58px sans-serif', c:'#FFFFFF', y:0.54}]));
  sign.position.set(0, H+0.42, D/2+0.16); g.add(sign);
  g.position.set(s.x, s.y, s.z); g.rotation.y=s.face;
  scene.add(g);
  addDeck([[s.x-3,s.z-3],[s.x+3,s.z-3],[s.x+3,s.z+3],[s.x-3,s.z+3]], s.y+0.2);
})();

// ---- chaya kada: tea stall with glass jars and a hanging bunch of plantains
(function(){
  const s=placeNear(JX+12, JZ+12, 5.0, 3.0); if(!s) return;
  const g=new THREE.Group();
  const add=(geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); g.add(m); return m; };
  add(new THREE.BoxGeometry(3.4,2.6,2.4), plainMat(0x5E8A7A), 0, 1.3, -0.3);           // painted stall
  const roof=add(new THREE.BoxGeometry(4.2,0.06,3.4), plainMat(0x8E9296), 0, 2.85, 0.1);
  roof.rotation.x=-0.12;
  add(new THREE.BoxGeometry(3.4,1.0,0.5), plainMat(0x7A5A3A), 0, 0.5, 1.05);           // counter
  const jarCols=[0xE0A13C,0xB3372B,0xF4F0E6,0x7A4A2A,0xD9C27A];
  for(let i=0;i<5;i++){
    add(new THREE.CylinderGeometry(0.13,0.13,0.3,10), plainMat(jarCols[i]), -1.2+i*0.6, 1.16, 1.05);
    add(new THREE.CylinderGeometry(0.14,0.14,0.05,10), plainMat(0xC9C4B6), -1.2+i*0.6, 1.33, 1.05);
  }
  for(let i=0;i<9;i++){                                                             // plantain bunch
    const b=add(new THREE.CylinderGeometry(0.035,0.02,0.2,5), plainMat(0xE6C23A),
                1.25+Math.cos(i)*0.1, 2.25-Math.floor(i/3)*0.14, 1.2+Math.sin(i)*0.1);
    b.rotation.z=0.5;
  }
  add(new THREE.BoxGeometry(2.4,0.08,0.4), plainMat(0x6A4A2E), 0, 0.45, 2.3);           // bench
  for(const x of [-1,1]) add(new THREE.BoxGeometry(0.08,0.45,0.35), plainMat(0x5A3E26), x, 0.22, 2.3);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.2,0.55), boardTex(700,120,'#F4F0E6',[
    {t:'CHAYA \u00B7 KAAPI \u00B7 PAZHAMPORI', f:'800 52px "IBM Plex Sans",sans-serif', c:'#7A1F1B', y:0.54}]));
  sign.position.set(0, 2.35, 0.92); g.add(sign);
  g.position.set(s.x, s.y, s.z); g.rotation.y=s.face;
  scene.add(g);
  BUILDINGS.push({poly:[[s.x-1.7,s.z-1.5],[s.x+1.7,s.z-1.5],[s.x+1.7,s.z+0.9],[s.x-1.7,s.z+0.9]],
                  h:3, y:s.y, c:[s.x,s.z], open:true, name:'Chaya kada', meta:'tea stall'});
})();

// ---- PWD milestone on the road west toward Karukachal (3 km, per the village record)
(function(){
  const s=placeNear(JX-60, JZ+2, 4.0, 2.0); if(!s) return;
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.62,0.2), boardTex(128,176,'#F2EFE6',[
    {t:'KARUKACHAL', f:'800 20px "IBM Plex Sans",sans-serif', c:'#222', y:0.52},
    {t:'3', f:'800 54px "IBM Plex Sans",sans-serif', c:'#222', y:0.78}]));
  body.position.y=0.31; g.add(body);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.23,0.23,0.2,12,1,false,0,Math.PI), plainMat(0xE3B41F));
  cap.rotation.z=Math.PI/2; cap.rotation.y=Math.PI/2; cap.position.y=0.62; g.add(cap);
  g.position.set(s.x, s.y, s.z); g.rotation.y=s.face;
  scene.add(g);
})();
