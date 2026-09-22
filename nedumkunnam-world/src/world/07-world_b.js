/* ---------- buildings ---------- */
const BUILDINGS = [];
function heightOf(b){
  if(b.l) return b.l*FLOOR + 1.0;
  if(b.k==='school'||b.k==='college') return 2*FLOOR + 1.0;
  if(b.k==='church'||b.am==='place_of_worship') return 7.5;
  if(b.s || b.k==='commercial') return 3.6;
  if(b.k==='house') return 3.2;
  return b.a2 > 400 ? 2*FLOOR : 3.6;
}
function isInstitutional(b){
  return !!b.l || b.k==='school' || b.k==='college' || b.k==='commercial'
      || b.am==='conference_centre' || b.am==='social_facility' || b.a2 > 1100;
}
// Each school block fronts onto its own campus court, so face it toward the
// mean of the other school buildings within 150 m rather than one global point.
function campusFocus(poly){
  const c = centroid(poly);
  let n=0, sx=0, sz=0;
  for(const o of SITE.b){
    if(o.k!=='school' && o.k!=='college') continue;
    const q = centroid(o.p);
    const d = Math.hypot(q[0]-c[0], q[1]-c[1]);
    if(d < 1 || d > 150) continue;
    sx+=q[0]; sz+=q[1]; n++;
  }
  // if the campus court is close by, the blocks front onto that
  const court = SITE.s.filter(function(x){ return x.k === 'court'; })[0];
  if(court){
    const q = centroid(court.p);
    if(Math.hypot(q[0]-c[0], q[1]-c[1]) < 90) return q;
  }
  if(!n) return nearestRoad(c[0], c[1]);
  return [sx/n, sz/n];
}

// Replace an over-large institutional polygon with a building-sized rectangle
// inside it, aligned to its long axis.
function shrinkToBuilding(poly, targetArea){
  const e = frontEdge(poly), c = centroid(poly);
  let W=0, D=0;
  for(const q of poly){
    const ax=q[0]-c[0], az=q[1]-c[1];
    W=Math.max(W,Math.abs(ax*e.dx+az*e.dz)); D=Math.max(D,Math.abs(ax*e.nx+az*e.nz));
  }
  W*=2; D*=2;
  const k = Math.sqrt(targetArea/(W*D));
  const w = W*Math.min(1,k*1.35), d = D*Math.min(1,targetArea/(W*Math.min(1,k*1.35)*D));
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(function(q){
    return [c[0] + e.dx*q[0]*w/2 + e.nx*q[1]*d/2,
            c[1] + e.dz*q[0]*w/2 + e.nz*q[1]*d/2];
  });
}

for(const b0 of SITE.b){
  const b = (b0.k==='college' && b0.a2 > 2500)
    ? Object.assign({}, b0, {p: shrinkToBuilding(b0.p, 1530), a2: 1530})
    : b0;
  const h = heightOf(b), gr = baseOf(b.p);
  const foot = gr.lo - 1.6, top = gr.hi + h;
  const inst = isInstitutional(b);
  const sacred = b.k==='church' || b.am==='place_of_worship';

  if(sacred){                      // skip only if a SITE.w2 area already covers it
    const ct = centroid(b.p);
    let covered = false;
    for(const s of SITE.w2) if(inPoly(ct[0], ct[1], s.p)) { covered = true; break; }
    if(covered) continue;
    scene.add(buildChurch(b.p, gr, false));
    BUILDINGS.push({poly:b.p, h:h+8, y:gr.hi, c:ct, open:true,
      name: b.n || 'chapel', meta:'chapel'});
    continue;
  }
  const isHall = b.am === 'conference_centre' || /auditorium|hall/i.test(b.n);
  if(isHall){
    scene.add(bigHall(b.p, gr, 8.5));
    BUILDINGS.push({poly:b.p, h:12, y:gr.hi, c:centroid(b.p),
      name: b.n || 'auditorium', meta:'parish hall'});
    continue;
  }
  const geo = new THREE.ExtrudeGeometry(shapeOf(b.p),
    {depth: top-foot, bevelEnabled:false, UVGenerator:UVGEN});
  geo.rotateX(-Math.PI/2);
  const plain = b.a2 < 40;
  const mesh = new THREE.Mesh(geo, plain ? [roofMat, plainMat(0xC9BBA4)]
                                         : [roofMat, sacred ? plainMat(0xF4EEE2) : wallMat]);
  mesh.position.y = foot; scene.add(mesh);

  if(inst && !sacred){                               // flat concrete roof + parapet
    const par = new THREE.ExtrudeGeometry(shapeOf(b.p), {depth:0.5, bevelEnabled:false});
    par.rotateX(-Math.PI/2);
    const pm = new THREE.Mesh(par, plainMat(C.roof)); pm.position.y = top; scene.add(pm);
  } else {
    scene.add(hippedRoof(b.p, top));                 // Mangalore tile
  }
  if(b.l && (b.k==='school'||b.k==='college')){
    const blk = schoolBlock(b.p, b.l, /higher secondary|high school|schol/i.test(b.n)
              ? "ST JOHN THE BAPTIST'S HIGHER SECONDARY SCHOOL NEDUMKUNNAM"
              : /college of education/i.test(b.n) ? "ST JOHN THE BAPTIST'S COLLEGE OF EDUCATION" : '',
      campusFocus(b.p));
    blk.position.y = gr.hi; scene.add(blk);
  }
  if(b.n && !inst && b.a2 < 900 && b.k !== 'house'){
    const sg = shopSign(b.p, b.n, gr.hi + h*0.78);
    if(sg) scene.add(sg);
  }
  BUILDINGS.push({poly:b.p, h:h, y:gr.hi, c:centroid(b.p),
    name: b.n || (b.s ? b.s.replace(/_/g,' ') : (b.k==='house' ? 'house' : 'building')),
    meta: (b.l ? b.l+' floors \u00B7 ' : '') +
          (sacred ? 'church' : b.k==='school' ? 'school block' : b.k==='college' ? 'college'
           : b.am ? b.am.replace(/_/g,' ') : b.s ? 'shop' : b.k==='house' ? 'house' : 'building')});
}

/* ---------- places of worship, from their own OSM areas ---------- */
for(const s of SITE.w2){
  const gr = baseOf(s.p), e = frontEdge(s.p), c = centroid(s.p);
  if(s.k === 'temple'){
    scene.add(buildTemple(s.p, gr, s.a2 > 800));
    BUILDINGS.push({poly:s.p, h:12, y:gr.hi, c:c, open:true,
      name: s.n || 'temple', meta:'Hindu temple'});
    continue;
  }
  // the OSM polygon is the compound, not the building: set a church-sized
  // rectangle inside it, aligned to the compound's long axis
  const grand = s.a2 > 1000;
  const L = grand ? 46 : 21, B = grand ? 15 : 9;
  const rect = [[-1,-1],[1,-1],[1,1],[-1,1]].map(function(q){
    return [c[0] + e.dx*q[0]*L/2 + e.nx*q[1]*B/2,
            c[1] + e.dz*q[0]*L/2 + e.nz*q[1]*B/2];
  });
  scene.add(buildChurch(rect, gr, grand));
  BUILDINGS.push({poly:rect, h:grand?26:12, y:gr.hi, c:c, open:true,
    name: s.n || 'church', meta: grand ? 'Syro-Malabar forane church \u00B7 walk in' : 'chapel'});
}
