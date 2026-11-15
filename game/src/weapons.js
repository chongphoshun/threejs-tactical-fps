// Weapon and equipment tables, plus the player's arsenal: viewmodel, ammo, recoil and spread.
// Spread = base + movement penalty + sustained-fire bloom; crouching tightens it, airborne ruins it.
import * as THREE from 'three';

export const WEAPONS = {
  sidearm: { name: 'Vex Sidearm', price: 0, mag: 12, reserve: 36, rpm: 300, dmg: 28, head: 3.5, pellets: 1, spread: 0.008, moveSpread: 0.035, recoil: 0.012, reload: 1.6, auto: false, slot: 2, len: 0.6 },
  talon: { name: 'Talon Magnum', price: 700, mag: 7, reserve: 28, rpm: 160, dmg: 52, head: 2.8, pellets: 1, spread: 0.006, moveSpread: 0.05, recoil: 0.03, reload: 2.0, auto: false, slot: 2, len: 0.75 },
  smg: { name: 'Hornet SMG', price: 1200, mag: 25, reserve: 100, rpm: 800, dmg: 22, head: 2.5, pellets: 1, spread: 0.014, moveSpread: 0.025, recoil: 0.008, reload: 2.1, auto: true, slot: 1, len: 0.7 },
  breaker: { name: 'Breaker Shotgun', price: 1800, mag: 6, reserve: 24, rpm: 70, dmg: 16, head: 1.5, pellets: 8, spread: 0.05, moveSpread: 0.02, recoil: 0.04, reload: 2.8, auto: false, slot: 1, len: 1.0 },
  rifle: { name: 'Pulse Rifle', price: 2700, mag: 30, reserve: 90, rpm: 600, dmg: 34, head: 4, pellets: 1, spread: 0.004, moveSpread: 0.06, recoil: 0.014, reload: 2.4, auto: true, slot: 1, len: 1.0 },
  marksman: { name: 'Longwatch DMR', price: 4200, mag: 5, reserve: 20, rpm: 45, dmg: 110, head: 2, pellets: 1, spread: 0.0008, moveSpread: 0.12, recoil: 0.05, reload: 3.0, auto: false, slot: 1, len: 1.5 },
};
export const EQUIPMENT = {
  vest: { name: 'Kevlite Vest', price: 650, info: 'Absorbs half of body damage' },
  helmet: { name: 'Vest + Helm', price: 1000, info: 'Helm halves headshots' },
  frag: { name: 'Frag Charge', price: 300, info: 'Blast damage, G to throw' },
  smoke: { name: 'Fog Canister', price: 300, info: 'Blocks sight for 12 s' },
  flash: { name: 'Glare Flash', price: 200, info: 'Blinds anyone facing it' },
  kit: { name: 'Defuse Kit', price: 400, info: 'Defuse in 3 s instead of 5' },
};
export const THROWABLES = ['frag', 'smoke', 'flash'];

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
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
  flash.position.set(0, 0.02, -0.62); flash.visible = false;
  const flashLight = new THREE.PointLight('#ffc070', 0, 6, 2);
  flashLight.position.copy(flash.position);
  group.add(body, barrel, sight, mag, flash, flashLight);
  group.position.set(0.24, -0.21, -0.5);
  group.scale.setScalar(0.55);
  camera.add(group);

  const state = {
    primary: null, secondary: 'sidearm', current: 'sidearm',
    ammo: { sidearm: { mag: 12, reserve: 36 } },
    throwables: { frag: 0, smoke: 0, flash: 0 }, throwIndex: 0,
    kit: false, cooldown: 0, reloading: 0, bloom: 0, kick: 0, flashTime: 0,
  };
  const def = () => WEAPONS[state.current];
  const ammo = () => state.ammo[state.current];

  function shape() {
    const w = def();
    barrel.scale.y = w.len; barrel.position.z = -0.25 - 0.17 * w.len;
    flash.position.z = -0.45 - 0.17 * w.len;
  }
  function give(id) {
    const w = WEAPONS[id];
    if (w.slot === 1) state.primary = id; else state.secondary = id;
    state.ammo[id] = { mag: w.mag, reserve: w.reserve };
    state.current = id; shape();
  }
  function select(slot) {
    if (slot === 1 && state.primary) state.current = state.primary;
    if (slot === 2) state.current = state.secondary;
    state.reloading = 0; state.cooldown = 0.35; shape();
  }
  function refillAll() {
    for (const id of Object.keys(state.ammo)) { const w = WEAPONS[id]; state.ammo[id].mag = w.mag; state.ammo[id].reserve = w.reserve; }
  }
  function resetLoadout() {
    state.primary = null; state.secondary = 'sidearm'; state.current = 'sidearm';
    state.ammo = { sidearm: { mag: 12, reserve: 36 } };
    state.throwables.frag = 0; state.throwables.smoke = 0; state.throwables.flash = 0; state.kit = false;
    select(2);
  }
  // nextThrowable: cycles G's throwable to the next one the player holds.
  function nextThrowable() {
    for (let i = 1; i <= THROWABLES.length; i += 1) {
      const k = (state.throwIndex + i) % THROWABLES.length;
      if (state.throwables[THROWABLES[k]] > 0) { state.throwIndex = k; return; }
    }
  }
  function heldThrowable() {
    const id = THROWABLES[state.throwIndex];
    if (state.throwables[id] > 0) return id;
    nextThrowable();
    const other = THROWABLES[state.throwIndex];
    return state.throwables[other] > 0 ? other : null;
  }
  const canFire = () => state.cooldown <= 0 && state.reloading <= 0 && ammo().mag > 0;
  function fire() {
    const w = def();
    ammo().mag -= 1;
    state.cooldown = 60 / w.rpm;
    state.bloom = Math.min(state.bloom + w.recoil * 0.6, 0.06);
    state.kick = 1; state.flashTime = 0.05;
  }
  function reload() {
    const a = ammo(); const w = def();
    if (state.reloading > 0 || a.mag >= w.mag || a.reserve <= 0) return false;
    state.reloading = w.reload;
    return true;
  }
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
        const take = Math.min(w.mag - a.mag, a.reserve);
        a.mag += take; a.reserve -= take; state.reloading = 0;
      }
    }
    state.kick = Math.max(0, state.kick - dt * 10);
    state.flashTime = Math.max(0, state.flashTime - dt);
    flash.visible = state.flashTime > 0;
    flashLight.intensity = flash.visible ? 8 : 0;
    group.position.z = -0.5 + state.kick * 0.04;
    group.rotation.x = state.kick * 0.08 + (state.reloading > 0 ? 0.5 : 0);
  }
  function holdFlash() { state.flashTime = 1; flash.visible = true; flashLight.intensity = 8; }
  return { state, def, ammo, give, select, refillAll, resetLoadout, nextThrowable, heldThrowable, canFire, fire, reload, spread, step, holdFlash };
}
