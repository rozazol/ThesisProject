import { continuously } from "@ixfx/flow.js";
import * as Numbers from "@ixfx/numbers.js";
import { setupCanvas } from "../../shared/canvas-setup.js";

const settings = {
  scrollSpeed: 1,
  items: [ `#6AC4A2`, `#5AADEA`, `#E87A5D`, `#F5C842`, `#9B6BFF`, `#FF6BAE`, `#6AC4A2`, `#5AADEA`, `#E87A5D`, `#F5C842`, `#9B6BFF`, `#FF6BAE`, `#6AC4A2`, `#5AADEA`, `#E87A5D`, `#F5C842`, `#9B6BFF`, `#FF6BAE`, `#6AC4A2`, `#5AADEA`, `#E87A5D`, `#F5C842`, `#9B6BFF`, `#FF6BAE` ],
  canvas: /** @type {HTMLCanvasElement} */ (document.getElementById(`canvas`)),
  debug: /** @type {HTMLElement} */ (document.getElementById(`debug`)),
  frictionInput: /** @type {HTMLInputElement} */ (document.getElementById(`friction`)),
  pullInput: /** @type {HTMLInputElement} */ (document.getElementById(`pull`)),
  weightInput: /** @type {HTMLInputElement} */ (document.getElementById(`weight`)),
  presetsInput: /** @type {HTMLSelectElement} */ (document.getElementById(`presets`)),
  frictionValue: /** @type {HTMLElement} */ (document.getElementById(`frictionValue`)),
  pullValue: /** @type {HTMLElement} */ (document.getElementById(`pullValue`)),
  weightValue: /** @type {HTMLElement} */ (document.getElementById(`weightValue`)),
};

const state = {
  virtY: 0,
  velY: 0,
  targetY: 0,
  maxScroll: 0,
  lastTouchY: 0,
};

const { ctx, size } = setupCanvas(settings.canvas, (_, cssH) => {
  state.maxScroll = Math.max(0, (settings.items.length - 1) * cssH);
});

settings.canvas.addEventListener(`wheel`, (e) => {
  e.preventDefault();
  state.targetY = Numbers.clamp(state.targetY + e.deltaY * settings.scrollSpeed, 0, state.maxScroll);
}, { passive: false });

settings.canvas.addEventListener(`touchstart`, (e) => {
  state.lastTouchY = e.touches[ 0 ].clientY;
}, { passive: true });

settings.canvas.addEventListener(`touchmove`, (e) => {
  const y = e.touches[ 0 ].clientY;
  const delta = (state.lastTouchY - y) * settings.scrollSpeed;
  state.lastTouchY = y;
  state.targetY = Numbers.clamp(state.targetY + delta, 0, state.maxScroll);
}, { passive: true });

const loop = continuously(() => {
  const weightClamped = Numbers.clamp(+settings.weightInput.value, 1, 100);
  const friction = Numbers.scale(+settings.frictionInput.value, 0, 100, 0, 0.6);
  const pull = Numbers.scale(+settings.pullInput.value, 0, 100, 0, 0.4);
  const weight = Numbers.scale(weightClamped, 1, 100, 0.1, 40);

  const forceY = (state.targetY - state.virtY) * pull;
  state.velY += forceY / weight;
  state.velY *= (1 - friction);
  state.virtY += state.velY;
  state.virtY = Numbers.clamp(state.virtY, 0, state.maxScroll);

  draw();
  updateDebug();
});
loop.start();

function draw() {
  const { cssW, cssH } = size;
  ctx.clearRect(0, 0, cssW, cssH);

  ctx.save();
  ctx.translate(0, -state.virtY);

  const fontSize = Math.min(cssW * 0.06, cssH * 0.1, 64);
  ctx.font = `${fontSize}px Overpass Mono, monospace`;
  ctx.textAlign = `center`;
  ctx.textBaseline = `middle`;

  for (let i = 0; i < settings.items.length; i++) {
    const y = i * cssH;
    ctx.fillStyle = settings.items[ i ];
    ctx.fillRect(0, y, cssW, cssH);
    ctx.fillStyle = `rgba(0,0,0,0.35)`;
    ctx.fillText(String(i + 1), cssW / 2, y + cssH / 2);
  }

  ctx.restore();
}

function updateDebug() {
  const lag = Math.abs(state.targetY - state.virtY).toFixed(1);
  settings.debug.textContent =
    `target: ${Math.round(state.targetY)}px   |   pos: ${Math.round(state.virtY)}px   |   lag: ${lag}px`;
}

const presets = {
  bouncy: { friction: 6, pull: 95, weight: 51 },
  heavy: { friction: 75, pull: 30, weight: 42 },
  flexible: { friction: 7, pull: 1, weight: 10 },
  jiggly: { friction: 19, pull: 44, weight: 6 },
  straightforward: { friction: 99, pull: 30, weight: 1 },
};

settings.presetsInput.addEventListener(`change`, () => {
  const preset = presets[ settings.presetsInput.value ];
  if (!preset) return;
  settings.frictionInput.value = String(preset.friction);
  settings.pullInput.value = String(preset.pull);
  settings.weightInput.value = String(preset.weight);
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
