// Placar acumulado da partida (até a meta) + rodada + monte.
export default function Scoreboard({ players, scores, targetScore, round, boneyardCount, currentPlayer, phase, myIndex }) {
  return (
    <aside className="scoreboard">
      <h2>Placar <small>(até {targetScore})</small></h2>
      <ul>
        {players.map((p, i) => (
          <li key={i} className={phase === 'playing' && currentPlayer === i ? 'turn' : ''}>
            <span className="score-name">
              {p.name}
              {i === myIndex ? ' (você)' : ''}
            </span>
            <span className="score-value">{scores[i]}</span>
          </li>
        ))}
      </ul>
      <div className="scoreboard-meta">
        <span>Rodada {round}</span>
        <span>Monte: {boneyardCount}</span>
      </div>
    </aside>
  );
}
