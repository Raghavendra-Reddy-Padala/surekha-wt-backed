const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const requireApiKey = require('../middlewares/auth.middleware');

router.post('/create-payment-order', requireApiKey, paymentController.createOrder);
router.post('/verify-payment', requireApiKey, paymentController.verifyPayment);

module.exports = router;