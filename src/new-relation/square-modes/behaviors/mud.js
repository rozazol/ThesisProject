export const config = {
  color: `#8d6e63`,
  desc: `tilt: flows downhill | pressure: gets stuck | no hover effect`,
  friction: 0.55,
  pull: 0.12,
  weight: 28,
};

export function update(s) {
  const { pressure, tiltX, tiltY } = s;

  const friction = Math.min(0.94, config.friction + pressure * 0.48);
  const pull = config.pull * (1 - pressure * 0.88);
  const weight = config.weight + pressure * 38;

  return {
    friction,
    pull,
    weight,
    extraVelX: tiltX * 0.04 * (1 - pressure * 0.7),
    extraVelY: tiltY * 0.04 * (1 - pressure * 0.7),
  };
}
