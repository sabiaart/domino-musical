// Dominó musical: os valores internos 0–6 são as 7 notas musicais.
// Toda a lógica do jogo continua numérica; só a apresentação (e o som) muda.

export const NOTES = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];

// Cores por nota (arco-íris, inspirado nos boomwhackers).
export const NOTE_COLORS = [
  '#e5484d', // Dó — vermelho
  '#f76b15', // Ré — laranja
  '#eab308', // Mi — amarelo
  '#46a758', // Fá — verde
  '#00a2c7', // Sol — ciano
  '#3e63dd', // Lá — azul
  '#8e4ec6', // Si — roxo
];

// Frequências da oitava central (C4–B4), em Hz.
export const NOTE_FREQS = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88];

// Extensão tocada: do Fá 2 ao Mi 4. A oitava de cada nota é escolhida pelo
// modo de intervalos (abaixo).
export const RANGE_MIN_HZ = 87.31; // F2
export const RANGE_MAX_HZ = 329.63; // E4

export function noteName(value) {
  return NOTES[value];
}

// --- Intervalos entre notas seguidas ----------------------------------------
//
// Cada nota soa numa altura ("posição" diatônica: valor 0–6 + 7 × oitava,
// Dó4 = 28). Entre duas notas seguidas o intervalo é contado como na música:
// mesma posição = 1ª (uníssono), vizinha = 2ª, … sete posições = 8ª.
// O modo escolhe quais intervalos valem, subindo ou descendo:
export const INTERVAL_MODES = {
  pequenos: [1, 2, 3, 4], // 1ª, 2ª, 3ª e 4ª
  grandes: [5, 6, 7, 8], // 5ª, 6ª, 7ª e 8ª
  misto: [1, 2, 3, 4, 5, 6, 7, 8],
};
export const DEFAULT_INTERVAL_MODE = 'misto';

const RANGE_MIN_POS = 3 + 7 * 2; // Fá 2
const RANGE_MAX_POS = 2 + 7 * 4; // Mi 4

export function posFreq(pos) {
  return NOTE_FREQS[pos % 7] * 2 ** (Math.floor(pos / 7) - 4);
}

// Posições da nota `value` dentro da extensão (Fá 2 a Mi 4).
export function notePositions(value) {
  const out = [];
  for (let pos = RANGE_MIN_POS; pos <= RANGE_MAX_POS; pos++) {
    if (pos % 7 === value) out.push(pos);
  }
  return out;
}

export function intervalBetween(a, b) {
  return Math.abs(a - b) + 1;
}

// Escolhe a altura da próxima nota `value` depois de `prevPos` (null = sem
// nota anterior), respeitando o modo de intervalos. Como a nota tem duas
// alturas possíveis na extensão, separadas por uma oitava, quase sempre uma
// cai em cada grupo (ex.: 3ª acima ou 6ª abaixo). Se nenhuma servir — perto
// das bordas da extensão —, fica a de intervalo mais próximo dos permitidos.
export function chooseNotePos(prevPos, value, mode = DEFAULT_INTERVAL_MODE, rng = Math.random) {
  const cands = notePositions(value);
  const pick = (list) => list[Math.floor(rng() * list.length)];
  if (prevPos === null || prevPos === undefined) return pick(cands);
  const allowed = INTERVAL_MODES[mode] ?? INTERVAL_MODES[DEFAULT_INTERVAL_MODE];
  const ok = cands.filter((p) => allowed.includes(intervalBetween(prevPos, p)));
  if (ok.length > 0) return pick(ok);
  const dist = (p) =>
    Math.min(...allowed.map((iv) => Math.abs(intervalBetween(prevPos, p) - iv)));
  const best = Math.min(...cands.map(dist));
  return pick(cands.filter((p) => dist(p) === best));
}

// Alturas das duas notas de uma peça, tocadas em seguida. A prioridade é o
// intervalo DENTRO da peça: ele sempre respeita o modo (as duas notas têm duas
// alturas cada, e alguma combinação sempre serve). Entre a peça anterior e
// esta, o modo também vale quando dá; se não der — perto das bordas da
// extensão —, a peça muda de oitava em relação à anterior para manter o
// próprio intervalo. Retorna [pos1, pos2].
export function choosePairPos(prevPos, v1, v2, mode = DEFAULT_INTERVAL_MODE, rng = Math.random) {
  const allowed = INTERVAL_MODES[mode] ?? INTERVAL_MODES[DEFAULT_INTERVAL_MODE];
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const pares = [];
  for (const p1 of notePositions(v1)) {
    for (const p2 of notePositions(v2)) pares.push([p1, p2]);
  }
  const dist = (iv) => Math.min(...allowed.map((a) => Math.abs(iv - a)));
  const melhorDentro = Math.min(...pares.map(([a, b]) => dist(intervalBetween(a, b))));
  const validos = pares.filter(([a, b]) => dist(intervalBetween(a, b)) === melhorDentro);
  if (prevPos === null || prevPos === undefined) return pick(validos);
  const ligados = validos.filter(([a]) => allowed.includes(intervalBetween(prevPos, a)));
  if (ligados.length > 0) return pick(ligados);
  // Sem ligação no modo: fica a de salto mais próximo dos permitidos.
  const melhorLigacao = Math.min(...validos.map(([a]) => dist(intervalBetween(prevPos, a))));
  return pick(validos.filter(([a]) => dist(intervalBetween(prevPos, a)) === melhorLigacao));
}

