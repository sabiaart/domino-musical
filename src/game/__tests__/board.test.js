import { describe, it, expect } from 'vitest';
import { getEnds, playableSides, canPlay, placeTile, placedNoteOrder } from '../board.js';
import { makeTile, createAllTiles, shuffle } from '../tiles.js';
import { seededRng } from './helpers.js';

describe('board', () => {
  it('mesa vazia: sem pontas e qualquer peça encaixa', () => {
    expect(getEnds([])).toBeNull();
    expect(canPlay(makeTile(0, 0), null)).toBe(true);
    expect(playableSides(makeTile(3, 5), null)).toEqual(['right']);
  });

  it('primeira peça define as duas pontas', () => {
    const board = placeTile([], makeTile(2, 5), 'right');
    expect(getEnds(board)).toEqual({ left: 2, right: 5 });
  });

  it('encaixa na ponta direita com orientação automática', () => {
    let board = placeTile([], makeTile(2, 5), 'right');
    board = placeTile(board, makeTile(5, 3), 'right'); // 5 encosta no 5
    expect(getEnds(board)).toEqual({ left: 2, right: 3 });
    board = placeTile(board, makeTile(1, 3), 'right'); // 3 encosta no 3, invertida
    expect(getEnds(board)).toEqual({ left: 2, right: 1 });
  });

  it('encaixa na ponta esquerda com orientação automática', () => {
    let board = placeTile([], makeTile(2, 5), 'right');
    board = placeTile(board, makeTile(2, 6), 'left'); // 2 encosta no 2
    expect(getEnds(board)).toEqual({ left: 6, right: 5 });
    board = placeTile(board, makeTile(6, 6), 'left'); // carroça
    expect(getEnds(board)).toEqual({ left: 6, right: 5 });
  });

  it('playableSides detecta as duas pontas quando aplicável', () => {
    const ends = { left: 4, right: 2 };
    expect(playableSides(makeTile(2, 4), ends)).toEqual(['left', 'right']);
    expect(playableSides(makeTile(4, 6), ends)).toEqual(['left']);
    expect(playableSides(makeTile(1, 2), ends)).toEqual(['right']);
    expect(playableSides(makeTile(0, 5), ends)).toEqual([]);
  });

  it('rejeita encaixe inválido', () => {
    const board = placeTile([], makeTile(2, 5), 'right');
    expect(() => placeTile(board, makeTile(0, 1), 'right')).toThrow();
    expect(() => placeTile(board, makeTile(5, 6), 'left')).toThrow(); // 5 só encaixa à direita
  });

  // Ordem dos sons: a nota que encaixa soa antes da que fica de fora.
  describe('placedNoteOrder', () => {
    const T = makeTile;

    it('ponta direita: primeiro a nota que encostou, depois a nova ponta', () => {
      let board = placeTile([], T(2, 5), 'right'); // pontas 2 e 5
      board = placeTile(board, T(5, 3), 'right'); // encaixa o 5
      expect(placedNoteOrder(board, board.length - 1)).toEqual([5, 3]);
    });

    it('ponta direita com a peça invertida', () => {
      let board = placeTile([], T(2, 5), 'right');
      board = placeTile(board, T(1, 5), 'right'); // o 5 está em `b`: inverte
      expect(placedNoteOrder(board, board.length - 1)).toEqual([5, 1]);
    });

    it('ponta esquerda: primeiro a nota que encostou, depois a nova ponta', () => {
      let board = placeTile([], T(2, 5), 'right'); // pontas 2 e 5
      board = placeTile(board, T(2, 6), 'left'); // encaixa o 2
      expect(placedNoteOrder(board, 0)).toEqual([2, 6]);
    });

    it('ponta esquerda com a peça invertida', () => {
      let board = placeTile([], T(2, 5), 'right');
      board = placeTile(board, T(6, 2), 'left');
      expect(placedNoteOrder(board, 0)).toEqual([2, 6]);
    });

    it('carroça repete a mesma nota nos dois lados', () => {
      let board = placeTile([], T(2, 5), 'right');
      board = placeTile(board, T(5, 5), 'right');
      expect(placedNoteOrder(board, board.length - 1)).toEqual([5, 5]);
    });

    it('peça de abertura sai na ordem da própria peça', () => {
      const board = placeTile([], T(2, 5), 'right');
      expect(placedNoteOrder(board, 0)).toEqual([2, 5]);
    });

    it('em qualquer jogada, a primeira nota é a ponta em que a peça encaixou', () => {
      const rng = seededRng(99);
      const monte = shuffle(createAllTiles(), rng);
      let board = placeTile([], monte.pop(), 'right');
      let jogadas = 0;
      while (monte.length > 0 && jogadas < 20) {
        const ends = getEnds(board);
        const idx = monte.findIndex((t) => canPlay(t, ends));
        if (idx < 0) break;
        const tile = monte.splice(idx, 1)[0];
        const side = playableSides(tile, ends)[0];
        const pontaAntes = side === 'left' ? ends.left : ends.right;
        board = placeTile(board, tile, side);
        const posicao = side === 'left' ? 0 : board.length - 1;
        const [primeira, segunda] = placedNoteOrder(board, posicao);
        expect(primeira).toBe(pontaAntes);
        expect(segunda).toBe(side === 'left' ? getEnds(board).left : getEnds(board).right);
        jogadas++;
      }
      expect(jogadas).toBeGreaterThan(5);
    });
  });

  it('placeTile não muta a mesa original', () => {
    const board = placeTile([], makeTile(2, 5), 'right');
    placeTile(board, makeTile(5, 5), 'right');
    expect(board).toHaveLength(1);
  });
});
