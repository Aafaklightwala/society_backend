const express = require('express');
const router  = express.Router();
const { getVisitors, createVisitor, updateVisitor } = require('../controllers/visitor.controller');
const authMiddleware  = require('../middleware/authMiddleware');
const roleMiddleware  = require('../middleware/roleMiddleware');

// All 3 roles can view visitors (data filtered by role in controller)
router.get('/',     authMiddleware, getVisitors);

// Only SECURITY and CHAIRMAN can log / update visitors
router.post('/',    authMiddleware, roleMiddleware('SECURITY', 'CHAIRMAN'), createVisitor);
router.put('/:id',  authMiddleware, roleMiddleware('SECURITY', 'CHAIRMAN'), updateVisitor);

module.exports = router;
