# Your own Nedumkunnam server — with voice

The same world as the artifact, hosted by you, with **proximity voice**:
friends hear each other only when their avatars are close, and voices
pan left and right and fade as people walk apart.

Anyone with the link can join. No claude.ai account needed.

## Set it up (about 15 minutes, free)

### 1. Make a LiveKit project (carries the voice)

1. Sign up at **https://cloud.livekit.io** (free tier).
2. Create a project.
3. Open **Settings → Keys**, create a key, and copy three things:
   - the **URL**, starting `wss://` and ending `.livekit.cloud`
   - the **API key**
   - the **API secret**, shown only once, so copy it now

### 2. Put the server on Render (hosts the world)

1. Sign up at **https://render.com** with your GitHub account.
2. **New → Blueprint**, pick the repository `android_device_asus_Z00L`
   and the branch `claude/3d-school-game-exploration-qdnexj`.
   Render finds `render.yaml` and sets everything up.
3. It asks for the three values from step 1:
   `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Paste them in.
4. **Apply**. After a few minutes you get a link like
   `https://nedumkunnam-world.onrender.com`.

### 3. Play

Send your friends the link. Everyone enters their name, picks colours,
and walks in. Press **Voice** (or **V**), allow the microphone, and talk.
Press it again to mute.

## Worth knowing

- **The free Render plan sleeps** after 15 minutes with nobody on it. The
  first person to open the link waits about a minute while it wakes.
- **Microphones need `https`**, which Render provides. On your own
  computer, `http://localhost` also works.
- **Voice range is 30 m.** Change `RANGE` in `public/voice.js`.
- Without the three LiveKit values the world still runs: walking, chat,
  emotes and scores work; the Voice button explains that voice isn't set up.
- Up to 64 players at once (`MAX_PEERS` in `server.js`).

## Run it on your own computer

```sh
cd nedumkunnam-world && ./build.sh        # build the world page
cd server && npm install
LIVEKIT_URL=wss://... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... npm start
# open http://localhost:8080 in two browser windows
```

## How it fits together

- `server.js` serves the page, relays positions, emotes and chat over one
  WebSocket, and hands a LiveKit voice token only to players who are
  connected to it.
- `public/room-shim.js` gives the world the same `room` API the claude.ai
  artifact has, so the world code in `../src` is unchanged and still
  publishes as an artifact.
- `public/voice.js` sends your microphone through LiveKit, and plays each
  friend through a Web Audio `PannerNode` placed at their avatar.
