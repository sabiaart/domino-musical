// Salas de jogo em memória: código compartilhável, jogadores, estado do motor
// e controle de pausa/reconexão.

import { randomUUID } from 'node:crypto';
import { shuffle } from '../src/game/tiles.js';

// Sem caracteres ambíguos (0/O, 1/I).
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

export const RECONNECT_TIMEOUT_MS = 60_000;
export const MAX_PLAYERS = 4;

const rooms = new Map();

export function generateCode() {
  let code;
  do {
    code = Array.from(
      { length: CODE_LENGTH },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

export function createRoom(hostName) {
  const code = generateCode();
  const player = { id: randomUUID(), name: hostName, socketId: null, connected: true };
  const room = {
    code,
    players: [player],
    hostId: player.id,
    status: 'lobby', // lobby | playing | closed
    state: null, // estado do motor (engine.js)
    pauses: new Map(), // playerId -> { deadline, timer }
  };
  rooms.set(code, room);
  return { room, player };
}

export function getRoom(code) {
  return rooms.get((code || '').toUpperCase().trim());
}

export function removeRoom(code) {
  const room = rooms.get(code);
  if (room) {
    for (const pause of room.pauses.values()) clearTimeout(pause.timer);
    room.pauses.clear();
    rooms.delete(code);
  }
}

export function addPlayer(room, name) {
  if (room.status !== 'lobby') throw new Error('A partida já começou');
  if (room.players.length >= MAX_PLAYERS) throw new Error('A sala está cheia (máx. 4)');
  const player = { id: randomUUID(), name, socketId: null, connected: true };
  room.players.push(player);
  return player;
}

export function playerIndex(room, playerId) {
  return room.players.findIndex((p) => p.id === playerId);
}

export function isPaused(room) {
  return room.pauses.size > 0;
}

// Remove um jogador de uma partida em andamento (timeout de reconexão em sala
// com 3+ jogadores): a mão dele volta ao monte e os índices são reajustados.
export function removePlayerFromState(state, idx) {
  const returned = state.hands[idx];
  const boneyard = shuffle([...state.boneyard, ...returned]);
  const hands = state.hands.filter((_, i) => i !== idx);
  const playerNames = state.playerNames.filter((_, i) => i !== idx);
  const scores = state.scores.filter((_, i) => i !== idx);
  const numPlayers = state.numPlayers - 1;

  const remap = (p) => (p > idx ? p - 1 : p);
  let currentPlayer = state.currentPlayer;
  if (currentPlayer === idx) {
    currentPlayer = idx % numPlayers; // a vez passa para o próximo
  } else {
    currentPlayer = remap(currentPlayer);
  }

  const log = state.log
    .filter((e) => e.player !== idx)
    .map((e) => ({ ...e, player: remap(e.player) }));

  return {
    ...state,
    hands,
    playerNames,
    scores,
    numPlayers,
    boneyard,
    currentPlayer,
    passStreak: 0,
    log,
    roundResult: state.roundResult,
    matchWinner: state.matchWinner === null ? null : remap(state.matchWinner),
  };
}

// Visão do estado enviada a um jogador: só a própria mão; dos outros, contagem.
export function filterStateFor(room, idx) {
  const s = room.state;
  if (!s) return null;
  return {
    phase: s.phase,
    round: s.round,
    numPlayers: s.numPlayers,
    playerNames: s.playerNames,
    targetScore: s.targetScore,
    scores: s.scores,
    board: s.board,
    currentPlayer: s.currentPlayer,
    boneyardCount: s.boneyard.length,
    handCounts: s.hands.map((h) => h.length),
    myHand: s.hands[idx] ?? [],
    myIndex: idx,
    roundResult: s.roundResult,
    matchWinner: s.matchWinner,
    events: (s.events ?? []).map((e) =>
      e.type === 'drew' && e.player !== idx ? { ...e, tile: null } : e
    ),
  };
}

export function roomSummary(room) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
  };
}
