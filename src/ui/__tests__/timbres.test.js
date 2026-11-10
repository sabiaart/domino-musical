import { describe, it, expect } from 'vitest';
import { envelopeDaVoz, TIMBRES } from '../sound.js';

describe('envelopeDaVoz', () => {
  it('existem os quatro timbres', () => {
    expect(TIMBRES).toEqual(['madeiras', 'metais', 'violoncelo', 'harpa']);
  });

  it('o ataque nunca toma a nota inteira, mesmo a mais curta', () => {
    for (const timbre of TIMBRES) {
      const { ataque, duration } = envelopeDaVoz(timbre, 0.09, false);
      expect(ataque).toBeLessThan(duration);
    }
  });

  it('a harpa não sustenta e tem duração limitada', () => {
    const { duration, sustain } = envelopeDaVoz('harpa', 2.7, true);
    expect(sustain).toBe(false);
    expect(duration).toBe(1.5);
  });

  it('os instrumentos de sustentação seguram o legato até o fim', () => {
    for (const timbre of ['madeiras', 'metais', 'violoncelo']) {
      const { duration, sustain } = envelopeDaVoz(timbre, 2.7, true);
      expect(sustain).toBe(true);
      expect(duration).toBe(2.7);
    }
  });
});
