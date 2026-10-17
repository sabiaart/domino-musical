import { useState } from 'react';
import Tile from './Tile.jsx';

// Mão do jogador. Duas formas de jogar uma peça destacada:
// - duplo clique: joga sozinha (se encaixar nas duas pontas, pergunta qual);
// - arrastar: leva a peça até a zona de encaixe na ponta da mesa.
// Peça de notas diferentes que cabe nas duas posições: um balão pergunta se
// ela entra deitada (horizontal) ou em pé (vertical).
export default function Hand({
  hand,
  playable,
  myTurn,
  ends,
  onPlay,
  onDragStart,
  draggingId,
  pendingOrient,
  onChooseOrient,
  onCancelOrient,
}) {
  const [choosing, setChoosing] = useState(null); // tileId aguardando escolha de ponta

  function handleDoubleClick(tile) {
    const sides = playable[tile.id];
    if (!sides || sides.length === 0) return;
    if (pendingOrient?.tileId === tile.id) {
      onCancelOrient();
      return;
    }
    if (sides.length > 1 && ends && ends.left !== ends.right) {
      setChoosing(choosing === tile.id ? null : tile.id);
      return;
    }
    setChoosing(null);
    onPlay(tile.id, sides[0]);
  }

  function chooseSide(tileId, side) {
    setChoosing(null);
    onPlay(tileId, side);
  }

  const hasPlayable = myTurn && Object.keys(playable).length > 0;

  return (
    <div className="hand-area">
      <div className="hand" data-my-turn={myTurn}>
        {hand.map((tile) => {
          const sides = playable[tile.id] ?? [];
          const isPlayable = myTurn && sides.length > 0;
          return (
            <div key={tile.id} className={`hand-slot ${draggingId === tile.id ? 'dragging' : ''}`}>
              {pendingOrient?.tileId === tile.id && (
                <div className="side-chooser" role="group" aria-label="Escolha a posição">
                  {pendingOrient.options.includes('horizontal') && (
                    <button type="button" onClick={() => onChooseOrient('horizontal')}>
                      ▬ Horizontal
                    </button>
                  )}
                  {pendingOrient.options.includes('vertical') && (
                    <button type="button" onClick={() => onChooseOrient('vertical')}>
                      ▮ Vertical
                    </button>
                  )}
                </div>
              )}
              {choosing === tile.id && (
                <div className="side-chooser" role="group" aria-label="Escolha a ponta">
                  <button type="button" onClick={() => chooseSide(tile.id, 'left')}>
                    ◀ Esquerda
                  </button>
                  <button type="button" onClick={() => chooseSide(tile.id, 'right')}>
                    Direita ▶
                  </button>
                </div>
              )}
              <Tile
                a={tile.a}
                b={tile.b}
                highlight={isPlayable}
                dimmed={myTurn && !isPlayable}
                onDoubleClick={isPlayable ? () => handleDoubleClick(tile) : undefined}
                onPointerDown={
                  isPlayable && onDragStart
                    ? (e) => {
                        setChoosing(null);
                        onCancelOrient?.();
                        onDragStart(tile, sides, e);
                      }
                    : undefined
                }
                title={isPlayable ? 'Arraste até a mesa ou dê dois cliques' : undefined}
              />
            </div>
          );
        })}
        {hand.length === 0 && <p className="hand-empty">Bati! 🎉</p>}
      </div>
      {hasPlayable && (
        <p className="hand-hint">
          Arraste a peça até a ponta da mesa ou dê dois cliques para jogar.
        </p>
      )}
    </div>
  );
}
