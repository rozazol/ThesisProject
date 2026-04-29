/**
 * Sets up canvas and keeps it in sync with window resizes.
 * Returns { ctx, size } where size = { cssW, cssH } is a live object updated on every resize.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {(cssW: number, cssH: number) => void} [onResize]  optional callback for sketch-specific resize logic
 * @returns {{ ctx: CanvasRenderingContext2D, size: { cssW: number, cssH: number } }}
 */
export function setupCanvas(canvas, onResize) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext(`2d`));
  const size = { cssW: 0, cssH: 0 };
  canvas.style.touchAction = `none`;
  canvas.style.userSelect = `none`;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    size.cssW = Math.max(1, Math.floor(rect.width));
    size.cssH = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(size.cssW * dpr);
    canvas.height = Math.floor(size.cssH * dpr);
    canvas.style.width = `${size.cssW}px`;
    canvas.style.height = `${size.cssH}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    onResize?.(size.cssW, size.cssH);
  }

  window.addEventListener(`resize`, resize);
  resize();

  return { ctx, size };
}
