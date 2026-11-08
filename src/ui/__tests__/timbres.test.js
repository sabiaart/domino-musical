import { describe, it, expect } from 'vitest';
import { envelopeDaVoz, TIMBRES } from '../sound.js';

describe('envelopeDaVoz', () => {
  it('existem os cinco timbres', () => {
    expect(TIMBRES).toEqual([
      'madeiras',
      'metais',
      'flauta',
      'harpa',
      'percussao',
    ]);
  });

  it('o ataque nunca toma a nota inteira, mesmo a mais curta', () => {
    for (const timbre of TIMBRES) {
      const { ataque, duration } = envelopeDaVoz(timbre, 0.09, false);
      expect(ataque).toBeLessThan(duration);
    }
  });

  it('marimba e harpa não sustentam e têm duração limitada', () => {
    for (const timbre of ['percussao', 'harpa']) {
      const { duration, sustain } = envelopeDaVoz(timbre, 4.04, true);
      expect(sustain).toBe(false);
      expect(duration).toBe(1.5);
    }
  });

  it('os instrumentos de sustentação seguram o legato até o fim', () => {
    for (const timbre of ['madeiras', 'metais', 'flauta']) {
      const { duration, sustain } = envelopeDaVoz(timbre, 4.04, true);
      expect(sustain).toBe(true);
      expect(duration).toBe(4.04);
    }
  });
});
