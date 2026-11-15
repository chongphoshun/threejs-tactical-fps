// Tracers: a fixed pool of line segments that fade out; no allocation per shot.
import * as THREE from 'three';

const COUNT = 48, LIFE = 0.09;

export function createTracers(scene) {
  const positions = new Float32Array(COUNT * 6);
  const colors = new Float32Array(COUNT * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  lines.frustumCulled = false;
  scene.add(lines);
  const life = new Float32Array(COUNT);
  const tint = new Float32Array(COUNT * 3);
  let next = 0;

  function add(from, to, r, g, b) {
    const i = next; next = (next + 1) % COUNT;
    const o = i * 6;
    positions[o] = from.x; positions[o + 1] = from.y; positions[o + 2] = from.z;
    positions[o + 3] = to.x; positions[o + 4] = to.y; positions[o + 5] = to.z;
    tint[i * 3] = r; tint[i * 3 + 1] = g; tint[i * 3 + 2] = b;
    life[i] = LIFE;
  }
  function step(dt) {
    for (let i = 0; i < COUNT; i += 1) {
      life[i] = Math.max(0, life[i] - dt);
      const k = life[i] / LIFE;
      for (let v = 0; v < 2; v += 1) {
        colors[i * 6 + v * 3] = tint[i * 3] * k;
        colors[i * 6 + v * 3 + 1] = tint[i * 3 + 1] * k;
        colors[i * 6 + v * 3 + 2] = tint[i * 3 + 2] * k;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  function hold() { life.fill(LIFE); step(0); } // screenshot freeze keeps them lit
  function clear() { life.fill(0); step(0); }
  return { add, step, hold, clear };
}
