// Regras do dominó "Draw" (compra).

import { isDouble, tileSum } from './tiles.js';
import { getEnds, playableSides, canPlay } from './board.js';

// Quem começa: maior carroça; se ninguém tiver carroça, a peça de maior soma
// (desempate: maior valor alto). Retorna { player, tile }.
export function findStartingPlayer(hands) {
  let best = null;
  for (let p = 0; p < hands.length; p++) {
    for (const tile of hands[p]) {
      if (!isDouble(tile)) continue;
      if (best === null || tile.a > best.tile.a) {
        best = { player: p, tile };
      }
    }
  }
  if (best) return best;
  for (let p = 0; p < hands.length; p++) {
    for (const tile of hands[p]) {
      if (
        best === null ||
        tileSum(tile) > tileSum(best.tile) ||
        (tileSum(tile) === tileSum(best.tile) && tile.b > best.tile.b)
      ) {
        best = { player: p, tile };
      }
    }
  }
  return best;
}

// Peças jogáveis da mão com as pontas dadas: [{ tile, sides }].
export function getPlayableTiles(hand, ends) {
  const result = [];
  for (const tile of hand) {
    const sides = playableSides(tile, ends);
    if (sides.length > 0) result.push({ tile, sides });
  }
  return result;
}

export function hasPlayableTile(hand, ends) {
  return hand.some((tile) => canPlay(tile, ends));
}

// Deve comprar: não tem jogada e o monte não está vazio.
export function mustDraw(hand, ends, boneyard) {
  return !hasPlayableTile(hand, ends) && boneyard.length > 0;
}

// Deve passar: não tem jogada e o monte está vazio.
export function mustPass(hand, ends, boneyard) {
  return !hasPlayableTile(hand, ends) && boneyard.length === 0;
}

// Jogo fechado: monte vazio e nenhum jogador consegue jogar.
export function isBlocked(hands, board, boneyard) {
  if (boneyard.length > 0) return false;
  const ends = getEnds(board);
  return hands.every((hand) => !hasPlayableTile(hand, ends));
}
