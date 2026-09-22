/* The world is built on click, so a CDN or WebGL failure shows up on the gate
   instead of silently leaving the button dead. */
(function(){
  var gate = document.getElementById('gate'),
      go   = document.getElementById('go'),
      msg  = document.getElementById('err'),
      who  = document.getElementById('who'),
      prev = document.getElementById('avprev'),
      label = go.textContent, start = null;

  var SHIRT = [0x2E5B9E,0xB3372B,0x2F7A4A,0xE0A13C,0x6B4E9B,0xF4F0E6,0x2B3138,0xD2743A];
  var TROU  = [0x33383E,0xF4F0E6,0x4A3A2A,0x24415E,0x6E6A62,0x7A3428];
  var SKIN  = [0xF0C9A8,0xD9A883,0xC9A184,0xA9744F,0x8A5A37,0x5E3A22];
  var me = {n:'', s:SHIRT[0], t:TROU[0], k:SKIN[2]};
  try {
    var saved = JSON.parse(localStorage.getItem('ndk.me') || 'null');
    if(saved && typeof saved === 'object'){
      if(typeof saved.n === 'string') me.n = saved.n.slice(0,22);
      ['s','t','k'].forEach(function(f){ if(typeof saved[f] === 'number') me[f] = saved[f]; });
    }
  } catch(e){}
  if(who) who.value = me.n;

  function hex(n){ return '#' + ('000000' + n.toString(16)).slice(-6); }
  function swatches(id, list, field){
    var host = document.getElementById(id);
    if(!host) return;
    list.forEach(function(col){
      var b = document.createElement('button');
      b.type='button'; b.className='sw'; b.style.background = hex(col);
      b.setAttribute('aria-label', field + ' ' + hex(col));
      b.setAttribute('aria-pressed', me[field] === col ? 'true' : 'false');
      b.addEventListener('click', function(){
        me[field] = col;
        Array.prototype.forEach.call(host.children, function(c){
          c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
        draw();
      });
      host.appendChild(b);
    });
  }
  function draw(){
    if(!prev) return;
    var x = prev.getContext('2d'), W = prev.width, H = prev.height;
    x.clearRect(0,0,W,H);
    var cx = W/2, sc = H/300;
    function box(w,h,cy,col){ x.fillStyle=hex(col); x.fillRect(cx-w*sc/2, H-(cy+h)*sc, w*sc, h*sc); }
    box(26,14,26,0x241C16);                 // feet
    box(34,96,30,me.t);                     // legs
    box(74,86,124,me.s);                    // torso
    box(20,74,128,me.s);                    // arms
    x.fillStyle = hex(me.s);
    x.fillRect(cx-70*sc/2-20*sc, H-(202)*sc, 20*sc, 74*sc);
    x.fillRect(cx+70*sc/2,        H-(202)*sc, 20*sc, 74*sc);
    x.fillStyle = hex(me.k);
    x.beginPath(); x.arc(cx, H-226*sc, 27*sc, 0, 6.283); x.fill();   // head
    x.fillStyle = '#2A2119';
    x.beginPath(); x.arc(cx, H-232*sc, 28*sc, Math.PI, 0); x.fill(); // hair
    x.fillStyle = hex(me.k);
    x.beginPath(); x.arc(cx-70*sc/2-10*sc, H-128*sc, 10*sc, 0, 6.283); x.fill();
    x.beginPath(); x.arc(cx+70*sc/2+10*sc, H-128*sc, 10*sc, 0, 6.283); x.fill();
  }
  swatches('sw-s', SHIRT, 's');
  swatches('sw-t', TROU,  't');
  swatches('sw-k', SKIN,  'k');
  draw();
  if(who) who.addEventListener('keydown', function(e){
    e.stopPropagation();
    if(e.key === 'Enter'){ e.preventDefault(); go.click(); }
  });

  function loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = src;
      s.onload  = function(){ res(); };
      s.onerror = function(){
        var host = src.indexOf('//') > -1 ? src.split('/')[2] : src;
        rej(new Error('Could not reach ' + host + ' \u2014 a network block or extension may be stopping it.'));
      };
      document.head.appendChild(s);
    });
  }
  // three.js is inlined in this page, so no network fetch is needed. The CDN
  // path stays only as a safety net if the inline copy somehow didn't parse.
  function ensureThree(){
    if (window.THREE) return Promise.resolve();
    return loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
      .catch(function(){ return loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'); })
      .then(function(){
        if (!window.THREE) throw new Error('three.js did not initialise');
      });
  }

  go.addEventListener('click', function(){
    me.n = ((who && who.value) || '').trim().slice(0,22) || 'Guest';
    window.__ME__ = me;
    try { localStorage.setItem('ndk.me', JSON.stringify(me)); } catch(e){}
    go.disabled = true; go.textContent = 'Loading\u2026'; msg.textContent = '';
    ensureThree()
      .then(function(){ if (!start) start = window.buildWorld(); })
      .then(function(){
        gate.classList.add('off');
        go.disabled = false; go.textContent = label;
        start();
      })
      .catch(function(e){
        go.disabled = false; go.textContent = 'Try again';
        msg.textContent = (e && e.message) ? e.message : String(e);
      });
  });
})();
