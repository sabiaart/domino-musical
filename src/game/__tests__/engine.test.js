import { describe, it, expect } from 'vitest';
import { createMatch, reduce, PHASES } from '../engine.js';
import { placeTile, getEnds } from '../board.js';
import { makeTile } from '../tiles.js';
import { seededRng } from './helpers.js';

const T = makeTile;

// Monta um estado de jogo em andamento com mãos/mesa/monte controlados.
function playingState({ hands, board, boneyard = [], currentPlayer = 0 }) {
  const base = createMatch(hands.map((_, i) => `J${i + 1}`));
  return {
    ...base,
    phase: PHASES.PLAYING,
    hands,
    board,
    boneyard,
    currentPlayer,
  };
}

describe('START_GAME', () => {
  it('distribui, joga automaticamente a peça inicial e passa a vez', () => {
    const state = reduce(createMatch(['Eu', 'PC']), { type: 'START_GAME', rng: seededRng(1) });
    expect(state.phase).toBe(PHASES.PLAYING);
    expect(state.board).toHaveLength(1);
    const starter = state.events.find((e) => e.type === 'gameStart').starter;
    expect(state.hands[starter]).toHaveLength(6);
    expect(state.hands[1 - starter]).toHaveLength(7);
    expect(state.boneyard).toHaveLength(28 - 14);
    expect(state.currentPlayer).toBe((starter + 1) % 2);
  });

  it('não permite iniciar um jogo já começado', () => {
    const state = reduce(createMatch(['A', 'B']), { type: 'START_GAME', rng: seededRng(1) });
    expect(() => reduce(state, { type: 'START_GAME', rng: seededRng(2) })).toThrow();
  });
});

describe('início do jogo', () => {
  it('sempre começa com a carroça mais grave em jogo', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = reduce(createMatch(['A', 'B']), { type: 'START_GAME', rng: seededRng(seed) });
      const first = state.board[0].tile;
      expect(first.a).toBe(first.b);
      const restantes = state.hands.flat().filter((t) => t.a === t.b);
      for (const t of restantes) expect(t.a).toBeGreaterThan(first.a);
    }
  });

  it('sem carroça nas mãos, compram do monte até aparecer uma', () => {
    // Procura uma distribuição sem carroças nas mãos.
    let achou = false;
    for (let seed = 1; seed <= 3000 && !achou; seed++) {
      const state = reduce(createMatch(['A', 'B']), { type: 'START_GAME', rng: seededRng(seed) });
      const draws = state.events.filter((e) => e.type === 'drew');
      if (draws.length === 0) continue;
      achou = true;
      const last = draws[draws.length - 1];
      expect(last.tile.a).toBe(last.tile.b); // a última compra trouxe a carroça
      expect(state.board[0].tile.id).toBe(last.tile.id);
      expect(draws.slice(0, -1).every((e) => e.tile.a !== e.tile.b)).toBe(true);
      expect(state.boneyard.length).toBe(14 - draws.length);
    }
    expect(achou).toBe(true);
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

  it('batida encerra o jogo com o vencedor', () => {
    const state = playingState({
      hands: [[T(2, 3)], [T(5, 6), T(1, 1)]],
      board: placeTile([], T(2, 5), 'right'),
    });
    const next = reduce(state, { type: 'PLAY_TILE', player: 0, tileId: '2-3', side: 'left' });
    expect(next.phase).toBe(PHASES.GAME_END);
    expect(next.result).toEqual({ winner: 0, reason: 'domino', tilesLeft: [0, 2] });
    expect(() => reduce(next, { type: 'START_GAME' })).toThrow();
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

  it('todos passam: jogo fechado, vence quem tem menos peças', () => {
    // Pontas 2 e 5; ninguém tem 2 nem 5 e o monte está vazio.
    const state = playingState({
      hands: [
        [T(0, 1)], // 1 peça
        [T(6, 6), T(3, 4)], // 2 peças
      ],
      board: placeTile([], T(2, 5), 'right'),
      boneyard: [],
    });
    const afterP0 = reduce(state, { type: 'PASS', player: 0 });
    expect(afterP0.phase).toBe(PHASES.PLAYING);
    expect(afterP0.currentPlayer).toBe(1);
    const afterP1 = reduce(afterP0, { type: 'PASS', player: 1 });
    expect(afterP1.phase).toBe(PHASES.GAME_END);
    expect(afterP1.result).toMatchObject({ winner: 0, reason: 'blocked' });
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
  it('jogos aleatórios sempre terminam com um resultado', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = seededRng(seed);
      let state = reduce(createMatch(['A', 'B', 'C']), { type: 'START_GAME', rng });
      let guard = 0;
      while (state.phase === PHASES.PLAYING && guard < 10000) {
        guard++;
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
      expect(state.phase).toBe(PHASES.GAME_END);
      expect(['domino', 'blocked', 'tie']).toContain(state.result.reason);
    }
  }, 20000);
});
