// Throwables: frag (falloff blast), fog canister (a smoke volume that blocks sight) and glare flash
// (blinds whoever faces it). One pool, ballistic arcs with floor bounces, a fuse per type.
import * as THREE from 'three';

const TYPES = {
  frag: { fuse: 1.8, color: '#e85d4c' },
  smoke: { fuse: 1.2, color: '#9aa7b8', lasts: 12, radius: 2.6 },
  flash: { fuse: 1.0, color: '#ffffff' },
};
const FRAG_RADIUS = 6, FRAG_DMG = 95, GRAVITY = 18;

export function createGrenades(scene) {
  const pool = [];
  const geo = new THREE.SphereGeometry(0.09, 10, 8);
  const blastGeo = new THREE.SphereGeometry(1, 16, 12);
  const smokeGeo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 8; i += 1) {
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#c9d4e0', emissiveIntensity: 0.8 }));
    const blast = new THREE.Mesh(blastGeo, new THREE.MeshBasicMaterial({ color: '#ffb057', transparent: true, opacity: 0.8, depthWrite: false }));
    const smoke = new THREE.Mesh(smokeGeo, new THREE.MeshStandardMaterial({ color: '#aab4c2', transparent: true, opacity: 0.92, roughness: 1, flatShading: true }));
    mesh.visible = blast.visible = smoke.visible = false;
    scene.add(mesh, blast, smoke);
    pool.push({ mesh, blast, smoke, type: 'frag', vel: new THREE.Vector3(), fuse: 0, active: false, blastTime: 0, smokeTime: 0, owner: null });
  }
  const smokes = []; // live smoke meshes, read by line-of-sight checks

  function thrown(type, from, dir, owner) {
    const g = pool.find((p) => !p.active && p.blastTime <= 0 && p.smokeTime <= 0);
    if (!g) return false;
    g.type = type;
    g.mesh.material.emissive.set(TYPES[type].color);
    g.mesh.position.copy(from); g.vel.copy(dir).multiplyScalar(14); g.vel.y += 3;
    g.fuse = TYPES[type].fuse; g.active = true; g.mesh.visible = true; g.owner = owner;
    return true;
  }

  function deploy(g, p) {
    g.smoke.position.set(p.x, 1.4, p.z); g.smoke.scale.setScalar(0.3); g.smoke.visible = true;
    g.smokeTime = TYPES.smoke.lasts; smokes.push(g.smoke);
  }

  function burst(g, handlers) {
    const p = g.mesh.position;
    if (g.type === 'frag') {
      g.blast.material.color.set('#ffb057'); g.blast.position.copy(p); g.blast.visible = true; g.blastTime = 0.35;
      handlers.frag(p, FRAG_RADIUS, FRAG_DMG, g.owner);
    } else if (g.type === 'flash') {
      g.blast.material.color.set('#ffffff'); g.blast.position.copy(p); g.blast.visible = true; g.blastTime = 0.2;
      handlers.flash(p, g.owner);
    } else {
      deploy(g, p);
      handlers.smoke(p, g.owner);
    }
  }

  function step(dt, handlers) {
    for (const g of pool) {
      if (g.active) {
        g.vel.y -= GRAVITY * dt;
        g.mesh.position.addScaledVector(g.vel, dt);
        if (g.mesh.position.y < 0.09) { g.mesh.position.y = 0.09; g.vel.y *= -0.35; g.vel.x *= 0.7; g.vel.z *= 0.7; }
        g.fuse -= dt;
        if (g.fuse <= 0) { g.active = false; g.mesh.visible = false; burst(g, handlers); }
      }
      if (g.blastTime > 0) {
        g.blastTime -= dt;
        const k = 1 - Math.max(0, g.blastTime) / 0.35;
        g.blast.scale.setScalar(0.5 + k * FRAG_RADIUS * 0.6);
        g.blast.material.opacity = 0.8 * (1 - k);
        if (g.blastTime <= 0) g.blast.visible = false;
      }
      if (g.smokeTime > 0) {
        g.smokeTime -= dt;
        const grow = Math.min(1, (TYPES.smoke.lasts - g.smokeTime) / 0.8);
        g.smoke.scale.set(TYPES.smoke.radius * grow, 1.9 * grow, TYPES.smoke.radius * grow);
        g.smoke.material.opacity = g.smokeTime < 1.5 ? 0.92 * (g.smokeTime / 1.5) : 0.92;
        if (g.smokeTime <= 0) { g.smoke.visible = false; smokes.splice(smokes.indexOf(g.smoke), 1); }
      }
    }
  }
  function clear() {
    for (const g of pool) { g.active = false; g.mesh.visible = g.blast.visible = g.smoke.visible = false; g.blastTime = 0; g.smokeTime = 0; }
    smokes.length = 0;
  }
  // placeSmoke: a fully grown fog cloud at a spot (screenshot setups only).
  function placeSmoke(p) {
    const g = pool.find((q) => !q.active && q.smokeTime <= 0);
    if (!g) return;
    deploy(g, p); g.smokeTime = TYPES.smoke.lasts - 1; step(0, null);
  }
  return { thrown, step, clear, smokes, placeSmoke };
}
