import { describe, it, expect } from 'vitest';
import { chooseAiAction } from '../ai.js';
import { createMatch, PHASES } from '../engine.js';
import { placeTile } from '../board.js';
import { makeTile } from '../tiles.js';
import { seededRng } from './helpers.js';

const T = makeTile;

function playingState({ hands, board, boneyard = [], currentPlayer = 0, log = [] }) {
  const base = createMatch(hands.map((_, i) => `J${i + 1}`));
  return { ...base, phase: PHASES.PLAYING, hands, board, boneyard, currentPlayer, log };
}

describe('chooseAiAction', () => {
  const board = placeTile([], T(2, 5), 'right'); // pontas 2 e 5

  it('sem jogada: compra se houver monte, senão passa', () => {
    const comMonte = playingState({ hands: [[T(0, 1)], []], board, boneyard: [T(6, 6)] });
    expect(chooseAiAction(comMonte, 0).type).toBe('DRAW_TILE');
    const semMonte = playingState({ hands: [[T(0, 1)], []], board, boneyard: [] });
    expect(chooseAiAction(semMonte, 0).type).toBe('PASS');
  });

  it('sempre retorna uma jogada válida', () => {
    const state = playingState({ hands: [[T(2, 3), T(5, 5), T(0, 1)], []], board });
    for (let i = 0; i < 10; i++) {
      const action = chooseAiAction(state, 0, seededRng(i));
      expect(action.type).toBe('PLAY_TILE');
      expect(['2-3', '5-5']).toContain(action.tileId);
    }
  });

  it('sorteia entre as jogadas possíveis', () => {
    const state = playingState({ hands: [[T(2, 3), T(5, 5), T(0, 1)], []], board });
    const escolhidas = new Set();
    for (let i = 0; i < 30; i++) escolhidas.add(chooseAiAction(state, 0, seededRng(i)).tileId);
    expect(escolhidas.size).toBe(2);
  });
});
