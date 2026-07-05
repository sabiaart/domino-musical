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

export function noteName(value) {
  return NOTES[value];
}
