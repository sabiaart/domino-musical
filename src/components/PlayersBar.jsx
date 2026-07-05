import Tile from './Tile.jsx';

// Oponentes: nome, indicador de vez e peças viradas (apenas a quantidade).
export default function PlayersBar({ players, myIndex, currentPlayer, phase }) {
  return (
    <div className="players-bar">
      {players.map((p, i) => {
        if (i === myIndex) return null;
        const isTurn = phase === 'playing' && currentPlayer === i;
        return (
          <div key={i} className={`opponent ${isTurn ? 'turn' : ''} ${p.connected === false ? 'offline' : ''}`}>
            <div className="opponent-name">
              {isTurn && <span className="turn-dot" aria-hidden="true" />}
              {p.name}
              {p.connected === false && <span className="offline-tag"> (desconectado)</span>}
            </div>
            <div className="opponent-tiles" aria-label={`${p.tileCount} peças`}>
              {Array.from({ length: Math.min(p.tileCount, 14) }, (_, k) => (
                <Tile key={k} back unit={16} />
              ))}
              <span className="tile-count">{p.tileCount}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
