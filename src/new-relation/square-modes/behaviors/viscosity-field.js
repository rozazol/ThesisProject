import * as Numbers from "@ixfx/numbers.js";

export const config = Object.freeze({
  baseFriction: 0.18,
  minFriction: 0.01,
  basePull: 0.12,
  weight: 4,
  meltRadius: 130,
  meltRate: 0.028,
  refreezeRate: 0.005,
  maxTiltDrift: 0.012,
});

const perObject = new Map();

function getObj(key) {
  if (!perObject.has(key)) perObject.set(key, { meltLevel: 0 });
  return perObject.get(key);
}

export function update(s) {
  const {
    pressure, tiltX, tiltY, dragging, dist,
    targetX, targetY,
  } = s;

  const key = `${targetX}_${targetY}`;
  const obj = getObj(key);

  const inRange = dist < config.meltRadius;

  if (inRange && dragging && pressure > 0.02) {
    const proximity = Numbers.scale(dist, 0, config.meltRadius, 1, 0);
    obj.meltLevel = Math.min(1, obj.meltLevel + pressure * proximity * config.meltRate);
  } else {
    const rate = inRange ? config.refreezeRate : config.refreezeRate * 4;
    obj.meltLevel = Math.max(0, obj.meltLevel - rate);
  }

  const { meltLevel } = obj;

  const friction = Numbers.scale(meltLevel, 0, 1, config.baseFriction, config.minFriction);
  const pull = config.basePull * (1 - meltLevel * 0.55);

  let extraVelX = 0;
  let extraVelY = 0;

  if (meltLevel > 0.3) {
    extraVelX = tiltX * config.maxTiltDrift * meltLevel;
    extraVelY = tiltY * config.maxTiltDrift * meltLevel;
  }

  return {
    friction,
    pull,
    weight: config.weight,
    extraVelX,
    extraVelY,
    meltLevel,
  };
}
