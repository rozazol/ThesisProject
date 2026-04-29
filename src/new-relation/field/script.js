import { continuously } from "@ixfx/flow.js";
import * as Numbers from "@ixfx/numbers.js";
import { physicsStep, capSpeed } from "../../shared/physics.js";
import { setupCanvas } from "../../shared/canvas-setup.js";
import { setupPointer } from "../../shared/pointer-input.js";
import * as rubber from "../square-modes/behaviors/rubber.js";
import * as mud from "../square-modes/behaviors/mud.js";
import * as ice from "../square-modes/behaviors/ice.js";
import * as magnet from "../square-modes/behaviors/magnet.js";
import * as viscosity from "../square-modes/behaviors/viscosity.js";
import * as elasticity from "../square-modes/behaviors/elasticity.js";
import * as forcefield from "../square-modes/behaviors/force-field.js";


const behaviors = { rubber, mud, ice, magnet, viscosity, elasticity, forcefield };

const settings = {
  cellSize: 22,
  objSize: 12,
  maxSpeed: 8,
  canvas: /** @type {HTMLCanvasElement} */ (document.getElementById(`canvas`)),
  modeSelect: /** @type {HTMLSelectElement} */ (document.getElementById(`mode-select`)),
};

const state = {
  mode: `rubber`,
  pointerX: -9999,
  pointerY: -9999,
  pressure: 0,
  tiltX: 0,
  tiltY: 0,
  twist: 0,
  twistNorm: 0,
  pointerType: `mouse`,
  dragging: false,
  /** @type {Array<{homeX:number,homeY:number,virtX:number,virtY:number,velX:number,velY:number,targetX:number,targetY:number}>} */
  objects: [],
};


const { ctx, size } = setupCanvas(settings.canvas, (cssW, cssH) => {
  state.objects = buildGrid(cssW, cssH);
});


function buildGrid(cssW, cssH) {
  const { cellSize, objSize } = settings;
  const cols = Math.floor(cssW / cellSize);
  const rows = Math.floor(cssH / cellSize);
  const padX = (cssW - cols * cellSize) / 2 + (cellSize - objSize) / 2;
  const padY = (cssH - rows * cellSize) / 2 + (cellSize - objSize) / 2;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const homeX = padX + c * cellSize;
      const homeY = padY + r * cellSize;
      grid.push({ homeX, homeY, virtX: homeX, virtY: homeY, velX: 0, velY: 0, targetX: homeX, targetY: homeY });
    }
  }
  return grid;
}


setupPointer(settings.canvas, {
  onDown(ptr) {
    state.dragging = true;
    state.pointerX = ptr.x;
    state.pointerY = ptr.y;
    state.pressure = ptr.pressure;
    state.tiltX = ptr.tiltX;
    state.tiltY = ptr.tiltY;
    state.twist = ptr.twist;
    state.twistNorm = ptr.twistNorm;
    state.pointerType = ptr.pointerType;
  },
  onMove(ptr) {
    state.pointerX = ptr.x;
    state.pointerY = ptr.y;
    state.pressure = ptr.pressure;
    state.tiltX = ptr.tiltX;
    state.tiltY = ptr.tiltY;
    state.twist = ptr.twist;
    state.twistNorm = ptr.twistNorm;
    state.pointerType = ptr.pointerType;
  },
  onUp() {
    state.dragging = false;
    state.pressure = 0;
  },
});


settings.modeSelect.addEventListener(`change`, () => {
  state.mode = settings.modeSelect.value;
  for (const obj of state.objects) {
    obj.velX = 0;
    obj.velY = 0;
    obj.targetX = obj.homeX;
    obj.targetY = obj.homeY;
  }
});


function tick() {
  const { cssW, cssH } = size;
  const { objSize, maxSpeed } = settings;
  const behavior = behaviors[state.mode];

  for (const obj of state.objects) {
    const centerX = obj.virtX + objSize / 2;
    const centerY = obj.virtY + objSize / 2;
    const dx = state.pointerX - centerX;
    const dy = state.pointerY - centerY;

    const result = behavior.update({
      pressure: Numbers.clamp(state.pressure, 0, 1),
      tiltX: state.tiltX,
      tiltY: state.tiltY,
      twist: state.twist,
      twistNorm: state.twistNorm,
      pointerX: state.pointerX,
      pointerY: state.pointerY,
      pointerType: state.pointerType,
      dragging: state.dragging,
      virtX: obj.virtX,
      virtY: obj.virtY,
      velX: obj.velX,
      velY: obj.velY,
      targetX: obj.targetX,
      targetY: obj.targetY,
      rotation: 0,
      centerX,
      centerY,
      dist: Math.sqrt(dx * dx + dy * dy),
      cssW,
      cssH,
      size: objSize,
    });

    if (result.targetX !== undefined) obj.targetX = result.targetX;
    if (result.targetY !== undefined) obj.targetY = result.targetY;
    physicsStep(obj, result);
    capSpeed(obj, maxSpeed);
    obj.virtX += obj.velX;
    obj.virtY += obj.velY;
  }

  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = behavior.config.color;
  for (const obj of state.objects) {
    ctx.fillRect(obj.virtX, obj.virtY, objSize, objSize);
  }
}

continuously(tick).start();
