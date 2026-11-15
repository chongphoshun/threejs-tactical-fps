// Player body: acceleration-based movement, crouch, jump, axis-separated AABB collision.
import * as THREE from 'three';

const RADIUS = 0.34;
const STAND_H = 1.72, CROUCH_H = 1.12;
const STAND_EYE = 1.6, CROUCH_EYE = 1.02;
const RUN = 5.4, CROUCH_RUN = 2.2, WALK = 2.8;
const ACCEL = 40, AIR_ACCEL = 8, FRICTION = 10, GRAVITY = 20, JUMP = 6.0;

export function createPlayer(colliders) {
  const body = {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    yaw: 0, pitch: 0, eye: STAND_EYE,
    onGround: true, crouching: false, height: STAND_H,
    health: 100, armor: 0, alive: true, team: 'atk',
  };
  const probe = new THREE.Box3();
  const wish = new THREE.Vector3();

  function overlaps(x, y, z, h, lift) {
    probe.min.set(x - RADIUS, y + lift, z - RADIUS);
    probe.max.set(x + RADIUS, y + h - lift, z + RADIUS);
    for (const c of colliders) if (probe.intersectsBox(c)) return c;
    return null;
  }
  function look(dx, dy, sens = 0.0022) {
    body.yaw -= dx * sens;
    body.pitch = Math.max(-1.45, Math.min(1.45, body.pitch - dy * sens));
  }
  function recoil(p, y) { body.pitch = Math.min(1.45, body.pitch + p); body.yaw += y; }

  function step(dt, keys) {
    if (!body.alive) return;
    const wantCrouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    if (wantCrouch && !body.crouching) { body.crouching = true; body.height = CROUCH_H; }
    else if (!wantCrouch && body.crouching && !overlaps(body.position.x, body.position.y, body.position.z, STAND_H, 0.02)) { body.crouching = false; body.height = STAND_H; }
    body.eye += ((body.crouching ? CROUCH_EYE : STAND_EYE) - body.eye) * Math.min(1, dt * 12);

    const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    wish.set(0, 0, 0);
    if (f || s) {
      const sn = Math.sin(body.yaw), cs = Math.cos(body.yaw);
      wish.set(-sn * f + cs * s, 0, -cs * f - sn * s).normalize();
    }
    const speed = body.crouching ? CROUCH_RUN : keys.has('ShiftLeft') ? WALK : RUN;
    const blend = Math.min(1, (body.onGround ? ACCEL : AIR_ACCEL) * dt / speed);
    body.velocity.x += (wish.x * speed - body.velocity.x) * blend;
    body.velocity.z += (wish.z * speed - body.velocity.z) * blend;
    if (body.onGround && !wish.lengthSq()) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      body.velocity.x *= damp; body.velocity.z *= damp;
    }
    if (keys.has('Space') && body.onGround) { body.velocity.y = JUMP; body.onGround = false; }
    body.velocity.y = Math.max(-30, body.velocity.y - GRAVITY * dt);

    const nx = body.position.x + body.velocity.x * dt;
    if (!overlaps(nx, body.position.y, body.position.z, body.height, 0.04)) body.position.x = nx; else body.velocity.x = 0;
    const nz = body.position.z + body.velocity.z * dt;
    if (!overlaps(body.position.x, body.position.y, nz, body.height, 0.04)) body.position.z = nz; else body.velocity.z = 0;
    body.position.y += body.velocity.y * dt;
    body.onGround = false;
    const hit = overlaps(body.position.x, body.position.y, body.position.z, body.height, 0);
    if (hit && body.velocity.y <= 0) { body.position.y = hit.max.y; body.velocity.y = 0; body.onGround = true; }
    else if (hit) { body.position.y = hit.min.y - body.height; body.velocity.y = 0; }
    if (body.position.y <= 0) { body.position.y = 0; body.velocity.y = 0; body.onGround = true; }
  }

  function damage(amount) {
    if (!body.alive) return false;
    let dmg = amount;
    if (body.armor > 0) { const absorbed = Math.min(body.armor, dmg * 0.5); body.armor -= absorbed; dmg -= absorbed; }
    body.health = Math.max(0, body.health - dmg);
    if (body.health <= 0) body.alive = false;
    return !body.alive;
  }
  function spawn(pos, yaw) {
    body.position.copy(pos); body.velocity.set(0, 0, 0);
    body.yaw = yaw; body.pitch = 0; body.health = 100; body.alive = true;
    body.crouching = false; body.height = STAND_H; body.eye = STAND_EYE;
  }
  return { state: body, step, look, recoil, damage, spawn, groundSpeed: () => Math.hypot(body.velocity.x, body.velocity.z) };
}
