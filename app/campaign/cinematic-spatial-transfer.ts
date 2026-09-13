type Rect = Pick<DOMRect, "left" | "top" | "width" | "height">;

export function spatialTransferKeyframes(from: Rect, to: Rect): Keyframe[] | null {
  if (![from.left, from.top, from.width, from.height, to.left, to.top, to.width, to.height].every(Number.isFinite)
    || from.width <= 0 || from.height <= 0 || to.width <= 0 || to.height <= 0) return null;
  return [
    { transform: "translate(0px, 0px)", opacity: 0.85 },
    // Preserve the text's size when a compact theory label returns to a large
    // card. Scaling the whole clone makes its text briefly dominate the board.
    { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px)`, opacity: 0 }
  ];
}

/** A disposable copy of visible content; never owns selection or dispatches actions. */
export function createCinematicSpatialTransfer() {
  let sequence = 0;
  let cancelFrame: (() => void) | undefined;
  let active: { ghost: HTMLElement; animation: Animation } | undefined;

  const cancel = () => {
    sequence += 1;
    cancelFrame?.();
    cancelFrame = undefined;
    const previous = active;
    active = undefined;
    previous?.animation.cancel();
    previous?.ghost.remove();
  };

  const start = (source: HTMLElement, destination: () => HTMLElement | null, reduced: boolean, kind: "evidence" | "witness" | "theory" = "evidence") => {
    cancel();
    const view = source.ownerDocument.defaultView;
    if (reduced || !view || !source.isConnected || typeof source.animate !== "function") return;
    const from = source.getBoundingClientRect();
    if (from.width <= 0 || from.height <= 0) return;
    const style = view.getComputedStyle(source);
    const ghost = source.cloneNode(true) as HTMLElement;
    // Duplicated content must not create a second focus target, label, test
    // locator, or live region. The real selected card remains accessible.
    for (const element of [ghost, ...ghost.querySelectorAll<HTMLElement>("*")]) {
      for (const attribute of [...element.attributes]) {
        if (/^(?:id|name|for|aria-.+|data-.+)$/.test(attribute.name)) element.removeAttribute(attribute.name);
      }
      element.tabIndex = -1;
    }
    ghost.inert = true;
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("data-cinematic-spatial-transfer", kind);
    Object.assign(ghost.style, {
      position: "fixed", left: `${from.left}px`, top: `${from.top}px`,
      width: `${from.width}px`, height: `${from.height}px`, margin: "0",
      boxSizing: "border-box", pointerEvents: "none", overflow: "hidden",
      transform: "none", transformOrigin: "top left", animation: "none",
      transition: "none", zIndex: "2147480000", font: style.font,
      color: style.color, background: style.backgroundColor, border: style.border
    });
    for (const name of ["--cinematic-ink", "--cinematic-muted", "--cinematic-gold", "--cinematic-rust", "--cinematic-cyan"]) {
      ghost.style.setProperty(name, style.getPropertyValue(name));
    }
    const token = sequence;
    const frame = view.requestAnimationFrame(() => {
      if (token !== sequence) return;
      cancelFrame = undefined;
      const target = destination();
      if (!target?.isConnected) return;
      const to = target.getBoundingClientRect();
      // Do not fly through offscreen panels or override the player's scroll.
      if (to.top >= view.innerHeight || to.left >= view.innerWidth || to.top + to.height <= 0 || to.left + to.width <= 0) return;
      const keyframes = spatialTransferKeyframes(from, to);
      if (!keyframes) return;
      source.ownerDocument.body.append(ghost);
      try {
        const animation = ghost.animate(keyframes, { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)", fill: "none" });
        active = { ghost, animation };
        const cleanup = () => {
          ghost.remove();
          if (active?.ghost === ghost) active = undefined;
        };
        void animation.finished.then(cleanup, cleanup);
      } catch { ghost.remove(); }
    });
    cancelFrame = () => view.cancelAnimationFrame(frame);
  };
  return { start, cancel };
}
