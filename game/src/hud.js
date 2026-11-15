// HUD: DOM readouts only; game state is pushed in, never read back.
import { WEAPONS, EQUIPMENT } from './weapons.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    mag: $('ammo-mag'), reserve: $('ammo-reserve'), ammo: $('ammo'),
    atk: $('score-atk'), def: $('score-def'), timer: $('round-timer'), label: $('round-label'),
    healthFill: $('health-fill'), healthText: $('health-text'), money: $('money'), weapon: $('weapon-name'),
    objective: $('objective'), feed: $('killfeed'), hit: $('hitmarker'), vignette: $('damage-vignette'),
    overlay: $('overlay'), title: $('overlay-title'), copy: $('overlay-copy'), play: $('play'),
    buy: $('buy-menu'), buyGrid: $('buy-grid'), buyMoney: $('buy-money'), buyReady: $('buy-ready'),
  };
  let hitTimer = 0;
  const feedItems = [];

  return {
    setAmmo(mag, reserve) { el.mag.textContent = mag; el.reserve.textContent = `/ ${reserve}`; el.ammo.classList.toggle('empty', mag === 0); },
    setHealth(hp, armor) { el.healthFill.style.width = `${hp}%`; el.healthText.textContent = armor > 0 ? `HP ${Math.ceil(hp)} · Vest ${Math.ceil(armor)}` : `HP ${Math.ceil(hp)}`; },
    setScore(atk, def) { el.atk.textContent = atk; el.def.textContent = def; },
    setTimer(seconds, label) {
      const s = Math.max(0, Math.ceil(seconds));
      el.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      el.label.textContent = label;
    },
    setMoney(m) { el.money.textContent = `$${m}`; },
    setWeapon(name, charges) { el.weapon.textContent = charges ? `${name} · Charges ${charges}` : name; },
    setObjective(text) { el.objective.textContent = text; },
    feed(text) {
      const d = document.createElement('div'); d.textContent = text; el.feed.prepend(d); feedItems.push(d);
      if (feedItems.length > 5) feedItems.shift().remove();
    },
    clearFeed() { for (const d of feedItems) d.remove(); feedItems.length = 0; },
    hitMarker(hold = 90) { el.hit.classList.add('on'); clearTimeout(hitTimer); hitTimer = setTimeout(() => el.hit.classList.remove('on'), hold); },
    hurt(amount) { el.vignette.style.opacity = String(Math.min(0.9, amount / 40)); setTimeout(() => { el.vignette.style.opacity = '0'; }, 160); },
    showOverlay(title, copy, button) { el.title.textContent = title; el.copy.textContent = copy; el.play.textContent = button; el.overlay.hidden = false; },
    hideOverlay() { el.overlay.hidden = true; },
    onPlay(fn) { el.play.addEventListener('click', fn); },
    onBuyReady(fn) { el.buyReady.addEventListener('click', fn); },
    showBuy(money, owned, onBuy) {
      el.buyMoney.textContent = `Cash $${money} · pick your loadout`;
      el.buyGrid.textContent = '';
      const items = [
        ...Object.entries(WEAPONS).filter(([, w]) => w.price > 0).map(([id, w]) => ({ id, name: w.name, price: w.price, info: `${w.dmg} dmg · ${w.mag} rounds` })),
        ...Object.entries(EQUIPMENT).map(([id, e]) => ({ id, name: e.name, price: e.price, info: id === 'charge' ? 'Throwable frag (G)' : 'Absorbs half of damage' })),
      ];
      for (const it of items) {
        const b = document.createElement('button');
        b.className = 'buy-item' + (owned.has(it.id) ? ' owned' : '');
        b.type = 'button';
        b.disabled = it.price > money;
        b.innerHTML = `<div>${it.name}</div><div class="price">$${it.price} · ${it.info}</div>`;
        b.addEventListener('click', () => onBuy(it.id));
        el.buyGrid.append(b);
      }
      el.buy.hidden = false;
    },
    hideBuy() { el.buy.hidden = true; },
    buyOpen() { return !el.buy.hidden; },
  };
}
