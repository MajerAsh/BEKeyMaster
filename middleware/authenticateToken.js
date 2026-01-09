// BE/middleware/authenticateToken.js
const jwt = require("jsonwebtoken");

/**
 * Require a valid JWT in the Authorization header.
 * Expects: Authorization: Bearer <token>
 */
module.exports = function authenticateToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Invalid Authorization format" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Keep only what you actually need downstream
    req.user = {
      id: payload.id,
      email: payload.email,
    };

    return next();
  } catch (err) {
    // Token missing/expired/invalid signature -> forbidden
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};
