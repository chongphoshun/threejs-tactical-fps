# threejs-tactical-fps

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/chongphoshun/threejs-tactical-fps/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/chongphoshun/threejs-tactical-fps/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

**Nightveil Breach** is a 5v5 plant/defuse tactical first-person shooter on three.js 0.187.0, single-player against nine bots, MR12 (sides swap after round 12, first to 13). Attackers carry the Pulse Core through an original moonlit freight yard (North Catwalk, Mid Alley, South Vault) and arm it at site A or B; defenders hold angles, react to gunfire they hear and defuse it.

- Gunplay: hitscan against head / body / leg boxes with per-weapon headshot multipliers, helm, pellets and range falloff; recoil kicks the view; spread grows when moving, airborne or holding the trigger and tightens when crouched.
- Movement: acceleration and friction, crouch, walk, jump, axis-separated collision with the map.
- Tactics: per-round economy (win, loss streak, kill, plant and defuse rewards) and a buy menu of 6 guns, vest, helm, frag, fog smoke (blocks bot sight), glare flash (blinds) and a defuse kit; bots follow waypoint routes, hold positions, use a view cone and hearing, and call contacts on the radio.
- Readouts: HUD with health, armour, ammo, round timer, score, money, killfeed, radio, minimap and a rendered after-action report (Tab) drawing every bot's route, held spots, hit sightlines, a shot log and per-round economy.
- Code: one module per job under `game/src/` (21 modules), a 60 Hz fixed-step simulation apart from rendering, pooled tracers and grenades, preallocated stats buffers. Sounds are synthesised with WebAudio; art is procedural geometry and canvas textures; no network requests.

## Run it

```sh
node serve.ts   # then open http://localhost:8080 in desktop Chrome
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # hand-in output
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=6a0zrzzd&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
