// Resultado do jogo: cada partida é um jogo isolado, sem pontos nem rodadas.
// - Alguém bateu (ficou sem peças): é o vencedor.
// - Jogo fechado: vence quem ficou com menos peças na mão;
//   empate no menor número de peças → ninguém vence ('tie').
// Retorna { winner: number|null, reason: 'domino'|'blocked'|'tie', tilesLeft: number[] }.
export function gameResult(hands, dominoWinner = null) {
  const tilesLeft = hands.map((h) => h.length);
  if (dominoWinner !== null) {
    return { winner: dominoWinner, reason: 'domino', tilesLeft };
  }
  const min = Math.min(...tilesLeft);
  const holders = tilesLeft.map((n, i) => (n === min ? i : -1)).filter((i) => i >= 0);
  if (holders.length > 1) return { winner: null, reason: 'tie', tilesLeft };
  return { winner: holders[0], reason: 'blocked', tilesLeft };
}
