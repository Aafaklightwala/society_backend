const express = require('express');
const router  = express.Router();
const { getAmenities } = require('../controllers/amenity.controller');
const authMiddleware   = require('../middleware/authMiddleware');
const roleMiddleware   = require('../middleware/roleMiddleware');

// RESIDENT and CHAIRMAN can view
router.get('/', authMiddleware, roleMiddleware('CHAIRMAN', 'RESIDENT'), getAmenities);

module.exports = router;
