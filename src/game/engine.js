// Motor da partida: reducer puro (estado + ação → novo estado).
// Usado tanto pelo single-player (no cliente) quanto pelo multiplayer (no servidor).

import { deal } from './tiles.js';
import { getEnds, placeTile } from './board.js';
import { findStartingPlayer, hasPlayableTile } from './rules.js';
import { roundResult, applyRoundScore, matchWinner, TARGET_SCORE } from './scoring.js';

export const PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  ROUND_END: 'roundEnd',
  MATCH_END: 'matchEnd',
};

export function createMatch(playerNames, { targetScore = TARGET_SCORE } = {}) {
  const n = playerNames.length;
  if (n < 2 || n > 4) throw new Error('A partida exige de 2 a 4 jogadores');
  return {
    phase: PHASES.IDLE,
    numPlayers: n,
    playerNames: playerNames.slice(),
    targetScore,
    round: 0,
    scores: new Array(n).fill(0),
    hands: [],
    board: [],
    boneyard: [],
    currentPlayer: 0,
    passStreak: 0,
    log: [],
    events: [],
    roundResult: null,
    matchWinner: null,
  };
}

function nextPlayer(state, from) {
  return (from + 1) % state.numPlayers;
}

function assertTurn(state, player) {
  if (state.phase !== PHASES.PLAYING) {
    throw new Error('A rodada não está em andamento');
  }
  if (player !== state.currentPlayer) {
    throw new Error('Não é a sua vez');
  }
}

function startRound(state, rng = Math.random) {
  if (state.phase === PHASES.PLAYING) {
    throw new Error('A rodada já está em andamento');
  }
  if (state.matchWinner !== null) {
    throw new Error('A partida já terminou');
  }
  const { hands, boneyard } = deal(state.numPlayers, rng);
  const start = findStartingPlayer(hands);
  // A peça que define quem começa é jogada automaticamente (sai de mão).
  const board = placeTile([], start.tile, 'right');
  const newHands = hands.map((hand, p) =>
    p === start.player ? hand.filter((t) => t.id !== start.tile.id) : hand
  );
  return {
    ...state,
    phase: PHASES.PLAYING,
    round: state.round + 1,
    hands: newHands,
    board,
    boneyard,
    currentPlayer: nextPlayer(state, start.player),
    passStreak: 0,
    roundResult: null,
    log: [{ type: 'play', player: start.player, tile: start.tile, side: 'right' }],
    events: [
      { type: 'roundStart', round: state.round + 1, starter: start.player },
      { type: 'played', player: start.player, tile: start.tile, side: 'right' },
    ],
  };
}

function finishRound(state, dominoWinner) {
  const result = roundResult(state.hands, dominoWinner);
  const scores = applyRoundScore(state.scores, result);
  const winner = matchWinner(scores, state.targetScore);
  return {
    ...state,
    phase: winner !== null ? PHASES.MATCH_END : PHASES.ROUND_END,
    scores,
    roundResult: result,
    matchWinner: winner,
    events: [
      ...state.events,
      { type: 'roundEnd', result },
      ...(winner !== null ? [{ type: 'matchEnd', winner }] : []),
    ],
  };
}

function playTile(state, action) {
  assertTurn(state, action.player);
  const hand = state.hands[action.player];
  const tile = hand.find((t) => t.id === action.tileId);
  if (!tile) throw new Error('Essa peça não está na sua mão');
  const side = action.side === 'left' ? 'left' : 'right';
  const board = placeTile(state.board, tile, side); // valida o encaixe
  const hands = state.hands.map((h, p) =>
    p === action.player ? h.filter((t) => t.id !== tile.id) : h
  );
  const next = {
    ...state,
    board,
    hands,
    passStreak: 0,
    log: [...state.log, { type: 'play', player: action.player, tile, side }],
    events: [{ type: 'played', player: action.player, tile, side }],
  };
  if (hands[action.player].length === 0) {
    return finishRound(next, action.player);
  }
  return { ...next, currentPlayer: nextPlayer(state, action.player) };
}

function drawTile(state, action) {
  assertTurn(state, action.player);
  const ends = getEnds(state.board);
  if (hasPlayableTile(state.hands[action.player], ends)) {
    throw new Error('Você tem jogada possível — não pode comprar');
  }
  if (state.boneyard.length === 0) {
    throw new Error('O monte está vazio — passe a vez');
  }
  const boneyard = state.boneyard.slice();
  const tile = boneyard.pop();
  const hands = state.hands.map((h, p) =>
    p === action.player ? [...h, tile] : h
  );
  // A vez continua com o jogador: ele compra até conseguir jogar ou o monte acabar.
  return {
    ...state,
    boneyard,
    hands,
    log: [...state.log, { type: 'draw', player: action.player, ends }],
    events: [{ type: 'drew', player: action.player, tile }],
  };
}

function pass(state, action) {
  assertTurn(state, action.player);
  const ends = getEnds(state.board);
  if (hasPlayableTile(state.hands[action.player], ends)) {
    throw new Error('Você tem jogada possível — não pode passar');
  }
  if (state.boneyard.length > 0) {
    throw new Error('O monte não está vazio — compre uma peça');
  }
  const passStreak = state.passStreak + 1;
  const next = {
    ...state,
    passStreak,
    log: [...state.log, { type: 'pass', player: action.player, ends }],
    events: [{ type: 'passed', player: action.player }],
  };
  if (passStreak >= state.numPlayers) {
    // Todos passaram em sequência: jogo fechado.
    return finishRound(next, null);
  }
  return { ...next, currentPlayer: nextPlayer(state, action.player) };
}

export function reduce(state, action) {
  switch (action.type) {
    case 'START_ROUND':
      return startRound(state, action.rng);
    case 'PLAY_TILE':
      return playTile(state, action);
    case 'DRAW_TILE':
      return drawTile(state, action);
    case 'PASS':
      return pass(state, action);
    default:
      throw new Error(`Ação desconhecida: ${action.type}`);
  }
}
