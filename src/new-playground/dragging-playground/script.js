import { continuously } from "@ixfx/flow.js";
import * as Numbers from "@ixfx/numbers.js";
import { setupCanvas } from "../../shared/canvas-setup.js";
import { physicsStep } from "../../shared/physics.js";

const settings = {
  size: 120,
  canvas: /** @type {HTMLCanvasElement} */ (document.getElementById(`canvas`)),
  debug: /** @type {HTMLElement} */(document.getElementById(`debug`)),
  frictionInput: /** @type {HTMLInputElement} */ (document.getElementById(`friction`)),
  pullInput: /** @type {HTMLInputElement} */ (document.getElementById(`pull`)),
  weightInput: /** @type {HTMLInputElement} */ (document.getElementById(`weight`)),
  presetsInput: /** @type {HTMLSelectElement} */ (document.getElementById(`presets`)),
  frictionValue: /** @type {HTMLElement} */ (document.getElementById(`frictionValue`)),
  pullValue: /** @type {HTMLElement} */ (document.getElementById(`pullValue`)),
  weightValue: /** @type {HTMLElement} */ (document.getElementById(`weightValue`)),
};

const state = {
  virtX: 120,
  virtY: 120,
  velX: 0,
  velY: 0,
  targetX: 120,
  targetY: 120,
  dragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  initialized: false,
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

function hitBody(px, py) {
  return (
    px >= state.virtX && px <= state.virtX + settings.size &&
    py >= state.virtY && py <= state.virtY + settings.size
  );
}

function updateCursor(px, py) {
  if (state.dragging) settings.canvas.style.cursor = `grabbing`;
  else if (hitBody(px, py)) settings.canvas.style.cursor = `grab`;
  else settings.canvas.style.cursor = `default`;
}

settings.canvas.addEventListener(`pointerdown`, (e) => {
  const x = e.offsetX,
    y = e.offsetY;
  if (hitBody(x, y)) {
    state.dragging = true;
    state.dragOffsetX = x - state.virtX;
    state.dragOffsetY = y - state.virtY;
    settings.canvas.setPointerCapture(e.pointerId);
  }
});

settings.canvas.addEventListener(`pointermove`, (e) => {
  const x = e.offsetX,
    y = e.offsetY;
  updateCursor(x, y);
  if (state.dragging) {
    state.targetX = Numbers.clamp(x - state.dragOffsetX, 0, size.cssW - settings.size);
    state.targetY = Numbers.clamp(y - state.dragOffsetY, 0, size.cssH - settings.size);
  }
  updateDebug(e);
});

settings.canvas.addEventListener(`pointerup`, () => {
  state.dragging = false;
});
settings.canvas.addEventListener(`pointercancel`, () => {
  state.dragging = false;
});

const loop = continuously(() => {
  const weightClamped = Numbers.clamp(+settings.weightInput.value, 1, 100);
  const friction = Numbers.scale(+settings.frictionInput.value, 0, 100, 0, 0.7);
  const pull = Numbers.scale(+settings.pullInput.value, 0, 100, 0, 1);
  const weight = Numbers.scale(weightClamped, 1, 100, 0.1, 40);

  physicsStep(state, { friction, pull, weight });
  state.virtX += state.velX;
  state.virtY += state.velY;

  draw();
});
loop.start();

function draw() {
  ctx.clearRect(0, 0, size.cssW, size.cssH);
  ctx.fillStyle = `rgb(0, 0, 0)`;
  ctx.fillRect(state.virtX, state.virtY, settings.size, settings.size);
}

function updateDebug(e) {
  const type = e.pointerType;
  const x = Math.round(e.offsetX);
  const y = Math.round(e.offsetY);
  const lagX = Math.abs(state.targetX - state.virtX).toFixed(1);
  const lagY = Math.abs(state.targetY - state.virtY).toFixed(1);
  const vx = Math.round(state.virtX);
  const vy = Math.round(state.virtY);
  settings.debug.textContent =
    `type: ${type}   |   x: ${x}   y: ${y}   |   pos: ${vx} × ${vy}px   |   lag: ${lagX} × ${lagY}px`;
}

const presets = {
  bouncy: { friction: 6, pull: 95, weight: 51 },
  heavy: { friction: 75, pull: 100, weight: 42 },
  flexible: { friction: 7, pull: 1, weight: 10 },
  jiggly: { friction: 19, pull: 44, weight: 6 },
  straightforward: { friction: 99, pull: 30, weight: 1 },
};

settings.presetsInput.addEventListener(`change`, () => {
  const preset = presets[ settings.presetsInput.value ];
  if (!preset) return;
  settings.frictionInput.value = preset.friction;
  settings.pullInput.value = preset.pull;
  settings.weightInput.value = preset.weight;
  updateSliderDisplays();
});

function updateSliderDisplays() {
  settings.frictionValue.textContent = settings.frictionInput.value;
  settings.pullValue.textContent = settings.pullInput.value;
  settings.weightValue.textContent = settings.weightInput.value;
}
settings.frictionInput.addEventListener(`input`, updateSliderDisplays);
settings.pullInput.addEventListener(`input`, updateSliderDisplays);
settings.weightInput.addEventListener(`input`, updateSliderDisplays);
updateSliderDisplays();
