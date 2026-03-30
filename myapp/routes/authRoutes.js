const express = require('express');
const router = express.Router();
const { googleAuth, completeProfile, getMe } = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');

router.post('/google', googleAuth);
router.put('/complete-profile', protect, completeProfile);
router.get('/me', protect, getMe);

module.exports = router;