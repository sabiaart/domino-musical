import { useCallback, useRef, useState } from 'react';
import { setHoverSoundsEnabled } from '../ui/sound.js';

// Arrastar peça da mão até uma ponta da mesa (Pointer Events: mouse e toque).
// O arrasto só ativa após ~8px de movimento, para não engolir o duplo clique.
// A posição do fantasma é atualizada direto no DOM (sem re-render por frame);
// o React só re-renderiza quando o arrasto ativa/termina ou a zona sob o
// ponteiro muda.
const DRAG_THRESHOLD_PX = 8;

export function useTileDrag(onPlay) {
  const [drag, setDrag] = useState(null); // { tile, sides, w, h, x, y }
  const [hoveredSide, setHoveredSide] = useState(null);
  const ghostRef = useRef(null);
  const infoRef = useRef(null);

  const startDrag = useCallback(
    (tile, sides, e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      infoRef.current = {
        tile,
        sides,
        grabX: e.clientX - rect.left,
        grabY: e.clientY - rect.top,
        w: rect.width,
        h: rect.height,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        hovered: null,
      };

      const move = (ev) => {
        const info = infoRef.current;
        if (!info) return;
        if (!info.active) {
          if (
            Math.hypot(ev.clientX - info.startX, ev.clientY - info.startY) < DRAG_THRESHOLD_PX
          ) {
            return;
          }
          info.active = true;
          // O ponteiro vai varrer a mesa: sem prévias de nota até soltar.
          setHoverSoundsEnabled(false);
          setDrag({
            tile: info.tile,
            sides: info.sides,
            w: info.w,
            h: info.h,
            x: ev.clientX - info.grabX,
            y: ev.clientY - info.grabY,
          });
        }
        const x = ev.clientX - info.grabX;
        const y = ev.clientY - info.grabY;
        if (ghostRef.current) {
          ghostRef.current.style.transform = `translate(${x}px, ${y}px)`;
        }
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const side = el?.closest('[data-drop-side]')?.getAttribute('data-drop-side') ?? null;
        const valid = side && info.sides.includes(side) ? side : null;
        if (valid !== info.hovered) {
          info.hovered = valid;
          setHoveredSide(valid);
        }
      };

      const finish = (drop) => {
        const info = infoRef.current;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        infoRef.current = null;
        setHoverSoundsEnabled(true);
        setDrag(null);
        setHoveredSide(null);
        if (drop && info?.active && info.hovered) {
          onPlay(info.tile.id, info.hovered);
        }
      };

      const up = (ev) => {
        move(ev);
        finish(true);
      };
      const cancel = () => finish(false);

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    },
    [onPlay]
  );

  return { drag, hoveredSide, ghostRef, startDrag };
}
