const MODOS = [
  { id: 'pequenos', label: '1ª–4ª', hint: 'Intervalos de 1ª, 2ª, 3ª e 4ª, subindo ou descendo' },
  { id: 'grandes', label: '5ª–8ª', hint: 'Intervalos de 5ª, 6ª, 7ª e 8ª, subindo ou descendo' },
  { id: 'misto', label: 'Misto', hint: 'Mistura os dois grupos de intervalos' },
];

// Botões de ação: comprar (só sem jogada e com monte), passar (só sem jogada
// e monte vazio), modo de intervalos, som e sair.
export default function Controls({
  canDraw,
  canPass,
  onDraw,
  onPass,
  onExit,
  soundOn,
  onToggleSound,
  volume,
  onVolume,
  intervalMode,
  onIntervalMode,
  chainGap,
  onChainGap,
  gapMin,
  gapMax,
}) {
  return (
    <div className="controls">
      <button type="button" className="btn primary" onClick={onDraw} disabled={!canDraw}>
        Comprar peça
      </button>
      <button type="button" className="btn warning" onClick={onPass} disabled={!canPass}>
        Passar a vez
      </button>
      <div className="interval-modes" role="radiogroup" aria-label="Intervalos entre as notas">
        <span className="interval-label">Intervalos</span>
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={intervalMode === m.id}
            className={intervalMode === m.id ? 'selected' : ''}
            onClick={() => onIntervalMode(m.id)}
            title={m.hint}
          >
            {m.label}
          </button>
        ))}
      </div>
      <label className="speed-control" title="Tempo entre as notas ao tocar a cadeia">
        <span className="interval-label">Velocidade</span>
        <input
          type="range"
          min={gapMin}
          max={gapMax}
          step={0.1}
          value={chainGap}
          onChange={(e) => onChainGap(parseFloat(e.target.value))}
          aria-label="Tempo entre as notas, em segundos"
        />
        <span className="speed-value">{chainGap.toFixed(1).replace('.', ',')} s</span>
      </label>
      <div className="speed-control volume-control">
        <button
          type="button"
          className="mute-toggle"
          onClick={onToggleSound}
          title={soundOn ? 'Silenciar notas' : 'Ativar notas'}
          aria-label={soundOn ? 'Silenciar notas' : 'Ativar notas'}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolume(parseInt(e.target.value, 10) / 100)}
          aria-label="Volume"
          title="Volume"
        />
        <span className="speed-value">{Math.round(volume * 100)}%</span>
      </div>
      <button type="button" className="btn ghost" onClick={onExit}>
        Sair
      </button>
    </div>
  );
}
