// Nedumkunnam world server: serves the page, relays presence and chat over
// WebSocket, and mints LiveKit tokens for proximity voice.
//
//   PORT                 port to listen on (default 8080)
//   LIVEKIT_URL          wss://<project>.livekit.cloud   } all three enable voice;
//   LIVEKIT_API_KEY      from the LiveKit project        } without them the world
//   LIVEKIT_API_SECRET   from the LiveKit project        } still runs, voice off
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = +process.env.PORT || 8080;
const LK = { url: process.env.LIVEKIT_URL, key: process.env.LIVEKIT_API_KEY,
             secret: process.env.LIVEKIT_API_SECRET };
const VOICE_ON = !!(LK.url && LK.key && LK.secret);
const MAX_MSG = 4096;            // bytes, same budget as the artifact room
const MAX_PEERS = 64;

// ---- the page: the built world, with the room stand-in first and voice last
function buildPage() {
  const world = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<script src="/room-shim.js"></script></head><body>' + world +
    '<script src="/livekit-client.js"></script><script src="/voice.js"></script>' +
    '</body></html>';
}
let PAGE = buildPage();
const FILES = {
  '/room-shim.js':      [path.join(__dirname, 'public', 'room-shim.js'), 'text/javascript'],
  '/voice.js':          [path.join(__dirname, 'public', 'voice.js'), 'text/javascript'],
  '/livekit-client.js': [path.join(path.dirname(require.resolve('livekit-client')).replace(/dist.*$/, ''), 'dist', 'livekit-client.umd.js'), 'text/javascript'],
};

async function token(identity, name) {
  const { AccessToken } = await import('livekit-server-sdk');
  const at = new AccessToken(LK.key, LK.secret, { identity, name, ttl: '6h' });
  at.addGrant({ room: 'nedumkunnam', roomJoin: true, canPublish: true, canSubscribe: true });
  return at.toJwt();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    if (process.env.NODE_ENV !== 'production') PAGE = buildPage();
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(PAGE);
  }
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  if (url.pathname === '/token') {
    const id = String(url.searchParams.get('id') || '');
    const name = String(url.searchParams.get('name') || 'Guest').slice(0, 22);
    // only peers connected to this server may get a voice token
    if (!VOICE_ON) { res.writeHead(503, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'voice_not_configured' })); }
    if (!peers.has(id)) { res.writeHead(403, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'not_connected' })); }
    try {
      const jwt = await token(id, name);
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ url: LK.url, token: jwt }));
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'token_failed' }));
    }
  }
  const f = FILES[url.pathname];
  if (f) {
    res.writeHead(200, { 'content-type': f[1] + '; charset=utf-8', 'cache-control': 'public, max-age=300' });
    return fs.createReadStream(f[0]).pipe(res);
  }
  res.writeHead(404); res.end('not found');
});

// ---- presence and moments
const peers = new Map();   // id -> { ws, presence }
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MSG * 2 });

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(msg, exceptId) {
  const s = JSON.stringify(msg);
  for (const [id, p] of peers) if (id !== exceptId && p.ws.readyState === 1) p.ws.send(s);
}

wss.on('connection', (ws) => {
  if (peers.size >= MAX_PEERS) { ws.close(4001, 'full'); return; }
  const id = crypto.randomBytes(8).toString('hex');
  peers.set(id, { ws, presence: {} });
  send(ws, { t: 'welcome', id, voice: VOICE_ON,
             peers: [...peers].map(([pid, p]) => ({ id: pid, p: p.presence })) });
  broadcast({ t: 'joined', id, p: {} }, id);

  let bucket = 60, last = Date.now();       // ~40 msg/s sustained, bursts of 60
  ws.on('message', (raw) => {
    const now = Date.now();
    bucket = Math.min(60, bucket + (now - last) * 0.04); last = now;
    if (bucket < 1 || raw.length > MAX_MSG) return;
    bucket -= 1;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'presence' && m.p && typeof m.p === 'object' && !Array.isArray(m.p)) {
      peers.get(id).presence = m.p;
      broadcast({ t: 'presence', id, p: m.p }, id);
    } else if (m.t === 'emit' && typeof m.topic === 'string' && /^[a-z][a-z0-9_.-]{0,47}$/.test(m.topic)) {
      broadcast({ t: 'emit', id, topic: m.topic, data: m.data });
    }
  });
  const alive = setInterval(() => { if (ws.readyState === 1) ws.ping(); }, 25000);
  ws.on('close', () => { clearInterval(alive); peers.delete(id); broadcast({ t: 'left', id }); });
});

server.listen(PORT, () =>
  console.log(`Nedumkunnam world on http://localhost:${PORT}  (voice ${VOICE_ON ? 'on' : 'off: set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET'})`));
