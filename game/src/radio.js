// Radio: short team callouts from bots, rate-limited per speaker so the channel stays readable.
import { zoneAt } from './zones.js';

export function createRadio(hud) {
  const lastCall = new Map();
  let clock = 0;
  function say(speaker, text, minGap = 4) {
    const prev = lastCall.get(speaker) ?? -99;
    if (clock - prev < minGap) return;
    lastCall.set(speaker, clock);
    hud.radio(`${speaker}: ${text}`);
  }
  return {
    tick(dt) { clock += dt; },
    reset() { lastCall.clear(); },
    spotted(bot, enemy) { say(bot.name, `Contact, ${zoneAt(enemy.position.x, enemy.position.z)}!`); },
    heard(bot, pos) { say(bot.name, `Shots heard near ${zoneAt(pos.x, pos.z)}`, 6); },
    holding(bot) { say(bot.name, `Holding ${zoneAt(bot.position.x, bot.position.z)}`, 20); },
    planting(bot, site) { say(bot.name, `Arming the core on ${site}, cover me`, 10); },
    defusing(bot) { say(bot.name, 'Defusing, watch my back', 10); },
    down(bot) { say(bot.name, `Down! They hold ${zoneAt(bot.position.x, bot.position.z)}`, 8); },
  };
}
