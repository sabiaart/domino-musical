import { describe, it, expect } from 'vitest';
import {
  NOTES,
  NOTE_COLORS,
  NOTE_FREQS,
  noteName,
  noteFreqsInRange,
  randomNoteFreq,
  RANGE_MIN_HZ,
  RANGE_MAX_HZ,
} from '../notes.js';
import { MAX_PIP } from '../tiles.js';

describe('notes', () => {
  it('há uma nota, uma cor e uma frequência para cada valor do jogo (0-6)', () => {
    expect(NOTES).toHaveLength(MAX_PIP + 1);
    expect(NOTE_COLORS).toHaveLength(MAX_PIP + 1);
    expect(NOTE_FREQS).toHaveLength(MAX_PIP + 1);
    expect(new Set(NOTES).size).toBe(7);
    expect(new Set(NOTE_COLORS).size).toBe(7);
  });

  it('mapeia a escala: Dó=0 … Si=6', () => {
    expect(noteName(0)).toBe('Dó');
    expect(noteName(3)).toBe('Fá');
    expect(noteName(6)).toBe('Si');
  });

  it('frequências em ordem crescente (escala maior de Dó)', () => {
    for (let i = 1; i < NOTE_FREQS.length; i++) {
      expect(NOTE_FREQS[i]).toBeGreaterThan(NOTE_FREQS[i - 1]);
    }
    expect(NOTE_FREQS[5]).toBeCloseTo(440); // Lá = A4
  });

  it('extensão de Fá 2 a Mi 4: cada nota tem 2 ou 3 oitavas possíveis', () => {
    const qtd = NOTES.map((_, v) => noteFreqsInRange(v).length);
    // Dó–Mi: oitavas 3 e 4 · Fá–Si: oitavas 2 e 3
    expect(qtd).toEqual([2, 2, 2, 2, 2, 2, 2]);
    expect(noteFreqsInRange(3)[0]).toBeCloseTo(87.31, 1); // F2, a mais grave
    expect(noteFreqsInRange(2).at(-1)).toBeCloseTo(329.63, 1); // E4, a mais aguda
  });

  it('sorteio sempre cai dentro da extensão', () => {
    for (let v = 0; v < 7; v++) {
      for (const r of [0, 0.5, 0.999]) {
        const f = randomNoteFreq(v, () => r);
        expect(f).toBeGreaterThanOrEqual(RANGE_MIN_HZ - 0.01);
        expect(f).toBeLessThanOrEqual(RANGE_MAX_HZ + 0.01);
      }
    }
  });
});
