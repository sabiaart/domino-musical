import { describe, it, expect } from 'vitest';
import { articularNota, CHAIN_GAP_MIN_S, CHAIN_GAP_MAX_S } from '../sound.js';

describe('articularNota', () => {
  it('normal: mantém a duração de sempre', () => {
    expect(articularNota('normal', 2, 1.2)).toEqual({ duration: 1.2 });
  });

  it('legato: nota segura quase até a seguinte, com uma pequena separação', () => {
    for (const gap of [CHAIN_GAP_MIN_S, 1, CHAIN_GAP_MAX_S]) {
      const { duration, sustain } = articularNota('legato', gap, 1.2);
      expect(duration).toBeCloseTo(gap * 0.8);
      expect(sustain).toBe(true);
    }
  });
});
