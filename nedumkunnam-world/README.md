# Nedumkunnam — a walkable village

A browser 3D model of Nedumkunnam, Kottayam district, Kerala: St John the
Baptist's HSS and its court, the Forane Church and its stairway, the B.Ed
college, the temples and the village junction — on real terrain, walkable
with friends.

Live: https://claude.ai/artifact/9kCwc9zDZoXkZtDMjgKdmQ

## Build

```sh
./build.sh          # writes dist/index.html
```

`dist/index.html` is one self-contained page (three.js, data and code all
inline) that needs no network at runtime. Open it in a browser to walk the
world solo; multiplayer and chat light up only inside the claude.ai
artifact viewer (see below).

The world is `src/world/*.js`, concatenated **in numeric order** into the
body of `window.buildWorld()`. Order matters: later parts use `const`/`let`
bindings from earlier ones — `12-game.js` reads `room` from `11-mp.js`,
and touching a `let` before its declaration throws even under `typeof`.
Keep new code ASCII-only; write any other character as a `\uXXXX` escape.

| Part | What it builds |
|---|---|
| `00-head` | terrain sampler, walkable-surface layer (stairs, decks), renderer, lights |
| `01-mats` | wall textures and UV mapping |
| `02-school` | school blocks: verandahs, railings, stair towers, banners |
| `03-world_a` | ground cover, roads, streams, Mangalore-tile roofs |
| `04-church` | the Forane Church, inside and out, and its stairway |
| `05-temple` | Kerala temple: prakaram, srikovil, dwajasthambam |
| `06-civic` | parish hall, shop signboards |
| `07-world_b` | every building, placed from OpenStreetMap |
| `08-ground` | the SJB HSS court and gallery |
| `09-veg` | rubber, coconut, areca, plantain, jack, teak |
| `10-kerala` | poles and lines, lamps, bus shelter, chaya kada, flex boards, milestone |
| `11-mp` | avatars, presence, proximity chat |
| `12-game` | jump, emotes, weather, collectibles, scores |
| `13-tail` | controls, HUD, frame loop |

## Controls

WASD walk · Shift run · drag or ←/→ look · Space jump · 1–4 wave,
namaskaram, dance, sit · N day / monsoon / night · T chat.
On a phone: thumbstick to walk, drag anywhere to look, buttons for the rest.

## Multiplayer

Uses the artifact `room` capability, declared as
`{room: {topics: {chat: "interact"}}}`. Presence carries each player's
position, facing, colours, jump, emote and score; chat is delivered only
to players within about 30 m. The room connects signed-in viewers of the
same organization, so check with two tabs before inviting friends.

A persistent leaderboard would need the `db` capability, which makes an
artifact organization-internal — so scores are shown live among whoever
is present, and each player's best is kept on their own device.

## Voice

Not possible inside an artifact: it has no audio transport, and its
content policy blocks connections to outside servers. `server/` runs the
same world on your own host with proximity voice over LiveKit — see
[server/README.md](server/README.md) for the 15-minute setup.

## Sources and licences

- **Buildings, roads, water, places of worship:** © OpenStreetMap
  contributors, under the Open Database Licence (ODbL). `data/site.json`
  is derived from OpenStreetMap and is itself ODbL: keep the attribution,
  and share any modified version of that data under the same licence.
- **Terrain:** SRTM 30 m elevation (NASA, public domain), sampled through
  OpenTopoData.
- **Facts used in the model:** Wikipedia (Nedumkunnam); Kottayam district
  administration; Kerala Soil Survey; sjbcollege.ac.in (49,470 sq ft of
  building); corporateschoolschry.org (school founded 1949); GCatholic
  (the Syro-Malabar Forane Church).
- **Architecture:** modelled by hand from photographs supplied by the
  project's owner. No photographs are included in this repository.
- **three.js r128** (MIT), in `vendor/`.
