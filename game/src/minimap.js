// Minimap: the yard from above, your team always, enemies only while a teammate sees them, the core when known.
import { PALETTE } from './palette.js';
import { drawYard, dot, MAP_W } from './mapdraw.js';

export function createMinimap(world) {
  const canvas = document.getElementById('minimap');
  const g = canvas.getContext('2d');
  const scale = canvas.width / MAP_W;
  let clock = 0;
  return {
    // draw: repaints at 15 Hz from the simulation's state, never on its own clock.
    draw(dt, player, bots, bomb, playerTeam) {
      clock += dt; if (clock < 1 / 15) return; clock = 0;
      g.clearRect(0, 0, canvas.width, canvas.height);
      const { X, Z } = drawYard(g, world, scale, 0, 0, false);
      for (const b of bots) {
        if (!b.group.visible) continue;
        const mine = b.team === playerTeam;
        if (!mine && !b.spotted) continue;
        dot(g, X(b.position.x), Z(b.position.z), b.alive ? 3 : 2, b.alive ? (b.team === 'atk' ? PALETTE.atk : PALETTE.def) : '#555');
      }
      if (bomb.planted || bomb.carrier === 'player') dot(g, X(bomb.planted ? bomb.position.x : player.position.x), Z(bomb.planted ? bomb.position.z : player.position.z), 4, PALETTE.plant);
      // the player: an arrow along the view
      const px = X(player.position.x), pz = Z(player.position.z);
      g.strokeStyle = PALETTE.trim; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px, pz); g.lineTo(px - Math.sin(player.yaw) * 10, pz - Math.cos(player.yaw) * 10); g.stroke();
      dot(g, px, pz, 3.5, '#ffffff');
    },
  };
}
