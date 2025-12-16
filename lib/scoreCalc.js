const { MAX_TIME, SCORING } = require("../config/scoring");

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function computeScore({ game, elapsedSeconds = 1, attempts = 1 }) {
  const maxTime = MAX_TIME[game] || 120;
  const elapsed = clamp(Math.floor(elapsedSeconds), 1, maxTime);
  const speedFactor = 1 - elapsed / maxTime; // 1..0
  const raw = Math.round(SCORING.BASE_POINTS * speedFactor);
  const attemptsPenalty = Math.max(0, attempts - 1) * SCORING.ATTEMPT_PENALTY;
  const points = Math.max(SCORING.MIN_POINTS, raw - attemptsPenalty);
  return { points, raw, attemptsPenalty, elapsed };
}

module.exports = { computeScore };
