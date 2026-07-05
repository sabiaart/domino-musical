import { describe, it, expect } from 'vitest';
import { findStartingPlayer, getPlayableTiles, mustDraw, mustPass, isBlocked } from '../rules.js';
import { placeTile } from '../board.js';
import { makeTile } from '../tiles.js';

const T = makeTile;

describe('findStartingPlayer', () => {
  it('maior carroça começa', () => {
    const hands = [
      [T(3, 3), T(1, 2)],
      [T(5, 5), T(0, 1)],
      [T(4, 4), T(6, 5)],
    ];
    const start = findStartingPlayer(hands);
    expect(start.player).toBe(1);
    expect(start.tile.id).toBe('5-5');
  });

  it('sem carroças: peça de maior soma começa', () => {
    const hands = [
      [T(1, 2), T(3, 4)],
      [T(5, 6), T(0, 2)],
    ];
    const start = findStartingPlayer(hands);
    expect(start.player).toBe(1);
    expect(start.tile.id).toBe('5-6');
  });
});

describe('jogadas, compra e passe', () => {
  const board = placeTile([], T(2, 5), 'right'); // pontas 2 e 5
  const ends = { left: 2, right: 5 };

  it('getPlayableTiles retorna peças e pontas possíveis', () => {
    const hand = [T(2, 3), T(5, 5), T(0, 1), T(2, 5)];
    const playable = getPlayableTiles(hand, ends);
    expect(playable.map((p) => p.tile.id)).toEqual(['2-3', '5-5', '2-5']);
    expect(playable.find((p) => p.tile.id === '2-5').sides).toEqual(['left', 'right']);
  });

  it('mustDraw: sem jogada e monte com peças', () => {
    const hand = [T(0, 1), T(3, 4)];
    expect(mustDraw(hand, ends, [T(6, 6)])).toBe(true);
    expect(mustDraw(hand, ends, [])).toBe(false);
    expect(mustDraw([T(2, 2)], ends, [T(6, 6)])).toBe(false); // tem jogada
  });

  it('mustPass: sem jogada e monte vazio', () => {
    const hand = [T(0, 1), T(3, 4)];
    expect(mustPass(hand, ends, [])).toBe(true);
    expect(mustPass(hand, ends, [T(6, 6)])).toBe(false);
    expect(mustPass([T(5, 6)], ends, [])).toBe(false);
  });

  it('isBlocked: monte vazio e ninguém joga', () => {
    const hands = [[T(0, 1)], [T(3, 4)]];
    expect(isBlocked(hands, board, [])).toBe(true);
    expect(isBlocked(hands, board, [T(6, 6)])).toBe(false);
    expect(isBlocked([[T(2, 2)], [T(3, 4)]], board, [])).toBe(false);
  });
});
