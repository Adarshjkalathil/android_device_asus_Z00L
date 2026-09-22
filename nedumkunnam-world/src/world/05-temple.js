
/* ---------- Kerala Hindu temple: laterite prakaram, tiled pyramidal
   srikovil with brass thazhikakudam, dwajasthambam ---------- */
function pyramidRoof(size, h, tiers){
  const g=new THREE.Group();
  let s=size, y=0;
  for(let i=0;i<tiers;i++){
    const th=h/tiers;
    const m=new THREE.Mesh(new THREE.ConeGeometry(s*0.78, th, 4), tileMat);
    m.position.y=y+th/2; m.rotation.y=Math.PI/4; g.add(m);
    const eave=new THREE.Mesh(new THREE.BoxGeometry(s*1.18,0.12,s*1.18), plainMat(0x6B4A33));
    eave.position.y=y; g.add(eave);
    y+=th*0.82; s*=0.72;
  }
  const fin=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.28,1.1,8), plainMat(0xC9932E));
  fin.position.y=y+0.4; g.add(fin);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,6), plainMat(0xD9A62B));
  knob.position.y=y+1.1; g.add(knob);
  return g;
}
function buildTemple(poly, gr, big){
  const g=new THREE.Group(), e=frontEdge(poly), c=centroid(poly);
  (function(){                       // the gate faces the approach road
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
  const P=(a,b)=>[c[0]+e.dx*a+e.nx*b, c[1]+e.dz*a+e.nz*b];
  const put=(m,a,b,y)=>{ const p=P(a,b); m.position.set(p[0],y,p[1]); m.rotation.y=e.th; g.add(m); return m; };

  // swept courtyard on a laterite terrace, inside the prakaram wall
  const drop=(gr.hi-gr.lo)+2.0;
  put(new THREE.Mesh(new THREE.BoxGeometry(W*0.94,drop+0.2,D*0.94), plainMat(0x9A6A4A)),
      0,0,0.05-(drop+0.2)/2);
  put(new THREE.Mesh(new THREE.PlaneGeometry(W*0.92,D*0.92).rotateX(-Math.PI/2),
      plainMat(0xB08A63)), 0,0,0.06);
  const wallH=2.0, t=0.4;
  for(const sgn of [-1,1]){
    put(new THREE.Mesh(new THREE.BoxGeometry(W*0.92,wallH,t), plainMat(0xA8623C)), 0, sgn*D*0.46, wallH/2);
    put(new THREE.Mesh(new THREE.BoxGeometry(t,wallH,D*0.92), plainMat(0xA8623C)), sgn*W*0.46, 0, wallH/2);
  }
  // gate with its own tiled roof
  put(new THREE.Mesh(new THREE.BoxGeometry(1.0,3.4,4.6), plainMat(0xC9B79A)), -W*0.46, 0, 1.7);
  const gate=pyramidRoof(3.6, 2.4, 2); put(gate, -W*0.46, 0, 3.4);

  // srikovil
  const S = big ? 7.5 : 5.0, H = big ? 4.2 : 3.2;
  put(new THREE.Mesh(new THREE.BoxGeometry(S,H,S), plainMat(0xE8DFCB)), W*0.10, 0, H/2);
  put(new THREE.Mesh(new THREE.BoxGeometry(S+0.7,0.5,S+0.7), plainMat(0x7C6A55)), W*0.10, 0, 0);
  const roof=pyramidRoof(S*0.82, big?5.6:4.0, big?2:1); put(roof, W*0.10, 0, H);

  // namaskara mandapam in front of the sanctum
  const M = big ? 5.0 : 3.6;
  for(let i=0;i<4;i++){
    const sx=(i&1)?1:-1, sz=(i&2)?1:-1;
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,2.8,8), plainMat(0xD9CDB6)),
        W*0.10-S*0.8+sx*M/2, sz*M/2, 1.4);
  }
  put(new THREE.Mesh(new THREE.BoxGeometry(M+0.8,0.3,M+0.8), plainMat(0xD9CDB6)), W*0.10-S*0.8, 0, 2.8);
  put(pyramidRoof(M*0.8, 2.4, 1), W*0.10-S*0.8, 0, 3.1);

  // dwajasthambam and a lamp pillar
  const dh = big ? 11 : 7;
  const fl=new THREE.Group();
  fl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.22,dh,9), plainMat(0xB98A3E)).translateY(dh/2));
  for(let i=1;i<16;i++)
    fl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.19,0.09,9), plainMat(0xD9A62B)).translateY(dh*i/16));
  fl.add(new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), plainMat(0xD9A62B)).translateY(dh+0.3));
  put(fl, -W*0.20, 0, 0);
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.34,2.4,8), plainMat(0x8E7A55)), -W*0.32, 0, 1.2);

  g.position.y = gr.hi;
  return g;
}
