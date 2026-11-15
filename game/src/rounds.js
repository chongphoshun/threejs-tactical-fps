// Round state machine and economy: buy -> live -> (planted) -> end. First to 7 rounds wins the match.
export const ROUND = { BUY: 8, LIVE: 105, BOMB: 40, END: 5, PLANT: 3.2, DEFUSE: 5, WIN_TARGET: 7 };
export const REWARD = { win: 3250, loss: 1400, lossStreak: 500, kill: 300, plant: 300, cap: 16000 };

export function createRounds() {
  const s = {
    number: 1, phase: 'buy', timer: ROUND.BUY,
    score: { atk: 0, def: 0 }, money: 800, lossStreak: 0,
    winner: null, reason: '', matchOver: false,
  };
  function startBuy() { s.phase = 'buy'; s.timer = ROUND.BUY; s.winner = null; s.reason = ''; }
  function goLive() { s.phase = 'live'; s.timer = ROUND.LIVE; }
  function bombPlanted() { s.phase = 'planted'; s.timer = ROUND.BOMB; }
  function end(winner, reason, playerTeam) {
    if (s.phase === 'end') return;
    s.phase = 'end'; s.timer = ROUND.END; s.winner = winner; s.reason = reason;
    s.score[winner] += 1;
    if (winner === playerTeam) { s.money += REWARD.win; s.lossStreak = 0; }
    else { s.money += REWARD.loss + REWARD.lossStreak * Math.min(s.lossStreak, 3); s.lossStreak += 1; }
    s.money = Math.min(REWARD.cap, s.money);
    if (s.score[winner] >= ROUND.WIN_TARGET) s.matchOver = true;
  }
  function next() { s.number += 1; startBuy(); }
  function reset() { Object.assign(s, { number: 1, score: { atk: 0, def: 0 }, money: 800, lossStreak: 0, matchOver: false }); startBuy(); }
  function earn(amount) { s.money = Math.min(REWARD.cap, s.money + amount); }
  function spend(amount) { if (s.money < amount) return false; s.money -= amount; return true; }
  return { state: s, startBuy, goLive, bombPlanted, end, next, reset, earn, spend };
}
