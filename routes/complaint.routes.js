const express = require('express');
const router  = express.Router();
const { getComplaints, createComplaint, updateComplaint } = require('../controllers/complaint.controller');
const authMiddleware  = require('../middleware/authMiddleware');
const roleMiddleware  = require('../middleware/roleMiddleware');

router.get('/',     authMiddleware, roleMiddleware('CHAIRMAN', 'RESIDENT'), getComplaints);
router.post('/',    authMiddleware, roleMiddleware('RESIDENT', 'CHAIRMAN'), createComplaint);
router.put('/:id',  authMiddleware, roleMiddleware('CHAIRMAN'), updateComplaint);

module.exports = router;
