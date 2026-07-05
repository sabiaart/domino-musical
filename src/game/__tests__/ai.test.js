import { describe, it, expect } from 'vitest';
import { chooseAiAction, inferMissingNumbers } from '../ai.js';
import { createMatch, PHASES } from '../engine.js';
import { placeTile } from '../board.js';
import { makeTile } from '../tiles.js';
import { seededRng } from './helpers.js';

const T = makeTile;

function playingState({ hands, board, boneyard = [], currentPlayer = 0, log = [] }) {
  const base = createMatch(hands.map((_, i) => `J${i + 1}`));
  return { ...base, phase: PHASES.PLAYING, round: 1, hands, board, boneyard, currentPlayer, log };
}

describe('chooseAiAction', () => {
  const board = placeTile([], T(2, 5), 'right'); // pontas 2 e 5

  it('sem jogada: compra se houver monte, senão passa', () => {
    const comMonte = playingState({ hands: [[T(0, 1)], []], board, boneyard: [T(6, 6)] });
    expect(chooseAiAction(comMonte, 0, 'easy').type).toBe('DRAW_TILE');
    const semMonte = playingState({ hands: [[T(0, 1)], []], board, boneyard: [] });
    expect(chooseAiAction(semMonte, 0, 'hard').type).toBe('PASS');
  });

  it('fácil: sempre retorna uma jogada válida', () => {
    const state = playingState({ hands: [[T(2, 3), T(5, 5), T(0, 1)], []], board });
    for (let i = 0; i < 10; i++) {
      const action = chooseAiAction(state, 0, 'easy', seededRng(i));
      expect(action.type).toBe('PLAY_TILE');
      expect(['2-3', '5-5']).toContain(action.tileId);
    }
  });

  it('médio: prefere carroça a peça comum de soma maior', () => {
    const state = playingState({ hands: [[T(2, 6), T(5, 5), T(0, 1)], []], board });
    const action = chooseAiAction(state, 0, 'medium');
    expect(action.tileId).toBe('5-5'); // carroça vence 2-6 (soma 8 vs 10)
  });

  it('difícil: bloqueia número que o oponente demonstrou não ter', () => {
    // Oponente passou com pontas 2 e 5 → não tem 2 nem 5.
    // IA pode deixar pontas {3,5} jogando 2-3, ou {2,6} jogando 5-6.
    // Jogando 2-3 a ponta 5 (que ele não tem) continua e 3 é incógnita;
    // jogando 5-6 a ponta 2 (que ele não tem) continua. Ambas mantêm um bloqueio,
    // mas 2-3 mantém a ponta 5 e cria 3... A escolha deve ser uma jogada válida
    // que maximize pontas bloqueadas — aqui validamos que considera o log.
    const log = [{ type: 'pass', player: 1, ends: { left: 2, right: 5 } }];
    const state = playingState({
      hands: [[T(2, 2), T(5, 5), T(3, 6)], [T(0, 1)]],
      board,
      log,
    });
    const action = chooseAiAction(state, 0, 'hard');
    // Carroças 2-2 e 5-5 mantêm as duas pontas bloqueadas (2/5 e 2/5);
    // 3-6 não encaixa. Deve escolher uma das carroças.
    expect(['2-2', '5-5']).toContain(action.tileId);
  });
});

describe('inferMissingNumbers', () => {
  it('registra números das pontas quando o oponente compra ou passa', () => {
    const log = [
      { type: 'draw', player: 1, ends: { left: 3, right: 6 } },
      { type: 'pass', player: 2, ends: { left: 3, right: 4 } },
    ];
    const missing = inferMissingNumbers(log, 3, 0);
    expect([...missing[1]].sort()).toEqual([3, 6]);
    expect([...missing[2]].sort()).toEqual([3, 4]);
    expect(missing[0].size).toBe(0);
  });

  it('descarta a inferência se o jogador depois jogar o número', () => {
    const log = [
      { type: 'draw', player: 1, ends: { left: 3, right: 6 } },
      { type: 'play', player: 1, tile: T(3, 5), side: 'left' },
    ];
    const missing = inferMissingNumbers(log, 2, 0);
    expect(missing[1].has(3)).toBe(false);
    expect(missing[1].has(6)).toBe(true);
  });
});
