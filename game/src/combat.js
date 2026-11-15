// Combat: the player's hitscan shots (spread, pellets, head/body/leg multipliers, falloff), bot gunfire
// against any actor, and damage with vest and helm. Every shot leaves a tracer and a stats record.
import * as THREE from 'three';
import { REWARD } from './rounds.js';

const LEG = 0.75, FALLOFF_FROM = 30, FALLOFF = 0.85, HELM_HEAD = 0.5;

export function createCombat({ scene, camera, world, botsys, player, arsenal, rounds, hud, tracers, stats, radio, sfx, random, shot }) {
  const ray = new THREE.Raycaster(); ray.far = 90;
  const dir = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  const end = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const targets = [];
  const hits = [];
  const body = player.state;
  const R = rounds.state;
  let onPlayerDeath = () => {};

  function feed(killer, victim, head, weapon) { hud.feed(`${killer} ▸ ${victim}${head ? ' ◎' : ''}${weapon ? ` · ${weapon}` : ''}`); }

  // playerShoot: one trigger pull; each pellet draws its own spread and is checked against bodies and the map.
  function playerShoot() {
    const w = arsenal.def();
    const spread = shot ? 0 : arsenal.spread(player.groundSpeed(), body.crouching, !body.onGround);
    arsenal.fire();
    sfx('shoot');
    scene.updateMatrixWorld();
    targets.length = 0;
    for (const m of world.shootables) targets.push(m);
    for (const m of botsys.hitMeshes) if (m.userData.bot.alive && m.userData.bot.team !== R.playerTeam) targets.push(m);
    camera.getWorldDirection(dir);
    const baseX = dir.x, baseY = dir.y, baseZ = dir.z;
    muzzle.copy(camera.position).addScaledVector(dir, 0.6); muzzle.y -= 0.12;
    for (let p = 0; p < w.pellets; p += 1) {
      const s = w.pellets > 1 && shot ? w.spread : spread + (w.pellets > 1 ? w.spread : 0);
      dir.set(baseX + (random() * 2 - 1) * s, baseY + (random() * 2 - 1) * s, baseZ + (random() * 2 - 1) * s).normalize();
      ray.set(camera.position, dir);
      hits.length = 0;
      ray.intersectObjects(targets, false, hits);
      const hit = hits[0];
      if (hit) end.copy(hit.point); else end.copy(camera.position).addScaledVector(dir, 60);
      tracers.add(muzzle, end, 1, 0.85, 0.5);
      const bot = hit && hit.object.userData.bot;
      if (!bot) { stats.recordShot('You', body.position.x, body.position.z, end.x, end.z, '', '', 0); continue; }
      const part = hit.object.userData.part;
      const dmg = w.dmg * (part === 'head' ? w.head : part === 'legs' ? LEG : 1) * (hit.distance > FALLOFF_FROM ? FALLOFF : 1);
      stats.recordShot('You', body.position.x, body.position.z, end.x, end.z, bot.name, part, dmg);
      const killed = botsys.damage(bot, dmg);
      hud.hitMarker(shot ? 4000 : 90);
      sfx(killed ? 'kill' : 'hit');
      if (killed) { rounds.earn(REWARD.kill); feed('You', bot.name, part === 'head', w.name); radio.down(bot); }
    }
    player.recoil(w.recoil * (0.8 + random() * 0.4), (random() * 2 - 1) * w.recoil * 0.4);
    botsys.hear(body.position, R.playerTeam, ctxRef.ctx);
  }

  // damageActor: applies a hit to the player or a bot and reports a kill to the feed.
  function damageActor(actor, amount, attacker, head) {
    if (actor.isPlayer) {
      const died = player.damage(amount);
      hud.hurt(amount); sfx('hurt');
      if (died) { feed(attacker, 'You', head); onPlayerDeath(); }
      return died;
    }
    const died = botsys.damage(actor, amount);
    if (died) { feed(attacker, actor.name, head); radio.down(actor); }
    return died;
  }

  // botShot: a bot's trigger pull; the hit roll was made in bots.js, here it lands, traces and records.
  function botShot(bot, enemy, hit, head, dmg) {
    from.set(bot.position.x, 1.15, bot.position.z);
    to.set(enemy.position.x, enemy.eyeY - (head ? 0 : 0.5), enemy.position.z);
    if (!hit) { to.x += (random() - 0.5) * 1.6; to.y += (random() - 0.5) * 0.8; }
    tracers.add(from, to, bot.team === 'atk' ? 1 : 0.5, bot.team === 'atk' ? 0.45 : 0.7, bot.team === 'atk' ? 0.35 : 1);
    let applied = dmg;
    if (hit && enemy.isPlayer && head && body.helmet) applied *= HELM_HEAD;
    stats.recordShot(bot.name, bot.position.x, bot.position.z, to.x, to.z, hit ? enemy.name : '', hit ? (head ? 'head' : 'body') : '', applied);
    if (hit) damageActor(enemy, applied, bot.name, head);
    if (bot.position.distanceTo(body.position) < 25) sfx('shoot');
  }

  // fragBlast: falloff damage to everyone in the radius, friendly fire included.
  function fragBlast(pos, radius, maxDmg, owner, actors) {
    sfx('kill');
    for (const a of actors) {
      if (!a.alive) continue;
      const d = Math.hypot(a.position.x - pos.x, a.position.z - pos.z);
      if (d < radius) damageActor(a, maxDmg * (1 - d / radius), owner, false);
    }
  }

  const ctxRef = { ctx: null };
  return {
    playerShoot, damageActor, botShot, fragBlast,
    bind(ctx, deathHandler) { ctxRef.ctx = ctx; onPlayerDeath = deathHandler; },
  };
}
