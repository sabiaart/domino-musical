// Sons das notas via WebAudio.
// O AudioContext é criado sob demanda (após o primeiro gesto do usuário).

import {
  chooseNotePos,
  choosePairPos,
  posFreq,
  INTERVAL_MODES,
  DEFAULT_INTERVAL_MODE,
  RANGE_MIN_HZ,
  RANGE_MAX_HZ,
} from '../game/notes.js';
import { aquecerCordas, corda, ondaPeriodica, ruido, sala } from './sintese.js';
import { solfejar } from './solfejo.js';

const MUTE_KEY = 'domino.muted';
const INTERVAL_KEY = 'domino.intervalos';

// Peça colocada na mesa: uma nota por vez, com 2 s entre o começo de uma e o da
// seguinte (a pedido do Pedro); quanto desse tempo a nota soa vem da articulação.
const PLAY_GAP_S = 2;
const PLAY_DURATION_S = 2;
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

// Articulação das notas tocadas (a prévia do mouse não muda), conforme o tempo
// até a nota seguinte. Staccato: nota curta e destacada. Desligado: soa a maior
// parte do tempo e se separa um pouco da seguinte. Legato: emenda totalmente na
// seguinte (a queda de uma passa por dentro do começo da outra).
const ARTICULATION_KEY = 'domino.articulacao';
export const ARTICULATIONS = ['staccato', 'desligado', 'legato'];
const DEFAULT_ARTICULATION = 'desligado';
const STACCATO_DURATION_S = 0.2;
const DESLIGADO_FRACAO = 0.5;
// Legato: a nota segura o volume cheio até a seguinte começar e só então cede,
// numa troca rápida (a seguinte entra enquanto ela sai), para os ataques
// ficarem o mais emendados possível.
const LEGATO_EMENDA_S = 0.06;
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

// Duração da nota para a articulação, dado o tempo até a nota seguinte (`gap`).
export function articularNota(articulacao, gap) {
  if (articulacao === 'staccato') return { duration: Math.min(STACCATO_DURATION_S, gap * 0.5) };
  if (articulacao === 'legato') return { duration: gap + LEGATO_EMENDA_S, sustain: true, legato: true };
  return { duration: gap * DESLIGADO_FRACAO, sustain: true };
}

// Timbre: instrumentos sintetizados na hora (não são gravações). Clarinete,
// violoncelo e órgão somam ondas com os harmônicos de cada instrumento, um
// filtro que imita o corpo (e abre no ataque) e o ruído do sopro, do arco ou
// do vento nos tubos. Harpa e piano digital são calculados amostra por amostra
// (ver sintese.js). Todos passam por um eco de sala, maior no órgão.
const TIMBRE_KEY = 'domino.timbre';
const DEFAULT_TIMBRE = 'madeiras';
// Corda pinçada ou percutida: o som não sustenta, vai morrendo desde o toque;
// a articulação decide quando a corda é abafada (staccato logo, desligado
// antes da seguinte, legato só quando a seguinte soa).
const PERCUSSAO_MAX_S = 4;
const ONDA_PRINCIPAL = [1, 0.45, 0.25, 0.18, 0.1, 0.07, 0.05, 0.03];
const VOZES = {
  // Clarinete: tubo fechado numa ponta, por isso quase só harmônicos ímpares;
  // a palheta abre o brilho no ataque, a nota chega um tico baixa e se firma,
  // e por baixo há um fio de sopro. Quase sem vibrato, como no clássico.
  madeiras: {
    ataque: 0.04,
    camadas: [
      {
        onda: 'clarinete',
        harmonicos: [1, 0.04, 0.62, 0.03, 0.42, 0.04, 0.27, 0.03, 0.17, 0.03, 0.1, 0.02, 0.06, 0.02, 0.04],
      },
    ],
    filtro: { de: 2, ate: 7, maxHz: 4200, abre: 0.07 },
    entrada: { cents: -10, tempo: 0.06 },
    sopro: { hz: 2400, q: 0.8, ganho: 0.02, ataque: 0.07 },
    vibrato: { hz: 4.8, cents: 3, atraso: 0.5 },
    sala: 0.22,
    nivel: 0.85,
  },
  // Violoncelo: o arco arrasta a corda em dente de serra; duas ondas levemente
  // desafinadas, o ruído do arco mordendo no começo, as ressonâncias da caixa
  // de madeira e um vibrato largo que entra depois do início da nota.
  violoncelo: {
    ataque: 0.1,
    camadas: [
      { tipo: 'sawtooth', detune: -4, ganho: 0.5 },
      { tipo: 'sawtooth', detune: 4, ganho: 0.5 },
    ],
    filtro: { de: 3, ate: 10, maxHz: 5000, abre: 0.15 },
    corpo: [
      { hz: 110, q: 1.4, db: 2 },
      { hz: 230, q: 2, db: 3 },
      { hz: 460, q: 1.8, db: 2 },
      { hz: 1600, q: 1, db: -2 },
    ],
    entrada: { cents: -6, tempo: 0.08 },
    sopro: { hz: 1800, q: 0.7, ganho: 0.01, ataque: 0.06 },
    vibrato: { hz: 5.3, cents: 14, atraso: 0.25 },
    sala: 0.25,
    nivel: 0.95,
    // A caixa reforça os graves: o agudo sobe um pouco para ficar no mesmo volume.
    inclinacao: 0.2,
  },
  // Harpa celta: corda de náilon pinçada pelo dedo. Morre sozinha.
  harpa: {
    ataque: 0.002,
    percussivo: true,
    corda: 'harpa',
    abafa: 0.12,
    sala: 0.28,
    nivel: 1,
  },
  // Órgão de tubos: registros somados (16', 8', 4', 2 2/3', 2' e um fio de
  // mistura), cada um um tico fora do outro, como tubos de verdade; o vento dá
  // um "chiff" quando o tubo fala; volume constante enquanto a tecla está
  // apertada, sem vibrato, numa igreja que ecoa.
  orgao: {
    ataque: 0.05,
    camadas: [
      { onda: 'bordao', harmonicos: [1, 0, 0.12, 0, 0.04], multiplo: 0.5, ganho: 0.32, detune: -1.5 },
      { onda: 'principal', harmonicos: ONDA_PRINCIPAL, ganho: 0.5 },
      { onda: 'principal', harmonicos: ONDA_PRINCIPAL, multiplo: 2, ganho: 0.3, detune: 1.5 },
      { tipo: 'sine', multiplo: 3, ganho: 0.13, detune: -1 },
      { onda: 'principal', harmonicos: ONDA_PRINCIPAL, multiplo: 4, ganho: 0.13, detune: 2 },
      { tipo: 'sine', multiplo: 8, ganho: 0.05, detune: -2 },
    ],
    filtro: { de: 12, ate: 12, maxHz: 7000 },
    sopro: { multiplo: 4, q: 2, ganho: 0.004, ataque: 0.08 },
    plano: true,
    sala: 0.5,
    nivel: 0.7,
  },
  // Piano digital (pedido do Pedro, no lugar da celesta, que nos graves soava
  // como ruído). Como a harpa, a articulação decide quando o som é abafado.
  pianoDigital: {
    ataque: 0.002,
    percussivo: true,
    corda: 'pianoDigital',
    abafa: 0.1,
    sala: 0.3,
    nivel: 1,
  },
  // Voz que solfeja: canta a sílaba de cada nota (pedido do Pedro). Ver
  // solfejo.js.
  voz: {
    ataque: 0.02,
    solfejo: true,
    sala: 0.3,
    nivel: 1,
  },
};
export const TIMBRES = Object.keys(VOZES);

// Multitimbre (pedido do Pedro): as duas notas de uma peça soam com timbres
// diferentes, sorteados entre os instrumentos (a Voz fica de fora). A primeira
// nota de uma peça repete a nota em que ela encaixa, e repete também o timbre
// com que essa nota soou. `papel`: 'inicio' ou 'fim' da peça; sem papel
// (prévia do mouse), só sorteia.
export const MULTITIMBRE = 'multi';
export const TIMBRES_DO_MULTI = TIMBRES.filter((t) => t !== 'voz');
let ultimoSorteado = null;
const timbreDaPonta = new Map(); // nota → timbre com que ela soou como ponta
export function timbreDaNota(escolhido, nota, papel) {
  if (escolhido !== MULTITIMBRE) return escolhido;
  let t;
  if (papel === 'inicio' && timbreDaPonta.has(nota)) {
    t = timbreDaPonta.get(nota);
  } else {
    const opcoes = TIMBRES_DO_MULTI.filter((x) => x !== ultimoSorteado);
    t = opcoes[Math.floor(Math.random() * opcoes.length)];
  }
  if (papel === 'fim') timbreDaPonta.set(nota, t);
  ultimoSorteado = t;
  return t;
}

let timbreAtual = null;

export function getTimbre() {
  if (timbreAtual !== null) return timbreAtual;
  let t = DEFAULT_TIMBRE;
  try {
    const salvo = localStorage.getItem(TIMBRE_KEY);
    if (TIMBRES.includes(salvo) || salvo === MULTITIMBRE) t = salvo;
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
  if (ctx) aquecerTimbre(ctx, timbre);
}

// Todas as alturas que o jogo toca.
function frequenciasDoJogo() {
  const fs = [];
  for (let pos = 0; pos < 70; pos++) {
    const f = posFreq(pos);
    if (f >= RANGE_MIN_HZ - 0.5 && f <= RANGE_MAX_HZ + 0.5) fs.push(f);
  }
  return fs;
}

// As cordas são calculadas antes de serem pedidas, para a primeira nota não
// atrasar.
function aquecerTimbre(audio, timbre) {
  if (timbre === MULTITIMBRE) {
    TIMBRES_DO_MULTI.forEach((t) => aquecerTimbre(audio, t));
    return;
  }
  const voz = VOZES[timbre];
  if (voz?.corda) aquecerCordas(audio, voz.corda, frequenciasDoJogo(), PERCUSSAO_MAX_S + 0.1);
}

// Ajusta o pedido da articulação ao que o timbre consegue fazer. O ataque
// encolhe em notas curtas, para caber em andamento rápido em qualquer timbre.
export function envelopeDaVoz(timbre, duration, sustain, legato = false) {
  const voz = VOZES[timbre];
  const dur = voz.percussivo ? Math.min(duration, PERCUSSAO_MAX_S) : duration;
  // No legato a entrada da nota cabe na troca com a anterior: sem buraco.
  const ataqueMax = legato && !voz.percussivo ? LEGATO_EMENDA_S : voz.ataque;
  return {
    ataque: Math.min(voz.ataque, ataqueMax, dur * 0.3),
    duration: dur,
    sustain: sustain && !voz.percussivo,
    legato: legato && !voz.percussivo,
  };
}

// Agenda uma nota no instante `t` e devolve as fontes de som criadas.
export function tocarVoz(audio, destino, freq, t, { duration, volume, sustain, legato, timbre, nota = 0 }) {
  const voz = VOZES[timbre];
  const env = envelopeDaVoz(timbre, duration, sustain, legato);
  const fim = t + env.duration;
  const pico = volume * (voz.nivel ?? 1) * (freq / 261.63) ** (voz.inclinacao ?? 0);

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(pico, t + env.ataque);
  if (env.legato || (env.sustain && voz.plano)) {
    // Volume cheio até o fim; só a troca final, curta.
    const queda = Math.min(env.legato ? LEGATO_EMENDA_S : LEGATO_RELEASE_S, env.duration * 0.3);
    gain.gain.setValueAtTime(pico, fim - queda);
  } else if (env.sustain) {
    // Em andamento rápido a nota é curta: a queda encolhe junto com ela.
    const queda = Math.min(LEGATO_RELEASE_S, env.duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(pico * LEGATO_SUSTENTACAO, fim - queda);
  } else if (voz.percussivo) {
    // A corda morre sozinha; o abafador só cai no fim.
    const queda = Math.min(voz.abafa, env.duration * 0.4);
    gain.gain.setValueAtTime(pico, Math.max(t + env.ataque, fim - queda));
  }
  gain.gain.exponentialRampToValueAtTime(0.001, fim);
  gain.connect(destino);
  if (voz.sala) {
    const envio = audio.createGain();
    envio.gain.value = voz.sala;
    gain.connect(envio).connect(sala(audio, destino));
  }
  const parar = fim + 0.05;

  if (voz.solfejo) return solfejar(audio, gain, freq, t, env.duration, nota, parar);

  if (voz.corda) {
    const fonte = audio.createBufferSource();
    fonte.buffer = corda(audio, voz.corda, freq, PERCUSSAO_MAX_S + 0.1);
    fonte.connect(gain);
    fonte.start(t);
    fonte.stop(parar);
    return [fonte];
  }

  // Corpo do instrumento: ressonâncias fixas, em hertz.
  let entrada = gain;
  for (const r of voz.corpo ?? []) {
    const f = audio.createBiquadFilter();
    f.type = 'peaking';
    f.frequency.value = r.hz;
    f.Q.value = r.q;
    f.gain.value = r.db;
    f.connect(entrada);
    entrada = f;
  }
  // Brilho: o filtro abre durante o ataque, como a palheta ou o arco pegando.
  if (voz.filtro) {
    const filtro = audio.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = 0.7;
    const aberto = Math.min(freq * voz.filtro.ate, voz.filtro.maxHz);
    filtro.frequency.setValueAtTime(Math.min(freq * voz.filtro.de, aberto), t);
    if (voz.filtro.abre) {
      filtro.frequency.exponentialRampToValueAtTime(aberto, t + Math.min(voz.filtro.abre, env.duration * 0.5));
    }
    filtro.connect(entrada);
    entrada = filtro;
  }

  const fontes = voz.camadas.map((camada) => {
    const osc = audio.createOscillator();
    if (camada.onda) osc.setPeriodicWave(ondaPeriodica(audio, camada.onda, camada.harmonicos));
    else osc.type = camada.tipo;
    osc.frequency.value = freq * (camada.multiplo ?? 1);
    const detune = camada.detune ?? 0;
    if (voz.entrada) {
      // A nota chega um pouco baixa e se firma.
      osc.detune.setValueAtTime(detune + voz.entrada.cents, t);
      osc.detune.linearRampToValueAtTime(detune, t + Math.min(voz.entrada.tempo, env.duration * 0.5));
    } else {
      osc.detune.value = detune;
    }
    const ganho = audio.createGain();
    ganho.gain.value = camada.ganho ?? 1;
    osc.connect(ganho).connect(entrada);
    osc.start(t);
    osc.stop(parar);
    return osc;
  });
  const oscs = [...fontes];

  // Sopro, arco ou vento: ruído filtrado, mais forte no ataque.
  if (voz.sopro) {
    const s = voz.sopro;
    const r = audio.createBufferSource();
    r.buffer = ruido(audio);
    r.loop = true;
    const banda = audio.createBiquadFilter();
    banda.type = 'bandpass';
    banda.frequency.value = Math.min(s.hz ?? freq * s.multiplo, audio.sampleRate * 0.45);
    banda.Q.value = s.q;
    const g = audio.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(s.ganho * 4, t + Math.min(0.015, env.duration * 0.2));
    g.gain.exponentialRampToValueAtTime(s.ganho, t + Math.min(s.ataque, env.duration * 0.5));
    r.connect(banda).connect(g).connect(gain);
    r.start(t, Math.random() * 1.5);
    r.stop(parar);
    fontes.push(r);
  }

  if (voz.vibrato) {
    const lfo = audio.createOscillator();
    lfo.frequency.value = voz.vibrato.hz;
    const profundidade = audio.createGain();
    profundidade.gain.setValueAtTime(0, t + voz.vibrato.atraso);
    profundidade.gain.linearRampToValueAtTime(voz.vibrato.cents, t + voz.vibrato.atraso + 0.4);
    lfo.connect(profundidade);
    oscs.forEach((osc) => profundidade.connect(osc.detune));
    lfo.start(t);
    lfo.stop(parar);
    fontes.push(lfo);
  }
  return fontes;
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
    aquecerTimbre(ctx, getTimbre());
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
    sustain = false, // mantém a nota soando, com decay suave no fim
    legato = false, // segura o volume cheio e emenda na seguinte
    papeis = null, // 'inicio'/'fim' de peça para cada nota (multitimbre)
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
    oscs.push(...tocarVoz(audio, saida, freq, t, { duration, volume, sustain, legato, timbre: timbreDaNota(getTimbre(), value, papeis?.[i]), nota: value }));
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
    papeis: ['inicio', 'fim'],
    ...articularNota(getArticulation(), PLAY_GAP_S),
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
// Intervalo entre as notas, ajustável na barra de velocidade (0,05 s a 3,5 s).
// Vale já na próxima nota, mesmo com a cadeia tocando.
const SPEED_KEY = 'domino.velocidade';
export const CHAIN_GAP_MIN_S = 0.05;
export const CHAIN_GAP_MAX_S = 3.5;
// Sem mexer na barra, a cadeia toca a 1,5 s por nota (pedido do Pedro).
export const CHAIN_GAP_DEFAULT_S = 1.5;

let gapAtual = null;

export function getChainGap() {
  if (gapAtual !== null) return gapAtual;
  let g = CHAIN_GAP_DEFAULT_S;
  try {
    const salvo = parseFloat(localStorage.getItem(SPEED_KEY));
    // Valor salvo fora da faixa (o limite já mudou algumas vezes) fica no
    // limite mais próximo, em vez de voltar ao padrão.
    if (Number.isFinite(salvo)) g = Math.min(CHAIN_GAP_MAX_S, Math.max(CHAIN_GAP_MIN_S, salvo));
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
export function playChainNote(value, pos, papel) {
  const gap = getChainGap();
  playNotes([value], { ...articularNota(getArticulation(), gap), positions: [pos], papeis: [papel] });
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
