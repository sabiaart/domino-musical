import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Tile from './Tile.jsx';
import { placedNoteOrder } from '../game/board.js';
import { layoutChain } from '../ui/layoutChain.js';
import { playTileNotes } from '../ui/sound.js';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Zonas de soltura nas duas pontas da cadeia, adjacentes às peças das pontas,
// na direção em que a cadeia cresce (respeitando a serpentina).
function endZones(cells, unit, long, containerWidth) {
  if (cells.length === 0) return null;
  const size = long;
  const gap = 6;
  const first = cells[0];
  const last = cells[cells.length - 1];
  const firstW = first.vertical ? unit : long;
  const lastW = last.vertical ? unit : long;
  // A ponta esquerda cresce contra a direção de leitura da linha da primeira
  // peça; a direita, a favor da linha da última.
  const leftX = first.flipped ? first.x + firstW + gap : first.x - gap - size;
  const rightX = last.flipped ? last.x - gap - size : last.x + lastW + gap;
  const centerY = (cell) => cell.y + (cell.vertical ? long : unit) / 2;
  return {
    size,
    left: {
      x: clamp(leftX, 0, containerWidth - size),
      y: centerY(first) - size / 2,
    },
    right: {
      x: clamp(rightX, 0, containerWidth - size),
      y: centerY(last) - size / 2,
    },
  };
}

// Mesa: cadeia em serpentina, com posições absolutas animadas via transição CSS.
// Durante um arrasto, mostra zonas de encaixe nas pontas válidas para a peça.
export default function Board({ board, dropSides = null, hoveredSide = null }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  // Toca as notas da peça recém-colocada (uma por vez; entradas em lote,
  // como reconexão no multiplayer, ficam mudas).
  const prevIdsRef = useRef(null);
  useEffect(() => {
    const prev = prevIdsRef.current;
    const ids = new Set(board.map((p) => p.tile.id));
    prevIdsRef.current = ids;

    // Início de rodada: a mesa recomeça com a peça inicial, que também soa.
    if (board.length === 1 && (prev === null || prev.size !== 1)) {
      playTileNotes(board[0].left, board[0].right);
      return;
    }
    if (prev === null) return; // entrou numa partida já em andamento
    const novas = board.map((p, i) => (prev.has(p.tile.id) ? -1 : i)).filter((i) => i >= 0);
    if (novas.length !== 1) return;
    playTileNotes(...placedNoteOrder(board, novas[0]));
  }, [board]);

  const unit = width > 0 && width < 520 ? 24 : 32;
  const { cells, height, long } =
    width > 0 ? layoutChain(board, width, unit) : { cells: [], height: 0, long: unit * 2 };
  const zones = dropSides ? endZones(cells, unit, long, width) : null;

  return (
    <div className="board-scroll">
      <div className="board" ref={containerRef} style={{ height: `${Math.max(height, unit * 2.4)}px` }}>
        {board.length === 0 && <p className="board-empty">A mesa está vazia</p>}
        {cells.map((cell) => (
          <div
            key={cell.id}
            className="board-cell"
            style={{ transform: `translate(${cell.x}px, ${cell.y}px)` }}
          >
            <Tile
              a={cell.flipped ? cell.right : cell.left}
              b={cell.flipped ? cell.left : cell.right}
              vertical={cell.vertical}
              unit={unit}
            />
          </div>
        ))}
        {zones &&
          ['left', 'right']
            .filter((side) => dropSides.includes(side))
            .map((side) => (
              <div
                key={side}
                className={`drop-zone ${hoveredSide === side ? 'over' : ''}`}
                data-drop-side={side}
                style={{
                  transform: `translate(${zones[side].x}px, ${zones[side].y}px)`,
                  width: `${zones.size}px`,
                  height: `${zones.size}px`,
                }}
              >
                {side === 'left' ? '◀' : '▶'}
              </div>
            ))}
      </div>
    </div>
  );
}
