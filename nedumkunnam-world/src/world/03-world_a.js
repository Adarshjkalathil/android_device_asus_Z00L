
/* ---------- where people are: drives the ground cover ---------- */
const ROADPTS = [];
for(const r of SITE.r) for(let i=0;i<r.p.length;i+=1) ROADPTS.push(r.p[i]);
const ROADPTS_C = ROADPTS.filter(function(_,i){ return i%5===0; });   // coarse, for terrain
function nearestRoad(x,z){
  let d=1e9, bx=x, bz=z;
  for(const q of ROADPTS){
    const e=(q[0]-x)*(q[0]-x)+(q[1]-z)*(q[1]-z);
    if(e<d){ d=e; bx=q[0]; bz=q[1]; }
  }
  return [bx,bz,Math.sqrt(d)];
}
const BLDC = SITE.b.map(function(b){ return centroid(b.p); });
// squared distances until the end, and bail out once we are already close
function settledness(x,z){          // metres to the nearest road or building
  let d=1e9;
  for(let i=0;i<ROADPTS_C.length;i++){
    const q=ROADPTS_C[i], dx=q[0]-x;
    if(dx>160||dx<-160) continue;
    const dz=q[1]-z; if(dz>160||dz<-160) continue;
    const e=dx*dx+dz*dz; if(e<d){ d=e; if(d<36) return 6; }
  }
  for(let i=0;i<BLDC.length;i++){
    const q=BLDC[i], dx=q[0]-x;
    if(dx>160||dx<-160) continue;
    const dz=q[1]-z; if(dz>160||dz<-160) continue;
    const e=dx*dx+dz*dz; if(e<d) d=e;
  }
  return Math.sqrt(d);
}

/* ---------- terrain ---------- */
const SURF = [];
const SURF_C = { water:[0.20,0.36,0.42], quarry:[0.62,0.55,0.45],
                 recreation_ground:[0.55,0.40,0.26], campus:[0.42,0.56,0.30] };
for(const s of SITE.s) SURF.push({p:s.p, bb:bbox(s.p), c:SURF_C[s.k]||[0.40,0.52,0.28]});

function terrainColor(x,z,y,out){
  for(let i=SURF.length-1;i>=0;i--){
    const s=SURF[i], b=s.bb;
    if(x<b[0]||x>b[2]||z<b[1]||z>b[3]) continue;
    if(inPoly(x,z,s.p)){ out[0]=s.c[0]; out[1]=s.c[1]; out[2]=s.c[2]; return; }
  }
  // Kottayam is rolling laterite: bare red earth around the houses and roads,
  // dark rubber and coconut canopy on the slopes, scrub between.
  const n1 = Math.sin(x*0.077)*Math.cos(z*0.069) + Math.sin(x*0.021+1.7)*Math.cos(z*0.026+0.6);
  const n2 = Math.sin(x*0.31+2.1)*Math.cos(z*0.28);
  const nz = 0.5*n1 + 0.14*n2;

  const LAT  = [0.545, 0.300, 0.190];      // exposed laterite
  const DUST = [0.500, 0.372, 0.250];      // dry compound earth
  const SCRUB= [0.265, 0.345, 0.165];      // olive scrub / grass
  const CANO = [0.150, 0.250, 0.125];      // rubber and coconut canopy

  const s = settledness(x,z);
  const slope = slopeAt(x,z);
  // laterite is confined to the compounds, road edges and cuttings; everything
  // beyond that closes over into rubber and coconut canopy
  const openness = Math.min(Math.max((s-7)/20, 0), 1);
  const steepish = Math.min(Math.max((slope-0.004)*13, 0), 1);
  const wood = openness * (0.55 + 0.45*steepish);

  let r,g,b;
  const t = Math.min(Math.max(openness*1.4 + nz*0.18, 0), 1);
  r = LAT[0]+(SCRUB[0]-LAT[0])*t; g = LAT[1]+(SCRUB[1]-LAT[1])*t; b = LAT[2]+(SCRUB[2]-LAT[2])*t;
  r += (CANO[0]-r)*wood; g += (CANO[1]-g)*wood; b += (CANO[2]-b)*wood;
  // steep cuttings scour back to raw laterite
  const bare = Math.min(Math.max((slope-0.075)*13, 0), 1) * (1-wood*0.55);
  r += (LAT[0]-r)*bare; g += (LAT[1]-g)*bare; b += (LAT[2]-b)*bare;
  // dusty patches near the compounds
  const dust = Math.max(0, 1-s/13) * 0.5;
  r += (DUST[0]-r)*dust; g += (DUST[1]-g)*dust; b += (DUST[2]-b)*dust;

  const v = 1 + nz*0.10;
  out[0]=Math.min(r*v,1); out[1]=Math.min(g*v,1); out[2]=Math.min(b*v,1);
}

// fine ground detail, so the terrain is not a flat colour field up close
function soilTexture(){
  const c=document.createElement('canvas'); c.width=128; c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='#EDEDED'; x.fillRect(0,0,128,128);
  for(let i=0;i<5200;i++){
    const v=200+Math.random()*55|0;
    x.fillStyle='rgb('+v+','+v+','+v+')';
    x.fillRect(Math.random()*128|0, Math.random()*128|0, 1+(Math.random()*2|0), 1);
  }
  for(let i=0;i<70;i++){
    x.fillStyle='rgba(150,150,150,.20)';
    x.beginPath(); x.arc(Math.random()*128, Math.random()*128, 3+Math.random()*7, 0, 6.283); x.fill();
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
const SOIL_TEX = soilTexture();

(function terrain(){
  const R=140, pos=[], col=[], uv=[], idx=[], c=[0,0,0];
  for(let j=0;j<=R;j++) for(let i=0;i<=R;i++){
    const x=-HX+2*HX*i/R, z=-HZ+2*HZ*j/R, y=groundAt(x,z);
    pos.push(x,y,z); terrainColor(x,z,y,c); col.push(c[0],c[1],c[2]);
    uv.push(x/6, z/6);
  }
  for(let j=0;j<R;j++) for(let i=0;i<R;i++){
    const a=j*(R+1)+i, b=a+1, d=a+R+1, e=d+1;
    idx.push(a,d,b, b,d,e);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',    new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({
    vertexColors:true, map:SOIL_TEX })));
})();

function ribbon(line, halfW, lift, mat){
  const pos=[], idx=[]; let n=0;
  for(let i=0;i<line.length-1;i++){
    const a=line[i], b=line[i+1];
    let dx=b[0]-a[0], dz=b[1]-a[1]; const L=Math.hypot(dx,dz); if(L<0.01) continue;
    dx/=L; dz/=L; const nx=-dz*halfW, nz=dx*halfW;
    const ya=groundAt(a[0],a[1])+lift, yb=groundAt(b[0],b[1])+lift;
    pos.push(a[0]+nx,ya,a[1]+nz, a[0]-nx,ya,a[1]-nz, b[0]+nx,yb,b[1]+nz, b[0]-nx,yb,b[1]-nz);
    idx.push(n,n+2,n+1, n+1,n+2,n+3); n+=4;
  }
  if(!idx.length) return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
const ROAD_W = {secondary:7, tertiary:5.5, unclassified:4, residential:4,
                service:3.5, track:3, footway:2, path:1.8};
const ROADS = [];
for(const r of SITE.r){
  const soft = r.k==='footway'||r.k==='path'||r.k==='track';
  const m = ribbon(r.p, (ROAD_W[r.k]||4)/2, 0.5, plainMat(soft?0xA5794F:C.road));
  if(m){ scene.add(m); ROADS.push(r.p); }
}
for(const w of SITE.wl){
  const m = ribbon(w.p, 1.2, -0.3, plainMat(0x3A606B));
  if(m) scene.add(m);
}

/* ---------- Kerala vernacular: Mangalore-tile hipped roof ---------- */
function tileTexture(){
  const c=document.createElement('canvas'); c.width=64; c.height=64;
  const x=c.getContext('2d');
  x.fillStyle='#A34A2C'; x.fillRect(0,0,64,64);
  x.strokeStyle='rgba(0,0,0,.22)'; x.lineWidth=2;
  for(let i=0;i<=64;i+=8){ x.beginPath(); x.moveTo(0,i); x.lineTo(64,i); x.stroke(); }
  x.strokeStyle='rgba(0,0,0,.10)'; x.lineWidth=1;
  for(let i=0;i<=64;i+=10){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,64); x.stroke(); }
  x.fillStyle='rgba(255,255,255,.05)';
  for(let i=0;i<60;i++) x.fillRect(Math.random()*64|0,Math.random()*64|0,3,2);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(0.6,0.6);
  return t;
}
const tileMat = new THREE.MeshLambertMaterial({map:tileTexture()});

function hippedRoof(poly, eaveY){
  const e = frontEdge(poly);
  let W=0, D=0;                                  // extent along / across the long edge
  const c = centroid(poly);
  for(const q of poly){
    const ax=q[0]-c[0], az=q[1]-c[1];
    W = Math.max(W, Math.abs(ax*e.dx + az*e.dz));
    D = Math.max(D, Math.abs(ax*e.nx + az*e.nz));
  }
  W = W*2 + 1.5; D = D*2 + 1.5;                  // eaves overhang
  const h = Math.min(D*0.42, 4.2), R = Math.max(W-D, 0.6);
  const v = [[-W/2,0,-D/2],[W/2,0,-D/2],[W/2,0,D/2],[-W/2,0,D/2],[-R/2,h,0],[R/2,h,0]];
  const faces = [[0,1,5],[0,5,4],[2,3,4],[2,4,5],[3,0,4],[1,2,5]];
  const pos=[], uv=[];
  for(const f of faces) for(const k of f){
    pos.push(v[k][0], v[k][1], v[k][2]);
    uv.push(v[k][0]*0.5, (v[k][2]+v[k][1])*0.5);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, tileMat);
  m.position.set(c[0], eaveY, c[1]); m.rotation.y = e.th;
  return m;
}


/* ---------- laterite compound walls ---------- */
function compoundWall(poly, h, col){
  const pos=[], idx=[]; let n=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i], b=poly[(i+1)%poly.length];
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<0.5) continue;
    const ya=groundAt(a[0],a[1])-0.4, yb=groundAt(b[0],b[1])-0.4;
    pos.push(a[0],ya,a[1], b[0],yb,b[1], a[0],ya+h,a[1], b[0],yb+h,b[1]);
    idx.push(n,n+1,n+2, n+1,n+3,n+2, n+2,n+1,n, n+2,n+3,n+1);
    n+=4;
  }
  if(!idx.length) return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, plainMat(col));
}
for(const s of SITE.s) if(s.k==='campus'){
  const m = compoundWall(s.p, 1.7, 0xA85436);
  if(m) scene.add(m);
}

