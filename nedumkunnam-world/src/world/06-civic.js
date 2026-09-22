
/* ---------- parish hall / auditorium: one clear span under a tiled roof ---------- */
function bigHall(poly, gr, h){
  const g=new THREE.Group(), e=frontEdge(poly), c=centroid(poly);
  const P=(a,b)=>[c[0]+e.dx*a+e.nx*b, c[1]+e.dz*a+e.nz*b];
  const put=(m,a,b,y)=>{ const p=P(a,b); m.position.set(p[0],y,p[1]); m.rotation.y=e.th; g.add(m); return m; };
  let W=0,D=0;
  for(const q of poly){
    const ax=q[0]-c[0], az=q[1]-c[1];
    W=Math.max(W,Math.abs(ax*e.dx+az*e.dz)); D=Math.max(D,Math.abs(ax*e.nx+az*e.nz));
  }
  W*=2; D*=2;
  const drop=(gr.hi-gr.lo)+1.8;
  put(new THREE.Mesh(new THREE.BoxGeometry(W,drop,D), plainMat(0xA88C6C)), 0,0,-drop/2);
  put(new THREE.Mesh(new THREE.BoxGeometry(W,h,D), boxMats(NAVE_TEX,W,h,D,4,10)), 0,0,h/2);
  put(new THREE.Mesh(new THREE.BoxGeometry(W+0.6,0.4,D+0.6), plainMat(0xC9BBA4)), 0,0,h);
  g.add(hippedRoof(poly, h+0.4));
  // entrance porch on the long side
  put(new THREE.Mesh(new THREE.BoxGeometry(W*0.26,0.3,3.0), plainMat(0xD9CDB6)), 0, -(D/2+1.5), 3.4);
  for(let i=-1;i<=1;i+=2)
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,3.4,8), plainMat(0xE6DCC8)),
        i*W*0.11, -(D/2+2.8), 1.7);
  g.position.y = gr.hi;
  return g;
}

/* ---------- shop signboards, painted with the real shop names ---------- */
const SIGN_COLS = [0x1B5E9B,0xB3261E,0x1F6B3A,0xD9932B,0x5B2D8E,0x0F6E75];
function signFor(name, col){
  const c=document.createElement('canvas'); c.width=512; c.height=96;
  const x=c.getContext('2d');
  x.fillStyle='#'+col.toString(16).padStart(6,'0'); x.fillRect(0,0,512,96);
  x.fillStyle='rgba(255,255,255,.12)'; x.fillRect(0,0,512,8);
  const txt=name.toUpperCase();
  let fs=46;
  x.font='700 '+fs+'px "IBM Plex Sans",sans-serif';
  while(x.measureText(txt).width>478 && fs>13){ fs-=2; x.font='700 '+fs+'px "IBM Plex Sans",sans-serif'; }
  x.fillStyle='#FFFFFF'; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(txt,256,52);
  return new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(c)});
}
function shopSign(poly, name, y){
  const c0=centroid(poly), nr=nearestRoad(c0[0],c0[1]);
  const tx=nr[0]-c0[0], tz=nr[1]-c0[1], TL=Math.hypot(tx,tz)||1;
  let bestScore=-1e9, bx=0, bz=0, bnx=0, bnz=0, blen=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i], b=poly[(i+1)%poly.length];
    const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz);
    if(L<1.2) continue;
    let nx=-dz/L, nz=dx/L;
    const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;
    if(nx*(mx-c0[0])+nz*(mz-c0[1]) < 0){ nx=-nx; nz=-nz; }   // point outward
    const score = (nx*tx+nz*tz)/TL * Math.min(L,14);          // road-facing and wide
    if(score>bestScore){ bestScore=score; bx=mx; bz=mz; bnx=nx; bnz=nz; blen=L; }
  }
  if(!blen) return null;
  let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))>>>0;
  const w=Math.min(blen*0.88, 11);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w, w/5.3),
                         signFor(name, SIGN_COLS[h%SIGN_COLS.length]));
  m.position.set(bx+bnx*0.14, y, bz+bnz*0.14);
  m.rotation.y = Math.atan2(bnx, bnz);
  return m;
}
