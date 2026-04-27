import * as Numbers from "@ixfx/numbers.js";

export const config = {
  color: `#e74c3c`,
  desc: `hover: static pull | pressure: stretch & snap | tilt: push angle | barrel: spin deflection`,
  friction: 0.15,
  pull: 0.25,
  weight: 6,
};

/**
 * @param {import('../script.js').PointerSnapshot} s
 */
export function update(s) {
  const { pressure, tiltX, tiltY, twistNorm, dragging, dist,
    pointerX, pointerY, centerX, centerY, virtX, virtY,
    velX, velY, targetX, targetY, cssW, cssH, size } = s;

  let pull = config.pull + pressure * 0.45;
  let weight = Math.max(1, config.weight - pressure * 4);
  let extraVelX = 0;
  let extraVelY = 0;
  let newTargetX;
  let newTargetY;

  // Hover attracts toward cursor; closer = stronger pull
  if (!dragging && dist < 260) {
    const hoverStrength = Numbers.scale(dist, 10, 260, 0.035, 0) * (1 - pressure * 0.6);
    extraVelX += (pointerX - centerX) * hoverStrength / weight;
    extraVelY += (pointerY - centerY) * hoverStrength / weight;
  }

  // Tilt shifts the drag target sideways
  if (dragging && pressure > 0.05) {
    newTargetX = Numbers.clamp(targetX + tiltX * 0.7, 0, cssW - size);
    newTargetY = Numbers.clamp(targetY + tiltY * 0.7, 0, cssH - size);
  }

  // Barrel rotation deflects velocity perpendicular to current direction
  const speed = Math.sqrt(velX ** 2 + velY ** 2);
  if (speed > 0.5 && Math.abs(twistNorm) > 0.05 && pressure > 0.1) {
    const perpX = -velY / speed;
    const perpY = velX / speed;
    extraVelX += perpX * twistNorm * pressure * 0.8;
    extraVelY += perpY * twistNorm * pressure * 0.8;
  }

  return {
    friction: config.friction,
    pull,
    weight,
    extraVelX,
    extraVelY,
    ...(newTargetX !== undefined && { targetX: newTargetX, targetY: newTargetY }),
  };
}
