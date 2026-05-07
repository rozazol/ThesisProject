import * as Numbers from "@ixfx/numbers.js";

export const config = Object.freeze({
  color: `#6AC4A2`,
  baseFriction: 0.15,
  basePull: 0.25,
  baseWeight: 6,
  hoverRadius: 260,
  burstScale: 8,
});

let state = {
  lastDragging: false,
  storedPressure: 0,
  burstTime: -Infinity,
};

export function update(s) {
  const { baseFriction, basePull, baseWeight, hoverRadius, burstScale } = config;
  const { pressure, tiltX, tiltY, twistNorm, dragging, dist,
    pointerX, pointerY, centerX, centerY, velX, velY,
    targetX, targetY, cssW, cssH, size } = s;

  const justStarted = !state.lastDragging && dragging;
  const justReleased = state.lastDragging && !dragging;
  state.lastDragging = dragging;

  if (justStarted) state.storedPressure = 0; // reset for new gesture
  if (dragging) state.storedPressure = Math.max(state.storedPressure, pressure);
  if (justReleased) state.burstTime = performance.now();

  const burstActive = (performance.now() - state.burstTime) < 60;

  const dx = pointerX - centerX;
  const dy = pointerY - centerY;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;

  let extraVelX = 0;
  let extraVelY = 0;

  if (dragging && pressure > 0.02 && dist < hoverRadius) {
    const influence = Numbers.scale(dist, 0, hoverRadius, 1, 0); // 1 at center, 0 at edge
    const pullForce = pressure * 0.55 * influence;
    extraVelX += (dx / d) * pullForce;
    extraVelY += (dy / d) * pullForce;

    const tiltMag = Math.sqrt(tiltX ** 2 + tiltY ** 2) || 1;
    const tiltNorm = Math.min(1, tiltMag / 70);
    if (tiltNorm > 0.05) {
      const stretchForce = tiltNorm * pressure * 0.9 * influence;
      extraVelX += (tiltX / tiltMag) * stretchForce;
      extraVelY += (tiltY / tiltMag) * stretchForce;
    }
  }

  if (burstActive) {
    const burstStrength = Math.pow(state.storedPressure, 40) * burstScale;
    extraVelX += (-dx / d) * burstStrength;
    extraVelY += (-dy / d) * burstStrength;
  }

  return {
    friction: baseFriction,
    pull: basePull,
    weight: baseWeight,
    extraVelX,
    extraVelY,
  };
}
