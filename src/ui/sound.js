// Sons das notas via WebAudio: arpejo curto ao colocar uma peça na mesa.
// O AudioContext é criado sob demanda (após o primeiro gesto do usuário).

import { NOTE_FREQS } from '../game/notes.js';

const MUTE_KEY = 'domino.muted';
let ctx = null;

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
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Toca as notas em sequência (arpejo). `values` são índices 0–6.
export function playNotes(values, { gap = 0.16, duration = 0.32 } = {}) {
  if (isMuted() || values.length === 0) return;
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + 0.02;
  values.forEach((value, i) => {
    const freq = NOTE_FREQS[value];
    if (!freq) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = start + i * gap;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  });
}
