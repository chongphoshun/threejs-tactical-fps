export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const state = { keys, firing: false, lookX: 0, lookY: 0 };
  let locked = false;

  function onKey(e, down) {
    if (e.code) {
      if (down) keys.add(e.code); else keys.delete(e.code);
      if (down && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
    }
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) state.firing = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.firing = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!locked) return;
    state.lookX += e.movementX;
    state.lookY += e.movementY;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    onLockChange(locked);
  });

  return {
    state,
    requestLock() { canvas.requestPointerLock(); },
    takeLook() {
      const x = state.lookX; const y = state.lookY;
      state.lookX = 0; state.lookY = 0;
      return { x, y };
    },
    consume(code) {
      if (!keys.has(code)) return false;
      keys.delete(code);
      return true;
    },
  };
}
