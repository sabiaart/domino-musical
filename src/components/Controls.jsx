// Botões de ação: comprar (só sem jogada e com monte), passar (só sem jogada
// e monte vazio), som, novo jogo e sair.
export default function Controls({ canDraw, canPass, onDraw, onPass, onNewMatch, onExit, soundOn, onToggleSound }) {
  return (
    <div className="controls">
      <button type="button" className="btn primary" onClick={onDraw} disabled={!canDraw}>
        Comprar peça
      </button>
      <button type="button" className="btn warning" onClick={onPass} disabled={!canPass}>
        Passar a vez
      </button>
      <button
        type="button"
        className="btn ghost"
        onClick={onToggleSound}
        title={soundOn ? 'Silenciar notas' : 'Ativar notas'}
        aria-label={soundOn ? 'Silenciar notas' : 'Ativar notas'}
      >
        {soundOn ? '🔊' : '🔇'}
      </button>
      {onNewMatch && (
        <button type="button" className="btn ghost" onClick={onNewMatch}>
          Novo jogo
        </button>
      )}
      <button type="button" className="btn ghost" onClick={onExit}>
        Sair
      </button>
    </div>
  );
}
