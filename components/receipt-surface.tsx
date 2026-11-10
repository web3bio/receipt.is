"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

const TILT_MEDIA = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
const DRAG_THRESHOLD = 5;

type CardDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  surface: HTMLDivElement;
};

export default function ReceiptSurface({ children }: { children: ReactNode }) {
  const cardRef = useRef<HTMLElement>(null);
  const drag = useRef<CardDrag | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    return () => cancelAnimationFrame(frame.current);
  }, []);

  function resetTilt() {
    const active = drag.current;
    if (!active) return;

    drag.current = null;
    cancelAnimationFrame(frame.current);

    const card = cardRef.current;
    card?.removeAttribute("data-tilting");
    card?.style.removeProperty("--receipt-tilt");
    card?.style.removeProperty("--receipt-light-x");
    card?.style.removeProperty("--receipt-light-y");

    if (active.surface.hasPointerCapture(active.pointerId)) {
      active.surface.releasePointerCapture(active.pointerId);
    }
  }

  function startTilt(event: PointerEvent<HTMLDivElement>) {
    if (
      drag.current ||
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      !window.matchMedia(TILT_MEDIA).matches ||
      !(event.target instanceof Element && event.target.hasAttribute("data-receipt-drag"))
    ) {
      return;
    }

    const { pointerId, clientX, clientY, currentTarget } = event;
    drag.current = { pointerId, startX: clientX, startY: clientY, surface: currentTarget };
  }

  function moveTilt(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    const card = cardRef.current;
    if (!active || !card || event.pointerId !== active.pointerId) return;
    if ((event.buttons & 1) === 0) {
      resetTilt();
      return;
    }

    const deltaX = event.clientX - active.startX;
    const deltaY = event.clientY - active.startY;
    if (!card.hasAttribute("data-tilting")) {
      if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

      active.surface.setPointerCapture(active.pointerId);
      card.setAttribute("data-tilting", "");
    }

    event.preventDefault();
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const x = Math.max(-1, Math.min(1, deltaX / 135));
      const y = Math.max(-1, Math.min(1, deltaY / 135));

      card.style.setProperty("--receipt-tilt", `rotateX(${-y * 3}deg) rotateY(${x * 3.5}deg)`);
      card.style.setProperty("--receipt-light-x", `${x * 22 - 8}%`);
      card.style.setProperty("--receipt-light-y", `${y * 14 - 8}%`);
    });
  }

  function endTilt(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) resetTilt();
  }

  function leaveTilt(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (active?.pointerId === event.pointerId && !active.surface.hasPointerCapture(active.pointerId)) {
      resetTilt();
    }
  }

  return (
    <div
      className="receipt-tilt"
      onPointerDown={startTilt}
      onPointerMove={moveTilt}
      onPointerLeave={leaveTilt}
      onPointerUp={endTilt}
      onPointerCancel={endTilt}
      onLostPointerCapture={endTilt}
      onFocusCapture={resetTilt}
    >
      <article ref={cardRef} className="receipt-card receipt-card--metal" data-receipt-drag>
        <span className="receipt-foil" aria-hidden="true" />
        {children}
      </article>
    </div>
  );
}
