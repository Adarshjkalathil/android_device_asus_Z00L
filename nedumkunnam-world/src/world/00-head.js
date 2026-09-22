window.buildWorld = function(){
const SITE = window.__SITE__;
const C = { laterite:0xA0512F, wall:0xF0E7D6, trim:0x7B3B33, palm:0x2F6B42,
            road:0x4A4441, roof:0xBFB5A0, tile:0xA34A2C };
const FLOOR = 3.5;

const DEM = SITE.dem, DN = DEM.n, HX = DEM.hx, HZ = DEM.hz, DG = DEM.g;
function groundAt(x,z){
  let u=(x+HX)/(2*HX)*(DN-1), v=(-z+HZ)/(2*HZ)*(DN-1);
  u=Math.min(Math.max(u,0),DN-1.001); v=Math.min(Math.max(v,0),DN-1.001);
  const i=Math.floor(u), j=Math.floor(v), fu=u-i, fv=v-j;
  return DG[j][i]*(1-fu)*(1-fv) + DG[j][i+1]*fu*(1-fv)
       + DG[j+1][i]*(1-fu)*fv   + DG[j+1][i+1]*fu*fv;
}
function slopeAt(x,z){
  const d=12;
  return Math.hypot((groundAt(x+d,z)-groundAt(x-d,z))/(2*d),
                    (groundAt(x,z+d)-groundAt(x,z-d))/(2*d));
}
function inPoly(x,z,p){
  let hit=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++)
    if((p[i][1]>z)!=(p[j][1]>z) &&
       x < (p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0]) hit=!hit;
  return hit;
}
function bbox(p){
  let a=1e9,b=1e9,c=-1e9,d=-1e9;
  for(const q of p){ a=Math.min(a,q[0]); b=Math.min(b,q[1]); c=Math.max(c,q[0]); d=Math.max(d,q[1]); }
  return [a,b,c,d];
}
function baseOf(poly){
  let lo=1e9, hi=-1e9;
  for(const q of poly){ const y=groundAt(q[0],q[1]); lo=Math.min(lo,y); hi=Math.max(hi,y); }
  return {lo:lo, hi:hi};
}
function centroid(p){ let x=0,z=0; for(const q of p){x+=q[0];z+=q[1];} return [x/p.length, z/p.length]; }

/* Walkable surfaces above the terrain - stair flights, landings, floors. The
   player's feet take the highest of these, so steps can actually be climbed. */
const PLATFORMS = [];
function addStair(o, dir, side, n, tread, rise, halfW, yTop){
  PLATFORMS.push({t:'s', ox:o[0], oz:o[1], dx:dir[0], dz:dir[1],
                  sx:side[0], sz:side[1], n:n, tread:tread, rise:rise, hw:halfW, y:yTop});
}
function addDeck(poly, y){ PLATFORMS.push({t:'f', p:poly, bb:bbox(poly), y:y}); }
function surfaceHeight(x,z){
  let h = groundAt(x,z);
  for(let k=0;k<PLATFORMS.length;k++){
    const p = PLATFORMS[k];
    if(p.t === 's'){
      const rx=x-p.ox, rz=z-p.oz;
      const t = rx*p.dx + rz*p.dz;
      if(t < -0.5 || t > p.n*p.tread) continue;
      if(Math.abs(rx*p.sx + rz*p.sz) > p.hw) continue;
      const i = Math.max(0, Math.min(p.n-1, Math.floor(t/p.tread)));
      const y = p.y - i*p.rise;
      if(y > h) h = y;
    } else {
      const b=p.bb;
      if(x<b[0]||x>b[2]||z<b[1]||z>b[3]) continue;
      if(inPoly(x,z,p.p) && p.y > h) h = p.y;
    }
  }
  return h;
}
function shapeOf(poly){
  const s = new THREE.Shape();
  s.moveTo(poly[0][0], -poly[0][1]);
  for(let i=1;i<poly.length;i++) s.lineTo(poly[i][0], -poly[i][1]);
  s.closePath(); return s;
}

/* ---------- scene ---------- */
const cv = document.getElementById('gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true}); }
catch(e){ throw new Error("This browser can't open a 3D canvas (WebGL is off or unavailable)."); }
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xA9C6D2);
scene.fog = new THREE.Fog(0xA9C6D2, 220, 1500);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4000);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
scene.add(new THREE.HemisphereLight(0xDCEBF2, 0x9C7E5C, 1.05));
const sun = new THREE.DirectionalLight(0xFFF6E6, 1.0);
sun.position.set(-90, 130, 60); scene.add(sun);
