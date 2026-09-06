// Layout da cadeia de peças na mesa.
//
// A cadeia é percorrida da ponta esquerda à direita e vai andando em quatro
// direções: segue reto ou vira para cima/para baixo por sorteio.
//
// A geometria é montada em torno do PONTO DE SAÍDA: cada peça encosta na
// anterior por esse ponto e define um novo. É isso que garante a ligação
// legal do dominó — sempre pela ponta, nunca lado longo com lado longo:
//
//   - peça comum seguindo reto: deita no sentido da cadeia, ponta com ponta;
//   - carroça: entra sempre atravessada, e a cadeia passa pelo meio dela
//     (ou sai por uma das pontas dela, quando vira);
//   - peça comum virando: fica em pé, encostando pela METADE que conecta, e a
//     cadeia segue pela outra metade.
//
// O sorteio é DETERMINÍSTICO (id da peça + rodada): a mesma mesa sempre produz
// o mesmo desenho, senão as peças pulariam de lugar a cada re-render. A cadeia
// também não pode se sobrepor nem estourar a largura, então cada direção
// candidata é testada antes de ser aceita.

// A cadeia corre principalmente na horizontal; os trechos verticais servem
// para mudar de linha, como numa mesa de verdade. Deixá-los curtos também é o
// que mantém o desenho compacto e dentro da área visível.
const CHANCE_DE_VIRAR = 12; // % — correndo na horizontal
const CHANCE_DE_VOLTAR = 70; // % — já descendo/subindo há um passo
const MAX_PASSOS_VERTICAIS = 2;
const VET = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
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
  if (largura <= 0 || largura >= 520) return 32;
  return largura < 420 ? 20 : 24;
}

function hash32(texto, semente = 0) {
  let h = (2166136261 ^ semente) >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Coloca a peça encostando no ponto de saída da peça anterior, vinda na
// direção `dIn` e seguindo em `dOut`. Devolve o retângulo, se ela fica em pé,
// e o novo ponto de saída da cadeia.
export function colocar(saida, dIn, dOut, carroca, m, primeira = false) {
  const { unit, long } = m;
  const gap = primeira ? 0 : m.gap;
  const vira = dOut !== dIn;
  const horizIn = ehHorizontal(dIn);

  // Carroça entra sempre atravessada; peça comum deita no sentido da saída, o
  // que também a deixa atravessada em relação à chegada quando a cadeia vira.
  const aoLongo = carroca || vira ? unit : long; // no eixo de chegada
  const atravessado = carroca || vira ? long : unit;
  const w = horizIn ? aoLongo : atravessado;
  const h = horizIn ? atravessado : aoLongo;

  // Eixo de chegada: a face de trás encosta no ponto de saída.
  const [ix, iy] = VET[dIn];
  const inicioAoLongo = horizIn
    ? ix > 0
      ? saida.x + gap
      : saida.x - gap - w
    : iy > 0
      ? saida.y + gap
      : saida.y - gap - h;

  // Eixo de través: centralizada — exceto quando uma peça comum vira. Aí é a
  // METADE que conecta que fica alinhada com a cadeia, não o meio da peça.
  const tamCross = horizIn ? h : w;
  const centroCross = horizIn ? saida.y : saida.x;
  let inicioCross;
  if (vira && !carroca) {
    const [ox, oy] = VET[dOut];
    const paraFrente = (horizIn ? oy : ox) > 0;
    inicioCross = paraFrente ? centroCross - unit / 2 : centroCross - (tamCross - unit / 2);
  } else {
    inicioCross = centroCross - tamCross / 2;
  }

  const rect = horizIn
    ? { x: inicioAoLongo, y: inicioCross, w, h }
    : { x: inicioCross, y: inicioAoLongo, w, h };

  // A cadeia sai pelo meio da face voltada para `dOut`.
  const [ox, oy] = VET[dOut];
  const novaSaida = {
    x: ox === 0 ? rect.x + rect.w / 2 : ox > 0 ? rect.x + rect.w : rect.x,
    y: oy === 0 ? rect.y + rect.h / 2 : oy > 0 ? rect.y + rect.h : rect.y,
  };

  // A carroça que segue reto entrega a cadeia pelo seu lado LONGO; em todos os
  // outros casos a saída é por uma face curta, do tamanho de uma unidade.
  return { rect, novaSaida, vertical: rect.h > rect.w, saidaLarga: carroca && !vira };
}

// Sobreposição com folga: encostar não conta como colidir.
function colide(r, ocupados) {
  const f = 0.5;
  return ocupados.some(
    (o) =>
      r.x < o.x + o.w - f && r.x + r.w > o.x + f && r.y < o.y + o.h - f && r.y + r.h > o.y + f
  );
}

// Cabe no quadro? A largura nunca cede (não há rolagem lateral); a altura pode
// ceder, porque a mesa rola na vertical.
function cabeNoQuadro(r, bb, larguraMax, alturaMax, checarAltura) {
  if (Math.max(bb.maxX, r.x + r.w) - Math.min(bb.minX, r.x) > larguraMax) return false;
  if (checarAltura && Math.max(bb.maxY, r.y + r.h) - Math.min(bb.minY, r.y) > alturaMax) {
    return false;
  }
  return true;
}

// Quantas peças ainda caberiam adiante a partir daqui? Olhar só um passo não
// basta: a cadeia enfia-se em bolsões estreitos e trava.
function espacoAFrente(saida, dir, ocupados, bb, m, limite, checarAltura) {
  let melhor = 0;
  for (const d of [dir, ...PERPENDICULARES[dir]]) {
    const { rect, novaSaida } = colocar(saida, dir, d, false, m);
    if (!cabeNoQuadro(rect, bb, m.larguraMax, m.alturaMax, checarAltura)) continue;
    if (colide(rect, ocupados)) continue;
    let profundidade = 1;
    if (limite > 1) {
      const bbDepois = {
        minX: Math.min(bb.minX, rect.x),
        maxX: Math.max(bb.maxX, rect.x + rect.w),
        minY: Math.min(bb.minY, rect.y),
        maxY: Math.max(bb.maxY, rect.y + rect.h),
      };
      profundidade += espacoAFrente(
        novaSaida,
        d,
        [...ocupados, rect],
        bbDepois,
        m,
        limite - 1,
        checarAltura
      );
    }
    if (profundidade > melhor) melhor = profundidade;
    if (melhor >= limite) break; // já basta
  }
  return melhor;
}

// Espaço livre que a cadeia ainda alcança a partir daqui, medido em células de
// uma unidade. Olhar poucos passos à frente não enxerga becos grandes: a cadeia
// entra num bolsão amplo mas fechado e só descobre lá dentro. Isto inunda a
// região permitida e conta quantas células ainda dá para alcançar.
function celulasAlcancaveis(saida, dir, ocupados, bb, m, limiteCelulas) {
  const { unit, larguraMax, alturaMax } = m;
  // Janela onde a cadeia ainda pode se estender sem estourar os limites.
  const x0 = Math.floor(Math.min(bb.minX, bb.maxX - larguraMax) / unit);
  const x1 = Math.ceil(Math.max(bb.maxX, bb.minX + larguraMax) / unit);
  const y0 = Math.floor(Math.min(bb.minY, bb.maxY - alturaMax) / unit);
  const y1 = Math.ceil(Math.max(bb.maxY, bb.minY + alturaMax) / unit);
  const colunas = x1 - x0;
  const linhas = y1 - y0;
  if (colunas <= 0 || linhas <= 0) return 0;
  // Sem limite de altura a janela é infinita: aí não há bolsão que prenda a
  // cadeia, e a varredura seria impossível de alocar.
  if (!Number.isFinite(colunas * linhas) || colunas * linhas > 20000) {
    return limiteCelulas;
  }

  const ocupada = new Uint8Array(colunas * linhas);
  for (const r of ocupados) {
    const ci0 = Math.max(0, Math.floor(r.x / unit) - x0);
    const ci1 = Math.min(colunas - 1, Math.ceil((r.x + r.w) / unit) - 1 - x0);
    const li0 = Math.max(0, Math.floor(r.y / unit) - y0);
    const li1 = Math.min(linhas - 1, Math.ceil((r.y + r.h) / unit) - 1 - y0);
    for (let l = li0; l <= li1; l++) {
      for (let c = ci0; c <= ci1; c++) ocupada[l * colunas + c] = 1;
    }
  }

  const [dx, dy] = VET[dir];
  const ci = Math.floor((saida.x + (dx * unit) / 2) / unit) - x0;
  const li = Math.floor((saida.y + (dy * unit) / 2) / unit) - y0;
  if (ci < 0 || ci >= colunas || li < 0 || li >= linhas) return 0;
  if (ocupada[li * colunas + ci]) return 0;

  let alcancadas = 0;
  const fila = [li * colunas + ci];
  ocupada[li * colunas + ci] = 1;
  while (fila.length > 0 && alcancadas < limiteCelulas) {
    const atual = fila.pop();
    alcancadas++;
    const c = atual % colunas;
    const l = (atual - c) / colunas;
    if (c > 0 && !ocupada[atual - 1]) { ocupada[atual - 1] = 1; fila.push(atual - 1); }
    if (c < colunas - 1 && !ocupada[atual + 1]) { ocupada[atual + 1] = 1; fila.push(atual + 1); }
    if (l > 0 && !ocupada[atual - colunas]) { ocupada[atual - colunas] = 1; fila.push(atual - colunas); }
    if (l < linhas - 1 && !ocupada[atual + colunas]) { ocupada[atual + colunas] = 1; fila.push(atual + colunas); }
  }
  return alcancadas;
}

// Vai afrouxando: primeiro exige bastante espaço adiante e caber na área
// visível; depois aceita menos folga; por fim aceita sair da altura.
// Ordem de preferência ao escolher onde pôr a peça. O que mais importa é
// SEMPRE sobrar continuação (`folga`): uma jogada sem saída parte a cadeia em
// duas na tela, enquanto passar da altura só faz a mesa rolar. Por isso os
// níveis que ainda deixam saída vêm todos antes dos que respeitam a altura.
const NIVEIS = [
  { folga: 3, respeitarAltura: true, checarArea: true },
  { folga: 2, respeitarAltura: true, checarArea: true },
  { folga: 1, respeitarAltura: true, checarArea: true },
  { folga: 3, respeitarAltura: true, checarArea: false },
  { folga: 2, respeitarAltura: true, checarArea: false },
  { folga: 1, respeitarAltura: true, checarArea: false },
  { folga: 3, respeitarAltura: false, checarArea: false },
  { folga: 2, respeitarAltura: false, checarArea: false },
  { folga: 1, respeitarAltura: false, checarArea: false },
  { folga: 0, respeitarAltura: true, checarArea: false },
  { folga: 0, respeitarAltura: false, checarArea: false },
];

export function layoutChain(board, containerWidth, unit, semente = 0, alturaDisponivel = Infinity) {
  const long = unit * 2;
  const gap = Math.max(2, Math.round(unit * 0.1));
  const larguraMax = Math.max(containerWidth, long * 2 + gap);
  const alturaMax = Math.max(alturaDisponivel, long * 2 + gap);
  const m = { unit, long, gap, larguraMax, alturaMax };

  // Dentro de uma rodada a cadeia muda de linha sempre para o MESMO lado —
  // sorteado entre cima e baixo. É isso que impede o desenho de se enrolar
  // sobre si mesmo: cada linha nova cai numa faixa ainda livre, então a cadeia
  // nunca se fecha num beco. O sorteio muda a cada rodada.
  const sentidoVertical = hash32('sentido', semente) % 2 === 0 ? 'down' : 'up';

  const cells = [];
  const ocupados = [];
  let quebras = 0; // vezes que a cadeia precisou reiniciar numa linha nova
  let dirPrimeira = 'right';
  let dirAtual = 'right';
  let saida = { x: 0, y: 0 };
  // Depois de uma saída pelo lado longo, virar faria a peça seguinte encostar
  // de lado — encaixe inválido. Nesse caso a cadeia só segue em frente (a
  // virada, se houver, acontece na própria carroça, por uma ponta dela).
  let saidaPelaFaceLonga = false;
  let passosNaVertical = 0;
  // Ao voltar de um trecho vertical, a cadeia retoma na horizontal para o lado
  // OPOSTO ao trecho anterior. Sem isso ela costuma retomar no mesmo sentido,
  // bater de novo na borda e se fechar num beco.
  let ultimaHorizontal = 'right';
  let primeira = true;
  const bb = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

  for (const placed of board) {
    const carroca = placed.tile.a === placed.tile.b;
    const h32 = hash32(placed.tile.id, semente);
    let perp;
    if (ehHorizontal(dirAtual)) {
      perp = [sentidoVertical];
    } else {
      // Voltando à horizontal: serpenteia para o lado oposto ao trecho anterior.
      perp = PERPENDICULARES[dirAtual].slice();
      if (perp[0] === ultimaHorizontal) perp.reverse();
    }
    const podeVirar = !primeira && !saidaPelaFaceLonga;
    const chance = passosNaVertical > 0 ? CHANCE_DE_VOLTAR : CHANCE_DE_VIRAR;
    const querVirar =
      passosNaVertical >= MAX_PASSOS_VERTICAIS || h32 % 100 < chance;
    const candidatas = podeVirar
      ? querVirar
        ? [...perp, dirAtual]
        : [dirAtual, ...perp]
      : [dirAtual];

    let escolha = null;
    for (const nivel of NIVEIS) {
      for (const cand of candidatas) {
        const posto = colocar(saida, dirAtual, cand, carroca, m, primeira);
        if (!primeira) {
          if (!cabeNoQuadro(posto.rect, bb, larguraMax, alturaMax, nivel.respeitarAltura)) continue;
          if (colide(posto.rect, ocupados)) continue;
          const bbDepois = {
            minX: Math.min(bb.minX, posto.rect.x),
            maxX: Math.max(bb.maxX, posto.rect.x + posto.rect.w),
            minY: Math.min(bb.minY, posto.rect.y),
            maxY: Math.max(bb.maxY, posto.rect.y + posto.rect.h),
          };
          // Uma carroça que segue reto obriga a peça seguinte a seguir reto
          // também. Se não houver espaço para ela, é aqui — na carroça — que a
          // cadeia tem de virar; senão ela trava encostada na borda.
          if (posto.saidaLarga) {
            const seguinte = colocar(posto.novaSaida, cand, cand, false, m);
            const temEspaco =
              cabeNoQuadro(seguinte.rect, bbDepois, larguraMax, alturaMax, false) &&
              !colide(seguinte.rect, [...ocupados, posto.rect]);
            if (!temEspaco) continue;
          }
          if (nivel.folga > 0) {
            const espaco = espacoAFrente(
              posto.novaSaida,
              cand,
              [...ocupados, posto.rect],
              bbDepois,
              m,
              nivel.folga,
              nivel.respeitarAltura
            );
            if (espaco < nivel.folga) continue;
            if (nivel.checarArea) {
              // Cada peça ocupa 2 células; exige folga para as que faltam.
              const faltam = board.length - cells.length - 1;
              const precisa = faltam * 2;
              const bbCheck = nivel.respeitarAltura ? bbDepois : bb;
              if (
                faltam > 0 &&
                celulasAlcancaveis(
                  posto.novaSaida,
                  cand,
                  [...ocupados, posto.rect],
                  bbCheck,
                  m,
                  precisa
                ) < precisa
              ) {
                continue;
              }
            }
          }
        }
        escolha = { ...posto, dir: cand };
        break;
      }
      if (escolha) break;
    }

    if (!escolha) {
      // A cadeia se fechou num beco (tela estreita com a mesa cheia). Quebra a
      // linha e recomeça abaixo de tudo que já foi posto: por construção não há
      // como colidir, e nenhuma peça se perde.
      const w = carroca ? unit : long;
      const h = carroca ? long : unit;
      const rect = { x: bb.minX, y: bb.maxY + gap * 2, w, h };
      escolha = {
        rect,
        novaSaida: { x: rect.x + w, y: rect.y + h / 2 },
        vertical: h > w,
        saidaLarga: carroca, // recomeça deitada para a direita
        dir: 'right',
      };
      quebras += 1;
    }

    cells.push({
      id: placed.tile.id,
      x: escolha.rect.x,
      y: escolha.rect.y,
      vertical: escolha.vertical,
      // Andando para a esquerda ou para cima, o valor que encosta na peça
      // anterior fica do outro lado: as metades são espelhadas.
      flipped: escolha.dir === 'left' || escolha.dir === 'up',
      left: placed.left,
      right: placed.right,
    });
    if (primeira) dirPrimeira = escolha.dir;
    ocupados.push(escolha.rect);
    bb.minX = Math.min(bb.minX, escolha.rect.x);
    bb.maxX = Math.max(bb.maxX, escolha.rect.x + escolha.rect.w);
    bb.minY = Math.min(bb.minY, escolha.rect.y);
    bb.maxY = Math.max(bb.maxY, escolha.rect.y + escolha.rect.h);
    saida = escolha.novaSaida;
    saidaPelaFaceLonga = escolha.saidaLarga;
    if (ehHorizontal(escolha.dir)) {
      passosNaVertical = 0;
      ultimaHorizontal = escolha.dir;
    } else {
      passosNaVertical += 1;
    }
    dirAtual = escolha.dir;
    primeira = false;
  }

  if (cells.length === 0) {
    return {
      cells,
      unit,
      long,
      gap,
      larguraCadeia: 0,
      alturaCadeia: 0,
      minX: 0,
      minY: 0,
      quebras: 0,
    };
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
    dirUltima: dirAtual,
    saidaFinal: saida,
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
