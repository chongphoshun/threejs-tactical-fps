// The Pulse Core: who carries it, arming it on a site, the armed countdown pulse and defusing it.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { ROUND, REWARD } from './rounds.js';

export function createObjective(scene, world, rounds, hud, radio, sfx) {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshStandardMaterial({ color: PALETTE.plant, emissive: PALETTE.plant, emissiveIntensity: 1.4 }));
  mesh.visible = false; scene.add(mesh);
  const light = new THREE.PointLight(PALETTE.plant, 0, 10, 2); scene.add(light);
  const bomb = { planted: false, position: new THREE.Vector3(), plantProgress: 0, defuseProgress: 0, carrier: 'player', site: -1, defuser: '' };
  const R = rounds.state;

  function atSite(pos) {
    for (let i = 0; i < world.sites.length; i += 1) {
      const s = world.sites[i];
      if (Math.hypot(pos.x - s.center.x, pos.z - s.center.z) < s.radius) return i;
    }
    return -1;
  }
  function reset(bots) {
    Object.assign(bomb, { planted: false, plantProgress: 0, defuseProgress: 0, site: -1, defuser: '' });
    mesh.visible = false; light.intensity = 0;
    if (R.playerTeam === 'atk') bomb.carrier = 'player';
    else handToBot(bots);
  }
  // handToBot: the core passes to the first living attacker bot.
  function handToBot(bots) {
    bomb.carrier = null;
    for (const b of bots) if (b.team === 'atk' && b.alive) { b.carrying = true; bomb.carrier = 'bot'; return; }
  }
  function plant(pos, who) {
    bomb.planted = true; bomb.position.set(pos.x, 0.3, pos.z); bomb.site = atSite(pos);
    mesh.position.copy(bomb.position); mesh.visible = true; light.position.copy(bomb.position); light.intensity = 6;
    rounds.bombPlanted();
    if (who === 'You') rounds.earn(REWARD.plant);
    hud.feed(`${who} armed the Pulse Core at site ${world.sites[bomb.site].name}`);
    sfx('plant');
  }
  // tryPlant: hold E, standing still on a site, for ROUND.PLANT seconds.
  function tryPlant(dt, body, holding, still) {
    if (R.phase !== 'live' || bomb.carrier !== 'player' || !body.alive) return false;
    if (!holding || !still || atSite(body.position) < 0) { bomb.plantProgress = 0; hud.setProgress(0); return false; }
    bomb.plantProgress += dt;
    hud.setProgress(bomb.plantProgress / ROUND.PLANT, `ARMING PULSE CORE ${Math.round((bomb.plantProgress / ROUND.PLANT) * 100)}%`);
    if (bomb.plantProgress >= ROUND.PLANT) { plant(body.position, 'You'); hud.setProgress(0); }
    return true;
  }
  // tryDefuse: hold E within reach of the armed core; a kit shortens it.
  function tryDefuse(dt, who, pos, holding, kit) {
    if (!bomb.planted || R.phase !== 'planted') return false;
    const near = Math.hypot(pos.x - bomb.position.x, pos.z - bomb.position.z) < 1.6;
    if (!holding || !near) { if (who === 'You') { bomb.defuseProgress = 0; hud.setProgress(0); } return false; }
    const need = kit ? ROUND.KIT_DEFUSE : ROUND.DEFUSE;
    if (bomb.defuser !== who) { bomb.defuser = who; bomb.defuseProgress = 0; }
    bomb.defuseProgress += dt;
    if (who === 'You') hud.setProgress(bomb.defuseProgress / need, `DEFUSING ${Math.round((bomb.defuseProgress / need) * 100)}%`);
    if (bomb.defuseProgress >= need) { if (who === 'You') { rounds.earn(REWARD.defuse); hud.setProgress(0); } sfx('defuse'); return 'done'; }
    return true;
  }
  function botPlant(bot, dt) {
    if (bomb.planted) return;
    radio.planting(bot, world.sites[atSite(bot.position)].name);
    bomb.plantProgress += dt;
    if (bomb.plantProgress >= ROUND.PLANT) { bot.carrying = false; plant(bot.position, bot.name); }
  }
  function pulse(time) { if (bomb.planted) light.intensity = 4 + Math.sin(time * (6 + (ROUND.BOMB - R.timer) * 0.4)) * 3; }
  return { bomb, atSite, reset, handToBot, plant, tryPlant, tryDefuse, botPlant, pulse };
}
