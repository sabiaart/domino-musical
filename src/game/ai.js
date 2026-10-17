// IA do computador — joga uma peça válida qualquer, por sorteio.
// A graça fica na aleatoriedade das peças, não em estratégia.

import { getEnds } from './board.js';
import { getPlayableTiles } from './rules.js';

// Decide a próxima ação do jogador `me`.
// Retorna { type: 'PLAY_TILE', tileId, side } | { type: 'DRAW_TILE' } | { type: 'PASS' }.
export function chooseAiAction(state, me, rng = Math.random) {
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

  const pick = options[Math.floor(rng() * options.length)];
  return { type: 'PLAY_TILE', player: me, tileId: pick.tile.id, side: pick.side };
}
