/* Stands in for the claude.ai artifact runtime: claude.use('room') returns an
   object with the same shape as the artifact room capability, backed by this
   server's WebSocket. The world code does not know the difference. */
(function () {
  'use strict';
  var ws = null, myId = null, connected = false, voiceOn = false;
  var myPresence = {}, others = new Map();       // id -> {presence, updatedAt}
  var snapshot = Object.freeze([]);
  var peerFns = [], connFns = [], topicFns = {};
  var pendingJoined = [], pendingLeft = [], pendingUpdated = [], scheduled = false;
  var presTimer = null, presDirty = false, retry = 800;

  function peerOf(id, pr, upd) {
    var me = id === myId;
    return Object.freeze({ peer: id, by: null, isMe: me, sameTab: me, kind: 'viewer',
                           presence: Object.freeze(Object.assign({}, pr)), updatedAt: upd });
  }
  function rebuild() {
    var list = [peerOf(myId || 'me', myPresence, Date.now())];
    others.forEach(function (v, id) { list.push(v.peer); });
    snapshot = Object.freeze(list);
  }
  function flush() {
    scheduled = false;
    rebuild();
    var ch = { peers: snapshot, joined: pendingJoined, left: pendingLeft, updated: pendingUpdated };
    pendingJoined = []; pendingLeft = []; pendingUpdated = [];
    peerFns.slice().forEach(function (f) { try { f(ch); } catch (e) { console.error(e); } });
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(flush); } }
  function setOther(id, pr) {
    var had = others.has(id);
    var rec = { presence: pr || {}, updatedAt: Date.now() };
    rec.peer = peerOf(id, rec.presence, rec.updatedAt);
    others.set(id, rec);
    (had ? pendingUpdated : pendingJoined).push(rec.peer);
    schedule();
  }
  function setConn(v) {
    if (v === connected) return;
    connected = v;
    connFns.slice().forEach(function (f) { try { f(v); } catch (e) {} });
  }
  function sendPresenceSoon() {
    presDirty = true;
    if (presTimer) return;
    presTimer = setTimeout(function () {
      presTimer = null;
      if (presDirty && ws && ws.readyState === 1) {
        presDirty = false;
        ws.send(JSON.stringify({ t: 'presence', p: myPresence }));
      }
    }, 66);                                   // ~15 updates a second
  }
  function connect() {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws');
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'welcome') {
        myId = m.id; voiceOn = !!m.voice; retry = 800;
        others.clear();
        m.peers.forEach(function (p) { if (p.id !== myId) setOther(p.id, p.p); });
        setConn(true); schedule();
        if (Object.keys(myPresence).length) sendPresenceSoon();
      } else if (m.t === 'joined' || m.t === 'presence') {
        setOther(m.id, m.p);
      } else if (m.t === 'left') {
        var r = others.get(m.id);
        if (r) { others.delete(m.id); pendingLeft.push(r.peer); schedule(); }
      } else if (m.t === 'emit') {
        var me = m.id === myId;
        var msg = Object.freeze({ peer: m.id, by: null, isMe: me, sameTab: me, kind: 'viewer',
                                  topic: m.topic, data: m.data });
        (topicFns[m.topic] || []).slice().forEach(function (f) { try { f(msg); } catch (e) {} });
      }
    };
    ws.onclose = function () {
      setConn(false);
      others.forEach(function (r) { pendingLeft.push(r.peer); });
      others.clear(); schedule();
      setTimeout(connect, retry); retry = Math.min(retry * 2, 15000);
    };
  }

  var room = Object.freeze({
    presence: function (patch) {
      Object.keys(patch || {}).forEach(function (k) {
        if (patch[k] === null) delete myPresence[k]; else myPresence[k] = patch[k];
      });
      if (JSON.stringify(myPresence).length > 4096) return Promise.reject({ code: 'invalid_argument', message: 'presence over 4 KiB' });
      sendPresenceSoon();
      return Promise.resolve();
    },
    peers: function () { return snapshot; },
    onPeers: function (fn) {
      peerFns.push(fn);
      setTimeout(function () { rebuild(); fn({ peers: snapshot, joined: snapshot, left: [], updated: [] }); }, 0);
      return function () { peerFns = peerFns.filter(function (f) { return f !== fn; }); };
    },
    emit: function (topic, data) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'emit', topic: topic, data: data }));
      return Promise.resolve();
    },
    on: function (topic, fn) {
      (topicFns[topic] = topicFns[topic] || []).push(fn);
      return function () { topicFns[topic] = topicFns[topic].filter(function (f) { return f !== fn; }); };
    },
    connected: function () { return connected; },
    onConnection: function (fn) {
      connFns.push(fn); setTimeout(function () { fn(connected); }, 0);
      return function () { connFns = connFns.filter(function (f) { return f !== fn; }); };
    }
  });

  // for voice.js: who am I, where is everyone
  window.__ROOM__ = {
    id: function () { return myId; },
    voice: function () { return voiceOn; },
    me: function () { return myPresence; },
    others: function () { return others; }
  };
  window.claude = Object.freeze({
    use: function (name) { return Promise.resolve(name === 'room' ? room : null); }
  });
  connect();
})();
