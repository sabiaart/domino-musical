// Servidor multiplayer: HTTP + Socket.io, salas em memória (sem banco).
// O servidor é autoritativo: toda ação passa pelo motor (engine.js).

import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createMatch, reduce, PHASES } from '../src/game/engine.js';
import {
  createRoom,
  getRoom,
  removeRoom,
  addPlayer,
  playerIndex,
  isPaused,
  removePlayerFromState,
  filterStateFor,
  roomSummary,
  RECONNECT_TIMEOUT_MS,
} from './rooms.js';

const PORT = process.env.PORT || 3210;

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Servidor de dominó no ar 🁡');
});

const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] },
});

function broadcastRoom(room) {
  io.to(room.code).emit('room:update', roomSummary(room));
}

function broadcastState(room) {
  for (let i = 0; i < room.players.length; i++) {
    const p = room.players[i];
    if (p.connected && p.socketId) {
      io.to(p.socketId).emit('game:state', filterStateFor(room, i));
    }
  }
}

function broadcastPause(room) {
  const waiting = [...room.pauses.entries()].map(([playerId, pause]) => {
    const p = room.players.find((pl) => pl.id === playerId);
    return { name: p?.name ?? '?', deadline: pause.deadline };
  });
  io.to(room.code).emit('game:paused', { waiting });
}

function closeRoom(room, reason) {
  io.to(room.code).emit('room:closed', { reason });
  io.in(room.code).socketsLeave(room.code);
  removeRoom(room.code);
}

function handleReconnectTimeout(room, playerId) {
  room.pauses.delete(playerId);
  const idx = playerIndex(room, playerId);
  if (idx < 0) return;
  const name = room.players[idx].name;

  if (room.status !== 'playing') {
    room.players.splice(idx, 1);
    if (room.players.length === 0) return removeRoom(room.code);
    if (room.hostId === playerId) room.hostId = room.players[0].id;
    broadcastRoom(room);
    return;
  }

  if (room.players.length <= 2) {
    closeRoom(room, `${name} não voltou a tempo. A partida foi encerrada.`);
    return;
  }

  // 3+ jogadores: remove o ausente, devolve a mão dele ao monte e continua.
  room.state = removePlayerFromState(room.state, idx);
  room.players.splice(idx, 1);
  if (room.hostId === playerId) room.hostId = room.players[0].id;
  io.to(room.code).emit('notice', {
    text: `${name} não voltou a tempo e saiu do jogo. As peças dele voltaram ao monte.`,
  });
  if (!isPaused(room)) io.to(room.code).emit('game:resumed');
  broadcastRoom(room);
  broadcastState(room);
}

function attachToRoom(socket, room, player) {
  socket.data.code = room.code;
  socket.data.playerId = player.id;
  player.socketId = socket.id;
  player.connected = true;
  socket.join(room.code);
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ name }, ack) => {
    if (!name?.trim()) return ack?.({ ok: false, error: 'Informe um nome' });
    const { room, player } = createRoom(name.trim().slice(0, 16));
    attachToRoom(socket, room, player);
    broadcastRoom(room);
    ack?.({ ok: true, code: room.code, playerId: player.id });
  });

  socket.on('room:join', ({ code, name }, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ ok: false, error: 'Sala não encontrada' });
    if (!name?.trim()) return ack?.({ ok: false, error: 'Informe um nome' });
    try {
      const player = addPlayer(room, name.trim().slice(0, 16));
      attachToRoom(socket, room, player);
      broadcastRoom(room);
      ack?.({ ok: true, code: room.code, playerId: player.id });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('room:rejoin', ({ code, playerId }, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ ok: false, error: 'A sala não existe mais' });
    const idx = playerIndex(room, playerId);
    if (idx < 0) return ack?.({ ok: false, error: 'Você não faz mais parte desta sala' });
    const player = room.players[idx];

    const pause = room.pauses.get(playerId);
    if (pause) {
      clearTimeout(pause.timer);
      room.pauses.delete(playerId);
    }
    attachToRoom(socket, room, player);
    broadcastRoom(room);
    if (room.state) socket.emit('game:state', filterStateFor(room, idx));
    if (isPaused(room)) broadcastPause(room);
    else io.to(room.code).emit('game:resumed');
    ack?.({ ok: true, code: room.code, playerId });
  });

  socket.on('room:start', (_payload, ack) => {
    const room = getRoom(socket.data.code);
    if (!room) return ack?.({ ok: false, error: 'Sala não encontrada' });
    if (socket.data.playerId !== room.hostId) {
      return ack?.({ ok: false, error: 'Só o anfitrião pode iniciar' });
    }
    if (room.status !== 'lobby') return ack?.({ ok: false, error: 'A partida já começou' });
    if (room.players.length < 2) {
      return ack?.({ ok: false, error: 'São necessários pelo menos 2 jogadores' });
    }
    room.status = 'playing';
    room.state = reduce(createMatch(room.players.map((p) => p.name)), { type: 'START_ROUND' });
    broadcastRoom(room);
    broadcastState(room);
    ack?.({ ok: true });
  });

  socket.on('game:action', ({ action }, ack) => {
    const room = getRoom(socket.data.code);
    if (!room || !room.state) return ack?.({ ok: false, error: 'Sala não encontrada' });
    if (isPaused(room)) return ack?.({ ok: false, error: 'Jogo pausado — aguardando reconexão' });
    const idx = playerIndex(room, socket.data.playerId);
    if (idx < 0) return ack?.({ ok: false, error: 'Jogador inválido' });
    const allowed = ['PLAY_TILE', 'DRAW_TILE', 'PASS'];
    if (!allowed.includes(action?.type)) {
      return ack?.({ ok: false, error: 'Ação inválida' });
    }
    try {
      room.state = reduce(room.state, { ...action, player: idx });
      broadcastState(room);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('game:next-round', (_payload, ack) => {
    const room = getRoom(socket.data.code);
    if (!room || !room.state) return ack?.({ ok: false, error: 'Sala não encontrada' });
    if (socket.data.playerId !== room.hostId) {
      return ack?.({ ok: false, error: 'Só o anfitrião pode iniciar a rodada' });
    }
    if (room.state.phase !== PHASES.ROUND_END) {
      return ack?.({ ok: false, error: 'A rodada ainda não terminou' });
    }
    try {
      room.state = reduce(room.state, { type: 'START_ROUND' });
      broadcastState(room);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('room:new-match', (_payload, ack) => {
    const room = getRoom(socket.data.code);
    if (!room) return ack?.({ ok: false, error: 'Sala não encontrada' });
    if (socket.data.playerId !== room.hostId) {
      return ack?.({ ok: false, error: 'Só o anfitrião pode reiniciar' });
    }
    room.state = reduce(createMatch(room.players.map((p) => p.name)), { type: 'START_ROUND' });
    room.status = 'playing';
    broadcastRoom(room);
    broadcastState(room);
    ack?.({ ok: true });
  });

  socket.on('room:leave', () => leaveRoom(socket, true));

  socket.on('disconnect', () => leaveRoom(socket, false));

  function leaveRoom(socket, voluntary) {
    const room = getRoom(socket.data.code);
    if (!room) return;
    const idx = playerIndex(room, socket.data.playerId);
    if (idx < 0) return;
    const player = room.players[idx];
    socket.leave(room.code);
    socket.data.code = null;

    if (voluntary || room.status === 'lobby') {
      // Saída definitiva (ou queda no lobby): remove na hora.
      room.players.splice(idx, 1);
      if (room.players.length === 0) return removeRoom(room.code);
      if (room.hostId === player.id) room.hostId = room.players[0].id;
      if (voluntary && room.status === 'playing') {
        if (room.players.length < 2) {
          closeRoom(room, `${player.name} saiu. A partida foi encerrada.`);
          return;
        }
        room.state = removePlayerFromState(room.state, idx);
        io.to(room.code).emit('notice', {
          text: `${player.name} saiu do jogo. As peças dele voltaram ao monte.`,
        });
        broadcastState(room);
      }
      broadcastRoom(room);
      return;
    }

    // Queda durante a partida: pausa e espera reconexão por 60s.
    player.connected = false;
    player.socketId = null;
    const deadline = Date.now() + RECONNECT_TIMEOUT_MS;
    const timer = setTimeout(() => handleReconnectTimeout(room, player.id), RECONNECT_TIMEOUT_MS);
    room.pauses.set(player.id, { deadline, timer });
    broadcastRoom(room);
    broadcastPause(room);
  }
});

httpServer.listen(PORT, () => {
  console.log(`Servidor de dominó ouvindo em http://localhost:${PORT}`);
});
