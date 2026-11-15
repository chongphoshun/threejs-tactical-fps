// After-action report: a rendered debrief of the last round, drawn from stats.js's record.
// Each layer is labelled with the function that recorded it, so what you see is traceable to code.
import { PALETTE } from './palette.js';
import { drawYard, dot } from './mapdraw.js';

export function createReport(world) {
  const panel = document.getElementById('report');
  const canvas = document.getElementById('report-map');
  const log = document.getElementById('report-log');
  const g = canvas.getContext('2d');

  function legend(y, color, text) {
    g.fillStyle = color; g.fillRect(14, y - 8, 12, 4);
    g.fillStyle = '#c8d3e0'; g.font = '12px ui-monospace, monospace'; g.textAlign = 'left'; g.fillText(text, 32, y - 3);
  }

  // show: paints routes (recordTrail), held spots (recordHold), sightlines (recordShot) and the economy (recordRound).
  function show(stats, round, score) {
    const scale = (canvas.width - 20) / 64;
    g.fillStyle = PALETTE.canvas; g.fillRect(0, 0, canvas.width, canvas.height);
    const { X, Z } = drawYard(g, world, scale, 10, 10, true);
    for (const t of stats.trails) {
      if (t.n < 2) continue;
      g.strokeStyle = t.team === 'atk' ? 'rgba(232,93,76,0.85)' : 'rgba(76,143,232,0.85)';
      g.lineWidth = 2; g.setLineDash([]);
      g.beginPath(); g.moveTo(X(t.xs[0]), Z(t.zs[0]));
      for (let i = 1; i < t.n; i += 1) g.lineTo(X(t.xs[i]), Z(t.zs[i]));
      g.stroke();
      if (t.held) {
        g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(X(t.holdX), Z(t.holdZ), 6, 0, Math.PI * 2); g.stroke();
      }
    }
    for (let i = 0; i < stats.rec.shotCount; i += 1) {
      const s = stats.shots[i];
      if (!s.hit) continue;
      g.strokeStyle = s.head ? PALETTE.plant : 'rgba(232,238,246,0.45)';
      g.lineWidth = s.head ? 1.6 : 1; g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(X(s.fx), Z(s.fz)); g.lineTo(X(s.tx), Z(s.tz)); g.stroke();
      if (s.head) dot(g, X(s.tx), Z(s.tz), 3, PALETTE.plant);
    }
    g.setLineDash([]);
    const ly = canvas.height - 64;
    legend(ly, PALETTE.atk, 'attacker route  \u2190 stats.recordTrail()');
    legend(ly + 16, PALETTE.def, 'defender route  \u2190 stats.recordTrail()');
    legend(ly + 32, '#ffffff', 'held position \u25CB \u2190 stats.recordHold()');
    legend(ly + 48, PALETTE.plant, 'sightline of a hit, gold = headshot \u2190 stats.recordShot()');

    log.textContent = '';
    const add = (text, cls) => { const d = document.createElement('div'); d.textContent = text; if (cls) d.className = cls; log.append(d); };
    add(`Round ${round} · you ${score.you} : ${score.them} enemy`, 'h');
    add(`Shots ${stats.rec.shotCount} · hits ${stats.rec.hits} · headshots ×${stats.rec.headshots}  \u2190 recordShot()`);
    add('Shot log', 'h');
    let listed = 0;
    for (let i = 0; i < stats.rec.shotCount && listed < 9; i += 1) {
      const s = stats.shots[i];
      if (!s.hit) continue;
      listed += 1;
      add(`${s.shooter} \u25B8 ${s.victim} · ${s.part}${s.head ? ' ◎' : ''} · ${Math.round(s.dmg)} dmg`);
    }
    add('Economy per round  \u2190 recordRound()', 'h');
    for (let i = 0; i < stats.rec.roundCount; i += 1) {
      const e = stats.economy[i];
      add(`R${e.round}  start $${e.start}  spent $${e.spent}  +$${e.earned}  ${e.winner === 'atk' ? 'ATK' : 'DEF'} · ${e.reason}`);
    }
    panel.hidden = false;
  }
  return { show, hide() { panel.hidden = true; }, open: () => !panel.hidden };
}
