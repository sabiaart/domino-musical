// Peças de dominó: 28 peças de 0-0 até 6-6.
// Representação canônica: { a, b, id } com a <= b.

export const MAX_PIP = 6;
export const HAND_SIZE = 7;

export function makeTile(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { a: lo, b: hi, id: `${lo}-${hi}` };
}

export function createAllTiles() {
  const tiles = [];
  for (let a = 0; a <= MAX_PIP; a++) {
    for (let b = a; b <= MAX_PIP; b++) {
      tiles.push(makeTile(a, b));
    }
  }
  return tiles;
}

export function isDouble(tile) {
  return tile.a === tile.b;
}

export function tileSum(tile) {
  return tile.a + tile.b;
}

export function tileHas(tile, value) {
  return tile.a === value || tile.b === value;
}

// Fisher-Yates; retorna um novo array. RNG injetável para testes determinísticos.
export function shuffle(tiles, rng = Math.random) {
  const arr = tiles.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Distribui 7 peças para cada jogador; o restante vira o monte (dorme).
export function deal(numPlayers, rng = Math.random) {
  const tiles = shuffle(createAllTiles(), rng);
  const hands = [];
  for (let p = 0; p < numPlayers; p++) {
    hands.push(tiles.slice(p * HAND_SIZE, (p + 1) * HAND_SIZE));
  }
  const boneyard = tiles.slice(numPlayers * HAND_SIZE);
  return { hands, boneyard };
}
