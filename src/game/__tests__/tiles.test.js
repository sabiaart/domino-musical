import { describe, it, expect } from 'vitest';
import { createAllTiles, deal, shuffle, isDouble, tileSum, makeTile } from '../tiles.js';
import { seededRng } from './helpers.js';

describe('tiles', () => {
  it('cria exatamente 28 peças únicas de 0-0 a 6-6', () => {
    const tiles = createAllTiles();
    expect(tiles).toHaveLength(28);
    const ids = new Set(tiles.map((t) => t.id));
    expect(ids.size).toBe(28);
    expect(ids.has('0-0')).toBe(true);
    expect(ids.has('6-6')).toBe(true);
    expect(ids.has('2-5')).toBe(true);
  });

  it('makeTile normaliza a ordem (a <= b)', () => {
    const t = makeTile(5, 2);
    expect(t).toEqual({ a: 2, b: 5, id: '2-5' });
  });

  it('identifica carroças e soma de pontos', () => {
    expect(isDouble(makeTile(3, 3))).toBe(true);
    expect(isDouble(makeTile(3, 4))).toBe(false);
    expect(tileSum(makeTile(6, 5))).toBe(11);
  });

  it('shuffle preserva as 28 peças e não muta o original', () => {
    const tiles = createAllTiles();
    const shuffled = shuffle(tiles, seededRng(42));
    expect(shuffled).toHaveLength(28);
    expect(new Set(shuffled.map((t) => t.id)).size).toBe(28);
    expect(tiles[0].id).toBe('0-0'); // original intacto
  });

  it('distribui 7 peças por jogador e o resto vai para o monte', () => {
    for (const n of [2, 3, 4]) {
      const { hands, boneyard } = deal(n, seededRng(7));
      expect(hands).toHaveLength(n);
      hands.forEach((h) => expect(h).toHaveLength(7));
      expect(boneyard).toHaveLength(28 - n * 7);
      const all = [...hands.flat(), ...boneyard].map((t) => t.id);
      expect(new Set(all).size).toBe(28);
    }
  });
});
