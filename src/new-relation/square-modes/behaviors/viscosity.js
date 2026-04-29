import * as Numbers from "@ixfx/numbers.js";

export const config = Object.freeze({
  color: `#F5C842`,
  baseFriction: 0.18,
  minFriction: 0.001,
  basePull: 0.06,
  weight: 4,
  meltRate: 0.02,
  refreezeRate: 0.004,
  hoverRadius: 180,
});

let state = {
  meltLevel: 0,
  rotation: 0,
};

export function update(s) {
  const { pressure, tiltX, tiltY, twistNorm, dragging, dist,
    pointerX, pointerY, centerX, centerY } = s;

  if (dragging) {
    state.meltLevel = Math.min(1, state.meltLevel + pressure * config.meltRate);
  } else {
    state.meltLevel = Math.max(0, state.meltLevel - config.refreezeRate);
  }

  const { meltLevel } = state;

  const friction = config.baseFriction + (config.minFriction - config.baseFriction) * meltLevel;
  const pull = config.basePull * (1 - meltLevel * 0.7);

  const tiltBias = 0.005 + (0.045 - 0.005) * meltLevel;
  let extraVelX = tiltX * tiltBias;
  let extraVelY = tiltY * tiltBias;

  if (!dragging && dist < config.hoverRadius) {
    const hoverStrength = Numbers.scale(dist, 10, config.hoverRadius, 0.008, 0);
    extraVelX -= (pointerX - centerX) * hoverStrength / config.weight;
    extraVelY -= (pointerY - centerY) * hoverStrength / config.weight;
  }

  const rotationDelta = twistNorm * 2.5 * (1 - meltLevel * 0.85);
  state.rotation = (state.rotation + rotationDelta) % 360;

  return {
    friction,
    pull,
    weight: config.weight,
    extraVelX,
    extraVelY,
    rotation: state.rotation,
    meltLevel,
  };
}
