// Weapon definitions and the player's viewmodel/state. Spread grows with movement and sustained fire.
import * as THREE from 'three';

export const WEAPONS = {
  sidearm: { name: 'Vex Sidearm', price: 0, mag: 12, reserve: 36, rpm: 300, dmg: 28, head: 3.5, spread: 0.008, moveSpread: 0.035, recoil: 0.012, reload: 1.6, auto: false, slot: 2 },
  smg: { name: 'Hornet SMG', price: 1200, mag: 25, reserve: 100, rpm: 800, dmg: 22, head: 2.5, spread: 0.014, moveSpread: 0.025, recoil: 0.008, reload: 2.1, auto: true, slot: 1 },
  rifle: { name: 'Pulse Rifle', price: 2700, mag: 30, reserve: 90, rpm: 600, dmg: 34, head: 4, spread: 0.004, moveSpread: 0.06, recoil: 0.014, reload: 2.4, auto: true, slot: 1 },
  marksman: { name: 'Longwatch DMR', price: 4200, mag: 5, reserve: 20, rpm: 45, dmg: 110, head: 2, spread: 0.0008, moveSpread: 0.12, recoil: 0.05, reload: 3.0, auto: false, slot: 1 },
};
export const EQUIPMENT = {
  charge: { name: 'Frag Charge', price: 300 },
  armor: { name: 'Kevlite Vest', price: 650 },
};

export function createArsenal(camera) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#4a5668', metalness: 0.5, roughness: 0.45 });
  const glowMat = new THREE.MeshStandardMaterial({ color: '#3dd6c6', emissive: '#3dd6c6', emissiveIntensity: 1.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.55), bodyMat);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.35, 10), bodyMat);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.42);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), glowMat);
  sight.position.set(0, 0.075, -0.05);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), bodyMat);
  mag.position.set(0, -0.11, -0.08);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
  flash.position.set(0, 0.02, -0.62); flash.visible = false;
  group.add(body, barrel, sight, mag, flash);
  group.position.set(0.24, -0.21, -0.5);
  group.scale.setScalar(0.55);
  camera.add(group);

  const state = {
    primary: null,
    secondary: 'sidearm',
    current: 'sidearm',
    ammo: { sidearm: { mag: 12, reserve: 36 } },
    charges: 0,
    cooldown: 0,
    reloading: 0,
    bloom: 0,
    kick: 0,
    flashTime: 0,
  };

  function def() { return WEAPONS[state.current]; }
  function ammo() { return state.ammo[state.current]; }

  function give(id) {
    const w = WEAPONS[id];
    if (w.slot === 1) state.primary = id; else state.secondary = id;
    state.ammo[id] = { mag: w.mag, reserve: w.reserve };
    state.current = id;
  }
  function select(slot) {
    if (slot === 1 && state.primary) state.current = state.primary;
    if (slot === 2) state.current = state.secondary;
    state.reloading = 0;
    state.cooldown = 0.35;
    barrel.scale.z = state.current === 'marksman' ? 1.8 : state.current === 'smg' ? 0.6 : 1;
  }
  function refillAll() {
    for (const id of Object.keys(state.ammo)) { const w = WEAPONS[id]; state.ammo[id].mag = w.mag; state.ammo[id].reserve = w.reserve; }
  }
  function resetLoadout() {
    state.primary = null; state.current = 'sidearm';
    state.ammo = { sidearm: { mag: 12, reserve: 36 } }; state.charges = 0; select(2);
  }

  function canFire() { return state.cooldown <= 0 && state.reloading <= 0 && ammo().mag > 0; }
  function fire() {
    const w = def();
    ammo().mag -= 1;
    state.cooldown = 60 / w.rpm;
    state.bloom = Math.min(state.bloom + w.recoil * 0.6, 0.06);
    state.kick = 1;
    state.flashTime = 0.05;
  }
  function reload() {
    const a = ammo(); const w = def();
    if (state.reloading > 0 || a.mag >= w.mag || a.reserve <= 0) return false;
    state.reloading = w.reload;
    return true;
  }
  // Spread: base + movement penalty + sustained-fire bloom; crouch tightens.
  function spread(speed, crouching, airborne) {
    const w = def();
    let s = w.spread + state.bloom + w.moveSpread * Math.min(1, speed / 5);
    if (airborne) s += w.moveSpread * 1.5;
    if (crouching) s *= 0.6;
    return s;
  }
  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.bloom = Math.max(0, state.bloom - dt * 0.12);
    if (state.reloading > 0) {
      state.reloading -= dt;
      if (state.reloading <= 0) {
        const a = ammo(); const w = def();
        const need = w.mag - a.mag; const take = Math.min(need, a.reserve);
        a.mag += take; a.reserve -= take; state.reloading = 0;
      }
    }
    state.kick = Math.max(0, state.kick - dt * 10);
    state.flashTime = Math.max(0, state.flashTime - dt);
    flash.visible = state.flashTime > 0;
    group.position.z = -0.5 + state.kick * 0.04;
    group.rotation.x = state.kick * 0.08 + (state.reloading > 0 ? 0.5 : 0);
  }
  return { state, def, ammo, give, select, refillAll, resetLoadout, canFire, fire, reload, spread, step, group };
}
