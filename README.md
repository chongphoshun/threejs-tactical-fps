# threejs-tactical-fps

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/chongphoshun/threejs-tactical-fps/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/chongphoshun/threejs-tactical-fps/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

**Nightveil Breach** is a round-based tactical first-person shooter on three.js 0.187.0: you and four attacker bots carry the Pulse Core across a moonlit freight yard and arm it at site A or B, while five defender bots follow waypoint routes, hold angles, react to gunfire they hear and rush to defuse. Between rounds you earn cash (win/loss/kill/plant rewards with a loss streak bonus) and spend it in a buy menu on the Hornet SMG, Pulse Rifle, Longwatch DMR, Kevlite vest and Frag Charges. First to 7 rounds wins.

- Gunplay: hitscan against head / body / leg boxes (headshots multiply damage), recoil that kicks the view, spread that grows when moving, jumping or holding the trigger and tightens when crouched.
- Movement: acceleration and friction, crouch, walk (Shift), jump, axis-separated collision with the map.
- Code: `game/src/` holds one module per job (world, player, weapons, bots, grenades, rounds, hud, input, audio) and `main.js` runs a fixed 60 Hz simulation apart from rendering.
- Sounds are synthesised in WebAudio; all art is procedural geometry and canvas textures. No network requests.

## Run it

```sh
node serve.ts   # then open http://localhost:8080 in desktop Chrome
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # hand-in output
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=6a0zrzzd&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
