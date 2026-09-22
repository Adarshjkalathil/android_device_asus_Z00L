
/* ---------- planting for this village.
   Wikipedia and the Kottayam district record describe Nedumkunnam as hill land
   under rubber and pepper, with cassava and plantain as food crops and NO paddy;
   Kerala homesteads carry coconut, areca, jack and teak. Planted to that. */
function insideAny(x,z,pad){
  for(const b of BUILDINGS){
    if(inPoly(x,z,b.poly)) return true;
    if(pad) for(const q of b.poly) if(Math.hypot(q[0]-x,q[1]-z)<pad) return true;
  }
  return false;
}
function solidAt(x,z){
  for(const b of BUILDINGS){ if(b.open) continue; if(inPoly(x,z,b.poly)) return true; }
  return false;
}
function distRoad(x,z){ return nearestRoad(x,z)[2]; }
let seed = 7;
const rnd = ()=> (seed = (seed*16807)%2147483647)/2147483647;

const _v=new THREE.Vector3(), _q=new THREE.Quaternion(), _s=new THREE.Vector3(),
      _m=new THREE.Matrix4(), _Y=new THREE.Vector3(0,1,0);
function instance(geo, mat, list){
  if(!list.length) return;
  const im=new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((t,i)=>{
    _v.set(t[0],t[1],t[2]); _q.setFromAxisAngle(_Y,t[3]); _s.set(t[4],t[5],t[6]);
    _m.compose(_v,_q,_s); im.setMatrixAt(i,_m);
  });
  im.instanceMatrix.needsUpdate=true; scene.add(im);
}
const coco=[],cocoF=[], areca=[],arecaF=[], rub=[],rubC=[],
      ban=[],banL=[], jack=[],jackC=[], teak=[],teakC=[];

function homestead(x,z){ return distRoad(x,z) < 65; }

// rubber \u2014 the district crop, planted in rows on the slopes
for(let patch=0, tries=0; patch<34 && tries<3000; tries++){
  const cx=-HX+rnd()*2*HX, cz=-HZ+rnd()*2*HZ;
  if(distRoad(cx,cz)<40 || slopeAt(cx,cz)<0.015 || insideAny(cx,cz,26)) continue;
  patch++;
  const th=rnd()*3.14, ct=Math.cos(th), st=Math.sin(th);
  for(let a=-5;a<=5;a++) for(let b=-5;b<=5;b++){
    const ox=a*4.6+(rnd()-0.5)*0.6, oz=b*4.6+(rnd()-0.5)*0.6;
    const x=cx+ox*ct-oz*st, z=cz+ox*st+oz*ct;
    if(Math.abs(x)>HX-20||Math.abs(z)>HZ-20||insideAny(x,z,5)||distRoad(x,z)<13) continue;
    const y=groundAt(x,z), h=15+rnd()*5;
    rub.push([x,y,z,0,1,h,1]);
    rubC.push([x,y+h*0.76,z,rnd()*3,1.9,3.2,1.9]);
  }
}
// coconut \u2014 homesteads and roadsides
for(let i=0;i<9000 && coco.length<1100;i++){
  const x=-HX+rnd()*2*HX, z=-HZ+rnd()*2*HZ;
  if(!homestead(x,z) || insideAny(x,z,4)) continue;
  const y=groundAt(x,z), h=10+rnd()*4.5, a=rnd()*6.283;
  coco.push([x,y,z,a,1,h,1]);
  for(let k=0;k<9;k++) cocoF.push([x,y+h,z,a+k*0.698,1,1,1]);
}
// areca (kavungu) \u2014 tight clusters beside the houses
for(let i=0;i<3000 && areca.length<820;i++){
  const cx=-HX+rnd()*2*HX, cz=-HZ+rnd()*2*HZ;
  if(distRoad(cx,cz)>45 || insideAny(cx,cz,6)) continue;
  const n=4+(rnd()*7|0);
  for(let k=0;k<n;k++){
    const x=cx+(rnd()-0.5)*9, z=cz+(rnd()-0.5)*9;
    if(insideAny(x,z,3)) continue;
    const y=groundAt(x,z), h=12+rnd()*4.5, a=rnd()*6.283;
    areca.push([x,y,z,a,1,h,1]);
    for(let f=0;f<6;f++) arecaF.push([x,y+h,z,a+f*1.047,1,1,1]);
  }
}
// plantain \u2014 clumps in the homestead gardens
for(let i=0;i<3000 && ban.length<620;i++){
  const cx=-HX+rnd()*2*HX, cz=-HZ+rnd()*2*HZ;
  if(distRoad(cx,cz)>40 || insideAny(cx,cz,6)) continue;
  const n=3+(rnd()*5|0);
  for(let k=0;k<n;k++){
    const x=cx+(rnd()-0.5)*6, z=cz+(rnd()-0.5)*6;
    if(insideAny(x,z,3)) continue;
    const y=groundAt(x,z), h=2.6+rnd()*1.3, a=rnd()*6.283;
    ban.push([x,y,z,a,1,h,1]);
    for(let f=0;f<6;f++) banL.push([x,y+h,z,a+f*1.047,1,0.85+rnd()*0.4,1]);
  }
}
// jack and mango \u2014 the big homestead shade trees
for(let i=0;i<5000 && jack.length<430;i++){
  const x=-HX+rnd()*2*HX, z=-HZ+rnd()*2*HZ;
  if(!homestead(x,z) || insideAny(x,z,6) || distRoad(x,z)<9) continue;
  const y=groundAt(x,z), h=7+rnd()*3.5;
  jack.push([x,y,z,rnd()*3,1,h,1]);
  jackC.push([x,y+h*0.80,z,rnd()*3,3.2+rnd(),2.6,3.2+rnd()]);
}
// teak / mahogany on the margins
for(let i=0;i<5000 && teak.length<380;i++){
  const x=-HX+rnd()*2*HX, z=-HZ+rnd()*2*HZ;
  if(insideAny(x,z,6) || distRoad(x,z)<25) continue;
  const y=groundAt(x,z), h=12+rnd()*5;
  teak.push([x,y,z,rnd()*3,1,h,1]);
  teakC.push([x,y+h*0.82,z,rnd()*3,2.3,3.0,2.3]);
}

const cyl=(a,b,s)=>new THREE.CylinderGeometry(a,b,1,s).translate(0,0.5,0);
const cap=new THREE.SphereGeometry(1,7,5);

// A palm frond or plantain leaf: a tapered strip that rises, then droops,
// folded slightly along its midrib. Built once, instanced per leaf.
function leafGeo(len, width, rise, droop, segs){
  const pos=[], idx=[];
  for(let i=0;i<=segs;i++){
    const t=i/segs, x=len*t;
    const y = rise*t - droop*t*t*len;
    const w = width*Math.sin(Math.PI*Math.min(t*1.08,1))*(1-0.3*t) + 0.01;
    pos.push(x, y+w*0.22, 0,  x, y-w*0.06, w,  x, y-w*0.06, -w);
  }
  for(let i=0;i<segs;i++){
    const a=i*3, b=a+3;
    idx.push(a,b,a+1, a+1,b,b+1,  a,a+2,b, a+2,b+2,b);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const leafMats={};
function leafMat(col){
  return leafMats[col] || (leafMats[col]=new THREE.MeshLambertMaterial({color:col, side:THREE.DoubleSide}));
}
// jack, mango and teak crowns read as clusters of lobes, not single balls
function lobes(list, spread){
  const out=[];
  for(const t of list){
    out.push(t);
    for(let k=0;k<2;k++){
      const a=rnd()*6.283, r=spread*(0.35+rnd()*0.3);
      out.push([t[0]+Math.cos(a)*r*t[4], t[1]+(rnd()-0.3)*t[5]*0.5, t[2]+Math.sin(a)*r*t[6],
                t[3], t[4]*0.72, t[5]*0.78, t[6]*0.72]);
    }
  }
  return out;
}

instance(cyl(0.15,0.28,6), plainMat(0x8A7355), coco);
instance(leafGeo(4.3, 0.55, 0.9, 0.34, 8), leafMat(0x2F6B3F), cocoF);
instance(cyl(0.07,0.10,5), plainMat(0xA49877), areca);
instance(leafGeo(2.4, 0.30, 0.9, 0.26, 6), leafMat(0x3C7A45), arecaF);
instance(cyl(0.10,0.17,5), plainMat(0x9A8F7E), rub);
instance(cap, plainMat(0x27552E), lobes(rubC, 0.8));
instance(cyl(0.15,0.21,6), plainMat(0x5E7A42), ban);
instance(leafGeo(2.3, 0.42, 1.4, 0.30, 6), leafMat(0x4F8F3C), banL);
instance(cyl(0.22,0.34,6), plainMat(0x6E5C44), jack);
instance(cap, plainMat(0x2F6335), lobes(jackC, 1.0));
instance(cyl(0.16,0.24,6), plainMat(0x7C6A50), teak);
instance(cap, plainMat(0x4A7A3E), lobes(teakC, 0.7));

// kept for the collectibles: where the fruit trees and homesteads are
const FRUIT_TREES = jack.map(function(t){ return [t[0], t[2], t[1]+t[5]]; });
const PLANTAIN    = ban.filter(function(_,i){ return i%4===0; }).map(function(t){ return [t[0], t[2]]; });

/* ---------- spawn: on the road facing the higher secondary block ---------- */
let hsb = BUILDINGS.find(b=>/higher secondary block/i.test(b.name))
       || BUILDINGS.find(b=>/higher secondary/i.test(b.name)) || BUILDINGS[0];
const player = {x:hsb.c[0], z:hsb.c[1], yaw:0, pitch:0, eye:1.68};
let best=null;
for(let a=0;a<32;a++){
  const th=a*Math.PI/16;
  for(const d of [42,50,58,34]){
    const x=hsb.c[0]+Math.sin(th)*d, z=hsb.c[1]+Math.cos(th)*d;
    if(insideAny(x,z,20)) continue;
    if(!best || d<best.d) best={x:x,z:z,d:d,th:th};
  }
}
if(best){ player.x=best.x; player.z=best.z; player.yaw=Math.atan2(hsb.c[0]-best.x, -(hsb.c[1]-best.z)); }
