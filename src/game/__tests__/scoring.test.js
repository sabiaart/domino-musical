import { describe, it, expect } from 'vitest';
import { handPoints, roundResult, applyRoundScore, matchWinner } from '../scoring.js';
import { makeTile } from '../tiles.js';

const T = makeTile;

describe('scoring', () => {
  it('handPoints soma os pontos da mão', () => {
    expect(handPoints([])).toBe(0);
    expect(handPoints([T(6, 6), T(0, 3)])).toBe(15);
  });

  it('batida: vencedor leva a soma das mãos dos perdedores', () => {
    const hands = [[], [T(6, 6), T(1, 2)], [T(0, 5)]];
    const r = roundResult(hands, 0);
    expect(r).toMatchObject({ winner: 0, points: 20, reason: 'domino' });
  });

  it('jogo fechado: menor mão vence e leva a soma das outras', () => {
    const hands = [[T(6, 6)], [T(0, 1)], [T(2, 3)]];
    const r = roundResult(hands, null);
    expect(r).toMatchObject({ winner: 1, points: 17, reason: 'blocked' });
  });

  it('jogo fechado com empate na menor mão: ninguém pontua', () => {
    const hands = [[T(0, 3)], [T(1, 2)]];
    const r = roundResult(hands, null);
    expect(r).toMatchObject({ winner: null, points: 0, reason: 'tie' });
  });

  it('applyRoundScore acumula sem mutar o placar original', () => {
    const scores = [10, 20];
    const next = applyRoundScore(scores, { winner: 1, points: 15 });
    expect(next).toEqual([10, 35]);
    expect(scores).toEqual([10, 20]);
    expect(applyRoundScore(scores, { winner: null, points: 0 })).toEqual([10, 20]);
  });

  it('matchWinner: só com 100+ pontos', () => {
    expect(matchWinner([99, 45])).toBeNull();
    expect(matchWinner([100, 45])).toBe(0);
    expect(matchWinner([70, 112], 100)).toBe(1);
    expect(matchWinner([40, 55], 50)).toBe(1);
  });
});
