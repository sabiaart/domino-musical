import { describe, it, expect } from 'vitest';
import { getEnds, playableSides, canPlay, placeTile } from '../board.js';
import { makeTile } from '../tiles.js';

describe('board', () => {
  it('mesa vazia: sem pontas e qualquer peça encaixa', () => {
    expect(getEnds([])).toBeNull();
    expect(canPlay(makeTile(0, 0), null)).toBe(true);
    expect(playableSides(makeTile(3, 5), null)).toEqual(['right']);
  });

  it('primeira peça define as duas pontas', () => {
    const board = placeTile([], makeTile(2, 5), 'right');
    expect(getEnds(board)).toEqual({ left: 2, right: 5 });
  });

  it('encaixa na ponta direita com orientação automática', () => {
    let board = placeTile([], makeTile(2, 5), 'right');
    board = placeTile(board, makeTile(5, 3), 'right'); // 5 encosta no 5
    expect(getEnds(board)).toEqual({ left: 2, right: 3 });
    board = placeTile(board, makeTile(1, 3), 'right'); // 3 encosta no 3, invertida
    expect(getEnds(board)).toEqual({ left: 2, right: 1 });
  });

  it('encaixa na ponta esquerda com orientação automática', () => {
    let board = placeTile([], makeTile(2, 5), 'right');
    board = placeTile(board, makeTile(2, 6), 'left'); // 2 encosta no 2
    expect(getEnds(board)).toEqual({ left: 6, right: 5 });
    board = placeTile(board, makeTile(6, 6), 'left'); // carroça
    expect(getEnds(board)).toEqual({ left: 6, right: 5 });
  });

  it('playableSides detecta as duas pontas quando aplicável', () => {
    const ends = { left: 4, right: 2 };
    expect(playableSides(makeTile(2, 4), ends)).toEqual(['left', 'right']);
    expect(playableSides(makeTile(4, 6), ends)).toEqual(['left']);
    expect(playableSides(makeTile(1, 2), ends)).toEqual(['right']);
    expect(playableSides(makeTile(0, 5), ends)).toEqual([]);
  });

  it('rejeita encaixe inválido', () => {
    const board = placeTile([], makeTile(2, 5), 'right');
    expect(() => placeTile(board, makeTile(0, 1), 'right')).toThrow();
    expect(() => placeTile(board, makeTile(5, 6), 'left')).toThrow(); // 5 só encaixa à direita
  });

  it('placeTile não muta a mesa original', () => {
    const board = placeTile([], makeTile(2, 5), 'right');
    placeTile(board, makeTile(5, 5), 'right');
    expect(board).toHaveLength(1);
  });
});
