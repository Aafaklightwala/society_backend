const express = require('express');
const router  = express.Router();
const { getDashboard }  = require('../controllers/dashboard.controller');
const authMiddleware    = require('../middleware/authMiddleware');

// All roles can access dashboard (data filtered inside controller by role)
router.get('/', authMiddleware, getDashboard);

module.exports = router;
