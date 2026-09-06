// Mesa: cadeia de peças orientadas, da ponta esquerda à direita.
// Cada item colocado: { tile, left, right } — left/right são os valores
// voltados para cada direção da cadeia.

import { isDouble } from './tiles.js';

export function getEnds(board) {
  if (board.length === 0) return null;
  return { left: board[0].left, right: board[board.length - 1].right };
}

// Em quais pontas a peça encaixa? Retorna subconjunto de ['left', 'right'].
// Mesa vazia: qualquer peça encaixa (convenção: lado 'right').
export function playableSides(tile, ends) {
  if (ends === null) return ['right'];
  const sides = [];
  if (tile.a === ends.left || tile.b === ends.left) sides.push('left');
  if (tile.a === ends.right || tile.b === ends.right) sides.push('right');
  return sides;
}

export function canPlay(tile, ends) {
  return playableSides(tile, ends).length > 0;
}

// Coloca a peça na ponta indicada, orientando-a automaticamente.
// Retorna uma nova mesa; lança erro se o encaixe for inválido.
export function placeTile(board, tile, side) {
  const ends = getEnds(board);
  if (ends === null) {
    return [{ tile, left: tile.a, right: tile.b }];
  }
  if (side === 'left') {
    if (tile.b === ends.left) {
      return [{ tile, left: tile.a, right: tile.b }, ...board];
    }
    if (tile.a === ends.left) {
      return [{ tile, left: tile.b, right: tile.a }, ...board];
    }
  } else if (side === 'right') {
    if (tile.a === ends.right) {
      return [...board, { tile, left: tile.a, right: tile.b }];
    }
    if (tile.b === ends.right) {
      return [...board, { tile, left: tile.b, right: tile.a }];
    }
  }
  throw new Error(`Peça ${tile.id} não encaixa na ponta ${side}`);
}

export function boardHasDoubleAt(placed) {
  return isDouble(placed.tile);
}

// Ordem em que as notas de uma peça recém-colocada devem soar: primeiro a que
// encostou na mesa, depois a que ficou de fora como nova ponta.
// A cadeia vai da ponta esquerda à direita, então uma peça nova no índice 0
// entrou pela esquerda — e nesse caso é o lado `right` dela que fez o encaixe.
export function placedNoteOrder(board, index) {
  const placed = board[index];
  const entrouPelaEsquerda = index === 0 && board.length > 1;
  return entrouPelaEsquerda
    ? [placed.right, placed.left]
    : [placed.left, placed.right];
}
