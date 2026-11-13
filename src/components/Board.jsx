import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Tile from './Tile.jsx';
import { placedNoteOrder } from '../game/board.js';
import {
  layoutChain,
  centralizar,
  zoneRect,
  oposta,
  unidadeParaLargura,
  setaParaVizinha,
} from '../ui/layoutChain.js';
import {
  playTileNotes,
  playChainNote,
  planTile,
  resetMelody,
  getChainGap,
} from '../ui/sound.js';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Silêncio antes da repetição pela tecla R.
const SILENCIO_ANTES_DA_REPETICAO_MS = 1000;

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
export default function Board({
  board,
  seed = 0,
  dropSides = null,
  hoveredSide = null,
  onAreaChange,
}) {
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

  useEffect(() => {
    onAreaChange?.(area);
  }, [area, onAreaChange]);

  // Toca as notas da peça recém-colocada (uma por vez; entradas em lote,
  // como reconexão no multiplayer, ficam mudas).
  const prevIdsRef = useRef(null);
  useEffect(() => {
    const prev = prevIdsRef.current;
    const ids = new Set(board.map((p) => p.tile.id));
    prevIdsRef.current = ids;

    // Início de jogo: a mesa recomeça com a peça inicial, que também soa.
    if (board.length === 1 && (prev === null || prev.size !== 1)) {
      playTileNotes(board[0].left, board[0].right);
      return;
    }
    if (prev === null) return; // entrou numa partida já em andamento
    const novas = board.map((p, i) => (prev.has(p.tile.id) ? -1 : i)).filter((i) => i >= 0);
    if (novas.length !== 1) return;
    playTileNotes(...placedNoteOrder(board, novas[0]));
  }, [board]);

  // Botões de seta numa peça: tocam dela até uma das pontas da cadeia, nota
  // por nota, destacando a peça que está soando. Cada seta aponta para a peça
  // vizinha naquele sentido, como ela aparece na tela.
  // A sequência anda uma nota por vez num timer, então pausar é só segurar o
  // timer e lembrar onde parou.
  const [tocando, setTocando] = useState(null); // id da peça soando
  const [player, setPlayer] = useState(null); // null | 'tocando' | 'pausado'
  const seqRef = useRef(null); // { notas, donos, idx, timer }

  const pararCadeia = () => {
    if (seqRef.current) clearTimeout(seqRef.current.timer);
    seqRef.current = null;
    setTocando(null);
    setPlayer(null);
  };
  useEffect(() => pararCadeia, []);

  const passo = () => {
    const seq = seqRef.current;
    if (!seq) return;
    if (seq.idx >= seq.notas.length) {
      pararCadeia();
      return;
    }
    // As notas vêm em pares, uma peça por vez: na primeira de cada peça,
    // escolhe as alturas das duas juntas (o modo de intervalos pode ter
    // mudado desde a peça anterior).
    if (seq.idx % 2 === 0) seq.plano = planTile(seq.notas[seq.idx], seq.notas[seq.idx + 1]);
    playChainNote(seq.notas[seq.idx], seq.plano[seq.idx % 2]);
    setTocando(seq.donos[seq.idx]);
    seq.idx += 1;
    seq.timer = setTimeout(passo, getChainGap() * 1000);
  };

  const pausar = () => {
    const seq = seqRef.current;
    if (!seq) return;
    clearTimeout(seq.timer);
    setPlayer('pausado');
  };

  const continuar = () => {
    if (!seqRef.current) return;
    setPlayer('tocando');
    passo();
  };

  // Guarda a peça (não a posição): jogadas na ponta inicial deslocam as posições.
  const ultimoTrechoRef = useRef(null); // { id, sentido } do último tocado
  // `espera`: silêncio antes da primeira nota, em ms. Ele vale como parte da
  // sequência, então pausar ou parar durante ele funciona como numa nota.
  const tocarDesde = (inicio, sentido, espera = 0) => {
    ultimoTrechoRef.current = { id: board[inicio]?.tile.id, sentido };
    pararCadeia();
    const notas = [];
    const donos = [];
    const pecas = sentido === 'fim' ? board.slice(inicio) : board.slice(0, inicio + 1).reverse();
    pecas.forEach((p) => {
      const nsPeca = sentido === 'fim' ? [p.left, p.right] : [p.right, p.left];
      nsPeca.forEach((n) => {
        notas.push(n);
        donos.push(p.tile.id);
      });
    });
    seqRef.current = { notas, donos, idx: 0, timer: null };
    resetMelody();
    setPlayer('tocando');
    if (espera > 0) seqRef.current.timer = setTimeout(passo, espera);
    else passo();
  };

  // Teclado. Espaço: pausa ou continua a cadeia; parada, toca a mesa inteira
  // desde a primeira ponta. R: repete do começo o último trecho tocado, depois
  // de um silêncio. O ref guarda a versão mais recente das funções.
  const tecladoRef = useRef(null);
  tecladoRef.current = (tecla) => {
    if (tecla === 'Space') {
      if (player === 'tocando') pausar();
      else if (player === 'pausado') continuar();
      else if (board.length > 0) tocarDesde(0, 'fim');
      return;
    }
    const trecho = ultimoTrechoRef.current;
    const inicio = trecho ? board.findIndex((p) => p.tile.id === trecho.id) : -1;
    if (inicio >= 0) tocarDesde(inicio, trecho.sentido, SILENCIO_ANTES_DA_REPETICAO_MS);
  };
  useEffect(() => {
    const aoTeclar = (e) => {
      if ((e.code !== 'Space' && e.code !== 'KeyR') || e.repeat) return;
      // Ctrl+R e afins são do navegador (recarregar a página).
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Digitando um nome ou mexendo numa lista, a tecla é do campo. As barras
      // (velocidade, volume) não contam: depois de arrastá-las elas ficam
      // selecionadas, e o Espaço e o R têm de continuar funcionando.
      const campo = e.target.closest?.('input, textarea, select, [contenteditable]');
      if (campo && !(campo.tagName === 'INPUT' && campo.type === 'range')) return;
      // Sem isto o espaço "clica" no último botão usado ou rola a página.
      e.preventDefault();
      tecladoRef.current(e.code);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  const pronto = area.largura > 0;
  const unit = unidadeParaLargura(area.largura);
  const layout = pronto
    ? layoutChain(board, area.largura, unit, seed, area.altura)
    : { cells: [], rects: [], larguraCadeia: 0, alturaCadeia: 0, minX: 0, minY: 0, long: unit * 2 };
  const { offsetX, offsetY, height } = centralizar(layout, area.largura, area.altura);
  const zones = pronto && dropSides ? endZones(layout, offsetX, offsetY, area.largura) : null;

  return (
    <div className="board-area">
      {/* Play, pause e stop, sempre à mão no canto inferior esquerdo da mesa.
          Parado, o play toca a mesa inteira desde a primeira ponta (como o Espaço). */}
      {board.length > 0 && (
        <div className="chain-transport" role="group" aria-label="Reprodução da cadeia">
          {player === 'tocando' ? (
            <button type="button" onClick={pausar} aria-label="Pausar" title="Pausar (Espaço)">
              ⏸
            </button>
          ) : player === 'pausado' ? (
            <button type="button" onClick={continuar} aria-label="Continuar" title="Continuar (Espaço)">
              ▶
            </button>
          ) : (
            <button
              type="button"
              onClick={() => tocarDesde(0, 'fim')}
              aria-label="Tocar a mesa"
              title="Tocar a mesa inteira (Espaço)"
            >
              ▶
            </button>
          )}
          <button
            type="button"
            onClick={pararCadeia}
            disabled={!player}
            aria-label="Parar"
            title="Parar"
          >
            ⏹
          </button>
        </div>
      )}
      <div className="board-scroll" ref={areaRef}>
        <div className="board" style={{ height: `${Math.max(height, unit * 2.4)}px` }}>
          {board.length === 0 && <p className="board-empty">A mesa está vazia</p>}
          {layout.cells.map((cell, i) => (
            <div
              key={cell.id}
              className={`board-cell ${tocando === cell.id ? 'playing' : ''}`}
              style={{ transform: `translate(${cell.x + offsetX}px, ${cell.y + offsetY}px)` }}
            >
              <Tile
                a={cell.flipped ? cell.right : cell.left}
                b={cell.flipped ? cell.left : cell.right}
                vertical={cell.vertical}
                unit={unit}
              />
              <div
                className="chain-play"
                style={{ '--play-size': `${Math.round(Math.min(24, unit * 1.1))}px` }}
              >
                {[
                  ['inicio', setaParaVizinha(layout.rects, i, -1)],
                  // Peça sozinha na mesa: um botão só, que toca ela mesma.
                  ['fim', setaParaVizinha(layout.rects, i, 1) ?? (board.length === 1 ? '▶' : null)],
                ]
                  .filter(([, icone]) => icone)
                  .map(([sentido, icone]) => (
                    <button
                      key={sentido}
                      type="button"
                      aria-label={`Tocar daqui até a ponta ${sentido === 'fim' ? 'final' : 'inicial'}`}
                      title={`Tocar daqui até a ponta ${sentido === 'fim' ? 'final' : 'inicial'}`}
                      onClick={() => tocarDesde(i, sentido)}
                    >
                      {icone}
                    </button>
                  ))}
              </div>
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
    </div>
  );
}
