import { placeTile } from '../game/board.js';

// Layout da cadeia de peças na mesa.
//
// A cadeia nasce da primeira peça, no centro da mesa, e cresce pelas duas
// pontas na ordem em que as peças foram jogadas, andando em quatro direções:
// segue reto ou vira para cima/para baixo (por sorteio, ou como o jogador
// escolheu). Cada peça só olha para o que já estava na mesa quando entrou,
// então uma peça posta nunca mais muda de lugar nem de forma.
//
// A geometria é montada em torno do PONTO DE SAÍDA: cada peça encosta na
// anterior por esse ponto e define um novo. É isso que garante a ligação
// legal do dominó — sempre pela ponta, nunca lado longo com lado longo:
//
//   - peça comum seguindo reto: deita no sentido da cadeia, ponta com ponta;
//   - carroça: entra sempre atravessada, e a cadeia passa pelo meio dela —
//     nunca vira numa carroça, então as duas ligações são pelo meio;
//   - peça comum virando: fica em pé, encostando pela METADE que conecta, e a
//     cadeia segue pela outra metade.
//
// O sorteio é DETERMINÍSTICO (id da peça + jogo): a mesma mesa sempre produz
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
    (o) => r.x < o.x + o.w - f && r.x + r.w > o.x + f && r.y < o.y + o.h - f && r.y + r.h > o.y + f,
  );
}

// Cabe no quadro? O quadro é FIXO, centrado na primeira peça: assim uma ponta
// nunca rouba o espaço que a outra já contava ter. A largura nunca cede (não
// há rolagem lateral); a altura pode ceder, porque a mesa rola na vertical.
function cabeNoQuadro(r, q, checarAltura) {
  if (r.x < q.minX - 0.5 || r.x + r.w > q.maxX + 0.5) return false;
  if (checarAltura && (r.y < q.minY - 0.5 || r.y + r.h > q.maxY + 0.5)) return false;
  return true;
}

// Quantas peças ainda caberiam adiante a partir daqui? Olhar só um passo não
// basta: a cadeia enfia-se em bolsões estreitos e trava.
function espacoAFrente(saida, dir, ocupados, q, m, limite, checarAltura) {
  let melhor = 0;
  for (const d of [dir, ...PERPENDICULARES[dir]]) {
    const { rect, novaSaida } = colocar(saida, dir, d, false, m);
    if (!cabeNoQuadro(rect, q, checarAltura)) continue;
    if (colide(rect, ocupados)) continue;
    let profundidade = 1;
    if (limite > 1) {
      profundidade += espacoAFrente(
        novaSaida,
        d,
        [...ocupados, rect],
        q,
        m,
        limite - 1,
        checarAltura,
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
function celulasAlcancaveis(saida, dir, ocupados, q, m, limiteCelulas) {
  const { unit } = m;
  // Janela onde a cadeia ainda pode se estender: o próprio quadro.
  const x0 = Math.floor(q.minX / unit);
  const x1 = Math.ceil(q.maxX / unit);
  const y0 = Math.floor(q.minY / unit);
  const y1 = Math.ceil(q.maxY / unit);
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
  // Começa uma unidade inteira à frente da saída: com o vão entre as peças, a
  // grade não fica alinhada a elas, e meia unidade às vezes ainda cai dentro
  // da célula ocupada pela própria peça — o bolsão pareceria fechado.
  const ci = Math.floor((saida.x + dx * unit) / unit) - x0;
  const li = Math.floor((saida.y + dy * unit) / unit) - y0;
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
    if (c > 0 && !ocupada[atual - 1]) {
      ocupada[atual - 1] = 1;
      fila.push(atual - 1);
    }
    if (c < colunas - 1 && !ocupada[atual + 1]) {
      ocupada[atual + 1] = 1;
      fila.push(atual + 1);
    }
    if (l > 0 && !ocupada[atual - colunas]) {
      ocupada[atual - colunas] = 1;
      fila.push(atual - colunas);
    }
    if (l < linhas - 1 && !ocupada[atual + colunas]) {
      ocupada[atual + colunas] = 1;
      fila.push(atual + colunas);
    }
  }
  return alcancadas;
}

// Reserva de espaço reto que uma peça comum deixa adiante, do pior caso ao
// nenhum: carroça + peça forçada a seguir reto (+ outra carroça + outra peça).
// `true` é carroça. Tenta-se a maior reserva primeiro.
const RESERVAS = [
  [true, false, true, false, true, false],
  [true, false, true, false],
  [true, false],
  [],
];

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

// Total de peças do jogo: o limite do que ainda pode entrar na mesa.
const TOTAL_PECAS = 28;

// Ordem em que as peças entraram na mesa. Cada peça guarda `seq` ao ser
// colocada; mesas sem essa marca (antigas ou montadas à mão) contam como se
// tivessem crescido só pela direita, a partir da primeira.
function ordemDeEntrada(board) {
  const indices = board.map((_, i) => i);
  if (board.some((p) => typeof p.seq !== 'number')) return indices;
  return indices.sort((i, j) => board[i].seq - board[j].seq);
}

// A cadeia nasce da primeira peça jogada e cresce pelas duas pontas, uma peça
// por vez, NA ORDEM EM QUE FORAM JOGADAS. Cada peça é posicionada olhando só
// para o que já estava na mesa quando ela entrou — nunca para o que veio
// depois. Por isso uma peça, uma vez na mesa, não muda mais de lugar nem de
// forma: a cadeia só ganha peças novas nas pontas.
export function layoutChain(board, containerWidth, unit, semente = 0, alturaDisponivel = Infinity) {
  const long = unit * 2;
  const gap = Math.max(2, Math.round(unit * 0.1));
  const larguraMax = Math.max(containerWidth, long * 2 + gap);
  const alturaMax = Math.max(alturaDisponivel, long * 2 + gap);
  const m = { unit, long, gap, larguraMax, alturaMax };

  // Cada ponta muda de linha sempre para o MESMO lado — sorteado por jogo, e
  // opostos entre as duas pontas. É isso que impede o desenho de se enrolar
  // sobre si mesmo: cada linha nova cai numa faixa ainda livre.
  const sentidoVertical = hash32('sentido', semente) % 2 === 0 ? 'down' : 'up';

  // Cabe uma sequência de peças seguindo reto a partir de `saida` (carroças
  // atravessadas onde indicado), e ainda sobra para onde ir depois?
  const retoLivre = (saida, dir, sequencia, juntos) => {
    let ponto = saida;
    const postos = [...juntos];
    for (const ehCarroca of sequencia) {
      const p = colocar(ponto, dir, dir, ehCarroca, m);
      if (!cabeNoQuadro(p.rect, quadro, false) || colide(p.rect, postos)) {
        return false;
      }
      postos.push(p.rect);
      ponto = p.novaSaida;
    }
    return espacoAFrente(ponto, dir, postos, quadro, m, 1, false) >= 1;
  };

  const cells = new Array(board.length);
  const rects = new Array(board.length);
  const ocupados = [];
  let quebras = 0; // vezes que a cadeia precisou reiniciar numa linha nova
  const bb = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

  const ordem = ordemDeEntrada(board);
  const ancora = ordem[0];
  // Estado de cada ponta: por onde a cadeia sai e para onde está andando.
  // Depois de uma saída pelo lado longo (carroça), virar faria a peça seguinte
  // encostar de lado — encaixe inválido —, então ali a cadeia só segue reto.
  // Ao voltar de um trecho vertical, a ponta retoma na horizontal para o lado
  // OPOSTO ao trecho anterior; sem isso ela bate de novo na borda e se fecha.
  let pontas = null;
  let quadro = null;

  const registrar = (idx, escolha, daEsquerda) => {
    const placed = board[idx];
    rects[idx] = escolha.rect;
    cells[idx] = {
      id: placed.tile.id,
      x: escolha.rect.x,
      y: escolha.rect.y,
      vertical: escolha.vertical,
      // A metade que encosta na peça anterior fica atrás, no sentido em que a
      // ponta anda. Crescendo pela direita ela é a `left`; pela esquerda, a
      // `right` — daí os espelhamentos opostos.
      flipped: daEsquerda
        ? escolha.dir === 'right' || escolha.dir === 'down'
        : escolha.dir === 'left' || escolha.dir === 'up',
      left: placed.left,
      right: placed.right,
    };
    ocupados.push(escolha.rect);
    bb.minX = Math.min(bb.minX, escolha.rect.x);
    bb.maxX = Math.max(bb.maxX, escolha.rect.x + escolha.rect.w);
    bb.minY = Math.min(bb.minY, escolha.rect.y);
    bb.maxY = Math.max(bb.maxY, escolha.rect.y + escolha.rect.h);
  };

  for (const idx of ordem) {
    const placed = board[idx];
    const carroca = placed.tile.a === placed.tile.b;

    if (idx === ancora) {
      // Primeira peça: no centro, deitada (ou em pé, se foi escolhida assim).
      const emPe = placed.orient === 'vertical' && !carroca;
      const dir = emPe ? sentidoVertical : 'right';
      const posto = colocar({ x: 0, y: 0 }, dir, dir, carroca, m, true);
      registrar(idx, { ...posto, dir }, false);
      const r = posto.rect;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      quadro = {
        minX: cx - larguraMax / 2,
        maxX: cx + larguraMax / 2,
        minY: cy - alturaMax / 2,
        maxY: cy + alturaMax / 2,
      };
      const [dx, dy] = VET[dir];
      pontas = {
        right: {
          saida: posto.novaSaida,
          dir,
          faceLonga: posto.saidaLarga,
          passosNaVertical: emPe ? 1 : 0,
          ultimaHorizontal: 'right',
          sentido: sentidoVertical,
        },
        left: {
          saida: {
            x: dx === 0 ? r.x + r.w / 2 : dx > 0 ? r.x : r.x + r.w,
            y: dy === 0 ? r.y + r.h / 2 : dy > 0 ? r.y : r.y + r.h,
          },
          dir: oposta(dir),
          faceLonga: posto.saidaLarga,
          passosNaVertical: emPe ? 1 : 0,
          ultimaHorizontal: 'left',
          sentido: oposta(sentidoVertical),
        },
      };
      continue;
    }

    const daEsquerda = idx < ancora;
    const ponta = daEsquerda ? pontas.left : pontas.right;
    const h32 = hash32(placed.tile.id, semente);
    const dirAtual = ponta.dir;
    let perp;
    if (ehHorizontal(dirAtual)) {
      perp = [ponta.sentido];
    } else {
      // Voltando à horizontal: serpenteia para o lado oposto ao trecho anterior.
      perp = PERPENDICULARES[dirAtual].slice();
      if (perp[0] === ponta.ultimaHorizontal) perp.reverse();
    }
    // Carroça nunca vira: a ligação com ela é sempre pelo meio, dos dois lados.
    const podeVirar = !ponta.faceLonga && !carroca;
    const chance = ponta.passosNaVertical > 0 ? CHANCE_DE_VOLTAR : CHANCE_DE_VIRAR;
    const querVirar = ponta.passosNaVertical >= MAX_PASSOS_VERTICAIS || h32 % 100 < chance;
    let candidatas = podeVirar
      ? querVirar
        ? [...perp, dirAtual]
        : [dirAtual, ...perp]
      : [dirAtual];
    // Posição escolhida pelo jogador: a peça fica em pé quando a cadeia anda
    // na vertical por ela (seguindo reto num trecho vertical, ou virando a
    // partir de um horizontal). As direções que dão essa posição vêm antes;
    // as outras ficam só de reserva, se não houver espaço.
    // A busca roda por grupos: sem posição escolhida, um grupo só; com ela,
    // primeiro as direções que a respeitam — em qualquer nível de folga —, e
    // só depois as outras.
    let grupos = null;
    if (placed.orient && !carroca) {
      const querEmPe = placed.orient === 'vertical';
      const todas = podeVirar ? [dirAtual, ...perp] : [dirAtual];
      grupos = [
        todas.filter((d) => !ehHorizontal(d) === querEmPe),
        todas.filter((d) => !ehHorizontal(d) !== querEmPe),
      ];
    }

    // Encostada na borda, a ponta pode virar até para o lado "errado" — é
    // melhor que quebrar a linha.
    if (podeVirar && ehHorizontal(dirAtual)) {
      const reserva = oposta(ponta.sentido);
      if (!candidatas.includes(reserva)) candidatas = [...candidatas, reserva];
    }

    let escolha = null;
    // Primeiro exige reservar espaço reto para uma possível carroça a seguir;
    // só se nada couber assim é que abre mão dessa reserva.
    for (const grupo of grupos ?? [candidatas]) {
      if (escolha) break;
      for (const reserva of RESERVAS) {
        if (escolha) break;
        for (const nivel of NIVEIS) {
          for (const cand of grupo) {
            const posto = colocar(ponta.saida, dirAtual, cand, carroca, m);
            if (!cabeNoQuadro(posto.rect, quadro, nivel.respeitarAltura)) continue;
            if (colide(posto.rect, ocupados)) continue;
            const juntos = [...ocupados, posto.rect];
            // Uma carroça obriga a peça seguinte a seguir reto; e a próxima peça
            // pode ser uma carroça (ainda não se sabe qual vem), que também não
            // vira. Então reserva-se espaço reto adiante — com saída no fim —
            // para o pior caso. Sem isso, a cadeia travaria encostada na borda.
            // No primeiro passe a reserva é obrigatória; só se nada couber assim
            // é que se abre mão dela (exceto o mínimo que a carroça exige).
            if (posto.saidaLarga) {
              if (!retoLivre(posto.novaSaida, cand, [false], juntos)) continue;
            } else if (!carroca && reserva.length > 0) {
              if (!retoLivre(posto.novaSaida, cand, reserva, juntos)) continue;
            }
            if (nivel.folga > 0) {
              const espaco = espacoAFrente(
                posto.novaSaida,
                cand,
                juntos,
                quadro,
                m,
                nivel.folga,
                nivel.respeitarAltura,
              );
              if (espaco < nivel.folga) continue;
              if (nivel.checarArea) {
                // Cada peça ocupa 2 células. Não se sabe quantas ainda virão, nem
                // por qual ponta: exige área para metade das que restam no jogo.
                const faltam = Math.ceil((TOTAL_PECAS - ocupados.length - 1) / 2);
                const precisa = faltam * 2;
                const janela = nivel.respeitarAltura
                  ? quadro
                  : { ...quadro, minY: -Infinity, maxY: Infinity };
                if (
                  faltam > 0 &&
                  celulasAlcancaveis(posto.novaSaida, cand, juntos, janela, m, precisa) < precisa
                ) {
                  continue;
                }
              }
            }
            escolha = { ...posto, dir: cand };
            break;
          }
          if (escolha) break;
        }
      }
    }

    if (!escolha) {
      // A ponta se fechou num beco (tela estreita com a mesa cheia). Quebra a
      // linha e recomeça abaixo de tudo que já foi posto: por construção não há
      // como colidir, e nenhuma peça se perde.
      const w = carroca ? unit : long;
      const h = carroca ? long : unit;
      const dir = daEsquerda ? 'left' : 'right';
      const x = daEsquerda ? quadro.maxX - w : quadro.minX;
      const rect = { x, y: bb.maxY + gap * 2, w, h };
      escolha = {
        rect,
        novaSaida: { x: daEsquerda ? rect.x : rect.x + w, y: rect.y + h / 2 },
        vertical: h > w,
        saidaLarga: carroca, // recomeça deitada, de volta para o seu lado
        dir,
      };
      quebras += 1;
    }

    registrar(idx, escolha, daEsquerda);
    ponta.saida = escolha.novaSaida;
    ponta.faceLonga = escolha.saidaLarga;
    if (ehHorizontal(escolha.dir)) {
      ponta.passosNaVertical = 0;
      ponta.ultimaHorizontal = escolha.dir;
    } else {
      ponta.passosNaVertical += 1;
    }
    ponta.dir = escolha.dir;
  }

  if (board.length === 0) {
    return {
      cells: [],
      rects: [],
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
    // Direção em que cada ponta avança, para posicionar as zonas de encaixe:
    // a ponta esquerda anda em oposta(dirPrimeira); a direita, em dirUltima.
    dirPrimeira: oposta(pontas.left.dir),
    dirUltima: pontas.right.dir,
    quadro,
    rects,
    quebras,
  };
}

// Posições ('horizontal' | 'vertical') que uma peça de notas diferentes
// consegue ter de fato ao entrar na ponta `side`, dado o espaço da mesa.
// Carroça não tem escolha: fica sempre atravessada.
export function orientacoesPossiveis(board, tile, side, largura, altura, semente = 0) {
  if (tile.a === tile.b || largura <= 0) return [];
  const unit = unidadeParaLargura(largura);
  return ['horizontal', 'vertical'].filter((orient) => {
    let teste;
    try {
      teste = placeTile(board, tile, side, orient);
    } catch {
      return false;
    }
    const idx = side === 'left' ? 0 : teste.length - 1;
    const cell = layoutChain(teste, largura, unit, semente, altura).cells[idx];
    return cell && cell.vertical === (orient === 'vertical');
  });
}

// Seta que aponta, na tela, da peça `i` para a vizinha `i + passo` na cadeia
// (passo -1: rumo à ponta inicial; +1: rumo à final). Como a cadeia faz
// curvas, cada sentido pode apontar para qualquer lado. Sem vizinha, null.
export function setaParaVizinha(rects, i, passo) {
  const a = rects[i];
  const b = rects[i + passo];
  if (!a || !b) return null;
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? '▶' : '◀';
  return dy >= 0 ? '▼' : '▲';
}

// Reposiciona a cadeia para ficar centralizada na área visível.
// Devolve o deslocamento a aplicar em cada peça e a altura da mesa.
export function centralizar(layout, containerWidth, alturaDisponivel) {
  if (layout.cells.length === 0) {
    return { offsetX: 0, offsetY: 0, height: Math.max(alturaDisponivel, 0) };
  }
  const q = layout.quadro;
  if (!q || !Number.isFinite(q.minY)) {
    const offsetX = (containerWidth - layout.larguraCadeia) / 2 - layout.minX;
    const height = Math.max(layout.alturaCadeia, alturaDisponivel);
    const offsetY = (height - layout.alturaCadeia) / 2 - layout.minY;
    return { offsetX, offsetY, height };
  }
  // O quadro em que a cadeia foi montada fica fixo no centro da área: a
  // primeira peça no meio, e nada se mexe quando entram peças novas. Só se a
  // cadeia passar da altura é que a mesa cresce (e rola).
  const offsetX = containerWidth / 2 - (q.minX + q.maxX) / 2;
  const centroY = Math.max(alturaDisponivel, 0) / 2 - (q.minY + q.maxY) / 2;
  const topo = Math.min(layout.minY + centroY, 0);
  const offsetY = centroY - topo;
  const height = Math.max(alturaDisponivel, layout.minY + layout.alturaCadeia + offsetY);
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

export const oposta = (d) => ({ right: 'left', left: 'right', down: 'up', up: 'down' })[d];
