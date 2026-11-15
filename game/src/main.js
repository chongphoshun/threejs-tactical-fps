// Nightveil Breach: boot, match flow and the one loop. A fixed 60 Hz simulation (step) runs apart from
// rendering (frame). ?shot=fight|buy|plant|report&seed=N hands control to shots.js for a screenshot.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createArsenal, WEAPONS, EQUIPMENT, THROWABLES } from './weapons.js';
import { createBots } from './bots.js';
import { createGrenades } from './grenades.js';
import { createRounds, ROUND } from './rounds.js';
import { createHud } from './hud.js';
import { createSfx } from './audio.js';
import { createTracers } from './tracers.js';
import { createStats } from './stats.js';
import { createRadio } from './radio.js';
import { createMinimap } from './minimap.js';
import { createReport } from './report.js';
import { createObjective } from './objective.js';
import { createCombat } from './combat.js';
import { runShot } from './shots.js';

const FIXED = 1 / 60;
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const random = mulberry32(seed);
const sfx = createSfx(!!shot);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!shot });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 22, 70);
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 160);
scene.add(camera);

const world = createWorld(scene);
const player = createPlayer(world.colliders);
const body = player.state;
const arsenal = createArsenal(camera);
const grenades = createGrenades(scene);
const botsys = createBots(scene, world, random, grenades.smokes);
const rounds = createRounds();
const R = rounds.state;
const hud = createHud();
const tracers = createTracers(scene);
const stats = createStats(botsys.bots.length);
const radio = createRadio(hud);
const minimap = createMinimap(world);
const report = createReport(world);
const objective = createObjective(scene, world, rounds, hud, radio, sfx);
const bomb = objective.bomb;
const combat = createCombat({ scene, camera, world, botsys, player, arsenal, rounds, hud, tracers, stats, radio, sfx, random, shot });
const input = createInput(renderer.domElement, onLockChange);

const playerActor = { isPlayer: true, name: 'You', position: body.position, get team() { return R.playerTeam; }, get alive() { return body.alive; }, get eyeY() { return body.position.y + body.eye; } };
const actors = [playerActor, ...botsys.bots];
const owned = new Set();
const view = new THREE.Vector3();
const toFlash = new THREE.Vector3();
let started = false, frozen = false, time = 0, acc = 0, last = performance.now(), kills = 0;

const ctx = {
  actors, time: 0, bomb, atSite: objective.atSite, radio, stats,
  onBotShot: combat.botShot,
  onBotPlant: objective.botPlant,
  onBotDefuse(bot, dt) {
    radio.defusing(bot);
    if (objective.tryDefuse(dt, bot.name, bot.position, true, false) === 'done') endRound('def', `${bot.name} defused the Pulse Core`);
  },
};
const blasts = {
  frag: (pos, radius, dmg, owner) => combat.fragBlast(pos, radius, dmg, owner, actors),
  smoke: () => sfx('reload'),
  flash: (pos) => { botsys.flashed(pos); flashPlayer(pos); sfx('hit'); },
};
combat.bind(ctx, () => { if (bomb.carrier === 'player') objective.handToBot(botsys.bots); });

// flashPlayer: whiteout for the player when the flash is in front of the view and in sight.
function flashPlayer(pos) {
  camera.getWorldDirection(view);
  toFlash.subVectors(pos, camera.position);
  const d = toFlash.length();
  if (d > 18 || view.dot(toFlash.normalize()) < 0.2 || !botsys.canSee(camera.position, pos)) return;
  body.blind = Math.max(body.blind, 3 - d * 0.12);
}

function spawnZoneLimit() { if (R.playerTeam === 'atk') body.position.x = Math.min(body.position.x, -21.5); else body.position.x = Math.max(body.position.x, 22.5); }

function startRound() {
  const survived = body.alive && R.number > 1 && R.number !== ROUND.HALF + 1;
  player.spawn(world.spawns[R.playerTeam][0], R.playerTeam === 'atk' ? -Math.PI / 2 : Math.PI / 2);
  if (!survived) { arsenal.resetLoadout(); body.armor = 0; body.helmet = false; owned.clear(); }
  body.blind = 0;
  botsys.assignTeams(R.playerTeam, world.spawns);
  botsys.planRoutes(Math.floor(random() * 2));
  grenades.clear(); tracers.clear(); stats.resetRound(); radio.reset();
  objective.reset(botsys.bots);
  arsenal.refillAll();
  hud.clearFeed();
  hud.setProgress(0);
  hud.setObjective(`Buy phase — press B · you ${R.playerTeam === 'atk' ? 'attack' : 'defend'}`);
  syncHud();
}

// buy: spends cash on a weapon, armour, a throwable or a kit.
function buy(id) {
  const item = WEAPONS[id] ?? EQUIPMENT[id];
  if (!item) return;
  if (THROWABLES.includes(id) && arsenal.state.throwables[id] >= (id === 'flash' ? 2 : 1)) return;
  if ((id === 'helmet' && body.helmet) || (id === 'kit' && arsenal.state.kit)) return;
  if (!rounds.spend(item.price)) return;
  if (WEAPONS[id]) arsenal.give(id);
  else if (THROWABLES.includes(id)) arsenal.state.throwables[id] += 1;
  else if (id === 'vest') body.armor = 100;
  else if (id === 'helmet') { body.armor = 100; body.helmet = true; }
  else if (id === 'kit') arsenal.state.kit = true;
  owned.add(id);
  sfx('buy');
  hud.showBuy(R.money, owned, R.playerTeam, buy);
  syncHud();
}

function syncHud() {
  const a = arsenal.ammo();
  hud.setAmmo(a.mag, a.reserve);
  hud.setHealth(body.health, body.armor, body.helmet);
  hud.setScore(R.sideScore.you, R.sideScore.them, R.playerTeam);
  hud.setMoney(R.money);
  const t = arsenal.heldThrowable();
  hud.setWeapon(arsenal.def().name, t ? `${EQUIPMENT[t].name} ×${arsenal.state.throwables[t]}` : '');
  const label = R.phase === 'buy' ? `Round ${R.number}/24 · Buy` : R.phase === 'planted' ? `Round ${R.number} · Core armed` : R.phase === 'end' ? `Round ${R.number} · Over` : `Round ${R.number}/24`;
  hud.setTimer(R.timer, label);
  hud.setBlind(body.blind);
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) { started = true; hud.hideOverlay(); }
  else if (!R.matchOver && !hud.buyOpen() && !report.open()) hud.showOverlay('Paused', 'Click to return to the yard.', 'Resume');
}
hud.onPlay(() => {
  if (shot) return;
  if (R.matchOver) { rounds.reset(); stats.resetMatch(); kills = 0; body.alive = false; startRound(); }
  input.requestLock();
});
hud.onBuyReady(() => { hud.hideBuy(); input.requestLock(); });

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

// endRound: scores the round, books its economy line and, at the end of the match, says who won.
function endRound(winner, reason) {
  if (R.phase === 'end') return;
  rounds.end(winner, reason);
  stats.recordRound(R.number, R.roundStartMoney, R.roundSpent, R.roundEarned, winner, reason);
  sfx('round');
  hud.setProgress(0);
  hud.setObjective(`${winner === R.playerTeam ? 'Round won' : 'Round lost'} — ${reason}`);
  if (R.matchOver && !shot) {
    if (document.pointerLockElement) document.exitPointerLock();
    const { you, them } = R.sideScore;
    hud.showOverlay(you > them ? 'Match won' : you < them ? 'Match lost' : 'Draw', `Final ${you} : ${them} · ${kills} eliminations · Tab for the report`, 'Play again');
  }
}

function countAlive(team) {
  let n = team === R.playerTeam && body.alive ? 1 : 0;
  for (const b of botsys.bots) if (b.team === team && b.alive) n += 1;
  return n;
}

function step(dt) {
  time += dt; ctx.time = time;
  R.timer -= dt;
  radio.tick(dt);
  body.blind = Math.max(0, body.blind - dt);
  if (R.phase === 'buy') {
    player.step(dt, input.state.keys);
    spawnZoneLimit();
    if (R.timer <= 0) {
      rounds.goLive(); hud.hideBuy();
      hud.setObjective(R.playerTeam === 'atk' ? 'Carry the Pulse Core to site A or B — hold E on the site to arm it' : 'Hold the sites — hold E on an armed core to defuse');
    }
    return;
  }
  if (R.phase === 'end') {
    arsenal.step(dt); tracers.step(dt);
    if (R.timer <= 0 && !R.matchOver) { rounds.next(); startRound(); }
    return;
  }
  player.step(dt, input.state.keys);
  botsys.step(dt, ctx);
  grenades.step(dt, blasts);
  arsenal.step(dt);
  tracers.step(dt);
  stats.recordTrail(dt, botsys.bots);
  objective.pulse(time);
  const holdingE = input.state.keys.has('KeyE');
  if (R.playerTeam === 'atk') objective.tryPlant(dt, body, holdingE, player.groundSpeed() < 0.5);
  else if (body.alive && objective.tryDefuse(dt, 'You', body.position, holdingE, arsenal.state.kit) === 'done') endRound('def', 'you defused the Pulse Core');
  if (R.phase === 'end') return;
  if (R.phase === 'planted' && R.timer <= 0) endRound('atk', 'the Pulse Core detonated');
  else if (R.phase === 'live' && R.timer <= 0) endRound('def', 'time ran out');
  else if (countAlive('def') === 0) endRound('atk', 'defenders eliminated');
  else if (countAlive('atk') === 0 && !bomb.planted) endRound('def', 'attackers eliminated');
}

// handleInput: per-frame player intent (look, fire, reload, switch, throw, buy, report).
function handleInput() {
  const look = input.takeLook();
  if (body.alive) player.look(look.x, look.y);
  const w = arsenal.def();
  if (R.phase !== 'buy' && R.phase !== 'end' && body.alive && input.state.firing && arsenal.canFire()) {
    combat.playerShoot();
    if (!w.auto) input.state.firing = false;
  }
  if (input.consume('KeyR') && arsenal.reload()) sfx('reload');
  if (input.consume('Digit1')) arsenal.select(1);
  if (input.consume('Digit2')) arsenal.select(2);
  if (input.consume('KeyQ')) arsenal.nextThrowable();
  if (input.consume('KeyG') && body.alive && R.phase !== 'buy') {
    const t = arsenal.heldThrowable();
    camera.getWorldDirection(view);
    if (t && grenades.thrown(t, camera.position, view, 'You')) arsenal.state.throwables[t] -= 1;
  }
  if (input.consume('KeyB') && R.phase === 'buy') { document.exitPointerLock(); hud.showBuy(R.money, owned, R.playerTeam, buy); }
  if (input.consume('Enter') && hud.buyOpen()) { hud.hideBuy(); input.requestLock(); }
  if (input.state.keys.has('Tab')) { if (!report.open()) report.show(stats, R.number, R.sideScore); }
  else if (report.open() && !R.matchOver) report.hide();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (!frozen && started) {
    handleInput();
    acc += dt;
    let n = 0;
    while (acc >= FIXED && n < 5) { step(FIXED); acc -= FIXED; n += 1; }
    if (acc > FIXED * 5) acc = 0;
    syncCamera();
    syncHud();
    minimap.draw(dt, body, botsys.bots, bomb, R.playerTeam);
  }
  renderer.render(scene, camera);
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

startRound();
syncCamera();
if (shot) {
  runShot(shot, {
    THREE, FIXED, renderer, scene, camera, world, player, body, arsenal, botsys, grenades, rounds, R, hud, tracers, stats, minimap, report, objective, combat,
    startRound, buy, owned, step, syncCamera, syncHud, endRound, input, setFrozen: (v) => { frozen = v; },
  });
} else {
  hud.showOverlay('Nightveil Breach', '5v5 against bots, MR12. Attackers carry the Pulse Core to site A or B and arm it; defenders hold the yard or defuse it. Sides swap after round 12; first to 13.', 'Click to play');
  requestAnimationFrame(frame);
}
