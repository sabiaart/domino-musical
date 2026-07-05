import { describe, it, expect } from 'vitest';
import { NOTES, NOTE_COLORS, NOTE_FREQS, noteName } from '../notes.js';
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
});
