/* Proximity voice. LiveKit carries the audio; Web Audio places it: each
   friend's voice goes through a PannerNode at their avatar's position, so it
   pans as you turn and fades out as you walk apart. */
(function () {
  'use strict';
  var RANGE = 30;                       // metres: beyond this you cannot hear them
  var LK = window.LivekitClient;
  var R = window.__ROOM__;
  if (!LK || !R) return;

  var ctx = null, lkRoom = null, state = 'off', voices = new Map();   // id -> {panner, gain, el}

  // ---- controls, added beside the world's own HUD buttons
  var btn = document.createElement('button');
  btn.className = 'hb'; btn.id = 'voicebtn'; btn.type = 'button';
  btn.textContent = 'Voice'; btn.title = 'Proximity voice (V)';
  var talk = document.createElement('div');
  talk.id = 'speaking';
  talk.style.cssText = 'position:fixed;top:48px;left:50%;transform:translateX(-50%);display:none;' +
    'font:500 11px/1.4 "IBM Plex Sans",sans-serif;color:#F0E7D6;background:rgba(22,30,34,.82);' +
    'border:1px solid rgba(240,231,214,.22);border-radius:999px;padding:4px 12px;pointer-events:none';
  document.body.appendChild(talk);
  function mount() {
    var row = document.querySelector('#hud .row');
    if (row && !btn.parentNode) row.insertBefore(btn, row.firstChild);
  }
  mount(); setTimeout(mount, 1000);

  function label(s) {
    state = s;
    btn.textContent = { off: 'Voice', connecting: 'Joining…', live: 'Mic on', muted: 'Mic off' }[s] || 'Voice';
    btn.style.borderColor = s === 'live' ? '#9FD0A8' : '';
  }
  function say(t) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = t; el.classList.add('on');
    clearTimeout(say.t); say.t = setTimeout(function () { el.classList.remove('on'); }, 2600);
  }

  // ---- one spatial chain per remote voice
  function addVoice(id, track) {
    removeVoice(id);
    var stream = new MediaStream([track.mediaStreamTrack]);
    // Chrome only flows remote WebRTC audio into Web Audio if an element holds the stream
    var el = new Audio(); el.muted = true; el.srcObject = stream; el.play().catch(function () {});
    var src = ctx.createMediaStreamSource(stream);
    var panner = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse',
      refDistance: 2, maxDistance: RANGE, rolloffFactor: 1.6 });
    var gain = ctx.createGain();
    src.connect(panner); panner.connect(gain); gain.connect(ctx.destination);
    voices.set(id, { panner: panner, gain: gain, el: el, src: src });
  }
  function removeVoice(id) {
    var v = voices.get(id);
    if (!v) return;
    try { v.src.disconnect(); v.panner.disconnect(); v.gain.disconnect(); } catch (e) {}
    v.el.srcObject = null; voices.delete(id);
  }

  // ---- keep the ears and the voices where the people are
  function place(node, x, y, z, t) {
    if (node.positionX) {
      node.positionX.setTargetAtTime(x, t, 0.05);
      node.positionY.setTargetAtTime(y, t, 0.05);
      node.positionZ.setTargetAtTime(z, t, 0.05);
    } else node.setPosition(x, y, z);
  }
  function tick() {
    if (ctx && lkRoom) {
      var me = R.me(), t = ctx.currentTime, L = ctx.listener;
      if (typeof me.x === 'number') {
        var y = (me.y || 0) + 1.6, a = me.a || 0;
        place(L, me.x, y, me.z, t);
        var fx = -Math.sin(a), fz = -Math.cos(a);
        if (L.forwardX) {
          L.forwardX.setTargetAtTime(fx, t, 0.05); L.forwardY.setTargetAtTime(0, t, 0.05);
          L.forwardZ.setTargetAtTime(fz, t, 0.05); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
        } else L.setOrientation(fx, 0, fz, 0, 1, 0);
        var others = R.others();
        voices.forEach(function (v, id) {
          var o = others.get(id), p = o && o.presence;
          if (!p || typeof p.x !== 'number') { v.gain.gain.setTargetAtTime(0, t, 0.1); return; }
          place(v.panner, p.x, (p.y || 0) + 1.6 + (p.j || 0), p.z, t);
          var d = Math.hypot(p.x - me.x, p.z - me.z);
          v.gain.gain.setTargetAtTime(d > RANGE ? 0 : 1, t, 0.15);
        });
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function showSpeakers(list) {
    var others = R.others(), names = [];
    list.forEach(function (p) {
      if (p.identity === R.id()) return;
      var o = others.get(p.identity), n = o && o.presence && o.presence.n;
      if (n) names.push(String(n).slice(0, 18));
    });
    talk.textContent = names.length ? 'Speaking: ' + names.join(', ') : '';
    talk.style.display = names.length ? 'block' : 'none';
  }

  // ---- join, mute, unmute
  async function start() {
    if (!R.id()) { say('Still connecting to the village — try again in a moment.'); return; }
    if (!R.voice()) { say('Voice is not set up on this server yet.'); return; }
    label('connecting');
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume();
      var me = R.me();
      var res = await fetch('/token?id=' + encodeURIComponent(R.id()) +
                            '&name=' + encodeURIComponent(me.n || 'Guest'));
      if (!res.ok) throw new Error('token ' + res.status);
      var tk = await res.json();
      lkRoom = new LK.Room({ adaptiveStream: false, dynacast: false });
      lkRoom.on(LK.RoomEvent.TrackSubscribed, function (track, pub, participant) {
        if (track.kind === 'audio') addVoice(participant.identity, track);
      });
      lkRoom.on(LK.RoomEvent.TrackUnsubscribed, function (track, pub, participant) {
        if (track.kind === 'audio') removeVoice(participant.identity);
      });
      lkRoom.on(LK.RoomEvent.ParticipantDisconnected, function (p) { removeVoice(p.identity); });
      lkRoom.on(LK.RoomEvent.ActiveSpeakersChanged, showSpeakers);
      lkRoom.on(LK.RoomEvent.Disconnected, function () {
        voices.forEach(function (_, id) { removeVoice(id); });
        lkRoom = null; label('off'); showSpeakers([]);
      });
      await lkRoom.connect(tk.url, tk.token);
      await lkRoom.localParticipant.setMicrophoneEnabled(true);
      label('live'); say('Voice on — people within ' + RANGE + ' m can hear you');
    } catch (e) {
      console.warn('voice', e);
      if (lkRoom) { try { lkRoom.disconnect(); } catch (x) {} lkRoom = null; }
      label('off');
      say(e && e.name === 'NotAllowedError'
          ? 'Microphone blocked — allow it in your browser to use voice.'
          : 'Could not start voice. Check your connection and try again.');
    }
  }
  async function toggle() {
    if (state === 'off') return start();
    if (state === 'connecting' || !lkRoom) return;
    var on = state !== 'live';
    await lkRoom.localParticipant.setMicrophoneEnabled(on);
    label(on ? 'live' : 'muted');
  }
  btn.addEventListener('click', function (e) { e.preventDefault(); btn.blur(); toggle(); });
  addEventListener('keydown', function (e) {
    if (e.code !== 'KeyV') return;
    var a = document.activeElement;
    if (a && /INPUT|TEXTAREA/.test(a.tagName)) return;
    var gate = document.getElementById('gate');
    if (gate && !gate.classList.contains('off')) return;
    toggle();
  });
})();
