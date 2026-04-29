import { continuously } from "@ixfx/flow.js";
import * as Numbers from "@ixfx/numbers.js";
import { physicsStep, capSpeed } from "../../shared/physics.js";
import { setupCanvas } from "../../shared/canvas-setup.js";
import { setupPointer } from "../../shared/pointer-input.js";
import * as rubber from "./behaviors/rubber.js";
import * as mud from "./behaviors/mud.js";
import * as ice from "./behaviors/ice.js";
import * as magnet from "./behaviors/magnet.js";

/** @typedef {{ pressure: number, tiltX: number, tiltY: number, twist: number, twistNorm: number, pointerX: number, pointerY: number, pointerType: string, dragging: boolean, virtX: number, virtY: number, velX: number, velY: number, targetX: number, targetY: number, rotation: number, centerX: number, centerY: number, dist: number, cssW: number, cssH: number, size: number }} PointerSnapshot */

const behaviors = { rubber, mud, ice, magnet };

const settings = {
  size: 120,
  maxSpeed: 8,
  canvas: /** @type {HTMLCanvasElement} */ (document.getElementById(`canvas`)),
  debug: /** @type {HTMLElement} */ (document.getElementById(`debug`)),
  modeDesc: /** @type {HTMLElement} */ (document.getElementById(`mode-desc`)),
};

const state = {
  virtX: 0,
  virtY: 0,
  velX: 0,
  velY: 0,
  targetX: 0,
  targetY: 0,
  dragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  initialized: false,
  rotation: 0,
  pressure: 0,
  tiltX: 0,
  tiltY: 0,
  twist: 0,
  twistNorm: 0,
  pointerX: -9999,
  pointerY: -9999,
  pointerType: `mouse`,
  mode: `rubber`,
};


const { ctx, size } = setupCanvas(settings.canvas, (cssW, cssH) => {
  if (!state.initialized) {
    state.virtX = (cssW - settings.size) / 2;
    state.virtY = (cssH - settings.size) / 2;
    state.targetX = state.virtX;
    state.targetY = state.virtY;
    state.initialized = true;
  }
});


/** @param {import('../../shared/pointer-input.js').PointerState} ptr */
function applyPointerToState(ptr) {
  state.pressure = ptr.pressure;
  state.tiltX = ptr.tiltX;
  state.tiltY = ptr.tiltY;
  state.twist = ptr.twist;
  state.twistNorm = ptr.twistNorm;
  state.pointerX = ptr.x;
  state.pointerY = ptr.y;
  state.pointerType = ptr.pointerType;
}

function hitBody(px, py) {
  return px >= state.virtX && px <= state.virtX + settings.size &&
         py >= state.virtY && py <= state.virtY + settings.size;
}

setupPointer(settings.canvas, {
  onDown(ptr) {
    applyPointerToState(ptr);
    if (hitBody(ptr.x, ptr.y)) {
      state.dragging = true;
      state.dragOffsetX = ptr.x - state.virtX;
      state.dragOffsetY = ptr.y - state.virtY;
      settings.canvas.setPointerCapture(ptr.pointerId);
    }
  },
  onMove(ptr) {
    applyPointerToState(ptr);
    if (state.dragging) {
      state.targetX = Numbers.clamp(ptr.x - state.dragOffsetX, 0, size.cssW - settings.size);
      state.targetY = Numbers.clamp(ptr.y - state.dragOffsetY, 0, size.cssH - settings.size);
    }
    settings.canvas.style.cursor = `default`;
  },
  onUp() {
    state.dragging = false;
  },
});


document.querySelectorAll(`.mode-btn`).forEach(btn => {
  btn.addEventListener(`click`, () => {
    state.mode = /** @type {string} */ ((/** @type {HTMLElement} */ (btn)).dataset.mode ?? `rubber`);
    state.velX = 0;
    state.velY = 0;
    state.rotation = 0;
    document.querySelectorAll(`.mode-btn`).forEach(b => b.classList.remove(`active`));
    btn.classList.add(`active`);
    settings.modeDesc.textContent = behaviors[state.mode]?.config.desc ?? ``;
  });
});
settings.modeDesc.textContent = behaviors[state.mode]?.config.desc ?? ``;


function buildSnapshot() {
  const centerX = state.virtX + settings.size / 2;
  const centerY = state.virtY + settings.size / 2;
  const dx = state.pointerX - centerX;
  const dy = state.pointerY - centerY;
  return {
    pressure: Numbers.clamp(state.pressure, 0, 1),
    tiltX: state.tiltX,
    tiltY: state.tiltY,
    twist: state.twist,
    twistNorm: state.twistNorm,
    pointerX: state.pointerX,
    pointerY: state.pointerY,
    pointerType: state.pointerType,
    dragging: state.dragging,
    virtX: state.virtX,
    virtY: state.virtY,
    velX: state.velX,
    velY: state.velY,
    targetX: state.targetX,
    targetY: state.targetY,
    rotation: state.rotation,
    centerX,
    centerY,
    dist: Math.sqrt(dx * dx + dy * dy),
    cssW: size.cssW,
    cssH: size.cssH,
    size: settings.size,
  };
}

function applyPhysics() {
  const behavior = behaviors[state.mode];
  if (!behavior) return;

  const result = behavior.update(buildSnapshot());

  if (result.targetX !== undefined) state.targetX = result.targetX;
  if (result.targetY !== undefined) state.targetY = result.targetY;
  if (result.rotation !== undefined) state.rotation = result.rotation;

  physicsStep(state, result);
  capSpeed(state, settings.maxSpeed);

  state.virtX = Numbers.clamp(state.virtX + state.velX, 0, size.cssW - settings.size);
  state.virtY = Numbers.clamp(state.virtY + state.velY, 0, size.cssH - settings.size);
}

function draw() {
  ctx.clearRect(0, 0, size.cssW, size.cssH);
  const { color } = behaviors[state.mode].config;
  const centerX = state.virtX + settings.size / 2;
  const centerY = state.virtY + settings.size / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.fillStyle = color;
  ctx.fillRect(-settings.size / 2, -settings.size / 2, settings.size, settings.size);
  ctx.restore();
}

function updateDebug() {
  const centerX = state.virtX + settings.size / 2;
  const centerY = state.virtY + settings.size / 2;
  const dx = state.pointerX - centerX;
  const dy = state.pointerY - centerY;
  settings.debug.textContent =
    `${state.pointerType} · pressure: ${state.pressure.toFixed(2)} · tilt: ${Math.round(state.tiltX)}°,${Math.round(state.tiltY)}° · twist: ${Math.round(state.twist)}° · dist: ${Math.round(Math.sqrt(dx * dx + dy * dy))}px · vel: ${state.velX.toFixed(1)},${state.velY.toFixed(1)}`;
}

continuously(() => {
  applyPhysics();
  draw();
  updateDebug();
}).start();
