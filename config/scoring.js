// Scoring constants for KeyMaster
const MAX_TIME = {
  DialLock: 120,
  PinTumbler: 90,
};

const SCORING = {
  BASE_POINTS: 1000,
  MIN_POINTS: 20,
  ATTEMPT_PENALTY: 25, // per wrong attempt beyond first
};

module.exports = { MAX_TIME, SCORING };
