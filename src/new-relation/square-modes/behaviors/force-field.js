import * as Numbers from "@ixfx/numbers.js";

export const config = Object.freeze({
  color: `#5AADEA`,
  friction: 0.08,
  weight: 8,
  baseFieldRange: 200,
  tiltFieldExpansion: 250,
  peakStrength: 8,
  bodyInfluence: 0.65,
  bodyReach: 120,
  maxTiltDeg: 70,
});

export function update(s) {
  const { maxTiltDeg, baseFieldRange, tiltFieldExpansion, peakStrength, weight, bodyReach, bodyInfluence } = config;
  const { tiltX, tiltY, dist, pointerX, pointerY, centerX, centerY, virtX, virtY } = s;

  let extraVelX = 0;
  let extraVelY = 0;

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
    const tiltDirX = tiltX / tiltMag;
    const tiltDirY = tiltY / tiltMag;
    const bodyOffsetDist = tiltNorm * bodyReach;

    const bodyX = pointerX - tiltDirX * bodyOffsetDist;
    const bodyY = pointerY - tiltDirY * bodyOffsetDist;
    const bodyDist = Math.max(1, Math.sqrt((bodyX - centerX) ** 2 + (bodyY - centerY) ** 2));

    if (bodyDist < fieldRange) {
      const bodyPeakStrength = peakStrength * bodyInfluence * tiltNorm;
      const bodyStrength = Numbers.scale(bodyDist, 0, fieldRange, bodyPeakStrength, 0);
      const bodyDirX = (bodyX - centerX) / bodyDist;
      const bodyDirY = (bodyY - centerY) / bodyDist;

      extraVelX += bodyDirX * bodyStrength / weight;
      extraVelY += bodyDirY * bodyStrength / weight;
    }
  }

  return {
    friction: config.friction,
    pull: 0,
    weight: weight,
    extraVelX,
    extraVelY,
    targetX: virtX,
    targetY: virtY,
  };
}
