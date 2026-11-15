// Bots: two teams of soldiers that follow waypoint routes, hold angles, react to sight and sound, and shoot back.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { findRoute, nearestNode } from './world.js';

const BOT_NAMES = {
  atk: ['Rook', 'Ember', 'Vandal', 'Kite'],
  def: ['Warden', 'Slate', 'Cobalt', 'Hollow', 'Quill'],
};

export function createBots(scene, world, random) {
  const bots = [];
  const hitMeshes = [];
  const losRay = new THREE.Raycaster();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  function makeBot(team, index) {
    const color = team === 'atk' ? PALETTE.atk : PALETTE.def;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#2a3240', roughness: 0.7 });
    const teamMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), bodyMat);
    torso.position.y = 1.05;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bodyMat);
    legs.position.y = 0.35;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), teamMat);
    head.position.y = 1.65;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: '#e8eef6' }));
    visor.position.set(0, 1.67, -0.16);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.37), teamMat);
    band.position.y = 1.3;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), bodyMat);
    gun.position.set(0.25, 1.15, -0.35);
    for (const m of [torso, legs, head, band, gun]) { m.castShadow = true; }
    group.add(torso, legs, head, visor, band, gun);
    scene.add(group);
    const bot = {
      team, name: BOT_NAMES[team][index % BOT_NAMES[team].length],
      group, head, torso, legs,
      position: group.position, yaw: 0,
      health: 100, alive: true,
      route: [], routeIndex: 0, goal: 0,
      mode: 'route', // route | hold | engage | plant | defuse
      target: null, reaction: 0, fireCooldown: 0, holdTime: 0, heardAt: null,
      skill: 0.55 + random() * 0.3,
      carrying: false,
    };
    for (const [m, part] of [[head, 'head'], [torso, 'body'], [legs, 'legs'], [band, 'body']]) {
      m.userData.bot = bot; m.userData.part = part; hitMeshes.push(m);
    }
    bots.push(bot);
    return bot;
  }

  function spawnTeam(team, count, positions, offset = 0) {
    for (let i = 0; i < count; i += 1) {
      const bot = bots.filter((b) => b.team === team)[i] ?? makeBot(team, i + offset);
      bot.position.copy(positions[i % positions.length]);
      bot.health = 100; bot.alive = true; bot.group.visible = true;
      bot.group.rotation.set(0, 0, 0);
      bot.mode = 'route'; bot.target = null; bot.reaction = 0; bot.heardAt = null; bot.carrying = false;
      bot.yaw = team === 'atk' ? -Math.PI / 2 : Math.PI / 2;
    }
  }

  function planRoutes(siteIndex) {
    const siteNode = siteIndex === 0 ? 4 : 14;
    const holdNodes = [3, 8, 13, 9, 4, 14];
    let di = 0;
    for (const bot of bots) {
      const start = nearestNode(world, bot.position);
      if (bot.team === 'atk') {
        bot.goal = siteNode;
      } else {
        bot.goal = holdNodes[di % holdNodes.length]; di += 1;
      }
      bot.route = findRoute(world, start, bot.goal);
      bot.routeIndex = 0;
    }
  }

  function canSee(from, to) {
    tmpDir.subVectors(to, from);
    const dist = tmpDir.length();
    tmpDir.normalize();
    losRay.set(from, tmpDir);
    losRay.far = dist;
    return losRay.intersectObjects(world.occluders, false).length === 0;
  }

  function hear(pos) {
    for (const b of bots) if (b.alive && b.position.distanceTo(pos) < 22) b.heardAt = pos.clone();
  }

  function kill(bot) {
    bot.alive = false; bot.carrying = false;
    bot.group.rotation.x = -Math.PI / 2; bot.group.position.y = 0.2;
  }

  function damage(bot, amount) {
    if (!bot.alive) return false;
    bot.health -= amount;
    if (bot.health <= 0) { kill(bot); return true; }
    bot.reaction = Math.min(bot.reaction, 0.1);
    return false;
  }

  const probe = new THREE.Box3();
  function blocked(x, z) {
    probe.min.set(x - 0.3, 0.3, z - 0.3);
    probe.max.set(x + 0.3, 1.6, z + 0.3);
    for (const c of world.colliders) if (probe.intersectsBox(c)) return true;
    return false;
  }

  function moveToward(bot, point, speed, dt) {
    tmpA.set(point.x - bot.position.x, 0, point.z - bot.position.z);
    const d = tmpA.length();
    if (d < 0.4) return true;
    tmpA.multiplyScalar(Math.min(d, speed * dt) / d);
    // slide along colliders one axis at a time
    if (!blocked(bot.position.x + tmpA.x, bot.position.z)) bot.position.x += tmpA.x;
    if (!blocked(bot.position.x, bot.position.z + tmpA.z)) bot.position.z += tmpA.z;
    bot.yaw = Math.atan2(-tmpA.x, -tmpA.z);
    return false;
  }

  // Each bot picks the nearest visible enemy (bots or player), turns, waits a reaction time, then fires with spread.
  function step(dt, ctx) {
    for (const bot of bots) {
      if (!bot.alive) continue;
      bot.fireCooldown = Math.max(0, bot.fireCooldown - dt);
      tmpA.set(bot.position.x, 1.6, bot.position.z);
      let enemy = null; let ed = Infinity;
      for (const other of ctx.actors) {
        if (!other.alive || other.team === bot.team) continue;
        tmpB.set(other.position.x, (other.eyeY ?? 1.5), other.position.z);
        const d = tmpA.distanceTo(tmpB);
        if (d >= 40 || d >= ed) continue;
        // view cone: a bot notices enemies within ~120 degrees ahead, or any it already tracks or heard
        const ang = Math.atan2(-(tmpB.x - tmpA.x), -(tmpB.z - tmpA.z));
        const off = Math.abs(Math.atan2(Math.sin(ang - bot.yaw), Math.cos(ang - bot.yaw)));
        if (off > 1.05 && bot.target !== other && d > 4) continue;
        if (canSee(tmpA, tmpB)) { enemy = other; ed = d; }
      }
      if (enemy) {
        if (bot.target !== enemy) { bot.target = enemy; bot.reaction = 0.75 - bot.skill * 0.35; }
        bot.mode = 'engage';
        bot.yaw = Math.atan2(-(enemy.position.x - bot.position.x), -(enemy.position.z - bot.position.z));
        bot.reaction -= dt;
        if (bot.reaction <= 0 && bot.fireCooldown <= 0) {
          bot.fireCooldown = 0.3 + random() * 0.2;
          const miss = 0.25 + (1 - bot.skill) * 0.8 + ed * 0.015;
          if (random() > miss) {
            const headshot = random() < 0.12 * bot.skill;
            ctx.onBotHit(bot, enemy, headshot ? 90 : 18 + random() * 8, headshot);
          }
          ctx.onBotShot(bot);
        }
      } else {
        bot.target = null;
        if (bot.mode === 'engage') bot.mode = 'route';
        if (bot.heardAt && bot.team === 'def' && bot.mode !== 'defuse') {
          bot.yaw = Math.atan2(-(bot.heardAt.x - bot.position.x), -(bot.heardAt.z - bot.position.z));
          if (moveToward(bot, bot.heardAt, 3.2, dt)) bot.heardAt = null;
        } else if (bot.mode === 'defuse' && ctx.bomb.planted) {
          if (moveToward(bot, ctx.bomb.position, 4.5, dt)) ctx.onBotDefuse(bot, dt);
        } else if (bot.mode === 'route') {
          const node = world.nodes[bot.route[bot.routeIndex]];
          if (node && moveToward(bot, node, 4.2, dt)) {
            bot.routeIndex += 1;
            if (bot.routeIndex >= bot.route.length) { bot.mode = 'hold'; bot.holdTime = 2 + random() * 4; }
          }
        } else if (bot.mode === 'hold') {
          bot.holdTime -= dt;
          bot.yaw += Math.sin(ctx.time * 0.7 + bot.skill * 10) * dt * 0.6; // scan angles
          if (bot.carrying && ctx.atSite(bot.position) >= 0) ctx.onBotPlant(bot, dt);
        }
        if (bot.team === 'def' && ctx.bomb.planted && bot.mode !== 'defuse') {
          bot.mode = 'defuse';
        }
      }
      bot.group.rotation.y = bot.yaw;
    }
  }

  return { bots, hitMeshes, spawnTeam, planRoutes, step, damage, hear, kill };
}
