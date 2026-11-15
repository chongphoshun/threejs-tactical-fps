// Callout zones: named rectangles of the yard, used by radio calls, the minimap and the after-action report.
export const ZONES = [
  { name: 'Attacker Yard', x0: -32, x1: -21, z0: -22, z1: 22 },
  { name: 'Defender Dock', x0: 23, x1: 32, z0: -6, z1: 6 },
  { name: 'A Site', x0: 17, x1: 32, z0: -22, z1: -6 },
  { name: 'B Site', x0: 17, x1: 32, z0: 6, z1: 22 },
  { name: 'North Catwalk', x0: -21, x1: 17, z0: -22, z1: -7 },
  { name: 'South Vault', x0: -21, x1: 17, z0: 7, z1: 22 },
  { name: 'Mid Alley', x0: -21, x1: 23, z0: -7, z1: 7 },
];

export function zoneAt(x, z) {
  for (const zone of ZONES) if (x >= zone.x0 && x < zone.x1 && z >= zone.z0 && z < zone.z1) return zone.name;
  return 'the Yard';
}
