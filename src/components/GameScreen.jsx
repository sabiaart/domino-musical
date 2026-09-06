import { useState } from 'react';
import Board from './Board.jsx';
import Hand from './Hand.jsx';
import Tile from './Tile.jsx';
import PlayersBar from './PlayersBar.jsx';
import Scoreboard from './Scoreboard.jsx';
import Controls from './Controls.jsx';
import { isMuted, setMuted } from '../ui/sound.js';
import { useTileDrag } from '../hooks/useTileDrag.js';

function RoundEndOverlay({ view, onNextRound, onNewMatch, onExit }) {
  const { roundResult, matchWinner, players, scores, myIndex } = view;
  if (!roundResult) return null;

  let title;
  if (roundResult.reason === 'tie') {
    title = 'Jogo fechado — empate! Ninguém pontua.';
  } else if (roundResult.winner === myIndex) {
    title = roundResult.reason === 'domino' ? 'Você bateu! 🎉' : 'Jogo fechado — você venceu na contagem!';
  } else {
    const name = players[roundResult.winner].name;
    title = roundResult.reason === 'domino' ? `${name} bateu.` : `Jogo fechado — ${name} venceu na contagem.`;
  }

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2>{title}</h2>
        {roundResult.winner !== null && (
          <p className="overlay-points">+{roundResult.points} pontos para {players[roundResult.winner].name}</p>
        )}
        <table className="result-table">
          <tbody>
            {players.map((p, i) => (
              <tr key={i} className={matchWinner === i ? 'winner' : ''}>
                <td>{p.name}{i === myIndex ? ' (você)' : ''}</td>
                <td>{roundResult.handPoints[i]} na mão</td>
                <td><strong>{scores[i]}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
        {matchWinner !== null ? (
          <>
            <p className="match-winner">
              🏆 {players[matchWinner].name} venceu a partida!
            </p>
            <div className="overlay-actions">
              {onNewMatch && (
                <button type="button" className="btn primary" onClick={onNewMatch}>
                  Nova partida
                </button>
              )}
              <button type="button" className="btn ghost" onClick={onExit}>
                Voltar ao menu
              </button>
            </div>
          </>
        ) : (
          <div className="overlay-actions">
            {onNextRound ? (
              <button type="button" className="btn primary" onClick={onNextRound}>
                Próxima rodada
              </button>
            ) : (
              <p className="waiting-host">Aguardando o anfitrião iniciar a próxima rodada…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GameScreen({ view, onPlay, onDraw, onPass, onNextRound, onNewMatch, onExit }) {
  const { players, myIndex, currentPlayer, phase, paused } = view;
  const myTurn = phase === 'playing' && currentPlayer === myIndex && !paused;
  const [soundOn, setSoundOn] = useState(() => !isMuted());
  const { drag, hoveredSide, ghostRef, startDrag } = useTileDrag(onPlay);

  function toggleSound() {
    setMuted(soundOn);
    setSoundOn(!soundOn);
  }

  return (
    <div className="game-screen">
      <header className="game-header">
        <PlayersBar players={players} myIndex={myIndex} currentPlayer={currentPlayer} phase={phase} />
        <Scoreboard
          players={players}
          scores={view.scores}
          targetScore={view.targetScore}
          round={view.round}
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
            : 'Rodada encerrada'}
      </div>

      <Board
        board={view.board}
        seed={view.round}
        dropSides={drag ? drag.sides : null}
        hoveredSide={hoveredSide}
      />

      <footer className="game-footer">
        <Hand
          hand={view.myHand}
          playable={view.playable}
          myTurn={myTurn}
          ends={view.ends}
          onPlay={onPlay}
          onDragStart={startDrag}
          draggingId={drag?.tile.id ?? null}
        />
        <Controls
          canDraw={myTurn && view.canDraw}
          canPass={myTurn && view.canPass}
          onDraw={onDraw}
          onPass={onPass}
          onNewMatch={phase === 'matchEnd' ? onNewMatch : undefined}
          onExit={onExit}
          soundOn={soundOn}
          onToggleSound={toggleSound}
        />
      </footer>

      {(phase === 'roundEnd' || phase === 'matchEnd') && (
        <RoundEndOverlay view={view} onNextRound={onNextRound} onNewMatch={onNewMatch} onExit={onExit} />
      )}

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
