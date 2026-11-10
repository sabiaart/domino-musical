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
// Pico de cada nota perto de 0 dBFS (0,9 ≈ -1 dB). Notas que se sobrepõem
// (andamento rápido) passam por um limitador antes da saída, sem distorcer.
const PLAY_VOLUME = 0.9;

// Prévia ao passar o mouse: mais curta e mais baixa que a jogada.
const HOVER_DURATION_S = 0.35;
const HOVER_VOLUME = 0.5;
const HOVER_REPEAT_MS = 140; // evita retrigger na mesma nota em varreduras rápidas

// A placa de som leva alguns milissegundos para começar a produzir áudio depois
// que o contexto nasce. Agendar a primeira nota rente a esse instante faz ela
// sair cortada (ou nem sair) — daí a folga extra logo após a criação.
const WARMUP_LEAD_S = 0.15;
const WARMUP_WINDOW_MS = 600;
const NORMAL_LEAD_S = 0.02;

let ctx = null;
let ctxCreatedAt = 0;
let saida = null; // volume geral → limitador → alto-falante

const VOLUME_KEY = 'domino.volume';
let volumeAtual = null;

// Volume geral, de 0 a 1 (padrão: 1, o máximo).
export function getVolume() {
  if (volumeAtual !== null) return volumeAtual;
  let v = 1;
  try {
    const salvo = parseFloat(localStorage.getItem(VOLUME_KEY));
    if (salvo >= 0 && salvo <= 1) v = salvo;
  } catch {
    // sem armazenamento: usa o padrão
  }
  volumeAtual = v;
  return v;
}

export function setVolume(v) {
  volumeAtual = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem(VOLUME_KEY, String(volumeAtual));
  } catch {
    // vale só nesta sessão da página
  }
  if (saida && ctx) saida.gain.setTargetAtTime(volumeAtual, ctx.currentTime, 0.02);
}

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

// Articulação das notas tocadas (a prévia do mouse não muda). Legato: a nota
// soa por quase todo o tempo até a seguinte, com decay suave e uma pequena
// separação. Normal: a nota vai sumindo, como já
// era antes de existir esta opção.
const ARTICULATION_KEY = 'domino.articulacao';
export const ARTICULATIONS = ['normal', 'legato'];
const DEFAULT_ARTICULATION = 'normal';
const LEGATO_FRACAO = 0.9;
// Decay suave: a nota perde volume aos poucos até 70% e depois some numa queda
// longa, em vez de segurar o volume e cortar.
const LEGATO_SUSTENTACAO = 0.7;
const LEGATO_RELEASE_S = 0.25;

let articulacaoAtual = null;

export function getArticulation() {
  if (articulacaoAtual !== null) return articulacaoAtual;
  let a = DEFAULT_ARTICULATION;
  try {
    const salva = localStorage.getItem(ARTICULATION_KEY);
    if (ARTICULATIONS.includes(salva)) a = salva;
  } catch {
    // sem armazenamento: usa o padrão
  }
  articulacaoAtual = a;
  return a;
}

export function setArticulation(articulacao) {
  articulacaoAtual = articulacao;
  try {
    localStorage.setItem(ARTICULATION_KEY, articulacao);
  } catch {
    // vale só nesta sessão da página
  }
}

// Duração da nota para a articulação, dado o tempo até a nota seguinte (`gap`)
// e a duração que ela teria no modo normal.
export function articularNota(articulacao, gap, normal) {
  if (articulacao === 'legato') return { duration: gap * LEGATO_FRACAO, sustain: true };
  return { duration: normal };
}

// Timbre: famílias de instrumentos sintetizadas na hora (não são gravações).
// Cada voz combina camadas de osciladores, um filtro que corta os agudos, em
// múltiplos da frequência da nota, e às vezes vibrato.
const TIMBRE_KEY = 'domino.timbre';
const DEFAULT_TIMBRE = 'madeiras';
// Corda pinçada (harpa): o som morre sozinho, então não sustenta no legato.
const PERCUSSAO_MAX_S = 1.5;
const VOZES = {
  madeiras: {
    ataque: 0.04,
    camadas: [{ tipo: 'square', ganho: 0.7 }],
    filtro: { inicio: 4 },
    vibrato: { hz: 4.5, cents: 5, atraso: 0.3 },
  },
  metais: {
    ataque: 0.05,
    camadas: [{ tipo: 'sawtooth', ganho: 0.9 }],
    // O filtro abre logo depois do ataque: é o "brilho" do sopro de metal.
    filtro: { inicio: 2, fim: 8, abre: 0.1 },
  },
  // Corda friccionada: duas ondas ricas levemente desafinadas (o arco nunca é
  // perfeitamente estável), entrada lenta, agudos cortados pela caixa de
  // madeira e vibrato largo que aparece depois do início da nota.
  violoncelo: {
    ataque: 0.1,
    camadas: [
      { tipo: 'sawtooth', detune: -5, ganho: 0.5 },
      { tipo: 'sawtooth', detune: 5, ganho: 0.5 },
    ],
    filtro: { inicio: 5 },
    vibrato: { hz: 5.5, cents: 12, atraso: 0.2 },
  },
  // Corda pinçada: ataque seco, som quente, e os harmônicos agudos somem antes
  // da nota. Morre sozinha.
  harpa: {
    ataque: 0.004,
    percussivo: true,
    camadas: [
      { tipo: 'triangle', ganho: 1 },
      { tipo: 'sine', multiplo: 2, ganho: 0.33, decai: 0.5 },
      { tipo: 'sine', multiplo: 3, ganho: 0.16, decai: 0.2 },
    ],
    filtro: { inicio: 5 },
  },
};
export const TIMBRES = Object.keys(VOZES);

let timbreAtual = null;

export function getTimbre() {
  if (timbreAtual !== null) return timbreAtual;
  let t = DEFAULT_TIMBRE;
  try {
    const salvo = localStorage.getItem(TIMBRE_KEY);
    if (TIMBRES.includes(salvo)) t = salvo;
  } catch {
    // sem armazenamento: usa o padrão
  }
  timbreAtual = t;
  return t;
}

export function setTimbre(timbre) {
  timbreAtual = timbre;
  try {
    localStorage.setItem(TIMBRE_KEY, timbre);
  } catch {
    // vale só nesta sessão da página
  }
}

// Ajusta o pedido da articulação ao que o timbre consegue fazer. O ataque
// encolhe em notas curtas, para caber em andamento rápido em qualquer timbre.
export function envelopeDaVoz(timbre, duration, sustain) {
  const voz = VOZES[timbre];
  const dur = voz.percussivo ? Math.min(duration, PERCUSSAO_MAX_S) : duration;
  return {
    ataque: Math.min(voz.ataque, dur * 0.3),
    duration: dur,
    sustain: sustain && !voz.percussivo,
  };
}

// Agenda uma nota no instante `t` e devolve os osciladores criados.
export function tocarVoz(audio, destino, freq, t, { duration, volume, sustain, timbre }) {
  const voz = VOZES[timbre];
  const env = envelopeDaVoz(timbre, duration, sustain);
  const fim = t + env.duration;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + env.ataque);
  if (env.sustain) {
    // Em andamento rápido a nota é curta: a queda encolhe junto com ela.
    const queda = Math.min(LEGATO_RELEASE_S, env.duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(volume * LEGATO_SUSTENTACAO, fim - queda);
  }
  gain.gain.exponentialRampToValueAtTime(0.001, fim);
  gain.connect(destino);

  let entrada = gain;
  if (voz.filtro) {
    const filtro = audio.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = 0.7;
    filtro.frequency.setValueAtTime(freq * voz.filtro.inicio, t);
    if (voz.filtro.fim) {
      filtro.frequency.exponentialRampToValueAtTime(freq * voz.filtro.fim, t + voz.filtro.abre);
    }
    filtro.connect(gain);
    entrada = filtro;
  }

  const oscs = voz.camadas.map((camada) => {
    const osc = audio.createOscillator();
    osc.type = camada.tipo;
    osc.frequency.value = freq * (camada.multiplo ?? 1);
    osc.detune.value = camada.detune ?? 0;
    const ganho = audio.createGain();
    ganho.gain.setValueAtTime(camada.ganho ?? 1, t);
    if (camada.decai) ganho.gain.exponentialRampToValueAtTime(0.001, t + camada.decai);
    osc.connect(ganho).connect(entrada);
    osc.start(t);
    osc.stop(fim + 0.05);
    return osc;
  });

  if (voz.vibrato) {
    const lfo = audio.createOscillator();
    lfo.frequency.value = voz.vibrato.hz;
    const profundidade = audio.createGain();
    profundidade.gain.setValueAtTime(0, t + voz.vibrato.atraso);
    profundidade.gain.linearRampToValueAtTime(voz.vibrato.cents, t + voz.vibrato.atraso + 0.2);
    lfo.connect(profundidade);
    oscs.forEach((osc) => profundidade.connect(osc.detune));
    lfo.start(t);
    lfo.stop(fim + 0.05);
    oscs.push(lfo);
  }
  return oscs;
}

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
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = -1;
    limitador.knee.value = 0;
    limitador.ratio.value = 20;
    limitador.attack.value = 0.002;
    limitador.release.value = 0.1;
    saida = ctx.createGain();
    saida.gain.value = getVolume();
    saida.connect(limitador).connect(ctx.destination);
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
    sustain = false, // legato: mantém a nota soando, com decay suave no fim
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
    const t = start + i * gap;
    oscs.push(...tocarVoz(audio, saida, freq, t, { duration, volume, sustain, timbre: getTimbre() }));
  });
  // A prévia do mouse não conta como nota da melodia.
  if (!preview) ultimaPos = anterior;
  return oscs;
}

// Notas de uma peça na ordem em que devem soar (carroça soa duas vezes).
// As alturas das duas são escolhidas juntas, para o intervalo dentro da peça
// respeitar o modo (ver choosePairPos).
export function playTileNotes(primeira, segunda) {
  playNotes([primeira, segunda], {
    positions: planTile(primeira, segunda),
    ...articularNota(getArticulation(), PLAY_GAP_S, PLAY_DURATION_S),
  });
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
  const gap = getChainGap();
  const normal = Math.min(CHAIN_DURATION_S, gap * 0.9);
  playNotes([value], { ...articularNota(getArticulation(), gap, normal), positions: [pos] });
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
