import * as Numbers from "@ixfx/numbers.js";

export const config = Object.freeze({
  color: `#6AC4A2`,
  baseFriction: 0.15,
  basePull: 0.25,
  baseWeight: 6,
  hoverRadius: 260,
  maxDeform: 60,
});

let state = {
  deformX: 0,
  deformY: 0,
};

export function update(s) {
  const { maxDeform, hoverRadius, baseWeight, basePull, baseFriction } = config;
  const { pressure, tiltX, tiltY, twistNorm, dragging, dist,
    pointerX, pointerY, centerX, centerY, velX, velY,
    targetX, targetY, cssW, cssH, size } = s;

  let extraVelX = 0;
  let extraVelY = 0;
  let newTargetX;
  let newTargetY;

  if (dragging) {
    state.deformX += (pointerX - centerX) * pressure * 0.008;
    state.deformY += (pointerY - centerY) * pressure * 0.008;
  } else {
    state.deformX *= 0.82;
    state.deformY *= 0.82;
  }

  const deformMag = Math.sqrt(state.deformX ** 2 + state.deformY ** 2);
  if (deformMag > maxDeform) {
    state.deformX = (state.deformX / deformMag) * maxDeform;
    state.deformY = (state.deformY / deformMag) * maxDeform;
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
    const pushbackStrength = pressure * 0.4;
    extraVelX += (toCenterX / toCenterDist) * pushbackStrength;
    extraVelY += (toCenterY / toCenterDist) * pushbackStrength;
  }

  if (dragging && pressure > 0.05) {
    const stretchResistance = 1 - deformNorm * 0.6;
    newTargetX = Numbers.clamp(targetX + tiltX * 0.7 * stretchResistance, 0, cssW - size);
    newTargetY = Numbers.clamp(targetY + tiltY * 0.7 * stretchResistance, 0, cssH - size);
  }

  const speed = Math.sqrt(velX ** 2 + velY ** 2);
  if (speed > 0.5 && Math.abs(twistNorm) > 0.05 && pressure > 0.1) {
    const perpX = -velY / speed;
    const perpY = velX / speed;
    const twistStrength = twistNorm * pressure * 0.8 * (1 - deformNorm * 0.5);
    extraVelX += perpX * twistStrength;
    extraVelY += perpY * twistStrength;
  }

  return {
    friction: baseFriction,
    pull,
    weight,
    extraVelX,
    extraVelY,
    ...(newTargetX !== undefined && { targetX: newTargetX, targetY: newTargetY }),
  };
}
