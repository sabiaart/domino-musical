// Layout da cadeia de peças na mesa.
// A cadeia é percorrida da ponta esquerda à direita e vai andando em quatro
// direções: segue reto ou vira para cima/para baixo por sorteio, como numa
// mesa de verdade. Carroças ficam perpendiculares à direção da vez.
//
// O sorteio é DETERMINÍSTICO (vem do id da peça + a rodada): a mesma mesa
// sempre produz o mesmo desenho, senão as peças pulariam de lugar a cada
// re-render. A cadeia também não pode se sobrepor nem estourar a largura,
// então cada direção candidata é testada antes de ser aceita.

const CHANCE_DE_VIRAR = 26; // %
const PERPENDICULARES = {
  right: ['down', 'up'],
  left: ['down', 'up'],
  down: ['right', 'left'],
  up: ['right', 'left'],
};

const ehHorizontal = (d) => d === 'right' || d === 'left';

// Tamanho da peça conforme o espaço: menor no celular. Fica aqui para a UI e
// os testes nunca usarem combinações de largura/unidade que não existem.
export function unidadeParaLargura(largura) {
  return largura > 0 && largura < 520 ? 24 : 32;
}

function hash32(texto, semente = 0) {
  let h = (2166136261 ^ semente) >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Uma peça normal ocupa 2 unidades no sentido em que a cadeia anda e 1 de
// través; a carroça fica atravessada, então troca as duas medidas.
function medidas(dir, carroca, unit, long) {
  const vertical = ehHorizontal(dir) ? carroca : !carroca;
  return vertical ? { w: unit, h: long, vertical } : { w: long, h: unit, vertical };
}

// Onde a peça cai, dado onde parou a anterior. Seguindo reto ela encosta na
// face oposta; virando, ela desce (ou sobe) a partir da última célula da
// anterior, formando o canto.
function posicionar(anterior, dirAnterior, dir, w, h, gap) {
  if (!anterior) return { x: 0, y: 0, w, h };

  if (dir === dirAnterior) {
    const meioY = anterior.y + anterior.h / 2 - h / 2;
    const meioX = anterior.x + anterior.w / 2 - w / 2;
    if (dir === 'right') return { x: anterior.x + anterior.w + gap, y: meioY, w, h };
    if (dir === 'left') return { x: anterior.x - gap - w, y: meioY, w, h };
    if (dir === 'down') return { x: meioX, y: anterior.y + anterior.h + gap, w, h };
    return { x: meioX, y: anterior.y - gap - h, w, h };
  }

  if (dir === 'down' || dir === 'up') {
    // Alinha pela ponta em que a cadeia estava avançando.
    const x = dirAnterior === 'right' ? anterior.x + anterior.w - w : anterior.x;
    const y = dir === 'down' ? anterior.y + anterior.h + gap : anterior.y - gap - h;
    return { x, y, w, h };
  }
  const y = dirAnterior === 'down' ? anterior.y + anterior.h - h : anterior.y;
  const x = dir === 'right' ? anterior.x + anterior.w + gap : anterior.x - gap - w;
  return { x, y, w, h };
}

// Sobreposição com folga: encostar não conta como colidir.
function colide(r, ocupados) {
  const f = 0.5;
  return ocupados.some(
    (o) =>
      r.x < o.x + o.w - f && r.x + r.w > o.x + f && r.y < o.y + o.h - f && r.y + r.h > o.y + f
  );
}

// Cabe no quadro? A largura nunca cede (não há rolagem lateral); a altura
// pode ceder, porque a mesa rola na vertical.
function cabeNoQuadro(r, bb, larguraMax, alturaMax, checarAltura) {
  if (Math.max(bb.maxX, r.x + r.w) - Math.min(bb.minX, r.x) > larguraMax) return false;
  if (checarAltura && Math.max(bb.maxY, r.y + r.h) - Math.min(bb.minY, r.y) > alturaMax) {
    return false;
  }
  return true;
}

// Quantas peças ainda caberiam adiante, seguindo em frente a partir daqui?
// Olhar só um passo não basta: a cadeia enfia-se em bolsões estreitos e trava.
// Conta até `limite` passos, explorando também as viradas.
function espacoAFrente(rect, dir, ocupados, bb, m, limite) {
  let melhor = 0;
  for (const d of [dir, ...PERPENDICULARES[dir]]) {
    const { w, h } = medidas(d, false, m.unit, m.long);
    const r = posicionar(rect, dir, d, w, h, m.gap);
    if (!cabeNoQuadro(r, bb, m.larguraMax, m.alturaMax, false)) continue;
    if (colide(r, ocupados)) continue;
    let profundidade = 1;
    if (limite > 1) {
      const bbDepois = {
        minX: Math.min(bb.minX, r.x),
        maxX: Math.max(bb.maxX, r.x + r.w),
        minY: Math.min(bb.minY, r.y),
        maxY: Math.max(bb.maxY, r.y + r.h),
      };
      profundidade += espacoAFrente(r, d, [...ocupados, r], bbDepois, m, limite - 1);
    }
    if (profundidade > melhor) melhor = profundidade;
    if (melhor >= limite) break; // já basta
  }
  return melhor;
}

export function layoutChain(board, containerWidth, unit, semente = 0, alturaDisponivel = Infinity) {
  const long = unit * 2;
  const gap = Math.max(2, Math.round(unit * 0.1));
  const larguraMax = Math.max(containerWidth, long * 2 + gap);
  const alturaMax = Math.max(alturaDisponivel, long * 2 + gap);
  const m = { unit, long, gap, larguraMax, alturaMax };

  const cells = [];
  const ocupados = [];
  let quebras = 0; // vezes que a cadeia precisou reiniciar numa linha nova
  let dir = 'right';
  let dirPrimeira = 'right';
  let anterior = null;
  let dirAnterior = 'right';
  const bb = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

  for (const placed of board) {
    const carroca = placed.tile.a === placed.tile.b;
    const h32 = hash32(placed.tile.id, semente);
    const perp = PERPENDICULARES[dir].slice();
    if ((h32 >>> 7) & 1) perp.reverse(); // sorteia entre cima e baixo
    const candidatas = h32 % 100 < CHANCE_DE_VIRAR ? [...perp, dir] : [dir, ...perp];

    // Ordem de preferência: caber na área visível e deixar saída para a
    // próxima peça; depois só caber; depois qualquer coisa que não colida.
    let escolhida = null;
    let rect = null;
    // Vai afrouxando: primeiro exige bastante espaço adiante e caber na área
    // visível; depois aceita menos folga; por fim aceita sair da altura.
    const niveis = [
      { folga: 5, respeitarAltura: true },
      { folga: 4, respeitarAltura: true },
      { folga: 3, respeitarAltura: true },
      { folga: 2, respeitarAltura: true },
      { folga: 1, respeitarAltura: true },
      { folga: 0, respeitarAltura: true },
      { folga: 1, respeitarAltura: false },
      { folga: 0, respeitarAltura: false },
    ];
    for (const nivel of niveis) {
      for (const cand of candidatas) {
        const { w, h, vertical } = medidas(cand, carroca, unit, long);
        const r = anterior
          ? posicionar(anterior, dirAnterior, cand, w, h, gap)
          : { x: 0, y: 0, w, h };
        if (anterior) {
          if (!cabeNoQuadro(r, bb, larguraMax, alturaMax, nivel.respeitarAltura)) continue;
          if (colide(r, ocupados)) continue;
          if (nivel.folga > 0) {
            const bbDepois = {
              minX: Math.min(bb.minX, r.x),
              maxX: Math.max(bb.maxX, r.x + r.w),
              minY: Math.min(bb.minY, r.y),
              maxY: Math.max(bb.maxY, r.y + r.h),
            };
            if (espacoAFrente(r, cand, [...ocupados, r], bbDepois, m, nivel.folga) < nivel.folga) {
              continue;
            }
          }
        }
        escolhida = { dir: cand, vertical };
        rect = r;
        break;
      }
      if (escolhida) break;
    }

    if (!escolhida) {
      // A cadeia se fechou num beco (tela estreita com a mesa cheia). Quebra a
      // linha e recomeça abaixo de tudo que já foi posto: por construção não
      // há como colidir, e nenhuma peça se perde.
      const { w, h, vertical } = medidas('right', carroca, unit, long);
      escolhida = { dir: 'right', vertical };
      rect = { x: bb.minX, y: bb.maxY + gap * 2, w, h };
      quebras += 1;
    }

    cells.push({
      id: placed.tile.id,
      x: rect.x,
      y: rect.y,
      vertical: escolhida.vertical,
      // Andando para a esquerda ou para cima, o valor que encosta na peça
      // anterior fica do outro lado: as metades são espelhadas.
      flipped: escolhida.dir === 'left' || escolhida.dir === 'up',
      left: placed.left,
      right: placed.right,
    });
    if (cells.length === 1) dirPrimeira = escolhida.dir;
    ocupados.push(rect);
    bb.minX = Math.min(bb.minX, rect.x);
    bb.maxX = Math.max(bb.maxX, rect.x + rect.w);
    bb.minY = Math.min(bb.minY, rect.y);
    bb.maxY = Math.max(bb.maxY, rect.y + rect.h);
    anterior = rect;
    dirAnterior = escolhida.dir;
    dir = escolhida.dir;
  }

  if (cells.length === 0) {
    return { cells, unit, long, gap, larguraCadeia: 0, alturaCadeia: 0, minX: 0, minY: 0, quebras: 0 };
  }

  return {
    cells,
    unit,
    long,
    gap,
    larguraCadeia: bb.maxX - bb.minX,
    alturaCadeia: bb.maxY - bb.minY,
    minX: bb.minX,
    minY: bb.minY,
    // Direção em que cada ponta avança, para posicionar as zonas de encaixe.
    dirPrimeira,
    dirUltima: dirAnterior,
    rects: ocupados,
    quebras,
  };
}

// Reposiciona a cadeia para ficar centralizada na área visível.
// Devolve o deslocamento a aplicar em cada peça e a altura da mesa.
export function centralizar(layout, containerWidth, alturaDisponivel) {
  if (layout.cells.length === 0) {
    return { offsetX: 0, offsetY: 0, height: Math.max(alturaDisponivel, 0) };
  }
  const offsetX = (containerWidth - layout.larguraCadeia) / 2 - layout.minX;
  const height = Math.max(layout.alturaCadeia, alturaDisponivel);
  const offsetY = (height - layout.alturaCadeia) / 2 - layout.minY;
  return { offsetX, offsetY, height };
}

// Quadrado de encaixe encostado numa ponta, no sentido em que ela cresce.
export function zoneRect(rect, dir, size, gap) {
  const meioY = rect.y + rect.h / 2 - size / 2;
  const meioX = rect.x + rect.w / 2 - size / 2;
  if (dir === 'right') return { x: rect.x + rect.w + gap, y: meioY };
  if (dir === 'left') return { x: rect.x - gap - size, y: meioY };
  if (dir === 'down') return { x: meioX, y: rect.y + rect.h + gap };
  return { x: meioX, y: rect.y - gap - size };
}

export const oposta = (d) => ({ right: 'left', left: 'right', down: 'up', up: 'down' }[d]);
