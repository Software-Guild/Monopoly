// app/api/routes/auth.routes.ts
//
// Route definitions for /api/auth/*. Maps HTTP verbs + paths to
// controller functions. Kept intentionally free of business logic.

import { Router } from 'express';
import { register, login, logout, me, checkUsername } from '../controller/auth.controller';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', isAuthenticated, me);
router.get('/check-username', checkUsername);

export default router;
