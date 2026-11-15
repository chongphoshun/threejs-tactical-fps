// HUD: DOM readouts only. Game state is pushed in each frame and only written when it changed.
import { WEAPONS, EQUIPMENT } from './weapons.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    mag: $('ammo-mag'), reserve: $('ammo-reserve'), ammo: $('ammo'),
    you: $('score-you'), them: $('score-them'), side: $('side-tag'), timer: $('round-timer'), label: $('round-label'),
    healthFill: $('health-fill'), healthText: $('health-text'), money: $('money'), weapon: $('weapon-name'),
    objective: $('objective'), feed: $('killfeed'), radio: $('radio'), hit: $('hitmarker'), vignette: $('damage-vignette'),
    blind: $('blind'), progress: $('progress'), progressFill: $('progress-fill'), progressText: $('progress-text'),
    overlay: $('overlay'), title: $('overlay-title'), copy: $('overlay-copy'), play: $('play'),
    buy: $('buy-menu'), buyGrid: $('buy-grid'), buyMoney: $('buy-money'), buyReady: $('buy-ready'),
  };
  const last = new Map();
  // put: writes text only when it differs, so the per-frame HUD sync touches the DOM rarely.
  function put(node, key, text) { if (last.get(key) !== text) { last.set(key, text); node.textContent = text; } }
  let hitTimer = 0;
  function pushLine(box, text, max) {
    const d = document.createElement('div'); d.textContent = text; box.prepend(d);
    while (box.childElementCount > max) box.lastElementChild.remove();
  }

  return {
    setAmmo(mag, reserve) { put(el.mag, 'mag', String(mag)); put(el.reserve, 'res', `/ ${reserve}`); el.ammo.classList.toggle('empty', mag === 0); },
    setHealth(hp, armor, helmet) {
      const w = `${Math.max(0, hp)}%`;
      if (last.get('hpw') !== w) { last.set('hpw', w); el.healthFill.style.width = w; }
      put(el.healthText, 'hp', `HP ${Math.ceil(hp)}${armor > 0 ? ` · Vest ${Math.ceil(armor)}` : ''}${helmet ? ' · Helm' : ''}`);
    },
    setScore(you, them, team) { put(el.you, 'you', String(you)); put(el.them, 'them', String(them)); put(el.side, 'side', team === 'atk' ? 'ATTACK' : 'DEFEND'); el.side.className = team; },
    setTimer(seconds, label) {
      const s = Math.max(0, Math.ceil(seconds));
      put(el.timer, 'timer', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
      put(el.label, 'label', label);
    },
    setMoney(m) { put(el.money, 'money', `$${m}`); },
    setWeapon(name, extra) { put(el.weapon, 'weapon', extra ? `${name} · ${extra}` : name); },
    setObjective(text) { put(el.objective, 'obj', text); },
    setProgress(fraction, text) {
      el.progress.hidden = fraction <= 0;
      if (fraction > 0) { el.progressFill.style.width = `${Math.min(100, fraction * 100)}%`; put(el.progressText, 'prog', text); }
    },
    setBlind(amount) { const o = String(Math.min(1, amount).toFixed(2)); if (last.get('blind') !== o) { last.set('blind', o); el.blind.style.opacity = o; } },
    feed(text) { pushLine(el.feed, text, 5); },
    radio(text) { pushLine(el.radio, text, 4); },
    clearFeed() { el.feed.textContent = ''; el.radio.textContent = ''; },
    hitMarker(hold = 90) { el.hit.classList.add('on'); clearTimeout(hitTimer); hitTimer = setTimeout(() => el.hit.classList.remove('on'), hold); },
    hurt(amount) { el.vignette.style.opacity = String(Math.min(0.9, amount / 40)); setTimeout(() => { el.vignette.style.opacity = '0'; }, 160); },
    showOverlay(title, copy, button) { el.title.textContent = title; el.copy.textContent = copy; el.play.textContent = button; el.overlay.hidden = false; },
    hideOverlay() { el.overlay.hidden = true; },
    onPlay(fn) { el.play.addEventListener('click', fn); },
    onBuyReady(fn) { el.buyReady.addEventListener('click', fn); },
    // showBuy: the buy menu, every weapon and piece of equipment with its price, greyed when unaffordable.
    showBuy(money, owned, team, onBuy) {
      el.buyMoney.textContent = `Cash $${money} · pick your loadout`;
      el.buyGrid.textContent = '';
      const items = [];
      for (const [id, w] of Object.entries(WEAPONS)) if (w.price > 0) items.push({ id, name: w.name, price: w.price, info: `${w.dmg}${w.pellets > 1 ? `×${w.pellets}` : ''} dmg · ${w.mag} rds · ${w.auto ? 'auto' : 'semi'}` });
      for (const [id, e] of Object.entries(EQUIPMENT)) if (id !== 'kit' || team === 'def') items.push({ id, name: e.name, price: e.price, info: e.info });
      for (const it of items) {
        const b = document.createElement('button');
        b.className = 'buy-item' + (owned.has(it.id) ? ' owned' : '');
        b.type = 'button';
        b.disabled = it.price > money;
        const n = document.createElement('div'); n.textContent = it.name;
        const p = document.createElement('div'); p.className = 'price'; p.textContent = `$${it.price} · ${it.info}`;
        b.append(n, p);
        b.addEventListener('click', () => onBuy(it.id));
        el.buyGrid.append(b);
      }
      el.buy.hidden = false;
    },
    hideBuy() { el.buy.hidden = true; },
    buyOpen() { return !el.buy.hidden; },
  };
}
