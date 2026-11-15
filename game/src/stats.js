// Match record for the after-action report: bot trails, held spots, shots, kills and per-round economy.
// Every buffer is preallocated; recording never allocates during a round.
const TRAIL_POINTS = 240, MAX_SHOTS = 400, MAX_ROUNDS = 24;

export function createStats(botCount) {
  const trails = [];
  for (let i = 0; i < botCount; i += 1) trails.push({ xs: new Float32Array(TRAIL_POINTS), zs: new Float32Array(TRAIL_POINTS), n: 0, holdX: 0, holdZ: 0, held: false, team: 'atk', name: '' });
  const shots = [];
  for (let i = 0; i < MAX_SHOTS; i += 1) shots.push({ fx: 0, fz: 0, tx: 0, tz: 0, hit: false, head: false, shooter: '', victim: '', dmg: 0, part: '' });
  const economy = [];
  for (let i = 0; i < MAX_ROUNDS; i += 1) economy.push({ round: 0, start: 0, spent: 0, earned: 0, winner: '', reason: '' });
  const rec = { shotCount: 0, headshots: 0, hits: 0, kills: 0, roundCount: 0, sampleClock: 0 };

  function resetRound() {
    for (const t of trails) { t.n = 0; t.held = false; }
    rec.shotCount = 0; rec.headshots = 0; rec.hits = 0; rec.sampleClock = 0;
  }
  // recordTrail: samples each living bot's position twice a second.
  function recordTrail(dt, bots) {
    rec.sampleClock += dt;
    if (rec.sampleClock < 0.5) return;
    rec.sampleClock = 0;
    for (let i = 0; i < bots.length && i < trails.length; i += 1) {
      const b = bots[i]; const t = trails[i];
      t.team = b.team; t.name = b.name;
      if (!b.alive || t.n >= TRAIL_POINTS) continue;
      t.xs[t.n] = b.position.x; t.zs[t.n] = b.position.z; t.n += 1;
    }
  }
  // recordHold: the spot where a bot set up to hold an angle.
  function recordHold(index, x, z) { const t = trails[index]; if (t) { t.holdX = x; t.holdZ = z; t.held = true; } }
  // recordShot: one shot line, shooter to impact, with its outcome.
  function recordShot(shooter, fx, fz, tx, tz, victim, part, dmg) {
    if (rec.shotCount >= MAX_SHOTS) return;
    const s = shots[rec.shotCount]; rec.shotCount += 1;
    s.shooter = shooter; s.fx = fx; s.fz = fz; s.tx = tx; s.tz = tz;
    s.victim = victim; s.part = part; s.dmg = dmg; s.hit = !!victim; s.head = part === 'head';
    if (s.hit) rec.hits += 1;
    if (s.head) rec.headshots += 1;
  }
  // recordRound: closes the round's economy line.
  function recordRound(round, start, spent, earned, winner, reason) {
    const e = economy[Math.min(rec.roundCount, MAX_ROUNDS - 1)];
    Object.assign(e, { round, start, spent, earned, winner, reason });
    rec.roundCount = Math.min(MAX_ROUNDS, rec.roundCount + 1);
  }
  function resetMatch() { rec.roundCount = 0; resetRound(); }
  return { trails, shots, economy, rec, resetRound, resetMatch, recordTrail, recordHold, recordShot, recordRound };
}
