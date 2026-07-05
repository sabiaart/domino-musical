// IA do computador — três níveis.
// A IA só usa informação pública (mesa + log) e a própria mão.

import { isDouble, tileSum, tileHas, MAX_PIP } from './tiles.js';
import { getEnds, placeTile } from './board.js';
import { getPlayableTiles } from './rules.js';

export const AI_LEVELS = ['easy', 'medium', 'hard'];

// Decide a próxima ação do jogador `me`.
// Retorna { type: 'PLAY_TILE', tileId, side } | { type: 'DRAW_TILE' } | { type: 'PASS' }.
export function chooseAiAction(state, me, level = 'medium', rng = Math.random) {
  const ends = getEnds(state.board);
  const hand = state.hands[me];
  const playable = getPlayableTiles(hand, ends);

  if (playable.length === 0) {
    return state.boneyard.length > 0
      ? { type: 'DRAW_TILE', player: me }
      : { type: 'PASS', player: me };
  }

  const options = [];
  for (const { tile, sides } of playable) {
    for (const side of sides) {
      options.push({ tile, side });
    }
  }

  let pick;
  if (level === 'easy') {
    pick = options[Math.floor(rng() * options.length)];
  } else if (level === 'medium') {
    // Prioriza carroças, depois maior soma de pontos.
    pick = options.reduce((best, opt) => {
      if (!best) return opt;
      const score = (o) => (isDouble(o.tile) ? 100 : 0) + tileSum(o.tile);
      return score(opt) > score(best) ? opt : best;
    }, null);
  } else {
    pick = chooseHard(state, me, options, hand);
  }
  return { type: 'PLAY_TILE', player: me, tileId: pick.tile.id, side: pick.side };
}

// --- Nível difícil ---------------------------------------------------------

// Números que cada oponente demonstrou não ter (comprou/passou com essas pontas).
// Se depois jogou uma peça com o número, a inferência é descartada.
export function inferMissingNumbers(log, numPlayers, me) {
  const missing = [];
  for (let p = 0; p < numPlayers; p++) missing.push(new Set());
  for (const entry of log) {
    if (entry.player === me) continue;
    if ((entry.type === 'draw' || entry.type === 'pass') && entry.ends) {
      missing[entry.player].add(entry.ends.left);
      missing[entry.player].add(entry.ends.right);
    } else if (entry.type === 'play') {
      // Comprou e conseguiu esse número, ou a inferência estava errada.
      missing[entry.player].delete(entry.tile.a);
      missing[entry.player].delete(entry.tile.b);
    }
  }
  return missing;
}

function chooseHard(state, me, options, hand) {
  const missing = inferMissingNumbers(state.log, state.numPlayers, me);

  // Quantas peças de cada número ainda tenho na mão (controle das pontas).
  const suitCount = new Array(MAX_PIP + 1).fill(0);
  for (const t of hand) {
    suitCount[t.a]++;
    if (t.b !== t.a) suitCount[t.b]++;
  }

  let best = null;
  let bestScore = -Infinity;
  for (const opt of options) {
    const after = placeTile(state.board, opt.tile, opt.side);
    const newEnds = getEnds(after);
    let score = 0;

    // Bloqueio: pontas com números que os oponentes parecem não ter.
    for (let p = 0; p < state.numPlayers; p++) {
      if (p === me) continue;
      if (missing[p].has(newEnds.left)) score += 5;
      if (missing[p].has(newEnds.right)) score += 5;
    }

    // Controle: manter na mão respostas para as novas pontas.
    const remaining = hand.filter((t) => t.id !== opt.tile.id);
    score += remaining.filter((t) => tileHas(t, newEnds.left)).length * 1.5;
    score += remaining.filter((t) => tileHas(t, newEnds.right)).length * 1.5;

    // Livrar-se de pontos altos e de carroças (difíceis de encaixar no fim).
    score += tileSum(opt.tile) * 0.3;
    if (isDouble(opt.tile)) score += 2;

    // Naipes raros na mão: gastar agora enquanto a ponta permite.
    const other = opt.tile.a === newEnds.left || opt.tile.a === newEnds.right ? opt.tile.b : opt.tile.a;
    if (suitCount[other] <= 1) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }
  return best;
}
