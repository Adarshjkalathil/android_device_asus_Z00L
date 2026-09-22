// procedural wall: cream render, maroon floor band, window openings \u2014 4m x 3.5m tile
function wallTexture(){
  const c = document.createElement('canvas'); c.width=128; c.height=112;
  const x = c.getContext('2d');
  x.fillStyle='#EFE6D4'; x.fillRect(0,0,128,112);
  x.fillStyle='rgba(0,0,0,.045)';
  for(let i=0;i<260;i++) x.fillRect(Math.random()*128|0, Math.random()*112|0, 2, 1); // render grain
  x.fillStyle='#7B3B33'; x.fillRect(0,0,128,9);              // floor band
  x.fillStyle='rgba(0,0,0,.14)'; x.fillRect(0,9,128,2);
  x.fillStyle='#2B3A40'; x.fillRect(24,30,34,52); x.fillRect(70,30,34,52);  // windows
  x.fillStyle='rgba(255,255,255,.16)'; x.fillRect(24,30,34,10); x.fillRect(70,30,34,10);
  x.strokeStyle='#EFE6D4'; x.lineWidth=3;
  x.beginPath(); x.moveTo(41,30); x.lineTo(41,82); x.moveTo(87,30); x.lineTo(87,82); x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1/4, 1/3.5);   // extrude UVs are in world metres
  return t;
}
const WALL_TEX = wallTexture();
// r128's default side-wall UVs collapse on axis-aligned walls; measure along the wall instead
const UVGEN = {
  generateTopUV: function(g,v,a,b,c){
    return [new THREE.Vector2(v[a*3],v[a*3+1]), new THREE.Vector2(v[b*3],v[b*3+1]), new THREE.Vector2(v[c*3],v[c*3+1])];
  },
  generateSideWallUV: function(g,v,ia,ib,ic,id){
    const ax=v[ia*3], ay=v[ia*3+1], az=v[ia*3+2];
    const bx=v[ib*3], by=v[ib*3+1], bz=v[ib*3+2];
    const L = Math.hypot(bx-ax, by-ay);
    return [new THREE.Vector2(0,az), new THREE.Vector2(L,bz),
            new THREE.Vector2(L,v[ic*3+2]), new THREE.Vector2(0,v[id*3+2])];
  }
};
const wallMat = new THREE.MeshLambertMaterial({map:WALL_TEX});
const roofMat = new THREE.MeshLambertMaterial({color:C.roof});
const plainMats = {};
function plainMat(col){ return plainMats[col] || (plainMats[col] = new THREE.MeshLambertMaterial({color:col})); }

