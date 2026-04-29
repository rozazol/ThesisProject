import { continuously } from "@ixfx/flow.js";
import * as Numbers from "@ixfx/numbers.js";
import { setupCanvas } from "../../shared/canvas-setup.js";
import { physicsStep } from "../../shared/physics.js";

const settings = {
  squareSize: 80,
  squarePresets: [ `floaty`, `quick`, `deliberate` ],
  presets: {
    floaty: { friction: 24, pull: 95, weight: 95 },
    quick: { friction: 47, pull: 82, weight: 2 },
    lovely: { friction: 38, pull: 100, weight: 10 },
    slow: { friction: 59, pull: 44, weight: 31 },
    eager: { friction: 67, pull: 30, weight: 1 },
    easy: { friction: 28, pull: 82, weight: 40 },
    rushed: { friction: 28, pull: 82, weight: 7 },
    energetic: { friction: 30, pull: 100, weight: 3 },
    shaky: { friction: 44, pull: 93, weight: 1 },
    deliberate: { friction: 36, pull: 66, weight: 47 },
  },
  canvas: /** @type {HTMLCanvasElement} */ (document.getElementById(`canvas`)),
  debug: /** @type {HTMLElement} */ (document.getElementById(`debug`)),
  randomizeButton: /** @type {HTMLButtonElement} */ (document.getElementById(`randomize`)),
};
const ctx = /** @type {CanvasRenderingContext2D} */ (settings.canvas.getContext(`2d`));

let state = {
  initialized: false,
  squares: settings.squarePresets.map(makeSquare),
  activePointers: new Map()
};

function makeSquare(preset) {
  return {
    preset,
    virtX: 0, virtY: 0,
    realX: 0, realY: 0,
    targetX: 0, targetY: 0,
    velX: 0, velY: 0,
    isDragging: false,
    pressure: 0,
    /** @type {PointerEvent|null} */
    lastEvent: null,
  };
}

const { size } = setupCanvas(settings.canvas, (cssW, cssH) => {
  if (!state.initialized) {
    state.squares.forEach((sq, i) => {
      sq.virtX = cssW * (i + 1) / (state.squares.length + 1);
      sq.virtY = cssH / 2;
      sq.realX = sq.virtX;
      sq.realY = sq.virtY;
    });
    state.initialized = true;
  }
});

function isOnSquare(sq, x, y) {
  const half = settings.squareSize / 2;
  return x >= sq.virtX - half && x <= sq.virtX + half &&
    y >= sq.virtY - half && y <= sq.virtY + half;
}

function squareAt(x, y) {
  return [ ...state.squares ].reverse().find(sq => isOnSquare(sq, x, y)) ?? null;
}

function updateCursor(x, y) {
  const anyDragging = state.squares.some(sq => sq.isDragging);
  settings.canvas.style.cursor = squareAt(x, y) ?
    (anyDragging ? `grabbing` : `grab`) :
    `default`;
}

function pointerXY(e) {
  const rect = settings.canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

settings.canvas.addEventListener(`pointerdown`, (e) => {
  e.preventDefault();
  const { x, y } = pointerXY(e);
  const sq = squareAt(x, y);
  if (!sq) return;
  sq.isDragging = true;
  sq.realX = x;
  sq.realY = y;
  sq.pressure = e.pressure;
  sq.lastEvent = e;
  state.activePointers.set(e.pointerId, sq);
  settings.canvas.setPointerCapture(e.pointerId);
});

settings.canvas.addEventListener(`pointermove`, (e) => {
  const { x, y } = pointerXY(e);
  updateDebug(e);
  updateCursor(x, y);
  const sq = state.activePointers.get(e.pointerId);
  if (!sq) return;
  sq.realX = x;
  sq.realY = y;
  sq.pressure = e.pressure;
  sq.lastEvent = e;
});

function releasePointer(e) {
  const sq = state.activePointers.get(e.pointerId);
  if (!sq) return;
  sq.isDragging = false;
  sq.pressure = 0;
  state.activePointers.delete(e.pointerId);
}
settings.canvas.addEventListener(`pointerup`, releasePointer);
settings.canvas.addEventListener(`pointercancel`, releasePointer);

const loop = continuously(() => {
  ctx.clearRect(0, 0, size.cssW, size.cssH);

  for (const sq of state.squares) {
    const { friction: fRaw, pull: pRaw, weight: wRaw } = settings.presets[ sq.preset ];
    const friction = Numbers.scale(fRaw, 0, 100, 0, 0.7);
    const pull = Numbers.scale(pRaw, 0, 100, 0, 1);
    const weight = Numbers.scale(Numbers.clamp(wRaw, 0, 100), 0, 100, 0, 40);

    const p = (sq.isDragging && sq.lastEvent?.pointerType === `pen`) ? sq.pressure : 0;
    const effectiveFriction = friction * (1 - p * 0.85);
    const effectivePull = pull * (1 + p * 0.5);

    sq.targetX = sq.isDragging ? sq.realX : sq.virtX;
    sq.targetY = sq.isDragging ? sq.realY : sq.virtY;
    physicsStep(sq, { friction: effectiveFriction, pull: effectivePull, weight });
    sq.virtX += sq.velX;
    sq.virtY += sq.velY;

    const half = settings.squareSize / 2;
    ctx.fillStyle = `rgb(0, 0, 0)`;
    ctx.fillRect(sq.virtX - half, sq.virtY - half, settings.squareSize, settings.squareSize);
  }
});
loop.start();

function randomizePresets() {
  const keys = Object.keys(settings.presets);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ keys[i], keys[j] ] = [ keys[j], keys[i] ];
  }
  state.squares.forEach((sq, i) => {
    sq.preset = keys[i];
  });
}
settings.randomizeButton.addEventListener(`click`, randomizePresets);

function updateDebug(e) {
  const sq = state.activePointers.get(e.pointerId) ?? squareAt(e.offsetX, e.offsetY);
  const preset = sq ? sq.preset : `–`;
  settings.debug.textContent =
    `type: ${e.pointerType}   |   x: ${Math.round(e.offsetX)}   y: ${Math.round(e.offsetY)}` +
    `   |   pressure: ${e.pressure.toFixed(3)}   |   preset: ${preset}`;
}
