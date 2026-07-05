// Peça do dominó musical: cada metade mostra o nome da nota
// sobre a cor correspondente (Dó=vermelho … Si=roxo).

import { NOTES, NOTE_COLORS } from '../game/notes.js';

function Half({ value }) {
  return (
    <div className="tile-half" style={{ '--note-color': NOTE_COLORS[value] }}>
      <span className="note-name">{NOTES[value]}</span>
    </div>
  );
}

export default function Tile({
  a,
  b,
  vertical = false,
  back = false,
  unit = null, // px; quando ausente, o CSS define via clamp()
  highlight = false,
  dimmed = false,
  onClick,
  onDoubleClick,
  onPointerDown,
  title,
  style,
}) {
  const interactive = Boolean(onClick || onDoubleClick || onPointerDown);
  const classes = [
    'tile',
    vertical ? 'vertical' : 'horizontal',
    back ? 'back' : '',
    highlight ? 'playable' : '',
    dimmed ? 'dimmed' : '',
    interactive ? 'clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      style={{ ...(unit ? { '--unit': `${unit}px` } : {}), ...style }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      disabled={!interactive}
      title={title}
      aria-label={back ? 'Peça virada' : `Peça ${NOTES[a]}-${NOTES[b]}`}
    >
      {!back && (
        <>
          <Half value={a} />
          <span className="tile-divider" />
          <Half value={b} />
        </>
      )}
    </button>
  );
}
