// Peça do dominó musical: cada metade mostra o nome da nota
// sobre a cor correspondente (Dó=vermelho … Si=roxo) e toca essa nota
// quando o mouse passa por cima dela.

import { NOTES, NOTE_COLORS } from '../game/notes.js';
import { playHoverNote } from '../ui/sound.js';

function Half({ value, audible }) {
  return (
    <div
      className="tile-half"
      style={{ '--note-color': NOTE_COLORS[value] }}
      onPointerEnter={
        audible
          ? (e) => {
              // Só no mouse: no toque, o "enter" viria junto com o arrasto.
              if (e.pointerType === 'mouse') playHoverNote(value);
            }
          : undefined
      }
    >
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
  hoverSound = true,
  onClick,
  onDoubleClick,
  onPointerDown,
  title,
  style,
}) {
  const interactive = Boolean(onClick || onDoubleClick || onPointerDown);
  const audible = hoverSound && !back;
  const classes = [
    'tile',
    vertical ? 'vertical' : 'horizontal',
    back ? 'back' : '',
    highlight ? 'playable' : '',
    dimmed ? 'dimmed' : '',
    interactive ? 'clickable' : '',
    audible ? 'audible' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const label = back ? 'Peça virada' : `Peça ${NOTES[a]}-${NOTES[b]}`;
  const commonProps = {
    className: classes,
    style: { ...(unit ? { '--unit': `${unit}px` } : {}), ...style },
    title,
  };

  const content = !back && (
    <>
      <Half value={a} audible={audible} />
      <span className="tile-divider" />
      <Half value={b} audible={audible} />
    </>
  );

  // Peça sem ação (mesa, mão do oponente) é conteúdo visual, não um controle:
  // como <div> ela continua recebendo o hover — um <button disabled> não
  // dispara eventos de ponteiro — e fica fora da navegação por teclado.
  if (!interactive) {
    return (
      <div {...commonProps} role="img" aria-label={label}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      {...commonProps}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      aria-label={label}
    >
      {content}
    </button>
  );
}
