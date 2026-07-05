import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSocket, saveSession, loadSession, clearSession } from '../net/socket.js';
import { getEnds } from '../game/board.js';
import { getPlayableTiles } from '../game/rules.js';

// Gerencia todo o fluxo multiplayer: conexão, sala, jogo e reconexão.
export function useMultiplayer(playerName) {
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null); // resumo da sala (lobby + jogo)
  const [game, setGame] = useState(null); // estado filtrado do jogo
  const [error, setError] = useState(null);
  const [pausedInfo, setPausedInfo] = useState(null); // { waiting: [{name, deadline}] }
  const [notice, setNotice] = useState(null);
  const [closedReason, setClosedReason] = useState(null);
  const sessionRef = useRef(loadSession());

  useEffect(() => {
    const socket = getSocket();

    function tryRejoin() {
      const session = sessionRef.current;
      if (!session?.code || !session?.playerId) return;
      socket.emit('room:rejoin', session, (res) => {
        if (!res?.ok) {
          clearSession();
          sessionRef.current = null;
        }
      });
    }

    function onConnect() {
      setConnected(true);
      tryRejoin();
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onRoomUpdate(summary) {
      setRoom(summary);
      setClosedReason(null);
    }
    function onGameState(state) {
      setGame(state);
    }
    function onPaused(info) {
      setPausedInfo(info);
    }
    function onResumed() {
      setPausedInfo(null);
    }
    function onNotice({ text }) {
      setNotice(text);
      setTimeout(() => setNotice(null), 6000);
    }
    function onClosed({ reason }) {
      clearSession();
      sessionRef.current = null;
      setRoom(null);
      setGame(null);
      setPausedInfo(null);
      setClosedReason(reason);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:update', onRoomUpdate);
    socket.on('game:state', onGameState);
    socket.on('game:paused', onPaused);
    socket.on('game:resumed', onResumed);
    socket.on('notice', onNotice);
    socket.on('room:closed', onClosed);
    socket.connect();
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:update', onRoomUpdate);
      socket.off('game:state', onGameState);
      socket.off('game:paused', onPaused);
      socket.off('game:resumed', onResumed);
      socket.off('notice', onNotice);
      socket.off('room:closed', onClosed);
    };
  }, []);

  const withAck = useCallback((event, payload) => {
    setError(null);
    getSocket().emit(event, payload ?? {}, (res) => {
      if (res?.ok) {
        if (res.code && res.playerId) {
          const session = { code: res.code, playerId: res.playerId };
          sessionRef.current = session;
          saveSession(session);
        }
      } else if (res?.error) {
        setError(res.error);
      }
    });
  }, []);

  const actions = useMemo(
    () => ({
      createRoom: () => withAck('room:create', { name: playerName }),
      joinRoom: (code) => withAck('room:join', { code, name: playerName }),
      startGame: () => withAck('room:start'),
      play: (tileId, side) =>
        withAck('game:action', { action: { type: 'PLAY_TILE', tileId, side } }),
      draw: () => withAck('game:action', { action: { type: 'DRAW_TILE' } }),
      pass: () => withAck('game:action', { action: { type: 'PASS' } }),
      nextRound: () => withAck('game:next-round'),
      newMatch: () => withAck('room:new-match'),
      leave: () => {
        getSocket().emit('room:leave');
        clearSession();
        sessionRef.current = null;
        setRoom(null);
        setGame(null);
        setPausedInfo(null);
      },
      dismissError: () => setError(null),
    }),
    [withAck, playerName]
  );

  const myId = sessionRef.current?.playerId;
  const isHost = room && myId === room.hostId;

  // Visão para o GameScreen (mesmo formato do single-player).
  const view = useMemo(() => {
    if (!game) return null;
    const ends = getEnds(game.board);
    const playable = {};
    for (const { tile, sides } of getPlayableTiles(game.myHand, ends)) {
      playable[tile.id] = sides;
    }
    const hasPlayable = Object.keys(playable).length > 0;
    const waiting = pausedInfo?.waiting?.[0] ?? null;
    return {
      mode: 'multi',
      myIndex: game.myIndex,
      players: game.playerNames.map((name, i) => ({
        name,
        tileCount: game.handCounts[i],
        connected: room?.players?.[i]?.connected ?? true,
      })),
      scores: game.scores,
      targetScore: game.targetScore,
      round: game.round,
      board: game.board,
      ends,
      myHand: game.myHand,
      playable,
      boneyardCount: game.boneyardCount,
      currentPlayer: game.currentPlayer,
      phase: game.phase,
      roundResult: game.roundResult,
      matchWinner: game.matchWinner,
      canDraw: !hasPlayable && game.boneyardCount > 0,
      canPass: !hasPlayable && game.boneyardCount === 0,
      paused: waiting ? { name: waiting.name, deadline: waiting.deadline } : null,
    };
  }, [game, room, pausedInfo]);

  return { connected, room, view, isHost, error, notice, closedReason, actions };
}
