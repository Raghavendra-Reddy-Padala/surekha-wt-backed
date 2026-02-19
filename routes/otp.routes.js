const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otp.controller');
const requireApiKey = require('../middlewares/auth.middleware');

router.post('/send-otp', requireApiKey, otpController.sendOtp);
router.post('/verify-otp', requireApiKey, otpController.verifyOtp);

module.exports = router;