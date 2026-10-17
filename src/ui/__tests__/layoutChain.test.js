import { describe, it, expect } from 'vitest';
import {
  setaParaVizinha,
  orientacoesPossiveis,
  layoutChain,
  centralizar,
  zoneRect,
  oposta,
  unidadeParaLargura,
  colocar,
} from '../layoutChain.js';
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


// Comprimento do encosto entre duas peças vizinhas, e por qual eixo.
// No dominó a ligação é sempre pela ponta: o contato mede exatamente uma
// unidade (a largura da face da peça). Lado longo com lado longo daria duas.
function encosto(a, b, gap) {
  const perto = (p, q) => Math.abs(p - q) <= gap + 0.6;
  if (perto(a.x + a.w, b.x) || perto(b.x + b.w, a.x)) {
    return { eixo: 'x', contato: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) };
  }
  if (perto(a.y + a.h, b.y) || perto(b.y + b.h, a.y)) {
    return { eixo: 'y', contato: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) };
  }
  return null; // não se encostam (quebra de linha de emergência)
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
    expect(unidadeParaLargura(380)).toBe(20); // celular: peça menor cabe melhor
    expect(unidadeParaLargura(460)).toBe(24);
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

  it('a quebra de linha de emergência é rara, e some quando há espaço', () => {
    // A quebra é o último recurso quando a mesa cheia não cabe de outro jeito.
    // Ela é segura (não sobrepõe nem perde peça), mas separa o desenho, então
    // precisa ser incomum — e praticamente inexistente numa tela larga.
    const limites = [
      [380, 260, 0.3],
      [700, 360, 0.2],
      [1100, 420, 0.05],
    ];
    for (const [largura, alturaVisivel, maximo] of limites) {
      let comQuebra = 0;
      const total = 120;
      const u = unidadeParaLargura(largura); // a mesma regra que a mesa usa
      for (let s = 1; s <= total; s++) {
        const l = layoutChain(cadeia(28, s), largura, u, s, alturaVisivel);
        if (l.quebras > 0) comQuebra++;
      }
      expect(comQuebra / total, `largura ${largura}`).toBeLessThan(maximo);
    }
  });

  it('a altura fica na mesma ordem de grandeza da área visível', () => {
    // Numa mesa cheia a cadeia pode passar da área e a mesa rola — o que não
    // pode é disparar, obrigando a rolar sem fim.
    for (let s = 1; s <= 80; s++) {
      const l = layoutChain(cadeia(28, s), 1100, UNIT, s, 420);
      expect(l.alturaCadeia).toBeLessThan(420 * 2.5);
    }
  });


  it('toda ligação é pela ponta, como manda o dominó', () => {
    // Regressão: a cadeia já encostou peça com peça pelo lado LONGO ao virar,
    // que é um encaixe inválido. O contato tem de medir uma unidade.
    for (const [largura, alturaVisivel] of [[380, 260], [700, 360], [1100, 420]]) {
      const u = unidadeParaLargura(largura);
      for (let s = 1; s <= 25; s++) {
        const l = layoutChain(cadeia(28, s), largura, u, s, alturaVisivel);
        const rs = l.cells.map((c) => rect(c, u));
        let semEncosto = 0;
        for (let i = 1; i < rs.length; i++) {
          const e = encosto(rs[i - 1], rs[i], l.gap);
          if (e === null) {
            semEncosto++;
            continue;
          }
          expect(
            Math.abs(e.contato - u),
            `semente ${s}: ${l.cells[i - 1].id} com ${l.cells[i].id} encosta ${e.contato}px (esperado ${u})`
          ).toBeLessThan(0.6);
        }
        // Só a quebra de emergência pode deixar peças sem encosto.
        expect(semEncosto).toBe(l.quebras);
      }
    }
  });

  it('carroça sempre liga pelo meio, dos dois lados', () => {
    // A cadeia nunca vira numa carroça: ela fica atravessada e as vizinhas
    // encostam no centro dela, em lados opostos.
    for (const [largura, alturaVisivel] of [[380, 260], [700, 360], [1100, 420]]) {
      const u = unidadeParaLargura(largura);
      for (let s = 1; s <= 25; s++) {
        const board = cadeia(28, s);
        const l = layoutChain(board, largura, u, s, alturaVisivel);
        const rs = l.cells.map((c) => rect(c, u));
        const centro = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
        for (let i = 1; i < rs.length - 1; i++) {
          if (board[i].tile.a !== board[i].tile.b) continue;
          const vizinhas = [i - 1, i + 1].filter((j) => encosto(rs[i], rs[j], l.gap));
          const c = centro(rs[i]);
          const lados = vizinhas.map((j) => {
            const v = rs[j];
            // A vizinha cruza a linha do meio da carroça (atravessada a ela).
            const cruzaMeio = rs[i].h > rs[i].w
              ? v.y < c.y && v.y + v.h > c.y
              : v.x < c.x && v.x + v.w > c.x;
            expect(cruzaMeio, `semente ${s}: ${l.cells[j].id} não encosta no meio de ${l.cells[i].id}`).toBe(true);
            const cv = centro(v);
            return rs[i].h > rs[i].w ? Math.sign(cv.x - c.x) : Math.sign(cv.y - c.y);
          });
          if (lados.length === 2) expect(lados[0]).toBe(-lados[1]);
        }
      }
    }
  });

  it('peça comum que vira fica em pé, encostando pela metade que conecta', () => {
    const m = { unit: 32, long: 64, gap: 3, larguraMax: 9999, alturaMax: 9999 };
    // Cadeia vindo da direita, saindo pela ponta (100, 50); vira para baixo.
    const { rect: r, novaSaida } = colocar({ x: 100, y: 50 }, 'right', 'down', false, m);
    expect(r.w).toBe(32); // em pé
    expect(r.h).toBe(64);
    expect(r.x).toBe(103); // encostada à frente, com o vão
    // A METADE de cima (a que conecta) fica centrada na linha da cadeia.
    expect(r.y + 16).toBe(50);
    // E a cadeia segue pela face de baixo.
    expect(novaSaida).toEqual({ x: 103 + 16, y: r.y + 64 });
  });

  it('carroça entra atravessada e a cadeia passa pelo meio dela', () => {
    const m = { unit: 32, long: 64, gap: 3, larguraMax: 9999, alturaMax: 9999 };
    const { rect: r, novaSaida } = colocar({ x: 100, y: 50 }, 'right', 'right', true, m);
    expect(r.w).toBe(32); // atravessada
    expect(r.h).toBe(64);
    expect(r.y + 32).toBe(50); // centrada na linha da cadeia
    expect(novaSaida).toEqual({ x: r.x + 32, y: 50 }); // sai pelo meio
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

describe('setaParaVizinha', () => {
  const r = (x, y, w = 40, h = 20) => ({ x, y, w, h });
  const rects = [r(0, 0), r(42, 0), r(84, 0, 20, 40), r(84, 42, 20, 40), r(42, 84)];

  it('aponta para a vizinha como ela aparece na tela', () => {
    expect(setaParaVizinha(rects, 1, -1)).toBe('◀');
    expect(setaParaVizinha(rects, 1, 1)).toBe('▶');
    expect(setaParaVizinha(rects, 3, -1)).toBe('▲');
    expect(setaParaVizinha(rects, 2, 1)).toBe('▼');
    expect(setaParaVizinha(rects, 4, -1)).toBe('▶'); // cadeia voltando para a esquerda
  });

  it('nas pontas não há seta para fora da cadeia', () => {
    expect(setaParaVizinha(rects, 0, -1)).toBeNull();
    expect(setaParaVizinha(rects, 4, 1)).toBeNull();
  });
});

describe('posição escolhida pelo jogador', () => {
  // Carroça no meio da mesa larga, com espaço de sobra para os dois lados.
  const base = placeTile([], makeTile(3, 3), 'right');

  it('placeTile guarda a posição só em peças de notas diferentes', () => {
    const b = placeTile(base, makeTile(3, 5), 'right', 'vertical');
    expect(b[1].orient).toBe('vertical');
    const d = placeTile(b, makeTile(5, 5), 'right', 'horizontal');
    expect(d[2].orient).toBeUndefined();
  });

  it('a peça fica na posição escolhida, nas duas pontas', () => {
    for (const side of ['left', 'right']) {
      for (const orient of ['horizontal', 'vertical']) {
        // Uma peça comum entre a carroça e a nova, para a nova poder virar.
        let board = placeTile(base, makeTile(1, 3), side, 'horizontal');
        board = placeTile(board, makeTile(6, 1), side, orient);
        const idx = side === 'left' ? 0 : board.length - 1;
        const { cells } = layoutChain(board, 900, UNIT, 1, 400);
        expect(cells[idx].vertical, `${side} ${orient}`).toBe(orient === 'vertical');
      }
    }
  });

  it('orientacoesPossiveis: com espaço, as duas; carroça, nenhuma', () => {
    const board = placeTile(base, makeTile(3, 5), 'right', 'horizontal');
    expect(orientacoesPossiveis(board, makeTile(5, 1), 'right', 900, 400, 1)).toEqual([
      'horizontal',
      'vertical',
    ]);
    expect(orientacoesPossiveis(board, makeTile(5, 5), 'right', 900, 400, 1)).toEqual([]);
  });

  it('logo depois de uma carroça a peça só pode seguir reto', () => {
    // A carroça entrega a cadeia pelo lado longo: virar ali seria encaixe inválido.
    const opcoes = orientacoesPossiveis(base, makeTile(3, 5), 'right', 900, 400, 1);
    expect(opcoes).toEqual(['horizontal']);
  });
});

describe('peças já postas não mudam', () => {
  it('a cada jogada, as peças anteriores mantêm lugar e forma', () => {
    for (const [largura, altura] of [[380, 260], [700, 360], [1100, 420]]) {
      const u = unidadeParaLargura(largura);
      for (let s = 1; s <= 30; s++) {
        const monte = shuffle(createAllTiles(), seededRng(s));
        const rng = seededRng(s + 1000);
        let board = placeTile([], monte.pop(), 'right');
        let antes = layoutChain(board, largura, u, s, altura);
        while (monte.length > 0) {
          const ends = getEnds(board);
          const i = monte.findIndex((t) => canPlay(t, ends));
          if (i < 0) break;
          const tile = monte.splice(i, 1)[0];
          const lados = playableSides(tile, ends);
          const lado = lados[Math.floor(rng() * lados.length)];
          const orient = rng() < 0.5 ? undefined : rng() < 0.5 ? 'horizontal' : 'vertical';
          board = placeTile(board, tile, lado, orient);
          const depois = layoutChain(board, largura, u, s, altura);
          const pos = new Map(depois.cells.map((c) => [c.id, c]));
          for (const c of antes.cells) {
            const d = pos.get(c.id);
            expect(
              [d.x, d.y, d.vertical, d.flipped],
              `semente ${s}, ${largura}px: ${c.id} mudou ao entrar ${tile.id}`
            ).toEqual([c.x, c.y, c.vertical, c.flipped]);
          }
          antes = depois;
        }
      }
    }
  });

  it('na tela, a primeira peça fica no centro e nada se desloca', () => {
    const monte = shuffle(createAllTiles(), seededRng(4));
    let board = placeTile([], monte.pop(), 'right');
    const l0 = layoutChain(board, 900, UNIT, 4, 400);
    const c0 = centralizar(l0, 900, 400);
    const x0 = l0.cells[0].x + c0.offsetX;
    for (let k = 0; k < 6; k++) {
      const ends = getEnds(board);
      const i = monte.findIndex((t) => canPlay(t, ends));
      const tile = monte.splice(i, 1)[0];
      board = placeTile(board, tile, playableSides(tile, ends).at(-1));
    }
    const l = layoutChain(board, 900, UNIT, 4, 400);
    const c = centralizar(l, 900, 400);
    const primeira = l.cells.find((cell) => cell.id === l0.cells[0].id);
    expect(primeira.x + c.offsetX).toBeCloseTo(x0, 5);
  });
});
