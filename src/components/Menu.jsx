import { useState } from 'react';

const DIFFICULTIES = [
  { id: 'easy', label: 'Fácil', hint: 'Joga qualquer peça válida' },
  { id: 'medium', label: 'Médio', hint: 'Prioriza carroças e pontos altos' },
  { id: 'hard', label: 'Difícil', hint: 'Conta peças e bloqueia você' },
];

export default function Menu({ initialName, onStartSingle, onGoMultiplayer }) {
  const [name, setName] = useState(initialName || '');
  const [difficulty, setDifficulty] = useState('medium');

  const trimmed = name.trim();

  return (
    <div className="menu">
      <h1 className="logo">
        <span className="logo-tile" aria-hidden="true">🎵</span> Dominó Musical
      </h1>
      <p className="menu-hint">
        As peças usam as 7 notas — Dó, Ré, Mi, Fá, Sol, Lá, Si — e nota encaixa com nota igual.
      </p>

      <label className="field">
        Seu nome
        <input
          type="text"
          value={name}
          maxLength={16}
          placeholder="Como quer ser chamado?"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <section className="menu-card">
        <h2>Contra o computador</h2>
        <div className="difficulty-row" role="radiogroup" aria-label="Dificuldade">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`difficulty ${difficulty === d.id ? 'selected' : ''}`}
              onClick={() => setDifficulty(d.id)}
              title={d.hint}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn primary big"
          disabled={!trimmed}
          onClick={() => onStartSingle(trimmed, difficulty)}
        >
          Jogar
        </button>
      </section>

      <section className="menu-card">
        <h2>Multiplayer online</h2>
        <p className="menu-hint">2 a 4 jogadores — crie uma sala e compartilhe o código.</p>
        <button
          type="button"
          className="btn secondary big"
          disabled={!trimmed}
          onClick={() => onGoMultiplayer(trimmed)}
        >
          Entrar no lobby
        </button>
      </section>

      {!trimmed && <p className="menu-hint">Digite seu nome para começar.</p>}
    </div>
  );
}
