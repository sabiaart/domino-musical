import { describe, it, expect } from 'vitest';
import { layoutChain, centralizar, zoneRect, oposta, unidadeParaLargura } from '../layoutChain.js';
import { placeTile, getEnds, canPlay, playableSides } from '../../game/board.js';
import { createAllTiles, shuffle, makeTile } from '../../game/tiles.js';
import { seededRng } from '../../game/__tests__/helpers.js';

const UNIT = 32;
const LONG = UNIT * 2;

// Monta uma cadeia real de `n` peças usando as próprias regras de encaixe.
function cadeia(n, semente = 7) {
  const monte = shuffle(createAllTiles(), seededRng(semente));
  let board = placeTile([], monte.pop(), 'right');
  while (board.length < n && monte.length > 0) {
    const ends = getEnds(board);
    const i = monte.findIndex((t) => canPlay(t, ends));
    if (i < 0) break;
    const tile = monte.splice(i, 1)[0];
    board = placeTile(board, tile, playableSides(tile, ends)[0]);
  }
  return board;
}

// Retângulo ocupado por uma peça já posicionada.
const rect = (c, u = UNIT) => ({
  x: c.x,
  y: c.y,
  w: c.vertical ? u : u * 2,
  h: c.vertical ? u * 2 : u,
});

function temSobreposicao(cells, u = UNIT) {
  const rs = cells.map((c) => rect(c, u));
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i];
      const b = rs[j];
      const f = 0.5;
      if (a.x < b.x + b.w - f && a.x + a.w > b.x + f && a.y < b.y + b.h - f && a.y + a.h > b.y + f) {
        return `${cells[i].id} sobrepõe ${cells[j].id}`;
      }
    }
  }
  return null;
}

describe('layoutChain', () => {
  it('posiciona todas as peças da mesa', () => {
    for (const n of [1, 2, 5, 14, 28]) {
      const board = cadeia(n);
      const { cells } = layoutChain(board, 900, UNIT);
      expect(cells).toHaveLength(board.length);
      expect(cells.map((c) => c.id)).toEqual(board.map((p) => p.tile.id));
    }
  });

  it('nenhuma peça se sobrepõe a outra', () => {
    for (let s = 1; s <= 20; s++) {
      for (const [largura, alturaVisivel] of [[380, 260], [420, 300], [700, 360], [1100, 420]]) {
        const board = cadeia(28, s);
        const u = unidadeParaLargura(largura);
        const { cells } = layoutChain(board, largura, u, s, alturaVisivel);
        expect(temSobreposicao(cells, u)).toBeNull();
      }
    }
  });

  it('a cadeia não estoura a largura disponível', () => {
    for (let s = 1; s <= 12; s++) {
      for (const largura of [380, 420, 700, 1100]) {
        const board = cadeia(28, s);
        const l = layoutChain(board, largura, unidadeParaLargura(largura), s, 300);
        expect(l.larguraCadeia).toBeLessThanOrEqual(largura);
      }
    }
  });

  it('a unidade acompanha a largura da tela', () => {
    expect(unidadeParaLargura(380)).toBe(24);
    expect(unidadeParaLargura(900)).toBe(32);
  });

  it('a mesma mesa sempre gera o mesmo desenho', () => {
    const board = cadeia(20, 3);
    const a = layoutChain(board, 800, UNIT, 5);
    const b = layoutChain(board, 800, UNIT, 5);
    expect(b.cells).toEqual(a.cells);
  });

  it('rodadas diferentes desenham a cadeia de outro jeito', () => {
    const board = cadeia(20, 3);
    const r1 = layoutChain(board, 800, UNIT, 1);
    const r2 = layoutChain(board, 800, UNIT, 2);
    expect(r2.cells).not.toEqual(r1.cells);
  });

  it('a cadeia realmente vira: aparecem trechos verticais', () => {
    const board = cadeia(28, 4);
    const { cells } = layoutChain(board, 700, UNIT, 4);
    // Peça comum desenhada na vertical = a cadeia estava subindo ou descendo.
    const comuns = cells.filter((c) => c.left !== c.right);
    expect(comuns.some((c) => c.vertical)).toBe(true);
    expect(comuns.some((c) => !c.vertical)).toBe(true);
  });

  it('vira para os dois lados ao longo das rodadas', () => {
    const alturas = [];
    for (let s = 1; s <= 8; s++) {
      const board = cadeia(28, s);
      const { cells, alturaCadeia } = layoutChain(board, 700, UNIT, s);
      alturas.push(alturaCadeia);
      expect(cells.some((c) => c.y < cells[0].y) || cells.some((c) => c.y > cells[0].y)).toBe(true);
    }
    expect(Math.max(...alturas)).toBeGreaterThan(LONG);
  });

  it('carroça fica atravessada em relação ao trecho', () => {
    // Cadeia curta e reta: a carroça sai vertical enquanto as outras ficam deitadas.
    const board = [
      { tile: makeTile(2, 5), left: 2, right: 5 },
      { tile: makeTile(5, 5), left: 5, right: 5 },
    ];
    const { cells } = layoutChain(board, 900, UNIT);
    const carroca = cells.find((c) => c.id === '5-5');
    const comum = cells.find((c) => c.id === '2-5');
    expect(carroca.vertical).toBe(!comum.vertical);
  });

  it('quase nunca precisa quebrar a linha de emergência', () => {
    // A quebra é o último recurso quando a cadeia se fecha num beco. Ela é
    // segura (não sobrepõe), mas parte o desenho — tem que ser rara.
    for (const [largura, alturaVisivel] of [[380, 260], [420, 300], [700, 360], [1100, 420]]) {
      let comQuebra = 0;
      const total = 120;
      const u = unidadeParaLargura(largura); // a mesma regra que a mesa usa
      for (let s = 1; s <= total; s++) {
        const l = layoutChain(cadeia(28, s), largura, u, s, alturaVisivel);
        if (l.quebras > 0) comQuebra++;
      }
      expect(comQuebra / total).toBeLessThan(0.15);
    }
  });

  it('procura caber na altura visível', () => {
    let couberam = 0;
    const total = 60;
    for (let s = 1; s <= total; s++) {
      const l = layoutChain(cadeia(28, s), 700, UNIT, s, 360);
      if (l.alturaCadeia <= 360) couberam++;
    }
    expect(couberam / total).toBeGreaterThan(0.8);
  });

  it('mesa vazia não quebra', () => {
    const l = layoutChain([], 800, UNIT);
    expect(l.cells).toEqual([]);
    expect(centralizar(l, 800, 300).height).toBe(300);
  });
});

describe('centralizar', () => {
  it('centraliza a cadeia na horizontal', () => {
    const board = cadeia(6, 2);
    const l = layoutChain(board, 800, UNIT, 2);
    const { offsetX } = centralizar(l, 800, 400);
    const esquerda = l.minX + offsetX;
    const direita = esquerda + l.larguraCadeia;
    expect(esquerda).toBeCloseTo(800 - direita, 5); // folgas iguais dos dois lados
  });

  it('centraliza na vertical quando sobra espaço', () => {
    const board = cadeia(3, 2);
    const l = layoutChain(board, 800, UNIT, 2);
    const { offsetY, height } = centralizar(l, 800, 400);
    const topo = l.minY + offsetY;
    expect(height).toBe(400);
    expect(topo).toBeCloseTo(height - (topo + l.alturaCadeia), 5);
  });

  it('cadeia mais alta que a área manda a altura crescer', () => {
    const board = cadeia(28, 9);
    const l = layoutChain(board, 420, UNIT, 9);
    const { height } = centralizar(l, 420, 200);
    expect(height).toBeGreaterThanOrEqual(l.alturaCadeia);
  });
});

describe('zoneRect', () => {
  it('encosta o quadrado no sentido em que a ponta cresce', () => {
    const r = { x: 100, y: 50, w: LONG, h: UNIT };
    expect(zoneRect(r, 'right', LONG, 6).x).toBe(100 + LONG + 6);
    expect(zoneRect(r, 'left', LONG, 6).x).toBe(100 - 6 - LONG);
    expect(zoneRect(r, 'down', LONG, 6).y).toBe(50 + UNIT + 6);
    expect(zoneRect(r, 'up', LONG, 6).y).toBe(50 - 6 - LONG);
  });

  it('oposta inverte a direção', () => {
    expect(oposta('right')).toBe('left');
    expect(oposta('up')).toBe('down');
  });
});
