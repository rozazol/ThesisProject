/**
 * Applies one frame of physics adjustments to a mutable state object
 * State must have: virtX, virtY, velX, velY, targetX, targetY
 */
export function physicsStep(state, { friction, pull, weight, extraVelX = 0, extraVelY = 0 }) {
  const springX = (state.targetX - state.virtX) * pull;
  const springY = (state.targetY - state.virtY) * pull;
  state.velX += springX / weight + extraVelX;
  state.velY += springY / weight + extraVelY;
  state.velX *= (1 - friction);
  state.velY *= (1 - friction);
}

/**
 * Clamps velocity magnitude to maxSpeed in-place.
 */
export function capSpeed(state, maxSpeed) {
  const speed = Math.sqrt(state.velX ** 2 + state.velY ** 2);
  if (speed > maxSpeed) {
    state.velX = (state.velX / speed) * maxSpeed;
    state.velY = (state.velY / speed) * maxSpeed;
  }
}
