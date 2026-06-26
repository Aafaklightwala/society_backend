const express = require('express');
const router  = express.Router();
const { login, getMe } = require('../controllers/auth.controller');
const authMiddleware   = require('../middleware/authMiddleware');

// Public
router.post('/login', login);

// Protected – Flutter calls this to verify token is still valid
router.get('/me', authMiddleware, getMe);

module.exports = router;
