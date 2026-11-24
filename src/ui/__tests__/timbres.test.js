import { describe, it, expect } from 'vitest';
import { envelopeDaVoz, TIMBRES, timbreDaNota, MULTITIMBRE } from '../sound.js';
import { SILABAS } from '../solfejo.js';
import { renderHarpa, renderPianoDigital } from '../sintese.js';

describe('envelopeDaVoz', () => {
  it('existem os cinco timbres', () => {
    expect(TIMBRES).toEqual(['madeiras', 'violoncelo', 'harpa', 'orgao', 'pianoDigital', 'voz']);
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

describe('cordas calculadas', () => {
  const sr = 48000;
  // Período pela autocorrelação: o atraso, perto do esperado, em que a onda
  // mais se parece com ela mesma.
  function freqMedida(d, inicio, esperado) {
    const P = sr / esperado;
    let melhor = 0;
    let lag = 0;
    for (let l = Math.floor(P * 0.9); l <= Math.ceil(P * 1.1); l++) {
      let s = 0;
      for (let i = inicio; i < inicio + 4096; i++) s += d[i] * d[i + l];
      if (s > melhor) {
        melhor = s;
        lag = l;
      }
    }
    return sr / lag;
  }
  function energia(d, de, ate) {
    let s = 0;
    for (let i = de; i < ate; i++) s += d[i] * d[i];
    return s / (ate - de);
  }

  for (const [nome, render] of [
    ['harpa', renderHarpa],
    ['piano digital', renderPianoDigital],
  ]) {
    it(`${nome}: afinada, sem passar de 1 e morrendo com o tempo`, () => {
      for (const f of [98, 261.63, 1046.52]) {
        const d = render(sr, f, 4.1);
        expect(d.every(Number.isFinite)).toBe(true);
        expect(d.reduce((m, x) => Math.max(m, Math.abs(x)), 0)).toBeCloseTo(1, 5);
        // erro de no máximo ~1 amostra de período
        expect(Math.abs(freqMedida(d, 2000, f) - f) / f).toBeLessThan(0.025);
        expect(energia(d, sr, sr + 4800)).toBeLessThan(energia(d, 1000, 5800));
      }
    });
  }
});

describe('multitimbre', () => {
  it('cada peça soa num timbre só, e a seguinte troca de timbre', () => {
    let anterior = null;
    const vistos = new Set();
    for (let i = 0; i < 300; i++) {
      const nota = i % 7;
      const ta = timbreDaNota(MULTITIMBRE, nota, 'inicio');
      const tb = timbreDaNota(MULTITIMBRE, (nota + 2) % 7, 'fim');
      expect(TIMBRES).toContain(ta);
      expect(tb).toBe(ta);
      expect(ta).not.toBe(anterior);
      vistos.add(ta);
      anterior = ta;
    }
    // Todos entram no sorteio, inclusive a Voz.
    expect(vistos.size).toBe(TIMBRES.length);
    expect(vistos.has('voz')).toBe(true);
  });

  it('um timbre escolhido continua o mesmo', () => {
    expect(timbreDaNota('harpa', 0, 'inicio')).toBe('harpa');
  });
});

describe('voz que solfeja', () => {
  it('tem uma sílaba para cada nota', () => {
    expect(SILABAS).toHaveLength(7);
  });
});
