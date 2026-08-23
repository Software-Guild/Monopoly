// app/api/routes/auth.routes.js
//
// Route definitions for /api/auth/*. Maps HTTP verbs + paths to
// controller functions. Kept intentionally free of business logic.

const express = require('express');
const {
  register,
  login,
  logout,
  me,
  checkUsername,
} = require('../controller/auth.controller');
const { isAuthenticated } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', isAuthenticated, me);
router.get('/check-username', checkUsername);

module.exports = router;
