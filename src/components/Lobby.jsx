import { useState } from 'react';
import { isMultiplayerConfigured } from '../net/socket.js';

// Lobby multiplayer: criar sala, entrar por código e sala de espera.
export default function Lobby({ connected, room, isHost, error, closedReason, actions, onBack }) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const serverAvailable = isMultiplayerConfigured();

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível — o código continua visível na tela
    }
  }

  if (!room) {
    return (
      <div className="lobby">
        <h1>Multiplayer</h1>
        {!serverAvailable && (
          <p className="error">
            O servidor multiplayer ainda não está publicado neste site. Jogue contra o
            computador, ou rode o jogo localmente com <code>npm run server</code>.
          </p>
        )}
        {serverAvailable && !connected && <p className="lobby-status">Conectando ao servidor…</p>}
        {closedReason && <p className="error">{closedReason}</p>}
        {error && <p className="error">{error}</p>}

        <section className="menu-card">
          <h2>Criar sala</h2>
          <p className="menu-hint">Você recebe um código para compartilhar com os amigos.</p>
          <button type="button" className="btn primary big" disabled={!connected} onClick={actions.createRoom}>
            Criar sala
          </button>
        </section>

        <section className="menu-card">
          <h2>Entrar em uma sala</h2>
          <div className="join-row">
            <input
              type="text"
              value={code}
              maxLength={6}
              placeholder="CÓDIGO"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && code.trim() && actions.joinRoom(code.trim())}
            />
            <button
              type="button"
              className="btn secondary"
              disabled={!connected || code.trim().length < 4}
              onClick={() => actions.joinRoom(code.trim())}
            >
              Entrar
            </button>
          </div>
        </section>

        <button type="button" className="btn ghost" onClick={onBack}>
          ← Voltar ao menu
        </button>
      </div>
    );
  }

  return (
    <div className="lobby">
      <h1>Sala de espera</h1>
      <div className="room-code" onClick={copyCode} role="button" tabIndex={0} title="Clique para copiar">
        <span className="room-code-value">{room.code}</span>
        <span className="room-code-hint">{copied ? 'Copiado! ✓' : 'Clique para copiar'}</span>
      </div>

      {error && <p className="error">{error}</p>}

      <ul className="player-list">
        {room.players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'offline'}>
            {p.name}
            {p.id === room.hostId && ' 👑'}
            {!p.connected && ' (desconectado)'}
          </li>
        ))}
        {room.players.length < 4 && (
          <li className="player-slot">aguardando jogadores… ({room.players.length}/4)</li>
        )}
      </ul>

      {isHost ? (
        <button
          type="button"
          className="btn primary big"
          disabled={room.players.length < 2}
          onClick={actions.startGame}
        >
          {room.players.length < 2 ? 'Aguardando mais jogadores…' : 'Iniciar partida'}
        </button>
      ) : (
        <p className="lobby-status">Aguardando o anfitrião iniciar a partida…</p>
      )}

      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          actions.leave();
          onBack();
        }}
      >
        Sair da sala
      </button>
    </div>
  );
}
