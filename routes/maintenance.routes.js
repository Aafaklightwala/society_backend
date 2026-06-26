const express = require('express');
const router  = express.Router();
const { getMaintenance, createMaintenance, updateMaintenance } = require('../controllers/maintenance.controller');
const authMiddleware  = require('../middleware/authMiddleware');
const roleMiddleware  = require('../middleware/roleMiddleware');

// CHAIRMAN and RESIDENT can view
router.get('/',     authMiddleware, roleMiddleware('CHAIRMAN', 'RESIDENT'), getMaintenance);

// Only CHAIRMAN can create / update bills
router.post('/',    authMiddleware, roleMiddleware('CHAIRMAN'), createMaintenance);
router.put('/:id',  authMiddleware, roleMiddleware('CHAIRMAN'), updateMaintenance);

module.exports = router;
