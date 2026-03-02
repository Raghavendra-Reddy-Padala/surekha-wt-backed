/**
 * razorpay.webhook.routes.js
 *
 * IMPORTANT: Razorpay webhook signature verification requires the RAW request body.
 * This route uses express.raw() middleware — NOT express.json().
 *
 * Mount this BEFORE your global express.json() middleware in server.js,
 * or use the pattern shown below.
 */

const express = require('express');
const router = express.Router();
const razorpayWebhookController = require('../controllers/razorpay.webhook.controller');

// Use express.raw to get the raw body for signature verification
// Content-Type from Razorpay is application/json but we need raw bytes
router.post(
    '/razorpay-webhook',
    express.raw({ type: 'application/json' }),
    (req, res, next) => {
        // Parse the raw body back to JSON for our controller
        // but keep req.body as the original Buffer for signature verification
        if (Buffer.isBuffer(req.body)) {
            req.rawBody = req.body;
            req.body = JSON.parse(req.body.toString());
        }
        next();
    },
    razorpayWebhookController.handleRazorpayWebhook
);

module.exports = router;