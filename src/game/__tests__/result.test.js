import { describe, it, expect } from 'vitest';
import { gameResult } from '../result.js';
import { makeTile } from '../tiles.js';

const T = makeTile;

describe('gameResult', () => {
  it('batida: quem ficou sem peças vence', () => {
    const r = gameResult([[], [T(6, 6), T(1, 2)], [T(0, 5)]], 0);
    expect(r).toEqual({ winner: 0, reason: 'domino', tilesLeft: [0, 2, 1] });
  });

  it('jogo fechado: vence quem tem menos peças', () => {
    const r = gameResult([[T(6, 6), T(0, 0)], [T(0, 1)], [T(2, 3), T(4, 4)]], null);
    expect(r).toMatchObject({ winner: 1, reason: 'blocked' });
  });

  it('jogo fechado com empate no menor número de peças: ninguém vence', () => {
    const r = gameResult([[T(0, 3)], [T(6, 6)]], null);
    expect(r).toMatchObject({ winner: null, reason: 'tie' });
  });
});
