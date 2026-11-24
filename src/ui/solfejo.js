// Voz que solfeja: cada nota soa cantando a própria sílaba (Dó, Ré, Mi, Fá,
// Sol, Lá, Si). É síntese de formantes: uma onda que imita o pulso das pregas
// vocais passa por cinco filtros de banda nas ressonâncias da boca e da
// garganta, que mudam de lugar para formar cada vogal. As consoantes são feitas no começo da nota:
// um toque curto (d, e o "r" de Ré), boca fechada vibrando (m), língua (l) ou
// um sopro fraco de ruído (f, s).

import { ondaPeriodica, ruido } from './sintese.js';

// Formantes (F1 a F5 em Hz) de cada vogal, perto do português cantado. F4 e
// F5 quase não mudam entre vogais, mas dão corpo e "presença" de voz humana.
const VOGAIS = {
  a: [750, 1300, 2600, 3350, 3900],
  ó: [570, 840, 2410, 3300, 3850], // ó aberto, de Dó e Sol
  é: [610, 1900, 2600, 3400, 3950], // é aberto, de Ré
  i: [280, 2250, 2950, 3500, 4100],
  u: [330, 800, 2400, 3300, 3850], // o "l" final de Sol, dito como "u"
};
const LARGURAS = [90, 110, 160, 250, 300]; // largura de cada ressonância, em Hz
const VOLUMES = [1, 0.55, 0.3, 0.16, 0.09];
// Pulso das pregas vocais: harmônicos caindo mais rápido que no dente de serra
// (que soa como zumbido de máquina).
const QUEDA_DA_GLOTE = 1.5;
const HARMONICOS_DA_GLOTE = Array.from({ length: 64 }, (_, i) => 1 / (i + 1) ** QUEDA_DA_GLOTE);
// Volume da vogal depois da conta de equilíbrio (ver volumeDaVogal).
const ALVO = 0.78;

// Sílaba de cada nota (índices 0–6 = Dó…Si).
// - inicio: F1–F3 no começo (padrão: os da vogal), deslizando para a vogal;
// - desliza: tempo da passagem para a vogal (é nela que o ouvido reconhece
//   d, m, l e r);
// - voz: quanto as pregas vibram durante a consoante (0 = muda);
// - labios: corte dos agudos durante a consoante (boca fechada, língua);
// - sopro: ruído da consoante { tipo, hz, volume };
// - tempo: duração da consoante, em segundos.
export const SILABAS = [
  // Dó: língua fechada (só um zumbido fraco), um estalo curto e abre.
  {
    vogal: 'ó',
    tempo: 0.035,
    voz: 0.06,
    inicio: [250, 1500, 2500],
    desliza: 0.05,
    sopro: { tipo: 'bandpass', hz: 3000, volume: 0.05, estalo: true },
  },
  // Ré: "r" de toque (como em "caro"): um fio de voz, a língua bate (a voz
  // some por um instante) e abre no "é". O terceiro formante baixo dá a cor
  // de "r".
  { vogal: 'é', tempo: 0.035, toque: true, inicio: [450, 1500, 1700], desliza: 0.06 },
  // Mi: um "m" curto e fraco, já com a língua na posição do "i" (um "m"
  // longo e forte soava como "u").
  { vogal: 'i', tempo: 0.035, voz: 0.2, labios: 700, inicio: [250, 1700, 2500], desliza: 0.05 },
  // Fá: sopro fraco entre o lábio e os dentes.
  { vogal: 'a', tempo: 0.055, voz: 0, sopro: { tipo: 'highpass', hz: 2500, volume: 0.035 } },
  // Sol: sopro fraco, "ó" e termina em "u".
  { vogal: 'ó', tempo: 0.065, voz: 0, sopro: { tipo: 'bandpass', hz: 7000, volume: 0.04 }, fim: 'u' },
  // Lá: a língua solta rápido no "a" (curto e fraco, para não soar "u").
  { vogal: 'a', tempo: 0.03, voz: 0.3, inicio: [400, 1400, 2700], desliza: 0.06 },
  // Si: sopro fraco e "i".
  { vogal: 'i', tempo: 0.065, voz: 0, sopro: { tipo: 'bandpass', hz: 7000, volume: 0.04 } },
];

// Resposta de um filtro de banda (pico 1) na frequência `f`.
function resposta(f, centro, q) {
  const r = f / centro - centro / f;
  return 1 / Math.sqrt(1 + q * q * r * r);
}

// Quanto soa a vogal nesta altura: soma dos harmônicos da glote que
// passam pelas ressonâncias. Cada vogal reforça harmônicos diferentes de cada
// nota; dividir por isto deixa todas no mesmo volume, sem compressor (que
// aumentaria também as consoantes).
export function volumeDaVogal(freq, formantes, larguras, sr) {
  let soma = 0;
  for (let n = 1; n * freq < sr * 0.45; n++) {
    let h = 0;
    for (let k = 0; k < formantes.length; k++) {
      h += VOLUMES[k] * resposta(n * freq, formantes[k], formantes[k] / larguras[k]);
    }
    soma += (h / n ** QUEDA_DA_GLOTE) ** 2;
  }
  return Math.sqrt(soma);
}

// Monta a voz da nota `nota` em `destino` (o envelope geral vem de fora) e
// devolve as fontes criadas.
export function solfejar(audio, destino, freq, t, duracao, nota, parar) {
  const silaba = SILABAS[((nota % 7) + 7) % 7];
  // Em notas curtas (staccato, andamento rápido) a consoante encolhe junto.
  const c = Math.min(silaba.tempo, duracao * 0.3);
  const transicao = Math.min(silaba.desliza ?? 0.03, duracao * 0.15);
  // Nos agudos a voz tem poucos harmônicos e a vogal se perde: como fazem os
  // cantores, o primeiro formante sobe acima da nota e as ressonâncias ficam
  // mais largas (pegam algum harmônico).
  const agudo = Math.max(0, (freq - 400) / 400);
  const ajustar = (fs) => [Math.max(fs[0], freq * 1.15), ...fs.slice(1)];
  const vogal = ajustar(VOGAIS[silaba.vogal]);
  // F4 e F5 da consoante: os da vogal.
  const inicio = ajustar([...(silaba.inicio ?? VOGAIS[silaba.vogal]), ...VOGAIS[silaba.vogal].slice(3)].slice(0, 5));
  const larguras = LARGURAS.map((l) => l * (1 + agudo));

  // Equilíbrio de volume entre sílabas e alturas.
  const saida = audio.createGain();
  // Os picos crescem nos graves (mais harmônicos somando): compensa.
  const inclinacao = (freq / 262) ** 0.3;
  saida.gain.value = (ALVO * inclinacao) / volumeDaVogal(freq, vogal, larguras, audio.sampleRate);
  saida.connect(destino);

  // Lábios e língua: cortam os agudos enquanto a boca está fechada.
  let boca = saida;
  if (silaba.labios) {
    const labios = audio.createBiquadFilter();
    labios.type = 'lowpass';
    labios.Q.value = 0.5;
    labios.frequency.setValueAtTime(silaba.labios, t);
    labios.frequency.setValueAtTime(silaba.labios, t + c);
    labios.frequency.exponentialRampToValueAtTime(12000, t + c + transicao);
    labios.connect(saida);
    boca = labios;
  }

  // Cinco ressonâncias em paralelo. A passagem da consoante para a vogal é
  // uma curva (rápida no começo, assentando no fim), como a língua se move.
  const filtros = vogal.map((_, k) => {
    const f = audio.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(inicio[k], t);
    f.frequency.setValueAtTime(inicio[k], t + c);
    f.frequency.setTargetAtTime(vogal[k], t + c, transicao / 3);
    if (silaba.fim && duracao > 0.3) {
      const alvo = ajustar(VOGAIS[silaba.fim]);
      f.frequency.cancelScheduledValues(t + duracao * 0.6);
      f.frequency.setValueAtTime(vogal[k], t + duracao * 0.6);
      f.frequency.linearRampToValueAtTime(alvo[k], t + duracao * 0.85);
    }
    f.Q.value = vogal[k] / larguras[k];
    const g = audio.createGain();
    g.gain.value = VOLUMES[k];
    f.connect(g).connect(boca);
    return f;
  });

  // Pregas vocais: pulso de glote, chegando um tico abaixo da nota e subindo
  // (como um cantor), com vibrato que entra depois.
  const prega = audio.createOscillator();
  prega.setPeriodicWave(ondaPeriodica(audio, 'glote', HARMONICOS_DA_GLOTE));
  prega.frequency.value = freq;
  prega.detune.setValueAtTime(-25, t);
  prega.detune.linearRampToValueAtTime(0, t + Math.min(0.08, duracao * 0.3));
  const vozeada = audio.createGain();
  const g = vozeada.gain;
  if (silaba.toque) {
    // "r" de toque: voz, um corte curtíssimo (a língua batendo) e a vogal.
    const a = Math.min(0.012, c * 0.35);
    const b = Math.min(0.026, c * 0.75);
    g.setValueAtTime(0.25, t);
    g.setValueAtTime(0.25, t + a);
    g.linearRampToValueAtTime(0.02, t + a + 0.004);
    g.setValueAtTime(0.02, t + b);
    g.linearRampToValueAtTime(1, t + c + transicao);
  } else {
    g.setValueAtTime(silaba.voz, t);
    g.setValueAtTime(silaba.voz, t + c);
    g.linearRampToValueAtTime(1, t + c + transicao);
  }
  prega.connect(vozeada);
  filtros.forEach((f) => vozeada.connect(f));

  const lfo = audio.createOscillator();
  lfo.frequency.value = 5.5;
  const fundo = audio.createGain();
  fundo.gain.setValueAtTime(0, t);
  fundo.gain.setValueAtTime(0, t + 0.3);
  fundo.gain.linearRampToValueAtTime(18, t + 0.7);
  lfo.connect(fundo).connect(prega.detune);
  prega.start(t);
  prega.stop(parar);
  lfo.start(t);
  lfo.stop(parar);
  const fontes = [prega, lfo];

  // Sopro da consoante (fraco) ou o estalo do "d".
  if (silaba.sopro) {
    const s = silaba.sopro;
    const r = audio.createBufferSource();
    r.buffer = ruido(audio);
    r.loop = true;
    const banda = audio.createBiquadFilter();
    banda.type = s.tipo;
    banda.frequency.value = s.hz;
    banda.Q.value = s.tipo === 'highpass' ? 0.5 : 1.5;
    const gs = audio.createGain();
    // O volume do sopro é fixo em relação ao da vogal (não passa pela conta).
    const de = s.estalo ? c * 0.75 : 0;
    const ate = s.estalo ? Math.min(c + 0.004, de + 0.012) : c;
    gs.gain.setValueAtTime(0, t);
    gs.gain.setValueAtTime(0, t + de);
    gs.gain.linearRampToValueAtTime(s.volume, t + de + Math.min(0.01, (ate - de) * 0.4));
    gs.gain.linearRampToValueAtTime(0, t + ate + 0.01);
    r.connect(banda).connect(gs).connect(destino);
    r.start(t, Math.random() * 1.5);
    r.stop(parar);
    fontes.push(r);
  }
  return fontes;
}
