// Pontuação: soma das mãos dos perdedores vai para o vencedor da rodada.
// Partida vai até targetScore (padrão 100).

import { tileSum } from './tiles.js';

export const TARGET_SCORE = 100;

export function handPoints(hand) {
  return hand.reduce((sum, tile) => sum + tileSum(tile), 0);
}

// Resultado da rodada.
// - dominoWinner != null: alguém bateu — leva a soma das mãos dos outros.
// - jogo fechado: menor mão vence e leva a soma das mãos dos outros;
//   empate na menor mão → ninguém pontua ('tie').
// Retorna { winner: number|null, points, reason, handPoints: number[] }.
export function roundResult(hands, dominoWinner = null) {
  const points = hands.map(handPoints);
  if (dominoWinner !== null) {
    const won = points.reduce((s, p, i) => (i === dominoWinner ? s : s + p), 0);
    return { winner: dominoWinner, points: won, reason: 'domino', handPoints: points };
  }
  const min = Math.min(...points);
  const holders = points
    .map((p, i) => (p === min ? i : -1))
    .filter((i) => i >= 0);
  if (holders.length > 1) {
    return { winner: null, points: 0, reason: 'tie', handPoints: points };
  }
  const winner = holders[0];
  const won = points.reduce((s, p, i) => (i === winner ? s : s + p), 0);
  return { winner, points: won, reason: 'blocked', handPoints: points };
}

// Aplica o resultado ao placar acumulado; retorna um novo array.
export function applyRoundScore(scores, result) {
  const next = scores.slice();
  if (result.winner !== null) next[result.winner] += result.points;
  return next;
}

// Índice do vencedor da partida, ou null se ninguém atingiu a meta.
export function matchWinner(scores, target = TARGET_SCORE) {
  let best = null;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] >= target && (best === null || scores[i] > scores[best])) {
      best = i;
    }
  }
  return best;
}
