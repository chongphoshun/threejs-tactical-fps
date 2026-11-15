// Frag charges: ballistic arc, bounce off floor, explode after a fuse with falloff damage.
import * as THREE from 'three';

const FUSE = 1.8, RADIUS = 6, MAX_DMG = 95, GRAVITY = 18;

export function createGrenades(scene) {
  const pool = [];
  const geo = new THREE.SphereGeometry(0.09, 10, 8);
  const mat = new THREE.MeshStandardMaterial({ color: '#c9d4e0', emissive: '#e85d4c', emissiveIntensity: 0.6 });
  const blastMat = new THREE.MeshBasicMaterial({ color: '#ffb057', transparent: true, opacity: 0.8 });
  const blastGeo = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < 6; i += 1) {
    const mesh = new THREE.Mesh(geo, mat); mesh.visible = false; scene.add(mesh);
    const blast = new THREE.Mesh(blastGeo, blastMat.clone()); blast.visible = false; scene.add(blast);
    pool.push({ mesh, blast, vel: new THREE.Vector3(), fuse: 0, active: false, blastTime: 0, owner: null });
  }

  function thrown(from, dir, owner) {
    const g = pool.find((p) => !p.active && p.blastTime <= 0);
    if (!g) return false;
    g.mesh.position.copy(from); g.vel.copy(dir).multiplyScalar(14); g.vel.y += 3;
    g.fuse = FUSE; g.active = true; g.mesh.visible = true; g.owner = owner;
    return true;
  }

  function step(dt, onExplode) {
    for (const g of pool) {
      if (g.active) {
        g.vel.y -= GRAVITY * dt;
        g.mesh.position.addScaledVector(g.vel, dt);
        if (g.mesh.position.y < 0.09) { g.mesh.position.y = 0.09; g.vel.y *= -0.35; g.vel.x *= 0.7; g.vel.z *= 0.7; }
        g.fuse -= dt;
        if (g.fuse <= 0) {
          g.active = false; g.mesh.visible = false;
          g.blast.position.copy(g.mesh.position); g.blast.visible = true; g.blastTime = 0.35;
          onExplode(g.mesh.position, RADIUS, MAX_DMG, g.owner);
        }
      } else if (g.blastTime > 0) {
        g.blastTime -= dt;
        const k = 1 - g.blastTime / 0.35;
        g.blast.scale.setScalar(0.5 + k * RADIUS * 0.6);
        g.blast.material.opacity = 0.8 * (1 - k);
        if (g.blastTime <= 0) g.blast.visible = false;
      }
    }
  }
  function clear() { for (const g of pool) { g.active = false; g.mesh.visible = false; g.blast.visible = false; g.blastTime = 0; } }
  return { thrown, step, clear };
}
