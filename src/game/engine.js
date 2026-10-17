// Motor da partida: reducer puro (estado + ação → novo estado).
// Usado tanto pelo single-player (no cliente) quanto pelo multiplayer (no servidor).

import { deal } from './tiles.js';
import { getEnds, placeTile } from './board.js';
import { findStartingPlayer, hasPlayableTile } from './rules.js';
import { gameResult } from './result.js';

export const PHASES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  GAME_END: 'gameEnd',
};

// Cada partida é um jogo isolado: distribui, joga até alguém bater ou o jogo
// fechar, e acaba. Não há pontos nem rodadas.
export function createMatch(playerNames) {
  const n = playerNames.length;
  if (n < 2 || n > 4) throw new Error('A partida exige de 2 a 4 jogadores');
  return {
    phase: PHASES.IDLE,
    numPlayers: n,
    playerNames: playerNames.slice(),
    seed: 0, // sorteio do desenho da cadeia na mesa
    hands: [],
    board: [],
    boneyard: [],
    currentPlayer: 0,
    passStreak: 0,
    log: [],
    events: [],
    result: null,
  };
}

function nextPlayer(state, from) {
  return (from + 1) % state.numPlayers;
}

function assertTurn(state, player) {
  if (state.phase !== PHASES.PLAYING) {
    throw new Error('O jogo não está em andamento');
  }
  if (player !== state.currentPlayer) {
    throw new Error('Não é a sua vez');
  }
}

function startGame(state, rng = Math.random) {
  if (state.phase !== PHASES.IDLE) {
    throw new Error('O jogo já começou');
  }
  const dealt = deal(state.numPlayers, rng);
  let hands = dealt.hands;
  const boneyard = dealt.boneyard.slice();
  // Ninguém com carroça: os jogadores compram do monte, um de cada vez, até
  // aparecer uma. Com 28 peças e 7 carroças, sempre aparece.
  const draws = [];
  let start = findStartingPlayer(hands);
  for (let p = 0; !start && boneyard.length > 0; p = (p + 1) % state.numPlayers) {
    const tile = boneyard.pop();
    hands = hands.map((h, i) => (i === p ? [...h, tile] : h));
    draws.push({ type: 'drew', player: p, tile });
    start = findStartingPlayer(hands);
  }
  // A carroça que define quem começa é jogada automaticamente (sai da mão).
  const board = placeTile([], start.tile, 'right');
  const newHands = hands.map((hand, p) =>
    p === start.player ? hand.filter((t) => t.id !== start.tile.id) : hand
  );
  return {
    ...state,
    phase: PHASES.PLAYING,
    seed: Math.floor(rng() * 1e9),
    hands: newHands,
    board,
    boneyard,
    currentPlayer: nextPlayer(state, start.player),
    passStreak: 0,
    result: null,
    log: [{ type: 'play', player: start.player, tile: start.tile, side: 'right' }],
    events: [
      { type: 'gameStart', starter: start.player },
      ...draws,
      { type: 'played', player: start.player, tile: start.tile, side: 'right' },
    ],
  };
}

function finishGame(state, dominoWinner) {
  const result = gameResult(state.hands, dominoWinner);
  return {
    ...state,
    phase: PHASES.GAME_END,
    result,
    events: [...state.events, { type: 'gameEnd', result }],
  };
}

function playTile(state, action) {
  assertTurn(state, action.player);
  const hand = state.hands[action.player];
  const tile = hand.find((t) => t.id === action.tileId);
  if (!tile) throw new Error('Essa peça não está na sua mão');
  const side = action.side === 'left' ? 'left' : 'right';
  const board = placeTile(state.board, tile, side, action.orient); // valida o encaixe
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
    return finishGame(next, action.player);
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
    return finishGame(next, null);
  }
  return { ...next, currentPlayer: nextPlayer(state, action.player) };
}

export function reduce(state, action) {
  switch (action.type) {
    case 'START_GAME':
      return startGame(state, action.rng);
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
