// app/api/middleware/auth.middleware.ts
//
// Middleware to protect routes that require an authenticated session.
// Attach this to any future game routes (create game, join game, roll
// dice, etc.) to ensure only logged-in players can access them.

import type { Request, Response, NextFunction } from 'express';

/**
 * Guards a route so it can only be accessed with a valid, active
 * session. Assumes `req.session.userId` is set at login time (see
 * auth.controller.ts#login and #register).
 */
export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.session && req.session.userId) {
    next();
    return;
  }

  res.status(401).json({
    success: false,
    message: 'Not authenticated. Please log in.',
  });
}
