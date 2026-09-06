import { useCallback, useEffect, useMemo, useState } from 'react';
import { createMatch, reduce, PHASES } from '../game/engine.js';
import { getEnds } from '../game/board.js';
import { getPlayableTiles, mustDraw, mustPass } from '../game/rules.js';
import { chooseAiAction } from '../game/ai.js';

const AI_INDEX = 1;
// Antes de jogar, o computador espera as notas da peça anterior terminarem,
// para elas não se atropelarem. Comprar e passar não soam nada — nesses casos
// a espera é só de ritmo, e uma sequência de compras não fica arrastada.
const AI_PLAY_DELAY_MS = 4000;
const AI_QUIET_DELAY_MS = 900;

export function useSinglePlayerGame(playerName, difficulty) {
  const [state, setState] = useState(() =>
    reduce(createMatch([playerName || 'Você', 'Computador']), { type: 'START_ROUND' })
  );

  const dispatch = useCallback((action) => {
    setState((prev) => {
      try {
        return reduce(prev, action);
      } catch {
        return prev; // a UI já bloqueia ações inválidas; ignora por segurança
      }
    });
  }, []);

  // Vez do computador: uma ação por mudança de estado, com atraso natural.
  // Compras encadeiam sozinhas (a vez continua com ele após comprar).
  useEffect(() => {
    if (state.phase !== PHASES.PLAYING || state.currentPlayer !== AI_INDEX) return;
    let action;
    try {
      action = chooseAiAction(state, AI_INDEX, difficulty);
    } catch {
      return;
    }
    const delay = action.type === 'PLAY_TILE' ? AI_PLAY_DELAY_MS : AI_QUIET_DELAY_MS;
    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev !== state) return prev; // estado mudou: a ação escolhida não vale mais
        try {
          return reduce(prev, action);
        } catch {
          return prev;
        }
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [state, difficulty]);

  const view = useMemo(() => {
    const ends = getEnds(state.board);
    const myHand = state.hands[0] ?? [];
    const playable = {};
    for (const { tile, sides } of getPlayableTiles(myHand, ends)) {
      playable[tile.id] = sides;
    }
    return {
      mode: 'single',
      myIndex: 0,
      players: state.playerNames.map((name, i) => ({
        name,
        tileCount: state.hands[i]?.length ?? 0,
      })),
      scores: state.scores,
      targetScore: state.targetScore,
      round: state.round,
      board: state.board,
      ends,
      myHand,
      playable,
      boneyardCount: state.boneyard.length,
      currentPlayer: state.currentPlayer,
      phase: state.phase,
      roundResult: state.roundResult,
      matchWinner: state.matchWinner,
      canDraw: mustDraw(myHand, ends, state.boneyard),
      canPass: mustPass(myHand, ends, state.boneyard),
      paused: null,
    };
  }, [state]);

  const actions = useMemo(
    () => ({
      play: (tileId, side) => dispatch({ type: 'PLAY_TILE', player: 0, tileId, side }),
      draw: () => dispatch({ type: 'DRAW_TILE', player: 0 }),
      pass: () => dispatch({ type: 'PASS', player: 0 }),
      nextRound: () => dispatch({ type: 'START_ROUND' }),
      newMatch: () =>
        setState(reduce(createMatch([playerName || 'Você', 'Computador']), { type: 'START_ROUND' })),
    }),
    [dispatch, playerName]
  );

  return { view, actions };
}
