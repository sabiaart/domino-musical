// Jogadores com quantas peças cada um tem na mão, de quem é a vez e o monte.
export default function GameInfo({ players, boneyardCount, currentPlayer, phase, myIndex }) {
  return (
    <aside className="scoreboard">
      <ul>
        {players.map((p, i) => (
          <li key={i} className={phase === 'playing' && currentPlayer === i ? 'turn' : ''}>
            <span className="score-name">
              {p.name}
              {i === myIndex ? ' (você)' : ''}
            </span>
            <span className="score-value">
              {p.tileCount} {p.tileCount === 1 ? 'peça' : 'peças'}
            </span>
          </li>
        ))}
      </ul>
      <div className="scoreboard-meta">
        <span>Monte: {boneyardCount}</span>
      </div>
    </aside>
  );
}
