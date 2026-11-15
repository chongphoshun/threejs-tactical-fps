// Bots: soldiers of both teams that follow waypoint routes, hold angles, react to what they see and hear,
// call it on the radio and shoot back with reaction time and distance-scaled accuracy.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { findRoute, nearestNode } from './world.js';

const NAMES = ['Rook', 'Ember', 'Vandal', 'Kite', 'Sable', 'Warden', 'Slate', 'Cobalt', 'Hollow', 'Quill'];
const VIEW_CONE = 1.05; // radians either side of facing
const SIGHT = 34, HEARING = 24, PUSH_RANGE = 18;
const HOLD_NODES = { def: [3, 8, 13, 4, 14], atk: [2, 7, 12, 1, 11] };

export function createBots(scene, world, random, smokes) {
  const bots = [];
  const hitMeshes = [];
  const losRay = new THREE.Raycaster();
  const losTargets = [];
  const eye = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const step3 = new THREE.Vector3();
  const probe = new THREE.Box3();
  const teamMats = {
    atk: new THREE.MeshStandardMaterial({ color: PALETTE.atk, emissive: PALETTE.atk, emissiveIntensity: 0.35 }),
    def: new THREE.MeshStandardMaterial({ color: PALETTE.def, emissive: PALETTE.def, emissiveIntensity: 0.35 }),
  };
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#2a3240', roughness: 0.7 });
  const flashMat = new THREE.MeshBasicMaterial({ color: '#ffd27a' });

  function makeBot(index) {
    const group = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), bodyMat);
    torso.position.y = 1.05;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bodyMat);
    legs.position.y = 0.35;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), teamMats.atk);
    head.position.y = 1.65;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: '#e8eef6' }));
    visor.position.set(0, 1.67, -0.16);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.37), teamMats.atk);
    band.position.y = 1.3;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), bodyMat);
    gun.position.set(0.25, 1.15, -0.35);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), flashMat);
    muzzle.position.set(0.25, 1.15, -0.7); muzzle.visible = false;
    for (const m of [torso, legs, head, band, gun]) m.castShadow = true;
    group.add(torso, legs, head, visor, band, gun, muzzle);
    scene.add(group);
    const bot = {
      index, team: 'atk', name: NAMES[index % NAMES.length], group, head, band, muzzle,
      position: group.position, yaw: 0, health: 100, alive: true, eyeY: 1.6,
      route: [], routeIndex: 0, mode: 'route', target: null, reaction: 0, fireCooldown: 0,
      holdTime: 0, holdYaw: 0, heard: new THREE.Vector3(), hasHeard: false, carrying: false,
      blind: 0, flashTime: 0, spotted: false, spottedTime: 0, sidestep: 0, sideSign: 1, skill: 0.55 + random() * 0.3,
    };
    for (const [m, part] of [[head, 'head'], [torso, 'body'], [legs, 'legs'], [band, 'body']]) {
      m.userData.bot = bot; m.userData.part = part; hitMeshes.push(m);
    }
    bots.push(bot);
    return bot;
  }
  for (let i = 0; i < 9; i += 1) makeBot(i);

  // assignTeams: deals the nine bots into the two sides, the player's side getting one fewer.
  function assignTeams(playerTeam, spawns) {
    const mine = 4;
    for (const bot of bots) {
      // the first four bots join the player's side, the other five are the enemy
      bot.team = bot.index < mine ? playerTeam : (playerTeam === 'atk' ? 'def' : 'atk');
      bot.head.material = teamMats[bot.team]; bot.band.material = teamMats[bot.team];
      const list = spawns[bot.team];
      const slot = bot.team === playerTeam ? bot.index + 1 : bot.index - mine;
      bot.position.copy(list[slot % list.length]);
      bot.health = 100; bot.alive = true; bot.group.visible = true;
      bot.group.rotation.set(0, 0, 0);
      bot.mode = 'route'; bot.target = null; bot.reaction = 0; bot.hasHeard = false; bot.carrying = false;
      bot.blind = 0; bot.spotted = false; bot.flashTime = 0; bot.muzzle.visible = false;
      bot.yaw = bot.team === 'atk' ? -Math.PI / 2 : Math.PI / 2;
    }
  }

  // planRoutes: attackers converge on the chosen site, defenders split over the hold spots.
  function planRoutes(siteIndex) {
    const siteNode = siteIndex === 0 ? 4 : 14;
    let held = 0, lurk = 0;
    for (const bot of bots) {
      const start = nearestNode(world, bot.position);
      let goal;
      if (bot.team === 'atk') goal = lurk++ === 3 ? HOLD_NODES.atk[siteIndex === 0 ? 2 : 0] : siteNode;
      else goal = HOLD_NODES.def[held++ % HOLD_NODES.def.length];
      bot.route = findRoute(world, start, goal);
      bot.routeIndex = 0;
      bot.holdYaw = bot.team === 'def' ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  function canSee(from, to) {
    aim.subVectors(to, from);
    const dist = aim.length();
    aim.multiplyScalar(1 / dist);
    losRay.set(from, aim);
    losRay.far = dist;
    losTargets.length = 0;
    for (const m of world.occluders) losTargets.push(m);
    for (const m of smokes) losTargets.push(m);
    return losRay.intersectObjects(losTargets, false).length === 0;
  }

  function blocked(x, z) {
    probe.min.set(x - 0.3, 0.3, z - 0.3);
    probe.max.set(x + 0.3, 1.6, z + 0.3);
    for (const c of world.colliders) if (probe.intersectsBox(c)) return true;
    return false;
  }

  function moveToward(bot, point, speed, dt) {
    step3.set(point.x - bot.position.x, 0, point.z - bot.position.z);
    const d = step3.length();
    if (d < 0.4) return true;
    step3.multiplyScalar(Math.min(d, speed * dt) / d);
    bot.yaw = Math.atan2(-step3.x, -step3.z);
    if (bot.sidestep > 0) { // stuck on cover: slide sideways for a moment
      bot.sidestep -= dt;
      const sx = -step3.z * bot.sideSign, sz = step3.x * bot.sideSign;
      if (!blocked(bot.position.x + sx, bot.position.z + sz)) { bot.position.x += sx; bot.position.z += sz; }
      return false;
    }
    let moved = false;
    if (!blocked(bot.position.x + step3.x, bot.position.z)) { bot.position.x += step3.x; moved = true; }
    if (!blocked(bot.position.x, bot.position.z + step3.z)) { bot.position.z += step3.z; moved = true; }
    if (!moved) { bot.sidestep = 0.5; bot.sideSign = -bot.sideSign; }
    return false;
  }

  // hear: gunfire and blasts within earshot turn bots toward the sound.
  function hear(pos, team, ctx) {
    for (const b of bots) {
      if (!b.alive || b.team === team || b.target) continue;
      if (b.position.distanceTo(pos) > HEARING) continue;
      if (!b.hasHeard && ctx) ctx.radio.heard(b, pos);
      b.heard.copy(pos); b.hasHeard = true;
    }
  }
  // flashed: a glare flash blinds bots that face it, for longer when close.
  function flashed(pos) {
    for (const b of bots) {
      if (!b.alive) continue;
      const d = b.position.distanceTo(pos);
      if (d > 18) continue;
      eye.set(b.position.x, 1.6, b.position.z);
      const ang = Math.atan2(-(pos.x - eye.x), -(pos.z - eye.z));
      const off = Math.abs(Math.atan2(Math.sin(ang - b.yaw), Math.cos(ang - b.yaw)));
      if (off < 1.4 && canSee(eye, pos)) b.blind = Math.max(b.blind, 3.2 - d * 0.12);
    }
  }

  function kill(bot) {
    bot.alive = false; bot.carrying = false; bot.muzzle.visible = false;
    bot.group.rotation.x = -Math.PI / 2; bot.group.position.y = 0.2;
  }
  function damage(bot, amount) {
    if (!bot.alive) return false;
    bot.health -= amount;
    if (bot.health <= 0) { kill(bot); return true; }
    bot.reaction = Math.min(bot.reaction, 0.1);
    return false;
  }

  function pickEnemy(bot, ctx) {
    eye.set(bot.position.x, 1.6, bot.position.z);
    let enemy = null, best = SIGHT;
    for (const other of ctx.actors) {
      if (!other.alive || other.team === bot.team) continue;
      aim.set(other.position.x, other.eyeY, other.position.z);
      const d = eye.distanceTo(aim);
      if (d >= best) continue;
      const ang = Math.atan2(-(aim.x - eye.x), -(aim.z - eye.z));
      const off = Math.abs(Math.atan2(Math.sin(ang - bot.yaw), Math.cos(ang - bot.yaw)));
      if (off > VIEW_CONE && bot.target !== other && d > 4) continue;
      if (canSee(eye, aim.set(other.position.x, other.eyeY, other.position.z))) { enemy = other; best = d; }
    }
    return enemy ? { enemy, dist: best } : null;
  }

  // engage: turn, wait out the reaction time, fire with accuracy falling off with distance and blindness.
  function engage(bot, enemy, dist, dt, ctx) {
    if (bot.target !== enemy) {
      bot.target = enemy; bot.reaction = 0.75 - bot.skill * 0.35;
      ctx.radio.spotted(bot, enemy);
    }
    if (!enemy.isPlayer) { enemy.spotted = true; enemy.spottedTime = 1.5; }
    bot.mode = 'engage';
    if (dist > PUSH_RANGE) { // too far to trade well: close the distance, then stop to shoot
      moveToward(bot, enemy.position, 2.6, dt);
      bot.reaction = Math.max(bot.reaction, 0.15);
    }
    bot.yaw = Math.atan2(-(enemy.position.x - bot.position.x), -(enemy.position.z - bot.position.z));
    bot.reaction -= dt;
    if (bot.reaction > 0 || bot.fireCooldown > 0) return;
    bot.fireCooldown = 0.3 + random() * 0.2;
    const miss = Math.min(0.85, 0.25 + (1 - bot.skill) * 0.8 + dist * 0.012);
    const hit = random() > miss;
    const head = hit && random() < 0.12 * bot.skill;
    ctx.onBotShot(bot, enemy, hit, head, hit ? (head ? 90 : 18 + random() * 8) : 0);
    bot.flashTime = 0.05;
  }

  function patrol(bot, dt, ctx) {
    if (bot.team === 'def' && ctx.bomb.planted) {
      if (moveToward(bot, ctx.bomb.position, 4.5, dt)) ctx.onBotDefuse(bot, dt);
      return;
    }
    if (bot.hasHeard && bot.team === 'def') {
      if (moveToward(bot, bot.heard, 3.2, dt)) bot.hasHeard = false;
      return;
    }
    if (bot.hasHeard) { bot.yaw = Math.atan2(-(bot.heard.x - bot.position.x), -(bot.heard.z - bot.position.z)); bot.hasHeard = false; }
    if (bot.mode === 'route') {
      const node = world.nodes[bot.route[bot.routeIndex]];
      if (!node || moveToward(bot, node, 4.2, dt)) {
        bot.routeIndex += 1;
        if (bot.routeIndex >= bot.route.length) {
          bot.mode = 'hold'; bot.holdTime = 3 + random() * 5;
          ctx.stats.recordHold(bot.index, bot.position.x, bot.position.z);
          ctx.radio.holding(bot);
        }
      }
    } else if (bot.mode === 'hold') {
      bot.holdTime -= dt;
      bot.yaw = bot.holdYaw + Math.sin(ctx.time * 0.7 + bot.skill * 10) * 0.7; // sweep the held angle
      if (bot.carrying && ctx.atSite(bot.position) >= 0) ctx.onBotPlant(bot, dt);
    }
  }

  function step(dt, ctx) {
    for (const bot of bots) {
      bot.flashTime = Math.max(0, bot.flashTime - dt);
      bot.muzzle.visible = bot.flashTime > 0;
      bot.spottedTime = Math.max(0, bot.spottedTime - dt);
      if (bot.spottedTime <= 0) bot.spotted = false;
      if (!bot.alive) continue;
      bot.fireCooldown = Math.max(0, bot.fireCooldown - dt);
      if (bot.blind > 0) { bot.blind -= dt; bot.group.rotation.y = bot.yaw; continue; }
      const seen = pickEnemy(bot, ctx);
      if (seen) engage(bot, seen.enemy, seen.dist, dt, ctx);
      else {
        bot.target = null;
        if (bot.mode === 'engage') bot.mode = bot.routeIndex >= bot.route.length ? 'hold' : 'route';
        patrol(bot, dt, ctx);
      }
      bot.group.rotation.y = bot.yaw;
    }
  }

  return { bots, hitMeshes, assignTeams, planRoutes, step, damage, hear, flashed, kill, canSee };
}
