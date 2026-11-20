import { describe, it, expect } from 'vitest';
import { articularNota, CHAIN_GAP_MIN_S, CHAIN_GAP_MAX_S } from '../sound.js';

const GAPS = [CHAIN_GAP_MIN_S, 1, CHAIN_GAP_MAX_S];

describe('articularNota', () => {
  it('staccato: nota curta, que acaba bem antes da seguinte', () => {
    for (const gap of GAPS) {
      const { duration, sustain } = articularNota('staccato', gap);
      expect(duration).toBeLessThanOrEqual(0.2);
      expect(duration).toBeLessThan(gap);
      expect(sustain).toBeUndefined();
    }
  });

  it('desligado: soa metade do tempo, bem separado da seguinte', () => {
    for (const gap of GAPS) {
      const { duration, sustain } = articularNota('desligado', gap);
      expect(duration).toBeCloseTo(gap * 0.5);
      expect(sustain).toBe(true);
    }
  });

  it('legato: emenda na seguinte', () => {
    for (const gap of GAPS) {
      const { duration, sustain } = articularNota('legato', gap);
      expect(duration).toBeGreaterThan(gap);
      expect(sustain).toBe(true);
    }
  });

  it('as três ficam em ordem: staccato < desligado < legato', () => {
    for (const gap of GAPS) {
      const [s, d, l] = ['staccato', 'desligado', 'legato'].map((a) => articularNota(a, gap).duration);
      expect(s).toBeLessThanOrEqual(d);
      expect(d).toBeLessThan(l);
    }
  });
});
