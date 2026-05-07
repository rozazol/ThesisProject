import * as Numbers from "@ixfx/numbers.js";

export const config = Object.freeze({
  color: `#5AADEA`,
  friction: 0.08,
  weight: 8,
  fieldRange: 180,
  fieldRangeTilt: 120,
  peakStrength: 10,
  bodyLength: 320,
  maxTiltDeg: 70,
});

export function update(s) {
  const { fieldRange, fieldRangeTilt, peakStrength, weight, bodyLength, maxTiltDeg } = config;
  const { tiltX, tiltY, pressure, pointerX, pointerY, centerX, centerY, virtX, virtY } = s;

  const pressureFactor = Numbers.scale(pressure, 0, 1, 0.04, 1);
  const effectivePeak = peakStrength * pressureFactor;

  const tiltMag = Math.sqrt(tiltX ** 2 + tiltY ** 2);
  const tiltNorm = Math.min(1, tiltMag / maxTiltDeg);

  let attractX, attractY;

  if (tiltNorm > 0.02) {
    const tdx = tiltX / tiltMag;
    const tdy = tiltY / tiltMag;

    const segLen = tiltNorm * bodyLength;
    const bx = pointerX + tdx * segLen;
    const by = pointerY + tdy * segLen;

    const abx = bx - pointerX, aby = by - pointerY;
    const t = Math.max(0, Math.min(1,
      ((centerX - pointerX) * abx + (centerY - pointerY) * aby) / (segLen * segLen)
    ));
    attractX = pointerX + t * abx;
    attractY = pointerY + t * aby;
  } else {
    attractX = pointerX;
    attractY = pointerY;
  }

  let extraVelX = 0;
  let extraVelY = 0;

  const adx = attractX - centerX;
  const ady = attractY - centerY;
  const aDist = Math.sqrt(adx * adx + ady * ady) || 1;

  const activeRange = fieldRange + tiltNorm * fieldRangeTilt;

  if (aDist < activeRange) {
    const strength = Numbers.scale(aDist, 0, activeRange, effectivePeak, 0);
    extraVelX = (adx / aDist) * strength / weight;
    extraVelY = (ady / aDist) * strength / weight;
  }

  if (!s.pointerOver) {
    return { friction: config.friction, pull: 0, weight, extraVelX: 0, extraVelY: 0, targetX: virtX, targetY: virtY };
  }

  return {
    friction: config.friction,
    pull: 0,
    weight,
    extraVelX,
    extraVelY,
    targetX: virtX,
    targetY: virtY,
  };
}
