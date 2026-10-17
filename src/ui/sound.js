// Sons das notas via WebAudio.
// O AudioContext é criado sob demanda (após o primeiro gesto do usuário).

import {
  chooseNotePos,
  choosePairPos,
  posFreq,
  INTERVAL_MODES,
  DEFAULT_INTERVAL_MODE,
} from '../game/notes.js';

const MUTE_KEY = 'domino.muted';
const INTERVAL_KEY = 'domino.intervalos';

// Peça colocada na mesa: uma nota por vez, com 1s entre elas.
const PLAY_GAP_S = 1.0;
const PLAY_DURATION_S = 0.5;
const PLAY_VOLUME = 0.22;

// Prévia ao passar o mouse: mais curta e mais baixa que a jogada.
const HOVER_DURATION_S = 0.35;
const HOVER_VOLUME = 0.12;
const HOVER_REPEAT_MS = 140; // evita retrigger na mesma nota em varreduras rápidas

// A placa de som leva alguns milissegundos para começar a produzir áudio depois
// que o contexto nasce. Agendar a primeira nota rente a esse instante faz ela
// sair cortada (ou nem sair) — daí a folga extra logo após a criação.
const WARMUP_LEAD_S = 0.15;
const WARMUP_WINDOW_MS = 600;
const NORMAL_LEAD_S = 0.02;

let ctx = null;
let ctxCreatedAt = 0;

export function isMuted() {
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function setMuted(muted) {
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
}

// Modo de intervalos entre notas seguidas (pode mudar durante a partida).
export function getIntervalMode() {
  try {
    const m = localStorage.getItem(INTERVAL_KEY);
    return m && INTERVAL_MODES[m] ? m : DEFAULT_INTERVAL_MODE;
  } catch {
    return DEFAULT_INTERVAL_MODE;
  }
}

export function setIntervalMode(mode) {
  try {
    localStorage.setItem(INTERVAL_KEY, mode);
  } catch {
    // sem armazenamento: vale só nesta sessão da página
  }
  modoAtual = mode;
}

let modoAtual = null;

// Altura da última nota tocada: a próxima é escolhida a partir dela.
let ultimaPos = null;

// Recomeça a melodia (ex.: ao tocar a cadeia do início): a próxima nota não
// depende da anterior.
export function resetMelody() {
  ultimaPos = null;
}

function getContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    ctxCreatedAt = performance.now();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Toca as notas em sequência. `values` são índices 0–6.
export function playNotes(
  values,
  {
    gap = PLAY_GAP_S,
    duration = PLAY_DURATION_S,
    volume = PLAY_VOLUME,
    preview = false,
    positions = null, // alturas já escolhidas (ex.: as duas notas de uma peça)
  } = {}
) {
  if (isMuted() || values.length === 0) return [];
  const audio = getContext();
  if (!audio) return [];
  const recemCriado = performance.now() - ctxCreatedAt < WARMUP_WINDOW_MS;
  const start = audio.currentTime + (recemCriado ? WARMUP_LEAD_S : NORMAL_LEAD_S);
  const oscs = [];
  const modo = modoAtual ?? getIntervalMode();
  let anterior = ultimaPos;
  values.forEach((value, i) => {
    const pos = positions?.[i] ?? chooseNotePos(anterior, value, modo);
    anterior = pos;
    const freq = posFreq(pos);
    if (!freq) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = start + i * gap;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
    oscs.push(osc);
  });
  // A prévia do mouse não conta como nota da melodia.
  if (!preview) ultimaPos = anterior;
  return oscs;
}

// Notas de uma peça na ordem em que devem soar (carroça soa duas vezes).
// As alturas das duas são escolhidas juntas, para o intervalo dentro da peça
// respeitar o modo (ver choosePairPos).
export function playTileNotes(primeira, segunda) {
  playNotes([primeira, segunda], { positions: planTile(primeira, segunda) });
}

// Alturas para as duas notas de uma peça, a partir da última nota tocada.
export function planTile(primeira, segunda) {
  return choosePairPos(ultimaPos, primeira, segunda, modoAtual ?? getIntervalMode());
}

// --- Tocar a cadeia ------------------------------------------------------

// Toca a mesa a partir de uma peça até uma das pontas, peça por peça.
// Pausar ou parar não corta a nota em curso: ela termina pelo próprio
// envelope, sem estalo.
// Intervalo entre as notas, ajustável na barra de velocidade (0,1 s a 3 s).
// Vale já na próxima nota, mesmo com a cadeia tocando.
const SPEED_KEY = 'domino.velocidade';
export const CHAIN_GAP_MIN_S = 0.1;
export const CHAIN_GAP_MAX_S = 3.0;
export const CHAIN_GAP_DEFAULT_S = 2.0;
const CHAIN_DURATION_S = 1.2;

let gapAtual = null;

export function getChainGap() {
  if (gapAtual !== null) return gapAtual;
  let g = CHAIN_GAP_DEFAULT_S;
  try {
    const salvo = parseFloat(localStorage.getItem(SPEED_KEY));
    if (salvo >= CHAIN_GAP_MIN_S && salvo <= CHAIN_GAP_MAX_S) g = salvo;
  } catch {
    // sem armazenamento: usa o padrão
  }
  gapAtual = g;
  return g;
}

export function setChainGap(segundos) {
  gapAtual = Math.min(CHAIN_GAP_MAX_S, Math.max(CHAIN_GAP_MIN_S, segundos));
  try {
    localStorage.setItem(SPEED_KEY, String(gapAtual));
  } catch {
    // vale só nesta sessão da página
  }
}

// `pos` vem de planTile, feito na primeira nota de cada peça. Em andamento
// rápido a nota fica mais curta, para não embolar com a seguinte.
export function playChainNote(value, pos) {
  const duration = Math.min(CHAIN_DURATION_S, getChainGap() * 0.9);
  playNotes([value], { duration, positions: [pos] });
}

// --- Prévia no hover -------------------------------------------------------

// Durante um arrasto o ponteiro varre a mesa; as prévias ficam suspensas
// para não virar uma cascata de notas.
let hoverEnabled = true;

export function setHoverSoundsEnabled(enabled) {
  hoverEnabled = enabled;
}

let lastHoverValue = null;
let lastHoverAt = 0;

export function playHoverNote(value) {
  if (!hoverEnabled) return;
  const now = performance.now();
  if (value === lastHoverValue && now - lastHoverAt < HOVER_REPEAT_MS) return;
  lastHoverValue = value;
  lastHoverAt = now;
  playNotes([value], { duration: HOVER_DURATION_S, volume: HOVER_VOLUME, preview: true });
}
