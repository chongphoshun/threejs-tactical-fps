// Tiny WebAudio synth — no external samples, keeps the game offline.
let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}
function beep(freq, dur, type = 'square', gain = 0.04, slide = 0) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + dur);
}
export const sfx = {
  shoot() { beep(180, 0.06, 'sawtooth', 0.05, -120); },
  reload() { beep(220, 0.08, 'triangle', 0.03); setTimeout(() => beep(320, 0.1, 'triangle', 0.03), 120); },
  hit() { beep(520, 0.04, 'square', 0.03); },
  kill() { beep(140, 0.15, 'sawtooth', 0.05, -80); },
  plant() { beep(440, 0.2, 'sine', 0.04); },
  defuse() { beep(660, 0.25, 'sine', 0.04); },
  buy() { beep(880, 0.05, 'triangle', 0.03); },
  round() { beep(300, 0.3, 'triangle', 0.04); },
  hurt() { beep(90, 0.12, 'sawtooth', 0.05); },
};
