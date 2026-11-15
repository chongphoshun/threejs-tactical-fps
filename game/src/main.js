// Nightveil Breach — boot and the one loop: fixed 60 Hz simulation, render at display rate.
// ?shot=buy|fight|plant|end&seed=N builds a deterministic frame for screenshots and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createArsenal, WEAPONS, EQUIPMENT } from './weapons.js';
import { createBots } from './bots.js';
import { createGrenades } from './grenades.js';
import { createRounds, ROUND, REWARD } from './rounds.js';
import { createHud } from './hud.js';
import { sfx } from './audio.js';

const FIXED = 1 / 60;
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const random = mulberry32(seed);
const play = (fn) => { if (!shot) { try { fn(); } catch { /* audio blocked */ } } };

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
const botsys = createBots(scene, world, random);
const grenades = createGrenades(scene);
const rounds = createRounds();
const hud = createHud();
const input = createInput(renderer.domElement, onLockChange);
const R = rounds.state;

// The Pulse Core: the attackers' objective.
const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshStandardMaterial({ color: PALETTE.plant, emissive: PALETTE.plant, emissiveIntensity: 1.4 }));
coreMesh.visible = false; scene.add(coreMesh);
const coreLight = new THREE.PointLight(PALETTE.plant, 0, 10, 2); scene.add(coreLight);
const bomb = { planted: false, position: new THREE.Vector3(), plantProgress: 0, defuseProgress: 0, carrier: 'player', site: -1 };

const playerActor = { team: 'atk', get alive() { return body.alive; }, position: body.position, get eyeY() { return body.position.y + body.eye; }, isPlayer: true, name: 'You' };
const ray = new THREE.Raycaster(); ray.far = 90;
const dir = new THREE.Vector3();
const eye = new THREE.Vector3();
const shootList = [];
let started = false, frozen = false, time = 0, acc = 0, last = performance.now();
let kills = 0;
const owned = new Set();

function atSite(pos) {
  for (let i = 0; i < world.sites.length; i += 1) {
    const s = world.sites[i];
    if (Math.hypot(pos.x - s.center.x, pos.z - s.center.z) < s.radius) return i;
  }
  return -1;
}

function startRound() {
  const survived = body.alive && R.number > 1;
  player.spawn(world.spawns.atk[0], -Math.PI / 2);
  if (!survived) { arsenal.resetLoadout(); body.armor = 0; owned.clear(); }
  botsys.spawnTeam('atk', 4, world.spawns.atk.slice(1));
  botsys.spawnTeam('def', 5, world.spawns.def, 0);
  botsys.planRoutes(Math.floor(random() * 2));
  grenades.clear();
  Object.assign(bomb, { planted: false, plantProgress: 0, defuseProgress: 0, carrier: 'player', site: -1 });
  coreMesh.visible = false; coreLight.intensity = 0;
  arsenal.refillAll();
  hud.clearFeed();
  hud.setObjective('Buy phase — press B for the buy menu');
  syncHud();
}

function buy(id) {
  const item = WEAPONS[id] ?? EQUIPMENT[id];
  if (!item || !rounds.spend(item.price)) return;
  if (WEAPONS[id]) arsenal.give(id);
  else if (id === 'charge') arsenal.state.charges = Math.min(2, arsenal.state.charges + 1);
  else if (id === 'armor') body.armor = 100;
  owned.add(id);
  play(sfx.buy);
  hud.showBuy(R.money, owned, buy);
  syncHud();
}

function syncHud() {
  const a = arsenal.ammo();
  hud.setAmmo(a.mag, a.reserve);
  hud.setHealth(body.health, body.armor);
  hud.setScore(R.score.atk, R.score.def);
  hud.setMoney(R.money);
  hud.setWeapon(arsenal.def().name, arsenal.state.charges);
  const label = R.phase === 'buy' ? `Round ${R.number} · Buy` : R.phase === 'planted' ? `Round ${R.number} · Core armed` : R.phase === 'end' ? `Round ${R.number} · Over` : `Round ${R.number}`;
  hud.setTimer(R.timer, label);
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) { started = true; hud.hideOverlay(); }
  else if (!R.matchOver && !hud.buyOpen()) hud.showOverlay('Paused', 'Click to return to the yard.', 'Resume');
}
hud.onPlay(() => {
  if (shot) return;
  if (R.matchOver) { rounds.reset(); owned.clear(); kills = 0; startRound(); }
  input.requestLock();
});
hud.onBuyReady(() => { hud.hideBuy(); input.requestLock(); });

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function killFeed(killer, victim, head) { hud.feed(`${killer} ▸ ${victim}${head ? ' ◎' : ''}`); }

function playerShoot() {
  const w = arsenal.def();
  const spread = shot ? 0 : arsenal.spread(player.groundSpeed(), body.crouching, !body.onGround);
  arsenal.fire();
  play(sfx.shoot);
  camera.getWorldDirection(dir);
  dir.x += (random() * 2 - 1) * spread; dir.y += (random() * 2 - 1) * spread; dir.z += (random() * 2 - 1) * spread;
  dir.normalize();
  scene.updateMatrixWorld();
  ray.set(camera.position, dir);
  shootList.length = 0;
  for (const m of world.shootables) shootList.push(m);
  for (const m of botsys.hitMeshes) if (m.userData.bot.alive) shootList.push(m);
  const hit = ray.intersectObjects(shootList, false)[0];
  if (hit && hit.object.userData.bot && hit.object.userData.bot.team !== 'atk') {
    const part = hit.object.userData.part;
    const dmg = w.dmg * (part === 'head' ? w.head : part === 'legs' ? 0.75 : 1) * (hit.distance > 30 ? 0.85 : 1);
    const killed = botsys.damage(hit.object.userData.bot, dmg);
    hud.hitMarker(shot ? 4000 : 90);
    play(killed ? sfx.kill : sfx.hit);
    if (killed) { kills += 1; rounds.earn(REWARD.kill); killFeed('You', hit.object.userData.bot.name, part === 'head'); }
  }
  player.recoil(w.recoil * (0.8 + random() * 0.4), (random() * 2 - 1) * w.recoil * 0.4);
  botsys.hear(body.position);
}

function damageActor(actor, amount, attackerName, head) {
  if (actor.isPlayer) {
    const died = player.damage(amount);
    hud.hurt(amount); play(sfx.hurt);
    if (died) { killFeed(attackerName, 'You', head); bomb.carrier = bomb.planted ? null : 'bot'; handoffCore(); }
  } else if (botsys.damage(actor, amount)) killFeed(attackerName, actor.name, head);
}

function handoffCore() {
  if (bomb.planted) return;
  const carrier = botsys.bots.find((b) => b.team === 'atk' && b.alive);
  if (carrier) { carrier.carrying = true; bomb.carrier = 'bot'; }
}

const ctx = {
  actors: [], time: 0, bomb, atSite,
  onBotHit(bot, enemy, dmg, head) { damageActor(enemy, dmg, bot.name, head); },
  onBotShot(bot) { if (bot.position.distanceTo(body.position) < 25) play(sfx.shoot); },
  onBotPlant(bot, dt) { if (!bomb.planted) { bomb.plantProgress += dt; if (bomb.plantProgress >= ROUND.PLANT) plantCore(bot.position, bot.name); } },
  onBotDefuse(bot, dt) { bomb.defuseProgress += dt; if (bomb.defuseProgress >= ROUND.DEFUSE) endRound('def', `${bot.name} defused the Pulse Core`); },
};

function plantCore(pos, who) {
  bomb.planted = true; bomb.position.set(pos.x, 0.3, pos.z); bomb.site = atSite(pos);
  coreMesh.position.copy(bomb.position); coreMesh.visible = true; coreLight.position.copy(bomb.position); coreLight.intensity = 6;
  rounds.bombPlanted();
  if (who === 'You') rounds.earn(REWARD.plant);
  hud.feed(`${who} armed the Pulse Core at site ${world.sites[bomb.site].name}`);
  play(sfx.plant);
}

function endRound(winner, reason) {
  if (R.phase === 'end') return;
  rounds.end(winner, reason, 'atk');
  play(sfx.round);
  hud.setObjective(`${winner === 'atk' ? 'Attackers' : 'Defenders'} win — ${reason}`);
  if (R.matchOver && !shot) {
    if (document.pointerLockElement) document.exitPointerLock();
    hud.showOverlay(R.score.atk > R.score.def ? 'Match won' : 'Match lost', `Final ${R.score.atk} : ${R.score.def} · ${kills} eliminations`, 'Play again');
  }
}

function step(dt) {
  time += dt; ctx.time = time;
  R.timer -= dt;
  if (R.phase === 'buy') {
    if (R.timer <= 0) { R.phase = 'live'; rounds.goLive(); hud.hideBuy(); hud.setObjective(bomb.carrier === 'player' ? 'Carry the Pulse Core to site A or B — hold E to arm' : 'Escort the core carrier'); }
    player.step(dt, input.state.keys);
    body.position.x = Math.min(body.position.x, -22); // buy-zone barrier
  } else if (R.phase === 'live' || R.phase === 'planted') {
    player.step(dt, input.state.keys);
    ctx.actors.length = 0; ctx.actors.push(playerActor); for (const b of botsys.bots) ctx.actors.push(b);
    botsys.step(dt, ctx);
    grenades.step(dt, explode);
    arsenal.step(dt);
    // Player plant
    if (R.phase === 'live' && bomb.carrier === 'player' && body.alive && input.state.keys.has('KeyE') && atSite(body.position) >= 0 && player.groundSpeed() < 0.5) {
      bomb.plantProgress += dt;
      hud.setObjective(`Arming… ${Math.round((bomb.plantProgress / ROUND.PLANT) * 100)}%`);
      if (bomb.plantProgress >= ROUND.PLANT) plantCore(body.position, 'You');
    }
    if (R.phase === 'planted') {
      coreLight.intensity = 4 + Math.sin(time * (6 + (ROUND.BOMB - R.timer) * 0.4)) * 3;
      if (R.timer <= 0) endRound('atk', 'the Pulse Core detonated');
    } else if (R.timer <= 0) endRound('def', 'time ran out');
    const atkAlive = (body.alive ? 1 : 0) + botsys.bots.filter((b) => b.team === 'atk' && b.alive).length;
    const defAlive = botsys.bots.filter((b) => b.team === 'def' && b.alive).length;
    if (defAlive === 0) endRound('atk', 'defenders eliminated');
    else if (atkAlive === 0 && !bomb.planted) endRound('def', 'attackers eliminated');
  } else if (R.phase === 'end') {
    arsenal.step(dt);
    if (R.timer <= 0 && !R.matchOver) { rounds.next(); startRound(); }
  }
}

function explode(pos, radius, maxDmg, owner) {
  play(sfx.kill);
  for (const a of ctx.actors) {
    if (!a.alive) continue;
    const d = Math.hypot(a.position.x - pos.x, a.position.z - pos.z);
    if (d < radius) damageActor(a, maxDmg * (1 - d / radius), owner, false);
  }
  botsys.hear(pos);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (!frozen && started) {
    const look = input.takeLook();
    if (body.alive) player.look(look.x, look.y);
    const w = arsenal.def();
    if (R.phase !== 'buy' && body.alive && input.state.firing && arsenal.canFire()) { playerShoot(); if (!w.auto) input.state.firing = false; }
    if (input.consume('KeyR') && arsenal.reload()) play(sfx.reload);
    if (input.consume('Digit1')) arsenal.select(1);
    if (input.consume('Digit2')) arsenal.select(2);
    if (input.consume('KeyG') && arsenal.state.charges > 0 && body.alive && R.phase !== 'buy') {
      camera.getWorldDirection(dir); eye.copy(camera.position);
      if (grenades.thrown(eye, dir, 'You')) arsenal.state.charges -= 1;
    }
    if (input.consume('KeyB') && R.phase === 'buy') { document.exitPointerLock(); hud.showBuy(R.money, owned, buy); }
    if (input.consume('Enter') && hud.buyOpen()) { hud.hideBuy(); input.requestLock(); }
    acc += dt;
    let n = 0;
    while (acc >= FIXED && n < 5) { step(FIXED); acc -= FIXED; n += 1; }
    if (acc > FIXED * 5) acc = 0;
    syncCamera();
    syncHud();
  }
  renderer.render(scene, camera);
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// --- Deterministic screenshot setups (real game code, scripted inputs) ---
function settle(steps) { for (let i = 0; i < steps; i += 1) step(FIXED); }
function aimAt(p) {
  const dx = p.x - body.position.x, dy = p.y - (body.position.y + body.eye), dz = p.z - body.position.z;
  body.yaw = Math.atan2(-dx, -dz); body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / (Math.hypot(dx, dy, dz) || 1))));
  syncCamera();
}
function runShot(name) {
  hud.hideOverlay();
  startRound();
  if (name === 'buy') {
    R.money = 3400; aimAt(new THREE.Vector3(0, 1.4, 0)); syncHud(); hud.showBuy(R.money, owned, buy);
  } else if (name === 'fight' || name === 'plant' || name === 'end') {
    rounds.spend(0); R.money = 5000; buy('rifle'); buy('armor'); buy('charge'); hud.hideBuy();
    R.timer = 0; settle(2);
    const target = botsys.bots.find((b) => b.team === 'def');
    if (name === 'fight') {
      body.position.set(4, 0, -1.2);
      target.position.set(14, 0, -3); target.mode = 'hold'; target.holdTime = 99;
      R.score.atk = 2; R.score.def = 1; R.number = 4;
      settle(30);
      body.position.set(4, 0, -1.2); target.position.set(14, 0, -3);
      aimAt(new THREE.Vector3(14, 1.65, -3));
      playerShoot(); settle(4); aimAt(new THREE.Vector3(14, 1.65, -3)); body.health = 74; body.armor = 62;
      R.timer = 78;
    } else if (name === 'plant') {
      const defenders = botsys.bots.filter((b) => b.team === 'def');
      defenders.slice(0, 3).forEach((b) => botsys.kill(b));
      defenders.slice(0, 3).forEach((b, i) => b.position.set(23 + i * 1.3, 0.2, -18 + i));
      defenders.slice(3).forEach((b) => { b.position.set(26, 0, 14); b.mode = 'hold'; b.holdTime = 99; });
      R.score.atk = 3; R.score.def = 2; R.number = 6; kills = 9;
      body.position.set(21, 0, -15.5); settle(2);
      plantCore(body.position, 'You'); R.timer = 31;
      body.position.set(25.5, 0, -10.5); aimAt(new THREE.Vector3(21, 0.3, -15.5)); body.health = 58;
      hud.setObjective('Hold the site — the Pulse Core is armed');
    } else {
      R.score.atk = 6; R.score.def = 4; R.number = 11; kills = 23;
      for (const b of botsys.bots) if (b.team === 'def') botsys.kill(b);
      body.position.set(10, 0, -3); settle(2);
      endRound('atk', 'defenders eliminated');
      aimAt(new THREE.Vector3(18, 0.6, 0));
      hud.showOverlay('Match won', `Final ${R.score.atk} : ${R.score.def} · ${kills} eliminations`, 'Play again');
    }
  }
  syncHud();
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    if (frozen) return;
    syncCamera(); renderer.render(scene, camera); painted += 1;
    if (painted === 3) { window.__shotReady = true; frozen = true; }
  }
  requestAnimationFrame(paint);
}

startRound();
syncCamera();
if (shot) runShot(shot);
else { hud.showOverlay('Nightveil Breach', 'Attackers carry the Pulse Core into the yard and arm it at site A or B. Five defender bots hold the vault. First to 7 rounds.', 'Click to play'); requestAnimationFrame(frame); }
