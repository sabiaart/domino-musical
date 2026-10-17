import { useCallback, useState } from 'react';
import Board from './Board.jsx';
import Hand from './Hand.jsx';
import Tile from './Tile.jsx';
import PlayersBar from './PlayersBar.jsx';
import GameInfo from './GameInfo.jsx';
import Controls from './Controls.jsx';
import {
  isMuted,
  setMuted,
  getIntervalMode,
  setIntervalMode,
  getChainGap,
  setChainGap,
  getVolume,
  setVolume,
  CHAIN_GAP_MIN_S,
  CHAIN_GAP_MAX_S,
} from '../ui/sound.js';
import { orientacoesPossiveis } from '../ui/layoutChain.js';
import { useTileDrag } from '../hooks/useTileDrag.js';

// Resultado do jogo num painel abaixo da mesa — sem cobrir o tabuleiro,
// para dar para continuar tocando a cadeia inteira antes de seguir.
function GameResult({ view, onNewMatch, onExit }) {
  const { result, players, myIndex } = view;
  if (!result) return null;

  let title;
  if (result.reason === 'tie') {
    title = 'Jogo fechado — empate!';
  } else if (result.winner === myIndex) {
    title =
      result.reason === 'domino'
        ? 'Você bateu! 🎉'
        : 'Jogo fechado — você venceu com menos peças! 🎉';
  } else {
    const name = players[result.winner].name;
    title =
      result.reason === 'domino'
        ? `${name} bateu.`
        : `Jogo fechado — ${name} venceu com menos peças.`;
  }

  return (
    <section className="round-result" role="status">
      <div className="round-result-info">
        <h2>{title}</h2>
        <ul className="result-list">
          {players.map((p, i) => (
            <li key={i} className={result.winner === i ? 'winner' : ''}>
              {p.name}
              {i === myIndex ? ' (você)' : ''}:{' '}
              <span className="result-hand">
                {result.tilesLeft[i] === 0
                  ? 'sem peças'
                  : `${result.tilesLeft[i]} ${result.tilesLeft[i] === 1 ? 'peça' : 'peças'} na mão`}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="overlay-actions">
        {onNewMatch ? (
          <button type="button" className="btn primary" onClick={onNewMatch}>
            Novo jogo
          </button>
        ) : (
          <p className="waiting-host">Aguardando o anfitrião iniciar um novo jogo…</p>
        )}
        <button type="button" className="btn ghost" onClick={onExit}>
          Voltar ao menu
        </button>
      </div>
    </section>
  );
}

export default function GameScreen({ view, onPlay, onDraw, onPass, onNewMatch, onExit }) {
  const { players, myIndex, currentPlayer, phase, paused } = view;
  const myTurn = phase === 'playing' && currentPlayer === myIndex && !paused;
  const [soundOn, setSoundOn] = useState(() => !isMuted());
  const [intervalMode, setIntervalModeState] = useState(getIntervalMode);
  const [volume, setVolumeState] = useState(getVolume);
  const changeVolume = (v) => {
    setVolume(v);
    setVolumeState(getVolume());
    // Mexer no volume com o som desligado religa o som.
    if (!soundOn && v > 0) {
      setMuted(false);
      setSoundOn(true);
    }
  };
  const [chainGap, setChainGapState] = useState(getChainGap);
  const changeChainGap = (segundos) => {
    setChainGap(segundos);
    setChainGapState(getChainGap());
  };
  const changeIntervalMode = (mode) => {
    setIntervalMode(mode);
    setIntervalModeState(mode);
  };
  // Peça de notas diferentes que cabe em pé e deitada: o jogador escolhe a
  // posição antes de ela entrar na mesa.
  const [area, setArea] = useState({ largura: 0, altura: 0 });
  const [pendingOrient, setPendingOrient] = useState(null); // { tileId, side, options }
  const tryPlay = useCallback(
    (tileId, side) => {
      const tile = view.myHand.find((t) => t.id === tileId);
      const options = tile
        ? orientacoesPossiveis(view.board, tile, side, area.largura, area.altura, view.seed)
        : [];
      if (options.length > 1) {
        setPendingOrient({ tileId, side, options });
        return;
      }
      setPendingOrient(null);
      onPlay(tileId, side, options[0]);
    },
    [view.myHand, view.board, view.seed, area, onPlay],
  );
  const chooseOrient = (orient) => {
    if (!pendingOrient) return;
    setPendingOrient(null);
    onPlay(pendingOrient.tileId, pendingOrient.side, orient);
  };
  const { drag, hoveredSide, ghostRef, startDrag } = useTileDrag(tryPlay);

  function toggleSound() {
    setMuted(soundOn);
    setSoundOn(!soundOn);
  }

  return (
    <div className="game-screen">
      <header className="game-header">
        <PlayersBar
          players={players}
          myIndex={myIndex}
          currentPlayer={currentPlayer}
          phase={phase}
        />
        <GameInfo
          players={players}
          boneyardCount={view.boneyardCount}
          currentPlayer={currentPlayer}
          phase={phase}
          myIndex={myIndex}
        />
      </header>

      <div className={`turn-banner ${myTurn ? 'mine' : ''}`} role="status">
        {paused
          ? `⏸ Jogo pausado — aguardando ${paused.name} reconectar (${paused.secondsLeft}s)`
          : phase === 'playing'
            ? myTurn
              ? 'Sua vez!'
              : `Vez de ${players[currentPlayer].name}…`
            : 'Fim de jogo'}
      </div>

      <Board
        board={view.board}
        seed={view.seed}
        dropSides={drag ? drag.sides : null}
        hoveredSide={hoveredSide}
        onAreaChange={setArea}
      />

      <footer className="game-footer">
        {phase === 'gameEnd' && <GameResult view={view} onNewMatch={onNewMatch} onExit={onExit} />}
        <Hand
          hand={view.myHand}
          playable={view.playable}
          myTurn={myTurn}
          ends={view.ends}
          onPlay={tryPlay}
          pendingOrient={myTurn ? pendingOrient : null}
          onChooseOrient={chooseOrient}
          onCancelOrient={() => setPendingOrient(null)}
          onDragStart={startDrag}
          draggingId={drag?.tile.id ?? null}
        />
        <Controls
          canDraw={myTurn && view.canDraw}
          canPass={myTurn && view.canPass}
          onDraw={onDraw}
          onPass={onPass}
          onExit={onExit}
          soundOn={soundOn}
          onToggleSound={toggleSound}
          volume={volume}
          onVolume={changeVolume}
          intervalMode={intervalMode}
          onIntervalMode={changeIntervalMode}
          chainGap={chainGap}
          onChainGap={changeChainGap}
          gapMin={CHAIN_GAP_MIN_S}
          gapMax={CHAIN_GAP_MAX_S}
        />
      </footer>

      {drag && (
        <div
          className="drag-ghost"
          ref={ghostRef}
          style={{
            width: `${drag.w}px`,
            height: `${drag.h}px`,
            transform: `translate(${drag.x}px, ${drag.y}px)`,
          }}
        >
          <Tile a={drag.tile.a} b={drag.tile.b} unit={drag.w / 2} highlight hoverSound={false} />
        </div>
      )}
    </div>
  );
}
