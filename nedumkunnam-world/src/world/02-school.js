/* ---------- Kerala school block: balcony corridors, verandah columns and an
   external stair tower \u2014 modelled from the photograph of the HS block ---------- */
function boxAt(w,hh,d,cx,cz,y,th,col){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,hh,d), plainMat(col));
  m.position.set(cx,y+hh/2,cz); m.rotation.y = th; return m;
}
function frontEdge(poly){
  let bi=0, bl=0;
  for(let i=0;i<poly.length;i++){
    const j=(i+1)%poly.length;
    const L=Math.hypot(poly[j][0]-poly[i][0], poly[j][1]-poly[i][1]);
    if(L>bl){ bl=L; bi=i; }
  }
  const a=poly[bi], b=poly[(bi+1)%poly.length], c=centroid(poly);
  const L=Math.hypot(b[0]-a[0], b[1]-a[1]);
  const dx=(b[0]-a[0])/L, dz=(b[1]-a[1])/L;
  let nx=-dz, nz=dx;
  const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;
  if(nx*(mx-c[0]) + nz*(mz-c[1]) < 0){ nx=-nx; nz=-nz; }
  return {dx:dx, dz:dz, nx:nx, nz:nz, len:L, mx:mx, mz:mz, th:Math.atan2(-dz,dx)};
}
function railTexture(){                     // green balusters over the shaded corridor
  const c=document.createElement('canvas'); c.width=64; c.height=32;
  const x=c.getContext('2d');
  x.fillStyle='#2B2F2A'; x.fillRect(0,0,64,32);
  x.fillStyle='#8FBE86';
  for(let i=2;i<64;i+=8) x.fillRect(i,4,4,24);
  x.fillRect(0,0,64,5); x.fillRect(0,27,64,5);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
const RAIL_TEX = railTexture();
function railMat(len){
  const t=RAIL_TEX.clone(); t.needsUpdate=true;
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(len/2.2, 1);
  return new THREE.MeshLambertMaterial({map:t});
}
function signBoard(text){
  const c=document.createElement('canvas'); c.width=512; c.height=64;
  const x=c.getContext('2d');
  x.fillStyle='#123E7C'; x.fillRect(0,0,512,64);          // blue banner
  x.fillStyle='rgba(255,255,255,.14)'; x.fillRect(0,0,512,5);
  let fs=27; x.font='700 '+fs+'px "IBM Plex Sans",sans-serif';
  while(x.measureText(text).width>486 && fs>9){ fs--; x.font='700 '+fs+'px "IBM Plex Sans",sans-serif'; }
  x.fillStyle='#FFFFFF'; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(text,256,34);
  return new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(c)});
}
// Pick the long wall that faces the target, rather than flipping the normal of
// whichever edge happened to be longest - flipping alone buries the verandah
// inside the building.
function frontEdgeToward(poly, target){
  const c = centroid(poly);
  let best=null, bestScore=-1e9;
  for(let i=0;i<poly.length;i++){
    const a=poly[i], b=poly[(i+1)%poly.length];
    const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz);
    if(L<2) continue;
    let nx=-dz/L, nz=dx/L;
    const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;
    if(nx*(mx-c[0])+nz*(mz-c[1]) < 0){ nx=-nx; nz=-nz; }      // outward
    let score = L;
    if(target){
      const tx=target[0]-mx, tz=target[1]-mz, T=Math.hypot(tx,tz)||1;
      score = L * (0.35 + 0.65*Math.max(0,(nx*tx+nz*tz)/T));
    }
    if(score>bestScore){
      bestScore=score;
      best={dx:dx/L, dz:dz/L, nx:nx, nz:nz, len:L, mx:mx, mz:mz, th:Math.atan2(-dz/L,dx/L)};
    }
  }
  return best || frontEdge(poly);
}
function schoolBlock(poly, levels, label, face){
  const g = new THREE.Group();
  const e = frontEdgeToward(poly, face);
  const D = 2.0, H = levels*FLOOR;
  const ox = e.mx + e.nx*(D/2),      oz = e.mz + e.nz*(D/2);
  const px = e.mx + e.nx*(D-0.09),   pz = e.mz + e.nz*(D-0.09);

  g.add(boxAt(e.len+0.3, 0.5, D+0.3, ox, oz, 0, e.th, C.trim));    // painted skirting
  const nCol = Math.max(3, Math.round(e.len/4));
  for(let i=0;i<=nCol;i++){
    const t=(i/nCol-0.5)*e.len;
    g.add(boxAt(0.34, FLOOR, 0.34,
      e.mx + e.dx*t + e.nx*(D-0.4), e.mz + e.dz*t + e.nz*(D-0.4), 0, e.th, 0xE6DCC8));
  }
  for(let k=1;k<=levels;k++){
    const y = k*FLOOR;
    g.add(boxAt(e.len, 0.24, D,    ox, oz, y-0.24, e.th, 0xD9CDB6));
    g.add(boxAt(e.len, 0.30, 0.18, px, pz, y,      e.th, C.trim));
    g.add(boxAt(e.len, 0.34, 0.16, px, pz, y+0.30, e.th, 0xEFE6D4));
    const rl = new THREE.Mesh(new THREE.BoxGeometry(e.len, 0.62, 0.12), railMat(e.len));
    const rp = [px, pz];
    rl.position.set(rp[0], y+0.64+0.31, rp[1]); rl.rotation.y = e.th; g.add(rl);
    if(k<levels) for(let i=0;i<=nCol;i++){
      const t=(i/nCol-0.5)*e.len;
      g.add(boxAt(0.3, FLOOR-0.96, 0.3,
        e.mx + e.dx*t + e.nx*(D-0.4), e.mz + e.dz*t + e.nz*(D-0.4), y+0.96, e.th, 0xE6DCC8));
    }
  }
  g.add(boxAt(e.len+1.0, 0.26, D+0.7, ox, oz, H,      e.th, 0xC7BBA4));
  g.add(boxAt(e.len+1.0, 0.55, 0.18, px, pz, H+0.26,  e.th, 0xEFE6D4));

  const SW = 4.4, SD = 3.6;
  const sx = e.mx + e.dx*(e.len/2-SW/2) + e.nx*(D+SD/2);
  const sz = e.mz + e.dz*(e.len/2-SW/2) + e.nz*(D+SD/2);
  g.add(boxAt(SW, 0.28, SD, sx, sz, -0.28, e.th, 0xD9CDB6));
  for(const sgn of [-1,1])
    g.add(boxAt(0.2, H, SD, sx + e.dx*sgn*SW/2, sz + e.dz*sgn*SW/2, 0, e.th, 0xEFE6D4));
  g.add(boxAt(SW, H, 0.2, sx + e.nx*SD/2, sz + e.nz*SD/2, 0, e.th, 0xEFE6D4));
  for(let k=0;k<levels;k++){
    const rise = FLOOR/2, run = SD-0.6;
    for(const half of [0,1]){
      const fl = new THREE.Mesh(new THREE.BoxGeometry(SW/2-0.4, 0.2, Math.hypot(run,rise)),
                                plainMat(0xE6DCC8));
      fl.position.set(sx + e.dx*(half? SW/4 : -SW/4),
                      k*FLOOR + rise*(half?1.5:0.5),
                      sz + e.dz*(half? SW/4 : -SW/4));
      fl.rotation.y = e.th; fl.rotateX(half ? -Math.atan2(rise,run) : Math.atan2(rise,run));
      g.add(fl);
    }
    g.add(boxAt(SW-0.4, 0.22, 1.3, sx, sz, k*FLOOR + rise - 0.22, e.th, 0xD9CDB6));
    g.add(boxAt(SW-0.4, 0.22, 1.3, sx, sz, (k+1)*FLOOR - 0.22,    e.th, 0xD9CDB6));
    for(const sgn of [-1,1])
      g.add(boxAt(0.24, 0.3, SD, sx + e.dx*sgn*SW/2, sz + e.dz*sgn*SW/2,
                  (k+1)*FLOOR, e.th, C.trim));
  }
  g.add(boxAt(SW+0.5, 0.26, SD+0.5, sx, sz, H, e.th, 0xC7BBA4));

  if(label){
    const bw = Math.min(e.len*0.8, 30);
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(bw, bw/13), signBoard(label));
    bd.position.set(px + e.nx*0.14, levels*FLOOR - 0.55, pz + e.nz*0.14);
    bd.rotation.y = Math.atan2(e.nx, e.nz);
    g.add(bd);
  }
  return g;
}

