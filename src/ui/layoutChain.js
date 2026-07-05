// Layout em serpentina da cadeia de peças.
// Percorre a cadeia (da ponta esquerda à direita) posicionando peças em linhas;
// ao atingir a borda, desce uma linha e inverte a direção (cobra).
// Carroças são desenhadas na vertical (perpendiculares à linha).

export function layoutChain(board, containerWidth, unit) {
  const long = unit * 2;
  const gap = Math.max(2, Math.round(unit * 0.09));
  const rowPitch = long + gap * 2;
  const max = Math.max(containerWidth, long + unit + gap * 2);

  const cells = [];
  let dir = 1;
  let row = 0;
  let x = 0;

  for (const placed of board) {
    const vertical = placed.tile.a === placed.tile.b;
    const w = (vertical ? unit : long) + gap;
    if (dir === 1 && x + w > max) {
      row += 1;
      dir = -1;
      x = max;
    } else if (dir === -1 && x - w < 0) {
      row += 1;
      dir = 1;
      x = 0;
    }
    let cx;
    if (dir === 1) {
      cx = x;
      x += w;
    } else {
      x -= w;
      cx = x;
    }
    const centerY = row * rowPitch + long / 2;
    cells.push({
      id: placed.tile.id,
      x: cx,
      y: vertical ? centerY - long / 2 : centerY - unit / 2,
      vertical,
      // Em linhas da direita para a esquerda, as metades são espelhadas
      // para os valores continuarem encostados na peça anterior.
      flipped: dir === -1,
      left: placed.left,
      right: placed.right,
    });
  }

  const height = (row + 1) * rowPitch;

  // Cadeia curta (uma linha só): centraliza horizontalmente.
  if (row === 0 && cells.length > 0) {
    const used = x;
    const offset = Math.max(0, (max - used) / 2);
    for (const c of cells) c.x += offset;
  }

  return { cells, height, unit, long };
}
