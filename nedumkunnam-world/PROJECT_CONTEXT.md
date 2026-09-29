# Nedumkunnam World — project context

Everything needed to pick this project up on a new machine, or to brief a new
Claude session. Written at the end of the first build session (September 2026).

---

## 1. The goal

A walkable 3D copy of **Nedumkunnam** (Kottayam district, Kerala) — the
owner's school, **St John the Baptist's HSS**, the Forane Church and the
village around them — where school friends can come online with avatars,
walk around together and **talk with proximity voice**. Reference for the
feel: https://kerala.dhilber.com ("Little Kerala").

## 2. Where things are

| What | Where |
|---|---|
| Live artifact (no voice, multiplayer + chat) | https://claude.ai/artifact/9kCwc9zDZoXkZtDMjgKdmQ |
| Older artifact link (early versions) | https://claude.ai/code/artifact/46d17359-f551-4d02-ac8f-0c3ab8948d9f |
| Source code | GitHub `Adarshjkalathil/android_device_asus_Z00L`, branch `claude/3d-school-game-exploration-qdnexj`, folder `nedumkunnam-world/` |
| Render deploy config | `render.yaml` at the repo root |
| Voice server setup guide | `nedumkunnam-world/server/README.md` |

The repo itself is an unrelated Android device tree; the world lives only
on that branch, in its own folder.

## 3. Folder layout

```
nedumkunnam-world/
  README.md            how the world is built, controls, sources, licences
  PROJECT_CONTEXT.md   this file
  build.sh             builds dist/index.html (one self-contained page)
  src/head.html        styles
  src/body.html        HUD, gate (name + avatar maker), chat, buttons
  src/boot.js          gate logic, avatar maker, starts the world
  src/world/00..13-*.js  the world, concatenated IN NUMERIC ORDER
  data/site.json       OSM buildings/roads/water + SRTM terrain (ODbL)
  vendor/three.min.js  three.js r128 (MIT)
  dist/index.html      built page (what is published as the artifact)
  server/              Node server: WebSocket multiplayer + LiveKit voice
    server.js          static page, /ws relay, /token (LiveKit JWT), /health
    public/room-shim.js  same API as the artifact `room` capability
    public/voice.js      LiveKit + Web Audio PannerNode proximity voice
../render.yaml         Render blueprint (rootDir nedumkunnam-world/server)
```

## 4. How to run on your laptop

Needs Node 18+.

```sh
cd nedumkunnam-world
./build.sh                                  # on Windows: use Git Bash or WSL
cd server
npm install
npm start                                   # http://localhost:8080 (voice off)
# with voice:
LIVEKIT_URL=wss://xxx.livekit.cloud LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... npm start
```

Open two browser windows to see multiplayer. Or just open
`dist/index.html` directly for a solo walk.

## 5. Build rules (important if you edit)

- `src/world/*.js` are concatenated in numeric order into the body of
  `window.buildWorld()`. Later parts use `const`/`let` from earlier ones.
  `12-game.js` reads `room` from `11-mp.js` — keep that order.
- Keep code **ASCII-only**; write other characters as `\uXXXX`
  (Malayalam text on boards is stored this way).
- `build.sh` output is byte-identical to the published artifact.
- After changing `src/`, run `./build.sh`, then republish the artifact
  and/or redeploy the server.

## 6. What the world contains

**Data (all real):**
- 123 buildings, 51 roads, 31 streams from **OpenStreetMap** (1.1 km radius
  around 9.5051756 N, 76.6573105 E).
- Terrain: 25×25 **SRTM 30 m** grid over 2.3 km, 47–154 m ASL, campus at
  86 m. Nedumkunnam = "long hill".
- Places of worship with religion tags; the **Forane Church** is a separate
  2,334 m² OSM compound (the 288 m² "chapel" is a different building).

**Facts verified from public sources:**
- Wikidata Q87659173: school founded **1949** (Golden Jubilee board = 1999),
  UDISE 32100500511, Kerala code 32046.
- Wikipedia: village is hills with **rubber, pepper, cassava, plantain; no
  paddy**; Karukachal 3 km west; ~50% Hindu, 45% Christian.
- Kerala Soil Survey: rolling **laterite** terrain, red soil.
- sjbcollege.ac.in: B.Ed college founded 1995, **49,470 sq ft** of building
  → ~1,530 m² footprint (OSM polygon is the compound, not the building).
- corporateschoolschry.org: high school 1949, 774 students, 19 divisions,
  known for basketball and handball, 100% SSLC.
- GCatholic: Syro-Malabar Forane Church, Archeparchy of Changanacherry;
  famous for **Puzhukku Nercha** in November.

**Built from the owner's photos:**
- **Forane Church**: white-and-gold Gothic facade, gold cusped arches,
  "THY KINGDOM COME", two spires, Christ statue, jali windows, pinnacle
  row, side awnings, walk-in interior (orange-capital columns, pews, blue
  carpet), copper kodimaram, **climbable red-and-white stairway** with a
  landing, timber cross and shrine kiosk.
- **SJB HSS**: U-shaped courtyard of three blocks (HS block 3 floors, high
  school 2 floors 90 m long, perpendicular "schol building"), verandah
  corridors, green railings, maroon skirting, blue banner "ST JOHN THE
  BAPTIST'S HIGHER SECONDARY SCHOOL NEDUMKUNNAM", basketball court in the
  courtyard (moved there by the owner's confirmation — OSM puts the
  "hss ground" north of the road, which is wrong), tiered gallery with
  red/white posts.

**Generated from rules (not surveyed):**
- Trees: rubber in rows on slopes, coconut/areca/plantain/jack/mango near
  homesteads, teak on margins.
- Ground colour: laterite near roads and houses, scrub, dark canopy away.
- Street life: 606 electric poles with sagging wires, lamps, bus shelter
  ("NEDUMKUNNAM · നെടുംകുന്നം"), chaya kada, flex boards (Puzhukku Nercha,
  SJB HSS 100% SSLC, Panchayat), milestone "KARUKACHAL 3".
- Kerala temples (Sree Bhadrakaali), parish hall, shop signboards with real
  OSM shop names.

## 7. Features

- Name + avatar maker (shirt, mundu/trousers, skin), saved per device.
- WASD / thumbstick, drag or arrows to look, Space jump, Shift run.
- Walkable surfaces: stairs, landings and floors lift the player.
- Multiplayer avatars with walk animation; emotes 1–4: wave, namaskaram,
  dance, sit.
- Proximity text chat (T), speech bubbles, "N people nearby".
- Weather N: day / monsoon (rain + sound) / night (street lamps).
- 180 collectibles (mango 1, chembarathi 1, chakka 5), respawn 2 min,
  live scores of people present + personal best.
- **Voice (server version only)**: LiveKit, each voice through a
  PannerNode (HRTF, inverse distance, 30 m cutoff). Button or V.

## 8. Why things are the way they are (decisions)

- **Artifact limits**: no external network (CDN blocked on the owner's
  phone → three.js is inlined), no pointer lock (drag-to-look added), no
  audio transport (voice impossible in the artifact → self-hosted server).
- **Artifact `room` capability** connects only same-organization viewers;
  the self-hosted server has no such limit.
- **No `db` leaderboard** in the artifact: it would make the page
  organization-only.
- **No scraping** of Google Maps/Earth, Instagram, Facebook or YouTube
  (platform terms). Public institutional websites, Wikipedia, OSM and the
  owner's own photos were used instead. YouTube videos were found and
  listed but not downloaded.

## 9. Deployment status (as of this file)

Voice server written, tested locally (two browsers see each other, chat,
tokens scoped and refused to non-players). **Not yet deployed.** Real
two-person speech not yet tested.

Steps:
1. **LiveKit** — cloud.livekit.io → project → Settings → Keys → copy URL
   (`wss://…livekit.cloud`), API key, API secret.
2. **Render** — render.com. Either:
   - **Blueprint** (needs GitHub access to the repo), or
   - **New → Web Service → Public Git Repository**:
     - URL: `https://github.com/Adarshjkalathil/android_device_asus_Z00L`
       (the repo link — NOT the branch name)
     - Branch: `claude/3d-school-game-exploration-qdnexj`
     - Root directory: `nedumkunnam-world/server`
     - Build: `npm ci` · Start: `node server.js`
     - Env: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
3. If Render calls the repo invalid, the repo is private — recover the
   Adarshjkalathil GitHub password, get added as collaborator, or push this
   folder to a new repo on your own GitHub and deploy from that.
4. Free Render sleeps after 15 idle minutes (~1 minute to wake).

**Easiest path now that you have the zip**: create a new repo on your own
GitHub, put the contents of this zip in it (keep `render.yaml` at the repo
root and change nothing else, or set Root directory to
`nedumkunnam-world/server`), push, and deploy from that repo.

## 10. Next steps (open list)

1. Deploy voice; test with two phones in one room.
2. Small friend test: performance, finding each other, what looks wrong.
3. Photos wanted: CBSE school (not built — OSM has no footprints), B.Ed
   college front, parish hall, pallimeda, junction shops, a typical house.
4. Ideas: distance culling for cheap phones; add CBSE buildings to OSM;
   persistent leaderboard on the server; autorickshaw; cricket/football on
   the court; Puzhukku Nercha feast day event.

## 11. Known limits

- Tree positions are generated, not surveyed.
- SRTM 30 m can't show terraces or retaining walls.
- Church footprint/proportions are estimated inside the OSM compound; the
  facade direction is set to face the nearest road.
- Malayalam text on boards needs a Malayalam font on the viewer's device.
- Software-rendered tests ran at 3–8 fps; real devices are much faster.

## 12. Credits

© OpenStreetMap contributors (ODbL — `data/site.json` is ODbL too);
SRTM (NASA, public domain) via OpenTopoData; three.js (MIT);
livekit-client / livekit-server-sdk / ws (Apache-2.0 / MIT).
