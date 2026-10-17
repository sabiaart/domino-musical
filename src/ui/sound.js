// Sons das notas via WebAudio.
// O AudioContext é criado sob demanda (após o primeiro gesto do usuário).

import { randomNoteFreq } from '../game/notes.js';

const MUTE_KEY = 'domino.muted';

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
  { gap = PLAY_GAP_S, duration = PLAY_DURATION_S, volume = PLAY_VOLUME } = {}
) {
  if (isMuted() || values.length === 0) return [];
  const audio = getContext();
  if (!audio) return [];
  const recemCriado = performance.now() - ctxCreatedAt < WARMUP_WINDOW_MS;
  const start = audio.currentTime + (recemCriado ? WARMUP_LEAD_S : NORMAL_LEAD_S);
  const oscs = [];
  values.forEach((value, i) => {
    const freq = randomNoteFreq(value);
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
  return oscs;
}

// Notas de uma peça na ordem em que devem soar (carroça soa duas vezes).
export function playTileNotes(primeira, segunda) {
  playNotes([primeira, segunda]);
}

// --- Tocar a cadeia ------------------------------------------------------

// Toca a mesa a partir de uma peça até uma das pontas, peça por peça.
// Uma nova execução (ou stopChain) corta a anterior.
const CHAIN_GAP_S = 2.0;
const CHAIN_DURATION_S = 1.2;

let chainOscs = [];

export function stopChain() {
  for (const osc of chainOscs) {
    try {
      osc.stop();
    } catch {
      // já parou
    }
  }
  chainOscs = [];
}

// `notes` são índices 0–6. Retorna o intervalo entre notas em ms (0 se mudo),
// para a interface acompanhar o andamento.
export function playChain(notes) {
  stopChain();
  chainOscs = playNotes(notes, { gap: CHAIN_GAP_S, duration: CHAIN_DURATION_S });
  return chainOscs.length > 0 ? CHAIN_GAP_S * 1000 : 0;
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
  playNotes([value], { duration: HOVER_DURATION_S, volume: HOVER_VOLUME });
}
