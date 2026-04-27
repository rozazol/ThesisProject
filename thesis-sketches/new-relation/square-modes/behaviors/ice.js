import * as Numbers from "@ixfx/numbers.js";

export const config = {
  color: `#b3e5fc`,
  desc: `pressure: melts, slippier | tilt: slides | barrel: spins the square`,
  friction: 0.025,
  pull: 0.06,
  weight: 4,
};

/**
 * @param {import('../script.js').PointerSnapshot} s
 */
export function update(s) {
  const { pressure, tiltX, tiltY, twistNorm, dragging, dist,
    pointerX, pointerY, centerX, centerY, rotation } = s;

  const friction = Math.max(0.001, config.friction * (1 - pressure * 0.95));
  const pull = config.pull + pressure * 0.18;
  let extraVelX = tiltX * 0.02;
  let extraVelY = tiltY * 0.02;

  const newRotation = (rotation + twistNorm * 2.5) % 360;

  if (!dragging && dist < 180) {
    const hoverStrength = Numbers.scale(dist, 10, 180, 0.012, 0);
    extraVelX += (pointerX - centerX) * hoverStrength / config.weight;
    extraVelY += (pointerY - centerY) * hoverStrength / config.weight;
  }

  return {
    friction,
    pull,
    weight: config.weight,
    extraVelX,
    extraVelY,
    rotation: newRotation,
  };
}
