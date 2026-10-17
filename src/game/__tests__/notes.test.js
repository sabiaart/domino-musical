import { describe, it, expect } from 'vitest';
import {
  NOTES,
  NOTE_COLORS,
  NOTE_FREQS,
  noteName,
  RANGE_MIN_HZ,
  RANGE_MAX_HZ,
  notePositions,
  posFreq,
  chooseNotePos,
  choosePairPos,
  intervalBetween,
  INTERVAL_MODES,
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

  it('extensão de Fá 2 a Mi 4: cada nota tem duas alturas, uma oitava aparte', () => {
    for (let v = 0; v < 7; v++) {
      const [baixa, alta] = notePositions(v);
      expect(notePositions(v)).toHaveLength(2);
      expect(alta - baixa).toBe(7);
      for (const pos of [baixa, alta]) {
        expect(posFreq(pos)).toBeGreaterThanOrEqual(RANGE_MIN_HZ - 0.01);
        expect(posFreq(pos)).toBeLessThanOrEqual(RANGE_MAX_HZ + 0.01);
      }
    }
    expect(posFreq(notePositions(3)[0])).toBeCloseTo(87.31, 1); // Fá 2
    expect(posFreq(notePositions(2)[1])).toBeCloseTo(329.63, 1); // Mi 4
  });

  it('cada modo só usa os seus intervalos, subindo e descendo', () => {
    for (const [modo, permitidos] of [
      ['pequenos', [1, 2, 3, 4]],
      ['grandes', [5, 6, 7, 8]],
    ]) {
      const vistos = new Set();
      let sobe = false;
      let desce = false;
      for (let semente = 0; semente < 200; semente++) {
        let x = semente;
        const rng = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
        const prev = 17 + (semente % 14); // qualquer altura da extensão
        const value = (semente * 3) % 7;
        const pos = chooseNotePos(prev, value, modo, rng);
        const iv = intervalBetween(prev, pos);
        // Se alguma altura da nota dá um intervalo do modo, é ela que soa.
        // (Perto das bordas da extensão às vezes nenhuma dá.)
        const possivel = notePositions(value).some((p) =>
          permitidos.includes(intervalBetween(prev, p))
        );
        if (!possivel) continue;
        expect(permitidos, `${modo}: ${iv}ª`).toContain(iv);
        vistos.add(iv);
        if (pos > prev) sobe = true;
        if (pos < prev) desce = true;
      }
      expect(sobe && desce).toBe(true);
      expect(vistos.size).toBeGreaterThan(2);
    }
  });

  it('mesma nota: uníssono nos pequenos, oitava nos grandes', () => {
    const prev = notePositions(4)[0]; // Sol 2
    expect(chooseNotePos(prev, 4, 'pequenos')).toBe(prev);
    expect(chooseNotePos(prev, 4, 'grandes')).toBe(prev + 7);
  });

  it('sem nota anterior, qualquer altura da extensão', () => {
    expect(notePositions(5)).toContain(chooseNotePos(null, 5, 'grandes'));
    expect(Object.keys(INTERVAL_MODES)).toEqual(['pequenos', 'grandes', 'misto']);
  });

  it('peça: o intervalo entre as duas notas sempre respeita o modo', () => {
    for (const [modo, permitidos] of Object.entries(INTERVAL_MODES)) {
      for (let v1 = 0; v1 < 7; v1++) {
        for (let v2 = 0; v2 < 7; v2++) {
          for (const prev of [null, 17, 20, 24, 27, 30]) {
            for (const r of [0, 0.5, 0.99]) {
              const [p1, p2] = choosePairPos(prev, v1, v2, modo, () => r);
              expect(notePositions(v1)).toContain(p1);
              expect(notePositions(v2)).toContain(p2);
              expect(permitidos, `${modo} ${v1}-${v2}`).toContain(intervalBetween(p1, p2));
            }
          }
        }
      }
    }
  });

  it('peça: a ligação com a anterior segue o modo quando dá', () => {
    for (const [modo, permitidos] of Object.entries(INTERVAL_MODES)) {
      for (let v1 = 0; v1 < 7; v1++) {
        for (let v2 = 0; v2 < 7; v2++) {
          for (let prev = 17; prev <= 30; prev++) {
            const daPraLigar = notePositions(v1).some(
              (a) =>
                permitidos.includes(intervalBetween(prev, a)) &&
                notePositions(v2).some((b) => permitidos.includes(intervalBetween(a, b)))
            );
            if (!daPraLigar) continue;
            const [p1] = choosePairPos(prev, v1, v2, modo, () => 0.3);
            expect(permitidos).toContain(intervalBetween(prev, p1));
          }
        }
      }
    }
  });
});

