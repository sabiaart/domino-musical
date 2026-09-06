import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Tile from './Tile.jsx';
import { placedNoteOrder } from '../game/board.js';
import {
  layoutChain,
  centralizar,
  zoneRect,
  oposta,
  unidadeParaLargura,
} from '../ui/layoutChain.js';
import { playTileNotes } from '../ui/sound.js';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Zonas de encaixe nas duas pontas, encostadas no sentido em que cada uma
// cresce — inclusive quando a ponta está subindo ou descendo.
function endZones(layout, offsetX, offsetY, larguraVisivel) {
  const { rects, long, gap } = layout;
  if (!rects || rects.length === 0) return null;
  const size = long;
  const folga = Math.max(gap, 6);
  const mover = (z) => ({
    x: clamp(z.x + offsetX, 0, Math.max(0, larguraVisivel - size)),
    y: z.y + offsetY,
  });
  return {
    size,
    left: mover(zoneRect(rects[0], oposta(layout.dirPrimeira), size, folga)),
    right: mover(zoneRect(rects[rects.length - 1], layout.dirUltima, size, folga)),
  };
}

// Mesa: a cadeia anda em quatro direções (segue reto ou vira para cima/baixo
// por sorteio) e fica centralizada na área visível. As posições são absolutas
// e animadas por transição CSS.
export default function Board({ board, seed = 0, dropSides = null, hoveredSide = null }) {
  const areaRef = useRef(null);
  const [area, setArea] = useState({ largura: 0, altura: 0 });

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entrada]) => {
      const r = entrada.contentRect;
      setArea({ largura: r.width, altura: r.height });
    });
    observer.observe(el);
    setArea({ largura: el.clientWidth, altura: el.clientHeight });
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

  const pronto = area.largura > 0;
  const unit = unidadeParaLargura(area.largura);
  const layout = pronto
    ? layoutChain(board, area.largura, unit, seed, area.altura)
    : { cells: [], rects: [], larguraCadeia: 0, alturaCadeia: 0, minX: 0, minY: 0, long: unit * 2 };
  const { offsetX, offsetY, height } = centralizar(layout, area.largura, area.altura);
  const zones = pronto && dropSides ? endZones(layout, offsetX, offsetY, area.largura) : null;

  return (
    <div className="board-scroll" ref={areaRef}>
      <div className="board" style={{ height: `${Math.max(height, unit * 2.4)}px` }}>
        {board.length === 0 && <p className="board-empty">A mesa está vazia</p>}
        {layout.cells.map((cell) => (
          <div
            key={cell.id}
            className="board-cell"
            style={{ transform: `translate(${cell.x + offsetX}px, ${cell.y + offsetY}px)` }}
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
