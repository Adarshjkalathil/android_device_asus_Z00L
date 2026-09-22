
/* ---------- St John the Baptist church, Nedumkunnam.
   Built from photographs: three spires, gold cusped archivolts, jali tracery,
   pierced parapet, grey plinth, kodimaram, and an interior you can walk into. */
const GOLD = 0xD9A62B, WHITE = 0xF7F4EC, PLINTH = 0x6F7C86, TEAK = 0x8B5A2B;

function jali(x, X,Y,W,H){                       // white pierced lattice
  x.save(); x.beginPath(); x.rect(X,Y,W,H); x.clip();
  x.strokeStyle='#FFFFFF'; x.lineWidth=Math.max(1.5,W/16);
  const s=W/3.2;
  for(let i=-H;i<W+H;i+=s){
    x.beginPath(); x.moveTo(X+i,Y);   x.lineTo(X+i+H,Y+H); x.stroke();
    x.beginPath(); x.moveTo(X+i+H,Y); x.lineTo(X+i,Y+H);   x.stroke();
  }
  x.restore();
}
function archPath(x, X,Y,W,H){                   // lancet: springs at Y+H, apex at Y
  const r=W/2;
  x.beginPath();
  x.moveTo(X, Y+H); x.lineTo(X, Y+H*0.42);
  x.quadraticCurveTo(X+r, Y-H*0.06, X+W, Y+H*0.42);
  x.lineTo(X+W, Y+H); 
  return x;
}
function cusped(x, X,Y,W,H, band){               // gold scalloped archivolt
  x.save();
  archPath(x,X,Y,W,H);
  x.strokeStyle='#E8B92E'; x.lineWidth=band*2; x.lineJoin='round'; x.stroke();
  x.strokeStyle='#F2CC4C'; x.lineWidth=band*0.7; x.stroke();
  x.fillStyle='#F7D66A'; const n=11;                // scallops on the inner edge
  for(let i=1;i<n;i++){
    const t=i/n, a=Math.PI*(0.06+0.88*t);
    const cx=X+W/2-Math.cos(a)*W*0.5, cy=Y+H*0.42-Math.sin(a)*H*0.46;
    x.beginPath(); x.arc(cx,cy,band*0.36,0,6.283); x.fill();
  }
  x.restore();
}
function naveWallTexture(){                       // 4 m x 10 m bay, jali window
  const c=document.createElement('canvas'); c.width=128; c.height=320;
  const x=c.getContext('2d');
  x.fillStyle='#F7F4EC'; x.fillRect(0,0,128,320);
  x.fillStyle='rgba(0,0,0,.03)';
  for(let i=0;i<260;i++) x.fillRect(Math.random()*128|0,Math.random()*320|0,2,1);
  const wx=38, ww=52, wy=104, wh=166;
  archPath(x,wx,wy,ww,wh); x.closePath();
  x.fillStyle='#E9E4D8'; x.fill();
  jali(x,wx,wy,ww,wh);
  archPath(x,wx,wy,ww,wh); x.closePath();
  x.strokeStyle='#F7F4EC'; x.lineWidth=7; x.stroke();
  cusped(x,wx,wy,ww,wh,7);
  x.fillStyle='#6F7C86'; x.fillRect(0,286,128,34);          // stone plinth
  x.fillStyle='rgba(0,0,0,.12)'; x.fillRect(0,286,128,3);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1/4,1/10);
  return t;
}
function parapetTexture(){                        // pierced openwork balustrade, 4 m x 2 m
  const c=document.createElement('canvas'); c.width=128; c.height=64;
  const x=c.getContext('2d');
  x.fillStyle='#F7F4EC'; x.fillRect(0,0,128,64);
  x.fillStyle='#DCD4C4';
  for(let i=6;i<128;i+=11){ x.beginPath(); x.arc(i,34,3.6,0,6.283); x.fill(); x.fillRect(i-1.6,34,3.2,18); }
  x.fillStyle='#F7F4EC'; x.fillRect(0,50,128,14);
  x.fillStyle='#D9A62B'; x.fillRect(0,0,128,5); x.fillRect(0,56,128,4);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1/4,1/2);
  return t;
}
function facadeTexture(){                         // bespoke front, drawn once
  const W=768, H=760;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d');
  x.fillStyle='#F7F4EC'; x.fillRect(0,0,W,H);
  x.fillStyle='#6F7C86'; x.fillRect(0,H-70,W,70);                    // plinth
  x.fillStyle='rgba(0,0,0,.10)'; x.fillRect(0,H-70,W,4);

  // lower storey: three gold-cusped arches, central doorway
  const bays=[[0.06,0.20],[0.30,0.40],[0.74,0.20]];
  const ly=H*0.56, lh=H*0.30;
  for(const [bx,bw] of bays){
    const X=W*bx, BW=W*bw;
    archPath(x,X,ly,BW,lh); x.closePath(); x.fillStyle='#EFE9DC'; x.fill();
    jali(x,X,ly,BW,lh);
    cusped(x,X,ly,BW,lh,13);
  }
  x.fillStyle='#8B5A2B';                                             // teak double door
  x.fillRect(W*0.40, H-70-H*0.20, W*0.20, H*0.20);
  x.strokeStyle='#6B4420'; x.lineWidth=4;
  x.beginPath(); x.moveTo(W*0.50,H-70-H*0.20); x.lineTo(W*0.50,H-70); x.stroke();

  x.fillStyle='#D9A62B'; x.fillRect(0,H*0.545,W,9);                  // gold string course
  x.fillStyle='#EFEADF'; x.fillRect(0,H*0.50,W,H*0.045);             // balustrade band
  x.fillStyle='#D9CFBC';
  for(let i=8;i<W;i+=16) x.fillRect(i,H*0.505,5,H*0.033);

  // upper storey: three arches, saints either side of a coloured window
  const uy=H*0.235, uh=H*0.255;
  const ub=[[0.09,0.19],[0.33,0.34],[0.72,0.19]];
  ub.forEach(([bx,bw],k)=>{
    const X=W*bx, BW=W*bw;
    archPath(x,X,uy,BW,uh); x.closePath();
    if(k===1){
      x.fillStyle='#EFE9DC'; x.fill(); jali(x,X,uy,BW,uh);
      const gw=BW*0.34;                                              // coloured light
      x.fillStyle='#C8412F'; x.fillRect(X+BW/2-gw/2, uy+uh*0.42, gw, uh*0.5);
      x.fillStyle='#2E7D4F'; x.fillRect(X+BW/2-gw/2, uy+uh*0.42, gw/2, uh*0.5);
      x.fillStyle='#E0B429'; x.fillRect(X+BW/2-gw/6, uy+uh*0.42, gw/3, uh*0.2);
    } else {
      x.fillStyle='#8FA8BE'; x.fill();                                // painted saint panel
      x.fillStyle='#E7DCC8'; x.fillRect(X+BW*0.26, uy+uh*0.40, BW*0.48, uh*0.46);
      x.fillStyle='#3D5A80'; x.fillRect(X+BW*0.36, uy+uh*0.46, BW*0.28, uh*0.34);
    }
    cusped(x,X,uy,BW,uh,13);
  });
  x.fillStyle='#D9A62B'; x.fillRect(0,H*0.222,W,8);

  // central gable
  x.beginPath(); x.moveTo(W*0.27,H*0.225); x.lineTo(W*0.50,H*0.055);
  x.lineTo(W*0.73,H*0.225); x.closePath();
  x.fillStyle='#F7F4EC'; x.fill(); x.strokeStyle='#D9A62B'; x.lineWidth=7; x.stroke();
  x.fillStyle='#C9992A'; x.font='bold 27px "IBM Plex Sans",sans-serif';
  x.textAlign='center'; x.fillText('THY KINGDOM COME', W*0.50, H*0.175);
  for(const [fx,fy,col] of [[0.345,0.145,'#D5566B'],[0.655,0.145,'#D5566B'],
                            [0.40,0.115,'#5E9E56'],[0.60,0.115,'#5E9E56']]){
    x.fillStyle=col; x.beginPath(); x.arc(W*fx,H*fy,9,0,6.283); x.fill();
  }
  return new THREE.CanvasTexture(c);
}

const NAVE_TEX = naveWallTexture(), PARA_TEX = parapetTexture();
function texFor(base, rx, ry){
  const t=base.clone(); t.needsUpdate=true;
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry);
  return new THREE.MeshLambertMaterial({map:t});
}
function boxMats(base, W,H,D, uw,vh){
  const ends=texFor(base,D/uw,H/vh), sides=texFor(base,W/uw,H/vh), cap=plainMat(WHITE);
  return [ends,ends,cap,cap,sides,sides];
}

function gothicSpire(x,y,z,th,base,total){        // openwork tower top + cross
  const g=new THREE.Group();
  const bodyH=total*0.46;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(base,bodyH,base), plainMat(WHITE))
        .translateY(bodyH/2));
  const louvre=new THREE.Mesh(new THREE.PlaneGeometry(base*0.42,bodyH*0.34), plainMat(0x8FA0A8));
  louvre.position.set(0,bodyH*0.62,base/2+0.02); g.add(louvre);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(base*1.18,0.3,base*1.18), plainMat(GOLD))
        .translateY(bodyH));
  const sp=new THREE.Mesh(new THREE.ConeGeometry(base*0.62,total*0.5,4), plainMat(WHITE));
  sp.position.y=bodyH+total*0.25; sp.rotation.y=Math.PI/4; g.add(sp);
  for(let i=0;i<4;i++){                            // corner pinnacles
    const a=i*Math.PI/2+Math.PI/4, r=base*0.62;
    const p=new THREE.Mesh(new THREE.ConeGeometry(base*0.13,total*0.22,4), plainMat(WHITE));
    p.position.set(Math.cos(a)*r, bodyH+total*0.11, Math.sin(a)*r); p.rotation.y=Math.PI/4;
    g.add(p);
  }
  const cr=new THREE.Group();
  cr.add(new THREE.Mesh(new THREE.BoxGeometry(0.14,1.5,0.14), plainMat(0xEDE6D6)).translateY(0.75));
  cr.add(new THREE.Mesh(new THREE.BoxGeometry(0.8,0.14,0.14), plainMat(0xEDE6D6)).translateY(1.05));
  cr.position.y=bodyH+total*0.5; g.add(cr);
  g.position.set(x,y,z); g.rotation.y=th; return g;
}
function kodimaram(x,y,z){                         // copper flagstaff
  const g=new THREE.Group();
  const H=15;
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.19,H,10), plainMat(0xB06A2E)).translateY(H/2));
  for(let i=1;i<26;i++)
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,0.09,10), plainMat(0xD08A44))
          .translateY(H*i/26));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), plainMat(0xC9802F)).translateY(H+0.4));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12,1.3,0.12), plainMat(0xD9A62B)).translateY(H+1.5));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7,0.12,0.12), plainMat(0xD9A62B)).translateY(H+1.7));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(3.2,0.08,0.08), plainMat(0xB06A2E)).translateY(H-0.6).translateX(1.4));
  g.position.set(x,y,z); return g;
}

function paverTexture(){
  const c=document.createElement('canvas'); c.width=64; c.height=64;
  const x=c.getContext('2d');
  x.fillStyle='#8E4034'; x.fillRect(0,0,64,64);
  x.fillStyle='#5B5C5E';
  x.beginPath(); x.moveTo(32,0); x.lineTo(64,32); x.lineTo(32,64); x.lineTo(0,32); x.closePath(); x.fill();
  x.strokeStyle='rgba(0,0,0,.18)'; x.lineWidth=1.5;
  x.strokeRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1.7,1.7);
  return t;
}
const paverMat = new THREE.MeshLambertMaterial({map:paverTexture()});
const FACADE_MAT = new THREE.MeshLambertMaterial({map:facadeTexture()});

function buildChurch(poly, gr, grand){
  const g=new THREE.Group(), e=frontEdge(poly), c=centroid(poly);
  // the facade sits at the -W/2 end, so turn that end toward the approach road
  (function(){
    const r=nearestRoad(c[0],c[1]);
    if((r[0]-c[0])*e.dx + (r[1]-c[1])*e.dz > 0){
      e.dx=-e.dx; e.dz=-e.dz; e.nx=-e.nx; e.nz=-e.nz;
      e.th=Math.atan2(-e.dz,e.dx);
    }
  })();
  let W=0,D=0;
  for(const q of poly){
    const ax=q[0]-c[0], az=q[1]-c[1];
    W=Math.max(W,Math.abs(ax*e.dx+az*e.dz)); D=Math.max(D,Math.abs(ax*e.nx+az*e.nz));
  }
  W*=2; D*=2;
  const NH = grand ? 9.2 : 6.0, TH_ = e.th;
  const FLOORY = 0.75;
  // local (a = along the nave, b = across) -> world
  const P = (a,b)=>[c[0]+e.dx*a+e.nx*b, c[1]+e.dz*a+e.nz*b];
  const put = (mesh,a,b,y)=>{ const p=P(a,b); mesh.position.set(p[0],y,p[1]); mesh.rotation.y=TH_; g.add(mesh); return mesh; };

  // terraced churchyard: the ground falls away, so carry it on a platform
  const drop = (gr.hi - gr.lo) + 2.4;
  put(new THREE.Mesh(new THREE.BoxGeometry(W+34,drop+0.2,D+22), plainMat(0x9A6A4A)),
      -6, 0, 0.06-(drop+0.2)/2);
  const yw=W+34, yd=D+22;
  const ytex=paverMat.map.clone(); ytex.needsUpdate=true;
  ytex.wrapS=ytex.wrapT=THREE.RepeatWrapping; ytex.repeat.set(yw/1.2, yd/1.2);
  put(new THREE.Mesh(new THREE.PlaneGeometry(yw,yd).rotateX(-Math.PI/2),
      new THREE.MeshLambertMaterial({map:ytex})), -6,0,0.06);

  // plinth, carried down into the platform
  put(new THREE.Mesh(new THREE.BoxGeometry(W+1.2,FLOORY+drop,D+1.2), plainMat(PLINTH)),
      0, 0, FLOORY-(FLOORY+drop)/2);

  // nave: four walls, so it can be entered
  const TKN=0.45;
  for(const sgn of [-1,1])
    put(new THREE.Mesh(new THREE.BoxGeometry(W,NH,TKN), boxMats(NAVE_TEX,W,NH,TKN,4,10)),
        0, sgn*D/2, FLOORY+NH/2);
  put(new THREE.Mesh(new THREE.BoxGeometry(TKN,NH,D), boxMats(NAVE_TEX,TKN,NH,D,4,10)),
      W/2, 0, FLOORY+NH/2);

  // roof + pierced parapet
  put(new THREE.Mesh(new THREE.BoxGeometry(W-0.4,1.2,D-0.4), tileMat), 0,0, FLOORY+NH+0.6);
  const PH = grand?1.7:1.2;
  for(const sgn of [-1,1])
    put(new THREE.Mesh(new THREE.BoxGeometry(W,PH,0.26), boxMats(PARA_TEX,W,PH,0.26,4,2)),
        0, sgn*D/2, FLOORY+NH+PH/2);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.26,PH,D), boxMats(PARA_TEX,0.26,PH,D,4,2)),
      W/2, 0, FLOORY+NH+PH/2);

  // pinnacle row with gold tips
  const n=Math.max(4,Math.round(W/3.4));
  for(let i=0;i<=n;i++){
    const a=(i/n-0.5)*W;
    for(const sgn of [-1,1]){
      const s=grand?1:0.8, ph=grand?1.9:1.3;
      const pin=new THREE.Group();
      pin.add(new THREE.Mesh(new THREE.BoxGeometry(0.4*s,ph,0.4*s), plainMat(WHITE)).translateY(ph/2));
      pin.add(new THREE.Mesh(new THREE.ConeGeometry(0.34*s,1.0*s,4), plainMat(WHITE)).translateY(ph+0.5*s));
      pin.add(new THREE.Mesh(new THREE.SphereGeometry(0.13*s,6,5), plainMat(GOLD)).translateY(ph+1.0*s+0.1));
      put(pin, a, sgn*D/2, FLOORY+NH+PH-0.1);
    }
  }

  // lean-to awning down both flanks
  for(const sgn of [-1,1]){
    const aw=new THREE.Mesh(new THREE.BoxGeometry(W*0.84,0.1,2.6), plainMat(0x6D7175));
    put(aw, -W*0.04, sgn*(D/2+1.3), FLOORY+4.5); aw.rotateX(sgn*0.16);
    for(let i=0;i<7;i++)
      put(new THREE.Mesh(new THREE.BoxGeometry(0.1,1.5,0.1), plainMat(0x6D7175)),
          -W*0.04+(i/6-0.5)*W*0.8, sgn*(D/2+2.5), FLOORY+3.6);
  }

  // facade screen, flanking spires, gable statue
  const FW = D+1.6, FH = grand ? 12.4 : 8.0;
  const fac=new THREE.Mesh(new THREE.PlaneGeometry(FW,FH), FACADE_MAT);
  const fp=P(-W/2-1.0, 0);
  fac.position.set(fp[0], FH/2, fp[1]);
  fac.rotation.y = Math.atan2(-e.dx, -e.dz);
  g.add(fac);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.6,FH,D+1.0), plainMat(WHITE)), -W/2+0.3, 0, FH/2);

  const spH = grand ? 21 : 11, spB = grand ? 2.3 : 1.6;
  for(const sgn of [-1,1]){
    const sp = P(-W/2-1.1, sgn*(D/2+0.9));
    g.add(gothicSpire(sp[0], 0, sp[1], TH_, spB, spH));
  }
  // central gable statue of Christ
  const st=new THREE.Group();
  st.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.34,1.6,7), plainMat(0xC8412F)).translateY(0.8));
  st.add(new THREE.Mesh(new THREE.SphereGeometry(0.24,7,6), plainMat(0xE8DCC6)).translateY(1.75));
  st.add(new THREE.Mesh(new THREE.BoxGeometry(0.12,2.0,0.12), plainMat(0x3A2A1E)).translateY(1.3).translateX(0.4));
  st.add(new THREE.Mesh(new THREE.BoxGeometry(0.9,0.12,0.12), plainMat(0x3A2A1E)).translateY(1.8).translateX(0.4));
  st.scale.setScalar(0.62);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.3,0.7,1.3), plainMat(WHITE)), -W/2+0.3, 0, FH);
  put(st, -W/2+0.3, 0, FH+0.7);

  // entrance steps up onto the church plinth
  for(let i=0;i<4;i++)
    put(new THREE.Mesh(new THREE.BoxGeometry(0.5,0.17,D*0.55), plainMat(0xF2EDE2)),
        -W/2-0.9-i*0.5, 0, FLOORY-0.17*(i+1)+0.085);
  addStair(P(-W/2-0.9, 0), [-e.dx,-e.dz], [e.nx,e.nz], 4, 0.5, 0.17, D*0.28, gr.hi + FLOORY);

  if(grand){
    /* ---- the grand stairway down to the road, white treads on red risers,
       with a landing carrying the timber cross and the shrine ---- */
    const RISE=0.165, TREAD=0.44, HW=6.5;
    const aEdge = -6 - (W+34)/2;
    let n=0;
    for(let i=0;i<140;i++){
      const p=P(aEdge - i*TREAD, 0);
      if((0.06 - i*RISE) <= (groundAt(p[0],p[1]) - gr.hi)) break;
      n=i+1;
    }
    if(n > 6){
      const nA = Math.round(n*0.55), LAND = 3.6;
      const step = (i, aBase, yBase)=>{
        const a = aBase - i*TREAD;
        const y = yBase - i*RISE;
        put(new THREE.Mesh(new THREE.BoxGeometry(TREAD+0.02, 0.13, HW*2), plainMat(0xF4F0E6)),
            a - TREAD/2, 0, y - 0.065);                               // white tread
        put(new THREE.Mesh(new THREE.BoxGeometry(0.07, RISE, HW*2), plainMat(0x9B3B30)),
            a - TREAD, 0, y - RISE/2);                                // red riser
      };
      for(let i=0;i<nA;i++) step(i, aEdge, 0.06);
      const yLand = 0.06 - nA*RISE;
      const aLand = aEdge - nA*TREAD;
      addStair(P(aEdge,0), [-e.dx,-e.dz], [e.nx,e.nz], nA, TREAD, RISE, HW, gr.hi + 0.06);

      // landing
      put(new THREE.Mesh(new THREE.BoxGeometry(LAND, 0.14, HW*2), plainMat(0xF4F0E6)),
          aLand - LAND/2, 0, yLand - 0.07);
      const lc=P(aLand-LAND/2, 0);
      addDeck([P(aLand,  HW), P(aLand, -HW), P(aLand-LAND, -HW), P(aLand-LAND, HW)], gr.hi + yLand);

      const nB = n - nA;
      for(let i=0;i<nB;i++) step(i, aLand - LAND, yLand);
      addStair(P(aLand-LAND,0), [-e.dx,-e.dz], [e.nx,e.nz], nB, TREAD, RISE, HW, gr.hi + yLand);

      // side cheek walls, white over red like the real ones
      for(const sgn of [-1,1]){
        const len = n*TREAD + LAND;
        put(new THREE.Mesh(new THREE.BoxGeometry(len, 1.0, 0.5), plainMat(0xF4F0E6)),
            aEdge - len/2, sgn*(HW+0.3), (0.06 + (0.06-n*RISE))/2 + 0.2);
      }

      // timber cross on the landing
      const cx0 = aLand - LAND*0.5;
      for(let i=0;i<3;i++)
        put(new THREE.Mesh(new THREE.BoxGeometry(2.6-i*0.5, 0.3, 2.6-i*0.5), plainMat(0x3A3A38)),
            cx0, -HW*0.35, yLand + 0.07 + i*0.3);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 5.4, 0.34), plainMat(0x4A3A2A)),
          cx0, -HW*0.35, yLand + 1.0 + 2.7);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 2.7), plainMat(0x4A3A2A)),
          cx0, -HW*0.35, yLand + 1.0 + 3.9);

      // roadside shrine: white pedestal, glass canopy, red-robed statue
      const sx0 = aLand - LAND*0.4, sz0 = HW*0.28;
      put(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 2.0), plainMat(0xF7F4EC)), sx0, sz0, yLand+0.07);
      put(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.18, 2.3), plainMat(0xF7F4EC)), sx0, sz0, yLand+1.57);
      put(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 1.5), plainMat(0xB33B2E)), sx0, sz0, yLand+1.75);
      for(let i=0;i<4;i++){
        const ox=(i&1?1:-1)*0.72, oz=(i&2?1:-1)*0.72;
        put(new THREE.Mesh(new THREE.BoxGeometry(0.09,1.7,0.09), plainMat(0x8A8A86)),
            sx0+ox, sz0+oz, yLand+1.75);
      }
      put(new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.75, 4), plainMat(0xD6D2C6))
            .rotateY(Math.PI/4), sx0, sz0, yLand+3.45+0.375);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.09,0.8,0.09), plainMat(0xE8E2D4)), sx0, sz0, yLand+4.2);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.42,0.09,0.09), plainMat(0xE8E2D4)), sx0, sz0, yLand+4.75);
    }
  }

  if(grand){
    addDeck([P(-W/2, D/2), P(W/2, D/2), P(W/2, -D/2), P(-W/2, -D/2)], gr.hi + FLOORY);
    // ---- interior ----
    put(new THREE.Mesh(new THREE.PlaneGeometry(W-1,D-1).rotateX(-Math.PI/2), plainMat(0x9C4A38)),
        0,0,FLOORY+0.02);
    put(new THREE.Mesh(new THREE.PlaneGeometry(W-3,D*0.18).rotateX(-Math.PI/2), plainMat(0x1D5B9E)),
        -0.5,0,FLOORY+0.05);
    put(new THREE.Mesh(new THREE.PlaneGeometry(W+0.6,D+0.6).rotateX(Math.PI/2), plainMat(0xF2EEE4)),
        0,0,FLOORY+NH-0.35);
    for(let i=0;i<9;i++)                                   // painted roof trusses
      put(new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,D), plainMat(0xE2DCCE)),
          (i/8-0.5)*(W-1), 0, FLOORY+NH-0.5);

    const nCol=7, colH=NH-1.6;
    for(let i=0;i<nCol;i++){
      const a=(i/(nCol-1)-0.5)*(W*0.72)-W*0.04;
      for(const sgn of [-1,1]){
        const b=sgn*D*0.27;
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.38,colH,10), plainMat(0xFBF7EF)),
            a,b,FLOORY+colH/2);
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,0.34,10), plainMat(0xE07A2C)),
            a,b,FLOORY+colH+0.17);
      }
    }
    for(let r=0;r<16;r++){
      const a=-W*0.33+r*0.98;
      if(a>W*0.20) break;
      for(const sgn of [-1,1]){
        const b=sgn*D*0.245, len=D*0.30;
        put(new THREE.Mesh(new THREE.BoxGeometry(0.44,0.1,len), plainMat(0xA9702F)), a,b,FLOORY+0.45);
        put(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.5,len),  plainMat(0x8C5A25)), a-0.2,b,FLOORY+0.75);
        for(const q of [-1,1])
          put(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.45,0.1), plainMat(0x8C5A25)),
              a,b+q*len/2,FLOORY+0.22);
      }
    }
    // sanctuary
    put(new THREE.Mesh(new THREE.BoxGeometry(3.2,0.4,D*0.7), plainMat(0xB2503C)), W*0.33,0,FLOORY+0.2);
    const rer=new THREE.Mesh(new THREE.PlaneGeometry(D*0.42,NH*0.62), plainMat(0xE6E2CC));
    const rp=P(W/2-0.35,0);
    rer.position.set(rp[0],FLOORY+NH*0.40,rp[1]); rer.rotation.y=Math.atan2(-e.dx,-e.dz)+Math.PI;
    g.add(rer);
    put(new THREE.Mesh(new THREE.BoxGeometry(1.6,1.1,0.7), plainMat(0xD8CFAE)), W*0.36,0,FLOORY+0.4);
  }

  const kp = P(-W/2-15, D*0.52);
  g.add(kodimaram(kp[0], 0, kp[1]));
  g.position.y = gr.hi;
  return g;
}
