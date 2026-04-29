/**
 * Normalized pointer/stylus state passed to all callbacks.
 * @typedef {{ pressure: number, tiltX: number, tiltY: number, twist: number, twistNorm: number, x: number, y: number, pointerType: string, pointerId: number }} PointerState
 */

/**
 * Registers pointer event listeners on an element and normalizes all stylus fields.
 * Handles down/move/up/cancel — cancel is forwarded to onUp.
 *
 * @param {HTMLElement} element
 * @param {{ onDown?: (p: PointerState) => void, onMove?: (p: PointerState) => void, onUp?: (p: PointerState) => void }} callbacks
 */
export function setupPointer(element, { onDown, onMove, onUp } = {}) {
  function normalize(e) {
    const twist = e.twist ?? 0;
    return {
      pressure: e.pressure ?? 0,
      tiltX: e.tiltX ?? 0,
      tiltY: e.tiltY ?? 0,
      twist,
      twistNorm: (twist > 180 ? twist - 360 : twist) / 180,
      x: e.offsetX,
      y: e.offsetY,
      pointerType: e.pointerType,
      pointerId: e.pointerId,
    };
  }

  element.addEventListener(`pointerdown`, (e) => { e.preventDefault(); onDown?.(normalize(e)); });
  element.addEventListener(`pointermove`, (e) => { e.preventDefault(); onMove?.(normalize(e)); });
  element.addEventListener(`pointerup`, (e) => onUp?.(normalize(e)));
  element.addEventListener(`pointercancel`, (e) => onUp?.(normalize(e)));
}
