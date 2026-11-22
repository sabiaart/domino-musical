import { describe, it, expect } from 'vitest';
import { envelopeDaVoz, TIMBRES } from '../sound.js';

describe('envelopeDaVoz', () => {
  it('existem os cinco timbres', () => {
    expect(TIMBRES).toEqual(['madeiras', 'violoncelo', 'harpa', 'orgao', 'piano']);
  });

  it('o ataque nunca toma a nota inteira, mesmo a mais curta', () => {
    for (const timbre of TIMBRES) {
      const { ataque, duration } = envelopeDaVoz(timbre, 0.09, false);
      expect(ataque).toBeLessThan(duration);
    }
  });

  it('a harpa não sustenta, mas vibra até onde a articulação pedir', () => {
    const { duration, sustain } = envelopeDaVoz('harpa', 2.7, true);
    expect(sustain).toBe(false);
    expect(duration).toBe(2.7);
    expect(envelopeDaVoz('harpa', 9, true).duration).toBe(4);
  });

  it('os instrumentos de sustentação seguram o legato até o fim', () => {
    for (const timbre of ['madeiras', 'violoncelo', 'orgao']) {
      const { duration, sustain } = envelopeDaVoz(timbre, 2.7, true);
      expect(sustain).toBe(true);
      expect(duration).toBe(2.7);
    }
  });
});

describe('legato', () => {
  it('a entrada da nota cabe na troca com a anterior', () => {
    for (const timbre of ['madeiras', 'violoncelo', 'orgao']) {
      const { ataque, legato } = envelopeDaVoz(timbre, 2, true, true);
      expect(legato).toBe(true);
      expect(ataque).toBeLessThanOrEqual(0.06);
    }
  });
});
