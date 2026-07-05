import { describe, it, expect } from 'vitest';
import { createMatch, reduce, PHASES } from '../engine.js';
import { placeTile, getEnds } from '../board.js';
import { makeTile } from '../tiles.js';
import { seededRng } from './helpers.js';

const T = makeTile;

// Monta um estado de rodada em andamento com mãos/mesa/monte controlados.
function playingState({ hands, board, boneyard = [], currentPlayer = 0, scores }) {
  const base = createMatch(hands.map((_, i) => `J${i + 1}`));
  return {
    ...base,
    phase: PHASES.PLAYING,
    round: 1,
    hands,
    board,
    boneyard,
    currentPlayer,
    scores: scores ?? base.scores,
  };
}

describe('START_ROUND', () => {
  it('distribui, joga automaticamente a peça inicial e passa a vez', () => {
    const state = reduce(createMatch(['Eu', 'PC']), { type: 'START_ROUND', rng: seededRng(1) });
    expect(state.phase).toBe(PHASES.PLAYING);
    expect(state.round).toBe(1);
    expect(state.board).toHaveLength(1);
    const starter = state.events.find((e) => e.type === 'roundStart').starter;
    expect(state.hands[starter]).toHaveLength(6);
    expect(state.hands[1 - starter]).toHaveLength(7);
    expect(state.boneyard).toHaveLength(28 - 14);
    expect(state.currentPlayer).toBe((starter + 1) % 2);
  });

  it('não permite iniciar rodada com partida em andamento', () => {
    const state = reduce(createMatch(['A', 'B']), { type: 'START_ROUND', rng: seededRng(1) });
    expect(() => reduce(state, { type: 'START_ROUND', rng: seededRng(2) })).toThrow();
  });
});

describe('PLAY_TILE', () => {
  const base = () =>
    playingState({
      hands: [
        [T(2, 3), T(0, 0)],
        [T(5, 6), T(1, 1)],
      ],
      board: placeTile([], T(2, 5), 'right'), // pontas 2 e 5
      boneyard: [T(6, 6)],
    });

  it('joga peça válida e avança a vez', () => {
    const next = reduce(base(), { type: 'PLAY_TILE', player: 0, tileId: '2-3', side: 'left' });
    expect(getEnds(next.board)).toEqual({ left: 3, right: 5 });
    expect(next.hands[0].map((t) => t.id)).toEqual(['0-0']);
    expect(next.currentPlayer).toBe(1);
  });

  it('rejeita jogada fora de turno', () => {
    expect(() =>
      reduce(base(), { type: 'PLAY_TILE', player: 1, tileId: '5-6', side: 'right' })
    ).toThrow(/vez/);
  });

  it('rejeita peça que não está na mão', () => {
    expect(() =>
      reduce(base(), { type: 'PLAY_TILE', player: 0, tileId: '6-6', side: 'right' })
    ).toThrow(/mão/);
  });

  it('rejeita encaixe inválido', () => {
    expect(() =>
      reduce(base(), { type: 'PLAY_TILE', player: 0, tileId: '0-0', side: 'right' })
    ).toThrow(/não encaixa/);
  });

  it('batida encerra a rodada e pontua a soma das mãos dos perdedores', () => {
    const state = playingState({
      hands: [[T(2, 3)], [T(5, 6), T(1, 1)]],
      board: placeTile([], T(2, 5), 'right'),
    });
    const next = reduce(state, { type: 'PLAY_TILE', player: 0, tileId: '2-3', side: 'left' });
    expect(next.phase).toBe(PHASES.ROUND_END);
    expect(next.roundResult).toMatchObject({ winner: 0, points: 13, reason: 'domino' });
    expect(next.scores).toEqual([13, 0]);
  });

  it('atingir a meta encerra a partida', () => {
    const state = playingState({
      hands: [[T(2, 3)], [T(5, 6), T(6, 6)]],
      board: placeTile([], T(2, 5), 'right'),
      scores: [90, 0],
    });
    const next = reduce(state, { type: 'PLAY_TILE', player: 0, tileId: '2-3', side: 'left' });
    expect(next.phase).toBe(PHASES.MATCH_END);
    expect(next.matchWinner).toBe(0);
    expect(next.scores[0]).toBeGreaterThanOrEqual(100);
  });
});

describe('DRAW_TILE e PASS', () => {
  it('compra obrigatória quando não há jogada; vez continua com o jogador', () => {
    const state = playingState({
      hands: [[T(0, 1)], [T(5, 6)]],
      board: placeTile([], T(2, 5), 'right'),
      boneyard: [T(3, 3), T(2, 2)],
    });
    const next = reduce(state, { type: 'DRAW_TILE', player: 0 });
    expect(next.hands[0].map((t) => t.id)).toEqual(['0-1', '2-2']);
    expect(next.boneyard).toHaveLength(1);
    expect(next.currentPlayer).toBe(0); // continua até conseguir jogar
  });

  it('não pode comprar tendo jogada possível', () => {
    const state = playingState({
      hands: [[T(2, 2)], [T(5, 6)]],
      board: placeTile([], T(2, 5), 'right'),
      boneyard: [T(3, 3)],
    });
    expect(() => reduce(state, { type: 'DRAW_TILE', player: 0 })).toThrow(/jogada possível/);
  });

  it('não pode passar com monte disponível, nem com jogada na mão', () => {
    const comMonte = playingState({
      hands: [[T(0, 1)], [T(5, 6)]],
      board: placeTile([], T(2, 5), 'right'),
      boneyard: [T(3, 3)],
    });
    expect(() => reduce(comMonte, { type: 'PASS', player: 0 })).toThrow(/monte/i);

    const comJogada = playingState({
      hands: [[T(2, 2)], [T(5, 6)]],
      board: placeTile([], T(2, 5), 'right'),
      boneyard: [],
    });
    expect(() => reduce(comJogada, { type: 'PASS', player: 0 })).toThrow(/jogada possível/);
  });

  it('todos passam: jogo fechado, menor mão vence', () => {
    // Pontas 2 e 5; ninguém tem 2 nem 5 e o monte está vazio.
    const state = playingState({
      hands: [
        [T(0, 1)], // 1 ponto
        [T(6, 6), T(3, 4)], // 19 pontos
      ],
      board: placeTile([], T(2, 5), 'right'),
      boneyard: [],
    });
    const afterP0 = reduce(state, { type: 'PASS', player: 0 });
    expect(afterP0.phase).toBe(PHASES.PLAYING);
    expect(afterP0.currentPlayer).toBe(1);
    const afterP1 = reduce(afterP0, { type: 'PASS', player: 1 });
    expect(afterP1.phase).toBe(PHASES.ROUND_END);
    expect(afterP1.roundResult).toMatchObject({ winner: 0, points: 19, reason: 'blocked' });
    expect(afterP1.scores).toEqual([19, 0]);
  });

  it('jogada válida zera a sequência de passes', () => {
    const state = playingState({
      hands: [
        [T(0, 1)],
        [T(2, 2), T(0, 3)],
      ],
      board: placeTile([], T(2, 5), 'right'),
      boneyard: [],
    });
    const afterPass = reduce(state, { type: 'PASS', player: 0 });
    const afterPlay = reduce(afterPass, { type: 'PLAY_TILE', player: 1, tileId: '2-2', side: 'left' });
    expect(afterPlay.passStreak).toBe(0);
    expect(afterPlay.phase).toBe(PHASES.PLAYING);
  });
});

describe('partida completa (simulação)', () => {
  it('rodadas se sucedem até alguém atingir 100 pontos', () => {
    const rng = seededRng(2026);
    let state = createMatch(['A', 'B']);
    let guard = 0;
    while (state.matchWinner === null && guard < 10000) {
      guard++;
      if (state.phase !== PHASES.PLAYING) {
        state = reduce(state, { type: 'START_ROUND', rng });
        continue;
      }
      const p = state.currentPlayer;
      const ends = getEnds(state.board);
      const playable = state.hands[p].filter(
        (t) => t.a === ends.left || t.b === ends.left || t.a === ends.right || t.b === ends.right
      );
      if (playable.length > 0) {
        const tile = playable[0];
        const side = tile.a === ends.left || tile.b === ends.left ? 'left' : 'right';
        state = reduce(state, { type: 'PLAY_TILE', player: p, tileId: tile.id, side });
      } else if (state.boneyard.length > 0) {
        state = reduce(state, { type: 'DRAW_TILE', player: p });
      } else {
        state = reduce(state, { type: 'PASS', player: p });
      }
    }
    expect(state.matchWinner).not.toBeNull();
    expect(state.phase).toBe(PHASES.MATCH_END);
    expect(Math.max(...state.scores)).toBeGreaterThanOrEqual(100);
  }, 20000);
});
