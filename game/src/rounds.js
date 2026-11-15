// Round state machine and economy, MR12: buy -> live -> (armed) -> end; sides swap after round 12,
// first to 13 wins, 12 : 12 is a draw. Money is the player's own wallet.
export const ROUND = { BUY: 10, LIVE: 105, BOMB: 40, END: 5, PLANT: 3.2, DEFUSE: 5, KIT_DEFUSE: 3, HALF: 12, WIN_TARGET: 13 };
export const REWARD = { start: 800, win: 3250, loss: 1400, lossStreak: 500, kill: 300, plant: 300, defuse: 300, cap: 16000 };

export function createRounds() {
  const s = {
    number: 1, phase: 'buy', timer: ROUND.BUY, playerTeam: 'atk',
    sideScore: { you: 0, them: 0 }, money: REWARD.start, lossStreak: 0,
    winner: null, reason: '', matchOver: false, roundStartMoney: REWARD.start, roundSpent: 0, roundEarned: 0,
  };
  function startBuy() {
    s.phase = 'buy'; s.timer = ROUND.BUY; s.winner = null; s.reason = '';
    s.roundStartMoney = s.money; s.roundSpent = 0; s.roundEarned = 0;
  }
  function goLive() { s.phase = 'live'; s.timer = ROUND.LIVE; }
  function bombPlanted() { s.phase = 'planted'; s.timer = ROUND.BOMB; }
  // end: scores the round by side, pays the round bonus and says whether the match is decided.
  function end(winner, reason) {
    if (s.phase === 'end') return;
    s.phase = 'end'; s.timer = ROUND.END; s.winner = winner; s.reason = reason;
    const won = winner === s.playerTeam;
    if (won) { s.sideScore.you += 1; earn(REWARD.win); s.lossStreak = 0; }
    else { s.sideScore.them += 1; earn(REWARD.loss + REWARD.lossStreak * Math.min(s.lossStreak, 3)); s.lossStreak += 1; }
    if (s.sideScore.you >= ROUND.WIN_TARGET || s.sideScore.them >= ROUND.WIN_TARGET || s.number >= ROUND.HALF * 2) s.matchOver = true;
  }
  // next: advances the round; at the half the sides swap and every wallet resets.
  function next() {
    s.number += 1;
    if (s.number === ROUND.HALF + 1) {
      s.playerTeam = s.playerTeam === 'atk' ? 'def' : 'atk';
      s.money = REWARD.start; s.lossStreak = 0;
    }
    startBuy();
  }
  function reset() {
    Object.assign(s, { number: 1, playerTeam: 'atk', sideScore: { you: 0, them: 0 }, money: REWARD.start, lossStreak: 0, matchOver: false });
    startBuy();
  }
  function earn(amount) { const before = s.money; s.money = Math.min(REWARD.cap, s.money + amount); s.roundEarned += s.money - before; }
  function spend(amount) { if (s.money < amount) return false; s.money -= amount; s.roundSpent += amount; return true; }
  return { state: s, startBuy, goLive, bombPlanted, end, next, reset, earn, spend };
}
