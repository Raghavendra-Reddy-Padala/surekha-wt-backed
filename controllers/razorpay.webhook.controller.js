/**
 * razorpay.webhook.controller.js
 *
 * Handles the `payment_link.paid` event from Razorpay.
 *
 * This is the FINAL STEP of the WhatsApp booking flow:
 *   1. Razorpay calls this endpoint when a payment link is paid
 *   2. We verify the webhook signature
 *   3. Extract all booking data from payment link `notes`
 *   4. Save to Firebase (same structure as web bookings)
 *   5. Send WhatsApp confirmation to patient + receptionist
 *   6. Clear the user's session
 */

const crypto = require('crypto');
const { saveBookingToFirestore } = require('../utils/firebase.bot.util');
const { sendBookingConfirmation } = require('../utils/whatsapp.bot.util');
const axios = require('axios');
const { clearSession } = require('../utils/session.store');

exports.handleRazorpayWebhook = async (req, res) => {
    // ── 1. VERIFY RAZORPAY WEBHOOK SIGNATURE ────────────────────────────────
    const receivedSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!receivedSignature || !webhookSecret) {
        console.error('❌ Missing signature or webhook secret');
        return res.status(400).json({ success: false, error: 'Missing signature' });
    }

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

    if (expectedSignature !== receivedSignature) {
        console.error('❌ Razorpay webhook signature mismatch! Possible tampering.');
        return res.status(400).json({ success: false, error: 'Invalid signature' });
    }

    // ── 2. ONLY HANDLE payment_link.paid EVENT ──────────────────────────────
    const event = req.body.event;

    if (event !== 'payment_link.paid') {
        console.log(`ℹ️ Ignoring Razorpay event: ${event}`);
        return res.status(200).json({ success: true, message: 'Event ignored' });
    }

    try {
        const payload = req.body.payload;
        const paymentLink = payload.payment_link?.entity;
        const payment = payload.payment?.entity;

        if (!paymentLink || !payment) {
            console.error('❌ Missing payment_link or payment entity in payload');
            return res.status(400).json({ success: false, error: 'Missing payload data' });
        }

        // ── 3. EXTRACT BOOKING DATA FROM NOTES ──────────────────────────────
        const notes = paymentLink.notes || {};
        const {
            patientName,
            phone,
            doctorName,
            doctorId,
            department,
            date,
            timeSlot,
            reason,
            appointmentType,
        } = notes;

        // Validate required fields
        if (!patientName || !phone || !doctorName || !date) {
            console.error('❌ Missing required booking data in payment link notes:', notes);
            return res.status(400).json({ success: false, error: 'Incomplete booking data in notes' });
        }

        const amountPaid = payment.amount / 100; // Convert paise to INR

        console.log(`✅ Payment confirmed: ₹${amountPaid} | ${patientName} | ${doctorName}`);

        // ── 4. BUILD BOOKING DATA (matches web booking structure exactly) ────
        const bookingData = {
            patientName,
            phone,
            email: '',               // Not collected via WhatsApp
            doctorName,
            doctorId: doctorId || '',
            date,
            timeSlot: timeSlot || '',
            department: department || '',
            reason: reason || '',
            bookedVia: 'whatsapp',
            type: appointmentType || 'paid_appointment',

            paymentDetails: {
                orderId: paymentLink.id,           // Payment link ID as order reference
                paymentId: payment.id,
                amountPaid,
                currency: payment.currency || 'INR',
                paymentMethod: payment.method || 'Razorpay',
                paymentStatus: payment.status || 'captured',
                paidAt: new Date().toISOString(),
            },
        };

        // ── 5. SAVE TO FIREBASE ──────────────────────────────────────────────
        const bookingId = await saveBookingToFirestore(bookingData, appointmentType || 'paid_appointment');

        // ── 6. SEND WHATSAPP CONFIRMATION ────────────────────────────────────
        const fullBooking = { ...bookingData, bookingId };

        // Send to patient
        try {
            await sendBookingConfirmation(phone, fullBooking);
        } catch (waErr) {
            console.warn('⚠️ Patient confirmation WhatsApp failed:', waErr.message);
        }

        // Trigger /web-request to notify patient (template) + receptionist (template)
        try {
            await axios.post(`https://api.surekhahospitals.in/web-request`, {
                patientName: fullBooking.patientName,
                patientPhone: fullBooking.phone,
                doctorName: fullBooking.doctorName,
                date: fullBooking.date,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.API_SECRET_KEY}`
                }
            });
            console.log('✅ /web-request notification sent');
        } catch (waErr) {
            console.warn('⚠️ /web-request failed (booking still saved):', waErr.message);
        }

        // ── 7. CLEAR SESSION ─────────────────────────────────────────────────
        clearSession(phone);

        console.log(`🎉 WhatsApp booking complete: ${bookingId} | ${patientName} | ${doctorName}`);

        return res.status(200).json({
            success: true,
            bookingId,
            message: 'Payment verified and booking saved',
        });

    } catch (err) {
        console.error('❌ Razorpay webhook processing error:', err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};