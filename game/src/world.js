// Map "Nightveil Yard": a walled industrial courtyard with three lanes (north catwalk, mid alley, south vault).
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const W = 64; // map size X
const D = 44; // map size Z

// Procedural panel texture: our own art, drawn once at load.
function panelTexture(base, line, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = line; g.globalAlpha = 0.45; g.lineWidth = 3;
  g.strokeRect(2, 2, 124, 124);
  g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createWorld(scene) {
  const colliders = [];
  const shootables = [];
  const occluders = [];
  const mats = {
    floor: new THREE.MeshStandardMaterial({ color: PALETTE.floor, roughness: 0.92, map: panelTexture(PALETTE.floor, '#2b3543', 8) }),
    wall: new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.8, map: panelTexture(PALETTE.wall, '#46546a', 2) }),
    crate: new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.7, map: panelTexture('#8a6a48', '#5e4630', 1) }),
    metal: new THREE.MeshStandardMaterial({ color: PALETTE.metal, metalness: 0.6, roughness: 0.35 }),
    trim: new THREE.MeshStandardMaterial({ color: PALETTE.trim, emissive: PALETTE.trim, emissiveIntensity: 0.6 }),
    siteA: new THREE.MeshStandardMaterial({ color: PALETTE.plant, emissive: PALETTE.plant, emissiveIntensity: 0.25, transparent: true, opacity: 0.35 }),
  };

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  shootables.push(floor);

  function box(x, z, w, d, h, mat = mats.wall, y = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    const b = new THREE.Box3().setFromObject(m);
    colliders.push(b);
    shootables.push(m);
    occluders.push(m);
    if (h >= 4) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.08, d + 0.02), mats.trim);
      cap.position.set(x, y + h, z);
      scene.add(cap);
    }
    return m;
  }
  function trimLine(x, z, w, d) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mats.trim);
    t.position.set(x, 0.03, z);
    scene.add(t);
  }

  // Outer walls
  box(0, -D / 2, W, 1, 5);
  box(0, D / 2, W, 1, 5);
  box(-W / 2, 0, 1, D, 5);
  box(W / 2, 0, 1, D, 5);

  // Lane dividers (create north, mid, south lanes)
  box(-8, -7, 26, 1, 4);
  box(10, -7, 14, 1, 4);
  box(-12, 7, 18, 1, 4);
  box(8, 7, 22, 1, 4);

  // Cover crates / pillars
  const crates = [
    [-20, -14, 2, 2, 1.4], [-18, -16, 2, 2, 2.4], [-4, -14, 3, 2, 1.2], [6, -16, 2, 2, 1.6],
    [18, -14, 2, 3, 1.4], [-22, 0, 2, 2, 1.2], [-6, 2, 2, 2, 1.6], [4, -2, 2, 2, 1.2],
    [14, 2, 2, 2, 2.2], [-18, 15, 3, 2, 1.4], [-2, 14, 2, 2, 1.2], [12, 16, 2, 2, 1.6],
    [22, 12, 2, 2, 1.4], [24, -4, 2, 2, 1.2],
  ];
  for (const [x, z, w, d, h] of crates) box(x, z, w, d, h, h > 2 ? mats.metal : mats.crate);
  // Pillars
  for (const [x, z] of [[-14, 0], [0, 0], [10, -11], [-8, 11]]) box(x, z, 1.2, 1.2, 4.5, mats.metal);

  // Bomb sites (A: north-east, B: south-east) marked on the floor
  const sites = [
    { name: 'A', center: new THREE.Vector3(22, 0, -15), radius: 4 },
    { name: 'B', center: new THREE.Vector3(20, 0, 15), radius: 4 },
  ];
  for (const s of sites) {
    const ring = new THREE.Mesh(new THREE.CircleGeometry(s.radius, 40), mats.siteA);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.center.x, 0.02, s.center.z);
    scene.add(ring);
  }

  // Trim lines guide lanes
  trimLine(-4, -14.5, 40, 0.15);
  trimLine(0, 0, 50, 0.15);
  trimLine(-4, 14.5, 40, 0.15);

  // Lighting: cool moonlight + warm lamps over sites
  scene.add(new THREE.HemisphereLight('#b8cbe8', '#3a2e24', 1.5));
  scene.add(new THREE.AmbientLight('#8fa4c4', 0.5));
  const moon = new THREE.DirectionalLight('#dbe8ff', 2.4);
  moon.position.set(-20, 30, 10);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = -36; sc.right = 36; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 80;
  scene.add(moon);
  for (const s of sites) {
    const lamp = new THREE.PointLight(PALETTE.plant, 18, 16, 1.6);
    lamp.position.set(s.center.x, 4, s.center.z);
    scene.add(lamp);
  }
  const midLamp = new THREE.PointLight(PALETTE.trim, 10, 18, 1.8);
  midLamp.position.set(0, 4, 0);
  scene.add(midLamp);

  // Waypoints for bot routes (graph across lanes)
  const nodes = [
    [-26, -15], [-12, -12], [2, -12], [20, -11], [22, -15],
    [-26, 0], [-10, -3], [8, -4], [21, 0], [26, 0],
    [-26, 15], [-12, 12], [4, 11], [22, 11], [20, 15],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const links = [
    [0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [8, 9],
    [10, 11], [11, 12], [12, 13], [13, 14], [0, 5], [5, 10], [4, 9], [9, 14], [3, 8], [8, 13],
  ];
  const neighbors = nodes.map(() => []);
  for (const [a, b] of links) { neighbors[a].push(b); neighbors[b].push(a); }

  const spawns = {
    atk: [[-27, -3], [-27, 0], [-27, 3], [-25, -1.5], [-25, 1.5]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    def: [[26, -3], [26, 3], [24, -10], [24, 10], [27, 0]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  };

  return { colliders, shootables, occluders, sites, nodes, neighbors, spawns };
}

// Breadth-first route between waypoint indices
export function findRoute(world, from, to) {
  const prev = new Array(world.nodes.length).fill(-1);
  const seen = new Uint8Array(world.nodes.length);
  const queue = [from];
  seen[from] = 1;
  while (queue.length) {
    const n = queue.shift();
    if (n === to) break;
    for (const m of world.neighbors[n]) if (!seen[m]) { seen[m] = 1; prev[m] = n; queue.push(m); }
  }
  const path = [];
  for (let n = to; n !== -1; n = prev[n]) { path.unshift(n); if (n === from) break; }
  return path;
}

export function nearestNode(world, pos) {
  let best = 0; let bd = Infinity;
  world.nodes.forEach((n, i) => { const d = n.distanceToSquared(pos); if (d < bd) { bd = d; best = i; } });
  return best;
}
