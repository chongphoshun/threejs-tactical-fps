// Shared top-down drawing of the yard on a 2D canvas, used by the minimap and the after-action report.
import { PALETTE } from './palette.js';
import { ZONES } from './zones.js';

export const MAP_W = 64, MAP_D = 44;

export function drawYard(g, world, scale, ox, oy, labels) {
  const X = (x) => ox + (x + MAP_W / 2) * scale;
  const Z = (z) => oy + (z + MAP_D / 2) * scale;
  g.fillStyle = PALETTE.floor; g.fillRect(X(-MAP_W / 2), Z(-MAP_D / 2), MAP_W * scale, MAP_D * scale);
  for (const s of world.sites) {
    g.fillStyle = 'rgba(240,180,41,0.28)';
    g.beginPath(); g.arc(X(s.center.x), Z(s.center.z), s.radius * scale, 0, Math.PI * 2); g.fill();
    g.fillStyle = PALETTE.plant; g.font = `bold ${Math.max(9, scale * 2.2)}px system-ui`; g.textAlign = 'center';
    g.fillText(s.name, X(s.center.x), Z(s.center.z) + scale);
  }
  g.fillStyle = PALETTE.wall;
  for (const r of world.rects) g.fillRect(X(r.x - r.w / 2), Z(r.z - r.d / 2), r.w * scale, r.d * scale);
  if (labels) {
    g.fillStyle = PALETTE.muted ?? '#8b9bb0'; g.font = `${Math.max(9, scale * 1.4)}px system-ui`; g.textAlign = 'center';
    for (const zone of ZONES) if (!zone.name.endsWith('Site')) g.fillText(zone.name, X((zone.x0 + zone.x1) / 2), Z((zone.z0 + zone.z1) / 2) - scale * 2.2);
  }
  return { X, Z };
}

export function dot(g, x, y, r, color) { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
