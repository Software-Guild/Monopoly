// app/api/middleware/auth.middleware.js
//
// Middleware to protect routes that require an authenticated session.
// Attach this to any future game routes (create game, join game, roll
// dice, etc.) to ensure only logged-in players can access them.

/**
 * Guards a route so it can only be accessed with a valid, active
 * session. Assumes `req.session.userId` is set at login time (see
 * auth.controller.js#login and #register).
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Not authenticated. Please log in.',
  });
}

module.exports = { isAuthenticated };
