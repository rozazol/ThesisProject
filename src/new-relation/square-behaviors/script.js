import { continuously } from "@ixfx/flow.js";
import * as Numbers from "@ixfx/numbers.js";
import { physicsStep, capSpeed } from "../../shared/physics.js";
import { setupCanvas } from "../../shared/canvas-setup.js";
import { setupPointer } from "../../shared/pointer-input.js";


const behaviors = {

  elasticity: {
    initState: () => ({ deformX: 0, deformY: 0 }),
    update(s, bs) {
      const baseFriction = 0.15,
        basePull = 0.25,
        baseWeight = 6;
      const hoverRadius = 260,
        maxDeform = 60;
      const { pressure, tiltX, tiltY, twistNorm, dragging, dist,
        pointerX, pointerY, centerX, centerY, velX, velY,
        targetX, targetY, cssW, cssH, size } = s;

      let extraVelX = 0,
        extraVelY = 0,
        newTargetX,
        newTargetY;

      if (dragging) {
        bs.deformX += (pointerX - centerX) * pressure * 0.008;
        bs.deformY += (pointerY - centerY) * pressure * 0.008;
      } else {
        bs.deformX *= 0.82;
        bs.deformY *= 0.82;
      }

      const deformMag = Math.sqrt(bs.deformX ** 2 + bs.deformY ** 2);
      if (deformMag > maxDeform) {
        bs.deformX = (bs.deformX / deformMag) * maxDeform;
        bs.deformY = (bs.deformY / deformMag) * maxDeform;
      }
      const deformNorm = Math.min(1, deformMag / maxDeform);

      if (!dragging && dist < hoverRadius) {
        const hoverStrength = Numbers.scale(dist, 10, hoverRadius, 0.035, 0);
        extraVelX += (pointerX - centerX) * hoverStrength / baseWeight;
        extraVelY += (pointerY - centerY) * hoverStrength / baseWeight;
      }

      const pull = basePull + pressure * 0.45;
      const weight = Math.max(1, baseWeight - pressure * 2);

      if (dragging && pressure > 0.05) {
        const toCenterX = centerX - pointerX;
        const toCenterY = centerY - pointerY;
        const toCenterDist = Math.sqrt(toCenterX ** 2 + toCenterY ** 2) || 1;
        extraVelX += (toCenterX / toCenterDist) * pressure * 0.4;
        extraVelY += (toCenterY / toCenterDist) * pressure * 0.4;
      }

      if (dragging && pressure > 0.05) {
        const stretchResistance = 1 - deformNorm * 0.6;
        newTargetX = Numbers.clamp(targetX + tiltX * 0.7 * stretchResistance, 0, cssW - size);
        newTargetY = Numbers.clamp(targetY + tiltY * 0.7 * stretchResistance, 0, cssH - size);
      }

      const speed = Math.sqrt(velX ** 2 + velY ** 2);
      if (speed > 0.5 && Math.abs(twistNorm) > 0.05 && pressure > 0.1) {
        const perpX = -velY / speed,
          perpY = velX / speed;
        const twistStrength = twistNorm * pressure * 0.8 * (1 - deformNorm * 0.5);
        extraVelX += perpX * twistStrength;
        extraVelY += perpY * twistStrength;
      }

      return {
        friction: baseFriction, pull, weight, extraVelX, extraVelY,
        ...(newTargetX !== undefined && { targetX: newTargetX, targetY: newTargetY }),
      };
    },
  },

  'force-field': {
    initState: () => ({}),
    update(s, _bs) {
      const friction = 0.08,
        weight = 8,
        baseFieldRange = 200;
      const tiltFieldExpansion = 250,
        peakStrength = 8;
      const bodyInfluence = 0.65,
        bodyReach = 120,
        maxTiltDeg = 70;
      const { tiltX, tiltY, dist, pointerX, pointerY, centerX, centerY, virtX, virtY } = s;

      let extraVelX = 0,
        extraVelY = 0;
      const tiltMag = Math.sqrt(tiltX ** 2 + tiltY ** 2);
      const tiltNorm = Math.min(1, tiltMag / maxTiltDeg);
      const fieldRange = baseFieldRange + tiltNorm * tiltFieldExpansion;

      const tipDist = Math.max(1, dist);
      const tipDirX = (pointerX - centerX) / tipDist;
      const tipDirY = (pointerY - centerY) / tipDist;

      if (tipDist < fieldRange) {
        const tipStrength = Numbers.scale(tipDist, 0, fieldRange, peakStrength, 0);
        extraVelX += tipDirX * tipStrength / weight;
        extraVelY += tipDirY * tipStrength / weight;
      }

      if (tiltNorm > 0.05) {
        const tiltDirX = tiltX / tiltMag,
          tiltDirY = tiltY / tiltMag;
        const bodyX = pointerX - tiltDirX * tiltNorm * bodyReach;
        const bodyY = pointerY - tiltDirY * tiltNorm * bodyReach;
        const bodyDist = Math.max(1, Math.sqrt((bodyX - centerX) ** 2 + (bodyY - centerY) ** 2));

        if (bodyDist < fieldRange) {
          const bodyPeakStrength = peakStrength * bodyInfluence * tiltNorm;
          const bodyStrength = Numbers.scale(bodyDist, 0, fieldRange, bodyPeakStrength, 0);
          extraVelX += ((bodyX - centerX) / bodyDist) * bodyStrength / weight;
          extraVelY += ((bodyY - centerY) / bodyDist) * bodyStrength / weight;
        }
      }

      return { friction, pull: 0, weight, extraVelX, extraVelY, targetX: virtX, targetY: virtY };
    },
  },

  ice: {
    initState: () => ({}),
    update(s, _bs) {
      const baseFriction = 0.025,
        basePull = 0.06,
        weight = 4;
      const { pressure, tiltX, tiltY, twistNorm, dragging, dist,
        pointerX, pointerY, centerX, centerY, rotation } = s;

      const friction = Math.max(0.001, baseFriction * (1 - pressure * 0.95));
      const pull = basePull + pressure * 0.18;
      const newRotation = (rotation + twistNorm * 2.5) % 360;
      let extraVelX = tiltX * 0.02;
      let extraVelY = tiltY * 0.02;

      if (!dragging && dist < 180) {
        const hoverStrength = Numbers.scale(dist, 10, 180, 0.012, 0);
        extraVelX += (pointerX - centerX) * hoverStrength / weight;
        extraVelY += (pointerY - centerY) * hoverStrength / weight;
      }

      return { friction, pull, weight, extraVelX, extraVelY, rotation: newRotation };
    },
  },

  mud: {
    initState: () => ({}),
    update(s, _bs) {
      const baseFriction = 0.55,
        basePull = 0.12,
        baseWeight = 28;
      const { pressure, tiltX, tiltY } = s;

      return {
        friction: Math.min(0.94, baseFriction + pressure * 0.48),
        pull: basePull * (1 - pressure * 0.88),
        weight: baseWeight + pressure * 38,
        extraVelX: tiltX * 0.04 * (1 - pressure * 0.7),
        extraVelY: tiltY * 0.04 * (1 - pressure * 0.7),
      };
    },
  },

  rubber: {
    initState: () => ({}),
    update(s, _bs) {
      const baseFriction = 0.15,
        basePull = 0.25,
        baseWeight = 6;
      const { pressure, tiltX, tiltY, twistNorm, dragging, dist,
        pointerX, pointerY, centerX, centerY,
        velX, velY, targetX, targetY, cssW, cssH, size } = s;

      let pull = basePull + pressure * 0.45;
      let weight = Math.max(1, baseWeight - pressure * 4);
      let extraVelX = 0,
        extraVelY = 0,
        newTargetX,
        newTargetY;

      if (!dragging && dist < 260) {
        const hoverStrength = Numbers.scale(dist, 10, 260, 0.035, 0) * (1 - pressure * 0.6);
        extraVelX += (pointerX - centerX) * hoverStrength / weight;
        extraVelY += (pointerY - centerY) * hoverStrength / weight;
      }

      if (dragging && pressure > 0.05) {
        newTargetX = Numbers.clamp(targetX + tiltX * 0.7, 0, cssW - size);
        newTargetY = Numbers.clamp(targetY + tiltY * 0.7, 0, cssH - size);
      }

      const speed = Math.sqrt(velX ** 2 + velY ** 2);
      if (speed > 0.5 && Math.abs(twistNorm) > 0.05 && pressure > 0.1) {
        const perpX = -velY / speed,
          perpY = velX / speed;
        extraVelX += perpX * twistNorm * pressure * 0.8;
        extraVelY += perpY * twistNorm * pressure * 0.8;
      }

      return {
        friction: baseFriction, pull, weight, extraVelX, extraVelY,
        ...(newTargetX !== undefined && { targetX: newTargetX, targetY: newTargetY }),
      };
    },
  },

  viscosity: {
    initState: () => ({ meltLevel: 0, rotation: 0 }),
    update(s, bs) {
      const baseFriction = 0.18,
        minFriction = 0.001,
        basePull = 0.06,
        weight = 4;
      const meltRate = 0.02,
        refreezeRate = 0.004,
        hoverRadius = 180;
      const { pressure, tiltX, tiltY, twistNorm, dragging, dist,
        pointerX, pointerY, centerX, centerY } = s;

      if (dragging) {
        bs.meltLevel = Math.min(1, bs.meltLevel + pressure * meltRate);
      } else {
        bs.meltLevel = Math.max(0, bs.meltLevel - refreezeRate);
      }

      const { meltLevel } = bs;
      const friction = baseFriction + (minFriction - baseFriction) * meltLevel;
      const pull = basePull * (1 - meltLevel * 0.7);
      const tiltBias = 0.005 + (0.045 - 0.005) * meltLevel;
      let extraVelX = tiltX * tiltBias;
      let extraVelY = tiltY * tiltBias;

      if (!dragging && dist < hoverRadius) {
        const hoverStrength = Numbers.scale(dist, 10, hoverRadius, 0.008, 0);
        extraVelX -= (pointerX - centerX) * hoverStrength / weight;
        extraVelY -= (pointerY - centerY) * hoverStrength / weight;
      }

      bs.rotation = (bs.rotation + twistNorm * 2.5 * (1 - meltLevel * 0.85)) % 360;

      return { friction, pull, weight, extraVelX, extraVelY, rotation: bs.rotation };
    },
  },
};

const settings = {
  size: 110,
  maxSpeed: 8,
  color: `#e0e0e0`,
  cols: 3,
  rows: 2,
  names: [ `elasticity`, `force-field`, `ice`, `mud`, `rubber`, `viscosity` ],
  canvas: /** @type {HTMLCanvasElement} */ (document.getElementById(`canvas`)),
};


const state = {
  squares: settings.names.map(name => ({
    name,
    bState: behaviors[name].initState(),
    virtX: 0,
    virtY: 0,
    velX: 0,
    velY: 0,
    targetX: 0,
    targetY: 0,
    rotation: 0,
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    initialized: false,
    pressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    twistNorm: 0,
    pointerX: -9999,
    pointerY: -9999,
    pointerType: `mouse`,
  })),
  activeSquare: null,
};

// --- Canvas ---

const { ctx, size } = setupCanvas(settings.canvas, (cssW, cssH) => {
  const colW = cssW / settings.cols;
  const rowH = cssH / settings.rows;
  state.squares.forEach((sq, i) => {
    if (!sq.initialized) {
      const col = i % settings.cols;
      const row = Math.floor(i / settings.cols);
      sq.virtX = col * colW + (colW - settings.size) / 2;
      sq.virtY = row * rowH + (rowH - settings.size) / 2;
      sq.targetX = sq.virtX;
      sq.targetY = sq.virtY;
      sq.initialized = true;
    }
  });
});


function applyPointerToSquare(sq, ptr) {
  sq.pressure = ptr.pressure;
  sq.tiltX = ptr.tiltX;
  sq.tiltY = ptr.tiltY;
  sq.twist = ptr.twist;
  sq.twistNorm = ptr.twistNorm;
  sq.pointerX = ptr.x;
  sq.pointerY = ptr.y;
  sq.pointerType = ptr.pointerType;
}

setupPointer(settings.canvas, {
  onDown(ptr) {
    for (let i = state.squares.length - 1; i >= 0; i--) {
      const sq = state.squares[i];
      if (ptr.x >= sq.virtX && ptr.x <= sq.virtX + settings.size &&
          ptr.y >= sq.virtY && ptr.y <= sq.virtY + settings.size) {
        state.activeSquare = sq;
        sq.dragging = true;
        sq.dragOffsetX = ptr.x - sq.virtX;
        sq.dragOffsetY = ptr.y - sq.virtY;
        applyPointerToSquare(sq, ptr);
        settings.canvas.setPointerCapture(ptr.pointerId);
        break;
      }
    }
  },
  onMove(ptr) {
    if (state.activeSquare) {
      applyPointerToSquare(state.activeSquare, ptr);
      state.activeSquare.targetX = Numbers.clamp(ptr.x - state.activeSquare.dragOffsetX, 0, size.cssW - settings.size);
      state.activeSquare.targetY = Numbers.clamp(ptr.y - state.activeSquare.dragOffsetY, 0, size.cssH - settings.size);
    }
    for (const sq of state.squares) {
      if (sq !== state.activeSquare) {
        sq.pointerX = ptr.x;
        sq.pointerY = ptr.y;
        sq.pointerType = ptr.pointerType;
        sq.pressure = 0;
        sq.tiltX = 0;
        sq.tiltY = 0;
        sq.twist = 0;
        sq.twistNorm = 0;
      }
    }
  },
  onUp() {
    if (state.activeSquare) {
      state.activeSquare.dragging = false;
      state.activeSquare = null;
    }
  },
});


function buildSnapshot(sq) {
  const centerX = sq.virtX + settings.size / 2;
  const centerY = sq.virtY + settings.size / 2;
  const dx = sq.pointerX - centerX;
  const dy = sq.pointerY - centerY;
  return {
    pressure: Numbers.clamp(sq.pressure, 0, 1),
    tiltX: sq.tiltX,
    tiltY: sq.tiltY,
    twist: sq.twist,
    twistNorm: sq.twistNorm,
    pointerX: sq.pointerX,
    pointerY: sq.pointerY,
    pointerType: sq.pointerType,
    dragging: sq.dragging,
    virtX: sq.virtX,
    virtY: sq.virtY,
    velX: sq.velX,
    velY: sq.velY,
    targetX: sq.targetX,
    targetY: sq.targetY,
    rotation: sq.rotation,
    centerX,
    centerY,
    dist: Math.sqrt(dx * dx + dy * dy),
    cssW: size.cssW,
    cssH: size.cssH,
    size: settings.size,
  };
}

function stepSquare(sq) {
  const behavior = behaviors[sq.name];
  const result = behavior.update(buildSnapshot(sq), sq.bState);

  if (result.targetX !== undefined) sq.targetX = result.targetX;
  if (result.targetY !== undefined) sq.targetY = result.targetY;
  if (result.rotation !== undefined) sq.rotation = result.rotation;

  physicsStep(sq, result);
  capSpeed(sq, settings.maxSpeed);

  sq.virtX = Numbers.clamp(sq.virtX + sq.velX, 0, size.cssW - settings.size);
  sq.virtY = Numbers.clamp(sq.virtY + sq.velY, 0, size.cssH - settings.size);
}

function draw() {
  ctx.clearRect(0, 0, size.cssW, size.cssH);
  ctx.fillStyle = settings.color;

  for (const sq of state.squares) {
    const cx = sq.virtX + settings.size / 2;
    const cy = sq.virtY + settings.size / 2;
    ctx.save();
    ctx.translate(cx, cy);
    if (sq.rotation) ctx.rotate((sq.rotation * Math.PI) / 180);
    ctx.fillRect(-settings.size / 2, -settings.size / 2, settings.size, settings.size);
    ctx.restore();
  }
}

continuously(() => {
  for (const sq of state.squares) stepSquare(sq);
  draw();
}).start();
