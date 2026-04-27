import * as Numbers from "@ixfx/numbers.js";

export const config = {
  color: `#ce93d8`,
  desc: `hover: attract | touch + tilt left: strong attract | touch + tilt right: repel`,
  friction: 0.08,
  pull: 0,
  weight: 8,
};

/**
 * @param {import('../script.js').PointerSnapshot} s
 */
export function update(s) {
  const { pressure, tiltX, dist, pointerX, pointerY, centerX, centerY, virtX, virtY } = s;

  const safeDist = Math.max(1, dist);
  let extraVelX = 0;
  let extraVelY = 0;

  const fieldRange = 450;
  if (dist < fieldRange) {
    const baseMag = Numbers.scale(dist, 0, fieldRange, 6, 0);
    const fieldMag = pressure < 0.05 ? baseMag : baseMag * 1.8;

    // tiltX left = attract, right = repel
    const fieldSign = pressure < 0.05 ?
      1 :
      (tiltX < -5 ? 1 : (tiltX > 5 ? -1 : Numbers.scale(tiltX, -5, 5, 1, -1)));

    const dirX = (pointerX - centerX) / safeDist;
    const dirY = (pointerY - centerY) / safeDist;

    extraVelX = dirX * fieldMag * fieldSign / config.weight;
    extraVelY = dirY * fieldMag * fieldSign / config.weight;
  }

  return {
    friction: config.friction,
    pull: 0,
    weight: config.weight,
    extraVelX,
    extraVelY,
    // Keep target pinned to current position so spring never fights the field force
    targetX: virtX,
    targetY: virtY,
  };
}
