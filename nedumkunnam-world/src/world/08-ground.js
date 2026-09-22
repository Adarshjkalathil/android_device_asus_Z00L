
/* ---------- school ground: concrete court, hoop and the tiered gallery
   that steps down from the blocks, as in the photographs ---------- */
function courtTexture(){
  const W=1024, H=576;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d');
  x.fillStyle='#6A6862'; x.fillRect(0,0,W,H);
  x.fillStyle='rgba(0,0,0,.04)';
  for(let i=0;i<1400;i++) x.fillRect(Math.random()*W|0,Math.random()*H|0,3,2);
  const m=42, L=m, R=W-m, T=m, B=H-m;
  x.fillStyle='#7A3428';                                   // painted keys
  x.fillRect(L, H/2-95, 190, 190); x.fillRect(R-190, H/2-95, 190, 190);
  x.strokeStyle='#C6C1B6'; x.lineWidth=6;
  x.strokeRect(L,T,R-L,B-T);
  x.beginPath(); x.moveTo(W/2,T); x.lineTo(W/2,B); x.stroke();
  x.fillStyle='#A8871F';                                    // centre circle
  x.beginPath(); x.arc(W/2,H/2,74,0,6.283); x.fill();
  x.fillStyle='#6A6862'; x.beginPath(); x.arc(W/2,H/2,62,0,6.283); x.fill();
  x.strokeStyle='#C6C1B6'; x.lineWidth=5;
  for(const cx of [L+190, R-190]){ x.beginPath(); x.arc(cx,H/2,72,0,6.283); x.stroke(); }
  x.strokeRect(L, H/2-95, 190, 190); x.strokeRect(R-190, H/2-95, 190, 190);
  x.lineWidth=6;
  for(const [cx,dir] of [[L,1],[R,-1]]){                    // three-point arcs
    x.beginPath(); x.arc(cx, H/2, 238, -Math.PI/2*dir, Math.PI/2*dir, dir<0); x.stroke();
  }
  return new THREE.CanvasTexture(c);
}
function basketHoop(x,y,z,th){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.12,3.4,8), plainMat(0x6E6A64)).translateY(1.7));
  const arm=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.1,0.1), plainMat(0x6E6A64));
  arm.position.set(0.5,3.4,0); g.add(arm);
  const bb=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.05), plainMat(0xF2EFE6));
  bb.position.set(1.0,3.5,0); bb.rotation.y=Math.PI/2; g.add(bb);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(0.23,0.035,6,12), plainMat(0xC4502A));
  rim.position.set(0.72,3.05,0); rim.rotation.x=Math.PI/2; g.add(rim);
  g.position.set(x,y,z); g.rotation.y=th; return g;
}
for(const s of SITE.s){
  if(s.k !== 'court') continue;
  const e=frontEdge(s.p), c=centroid(s.p);
  let W=0,D=0;
  for(const q of s.p){
    const ax=q[0]-c[0], az=q[1]-c[1];
    W=Math.max(W,Math.abs(ax*e.dx+az*e.dz)); D=Math.max(D,Math.abs(ax*e.nx+az*e.nz));
  }
  W*=2; D*=2;
  const P=(a,b)=>[c[0]+e.dx*a+e.nx*b, c[1]+e.dz*a+e.nz*b];

  // The player walks on the terrain, so the court is laid over it as a draped
  // mesh rather than a raised slab - no floating, and you can stand on it.
  const NU=28, NV=16, pos=[], uv=[], idx=[];
  for(let j=0;j<=NV;j++) for(let i=0;i<=NU;i++){
    const a=(i/NU-0.5)*W, b=(j/NV-0.5)*D, p=P(a,b);
    pos.push(p[0], groundAt(p[0],p[1])+0.55, p[1]);
    uv.push(i/NU, 1-j/NV);
  }
  for(let j=0;j<NV;j++) for(let i=0;i<NU;i++){
    const k=j*(NU+1)+i;
    idx.push(k, k+NU+1, k+1, k+1, k+NU+1, k+NU+2);
  }
  const cg=new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  cg.setAttribute('uv',       new THREE.Float32BufferAttribute(uv,2));
  cg.setIndex(idx); cg.computeVertexNormals();
  // winding depends on the polygon's orientation, so draw both faces
  scene.add(new THREE.Mesh(cg, new THREE.MeshLambertMaterial({
    map:courtTexture(), side:THREE.DoubleSide })));

  for(const sx of [-0.42, 0.42]){
    const p=P(W*sx,0);
    scene.add(basketHoop(p[0], groundAt(p[0],p[1])+0.55, p[1], e.th + (sx<0?0:Math.PI)));
  }

  // tiered gallery on the side facing the nearest block, each piece set on the ground
  let near=null, nd=1e9;
  for(const b of BUILDINGS){
    const d=Math.hypot(b.c[0]-c[0], b.c[1]-c[1]);
    if(d<nd && d>4){ nd=d; near=b; }
  }
  const sgn = near && (((near.c[0]-c[0])*e.nx + (near.c[1]-c[1])*e.nz) < 0) ? -1 : 1;
  const seg=Math.max(6, Math.round(W/4));
  for(let t=0;t<3;t++){
    for(let i=0;i<seg;i++){
      const a=((i+0.5)/seg-0.5)*W, b=sgn*(D/2+0.6+t*1.15);
      const p=P(a,b), y=groundAt(p[0],p[1]);
      const m=new THREE.Mesh(new THREE.BoxGeometry(W/seg+0.05,0.42+t*0.34,1.2), plainMat(0xBFB6A6));
      m.position.set(p[0], y+0.55+(0.42+t*0.34)/2, p[1]); m.rotation.y=e.th;
      scene.add(m);
    }
  }
  const np=Math.max(4, Math.round(W/3.2));
  for(let i=0;i<=np;i++){
    const a=(i/np-0.5)*W, p=P(a, sgn*(D/2+2.5));
    const m=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.13,0.95,7),
                           plainMat(i%2 ? 0xB3372B : 0xF0EBDF));
    m.position.set(p[0], groundAt(p[0],p[1])+1.95, p[1]);
    scene.add(m);
  }
}
