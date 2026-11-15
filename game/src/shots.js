// Screenshot setups: each drives the real game modules with scripted inputs on a fixed seed, renders,
// then freezes and sets window.__shotReady. Nothing here draws anything the game itself does not.
export function runShot(name, g) {
  const { THREE, FIXED, body, botsys, R, hud } = g;
  const settle = (n) => { for (let i = 0; i < n; i += 1) g.step(FIXED); };
  const aimAt = (x, y, z) => {
    const dx = x - body.position.x, dy = y - (body.position.y + body.eye), dz = z - body.position.z;
    body.yaw = Math.atan2(-dx, -dz);
    body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / (Math.hypot(dx, dy, dz) || 1))));
    g.syncCamera();
  };
  const enemies = () => botsys.bots.filter((b) => b.team !== R.playerTeam);
  const allies = () => botsys.bots.filter((b) => b.team === R.playerTeam);
  const park = (b, x, z, yaw) => { b.position.set(x, 0, z); b.mode = 'hold'; b.holdTime = 999; b.holdYaw = yaw; b.yaw = yaw; b.route = []; };
  const goLive = () => { R.timer = 0; settle(1); };
  hud.hideOverlay();

  if (name === 'buy') {
    R.number = 3; R.sideScore.you = 1; R.sideScore.them = 1; R.money = 4650;
    g.startRound();
    aimAt(0, 1.5, 0);
    g.syncHud();
    hud.showBuy(R.money, g.owned, R.playerTeam, g.buy);
  } else if (name === 'fight') {
    R.number = 7; R.sideScore.you = 4; R.sideScore.them = 2; R.money = 6200;
    g.startRound(); g.buy('rifle'); g.buy('helmet'); g.buy('smoke'); g.buy('flash'); hud.hideBuy();
    R.money = 2950;
    goLive();
    const foes = enemies(), mates = allies();
    park(foes[0], 13.5, -3.2, Math.PI / 2); park(foes[1], 16, 2.5, Math.PI / 2);
    for (let i = 2; i < foes.length; i += 1) park(foes[i], 26, 14 - i, Math.PI / 2);
    park(mates[0], 2.5, 3.6, -Math.PI / 2); park(mates[1], -3, -4.6, -Math.PI / 2);
    park(mates[2], -26, 15, -Math.PI / 2); park(mates[3], -26, -15, -Math.PI / 2);
    body.position.set(6, 0, -1.6);
    settle(4);
    g.grenades.placeSmoke(new THREE.Vector3(18, 0, 5.2));
    park(foes[0], 13.5, -3.2, Math.PI / 2); park(foes[1], 17, 1.2, Math.PI / 2);
    // a firefight: allies trade with the near defender, the player takes the far one's head
    botsys.kill(foes[2]); foes[2].position.set(10, 0.2, -5); hud.feed('Rook ▸ Sable · Hornet SMG');
    body.health = 71; body.armor = 64;
    aimAt(13.5, 1.65, -3.2);
    g.combat.playerShoot();
    g.combat.botShot(mates[0], foes[1], true, false, 22);
    g.combat.botShot(foes[1], mates[0], false, false, 0); foes[1].flashTime = 9; foes[1].muzzle.visible = true;
    g.combat.botShot(mates[1], foes[0], true, false, 18);
    aimAt(14.2, 1.45, -2.6);
    R.timer = 71;
    g.tracers.hold(); g.arsenal.holdFlash();
    for (const b of foes) { b.spotted = true; b.spottedTime = 9; }
    hud.radio('Ember: Contact, Mid Alley!'); hud.radio('Rook: Fog down south mid, pushing');
    hud.setObjective('Carry the Pulse Core to site A or B — hold E on the site to arm it');
  } else if (name === 'plant') {
    // second half: the player defends and defuses with a kit while a teammate covers
    R.number = 12; R.sideScore.you = 7; R.sideScore.them = 4;
    g.rounds.end('atk', 'warm-up'); R.sideScore.you = 7; R.sideScore.them = 4; g.rounds.next();
    R.money = 4100; g.startRound(); g.buy('rifle'); g.buy('kit'); g.buy('vest'); hud.hideBuy();
    goLive();
    const foes = enemies(), mates = allies();
    for (let i = 0; i < foes.length; i += 1) { park(foes[i], 26 - i, -20 + i * 0.6, 0); if (i < 4) botsys.kill(foes[i]); }
    foes[4].position.set(-26, 0, 15);
    park(mates[0], 18.5, -10, Math.PI); park(mates[1], 24, -11, Math.PI);
    g.objective.plant(new THREE.Vector3(21.2, 0, -15.6), 'Kite');
    R.timer = 19;
    body.position.set(20.4, 0, -14.4);
    settle(1);
    for (let i = 0; i < 110; i += 1) g.objective.tryDefuse(FIXED, 'You', body.position, true, true);
    body.health = 64;
    aimAt(21.2, 0.3, -15.6);
    body.crouching = true; body.eye = 1.02; aimAt(21.2, 0.3, -15.6);
    body.yaw += 0.18; body.pitch += 0.12; g.syncCamera();
    hud.setObjective('Defusing the Pulse Core — keep holding E');
    hud.radio('Slate: Covering you on A, go go');
  } else if (name === 'report') {
    // three bot-only rounds on the seed, the player held back in spawn; the report shows the last one
    for (let round = 0; round < 3; round += 1) {
      g.startRound(); if (round === 0) { g.buy('smg'); } hud.hideBuy();
      goLive();
      body.position.set(-30, 0, 20);
      g.player.damage(999); g.objective.handToBot(botsys.bots);
      let steps = 0;
      while (R.phase !== 'end' && steps < 60 * 110) { g.step(FIXED); steps += 1; }
      if (R.phase !== 'end') g.endRound('def', 'time ran out');
      if (round < 2) { g.rounds.next(); }
    }
    g.report.show(g.stats, R.number, R.sideScore);
  }
  g.syncHud();
  g.minimap.draw(1, body, botsys.bots, g.objective.bomb, R.playerTeam);
  let painted = 0;
  function paint() {
    if (painted >= 3) { window.__shotReady = true; g.setFrozen(true); return; }
    requestAnimationFrame(paint);
    g.syncCamera(); g.renderer.render(g.scene, g.camera); painted += 1;
  }
  requestAnimationFrame(paint);
}
