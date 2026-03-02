/**
 * Creates a Razorpay Payment Link for WhatsApp booking flow.
 */

const razorpay = require('../config/razorpay');

const createPaymentLink = async (params) => {
    const {
        phone,
        patientName,
        doctorName,
        doctorId,
        department,
        date,
        timeSlot,
        reason,
        amount,
        appointmentType,
    } = params;

    // ✅ appointmentcost in Firestore is a string e.g. "1000"
    const amountInt = parseInt(amount, 10);
    if (!amountInt || amountInt <= 0) {
        throw new Error(`Invalid appointment amount: "${amount}" — check appointmentcost field in Firestore`);
    }

    // Clean phone for Razorpay (digits only, no +91)
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');

    console.log(`💳 Creating payment link: ₹${amountInt} | ${doctorName} | Patient: ${patientName}`);

    // ✅ FIX: Do NOT set expire_by at all — Razorpay defaults to 6 months.
    // The "15 minutes minimum" rule causes issues in test mode with clock skew.
    // Removing expire_by entirely avoids this completely.
    const paymentLinkData = {
        amount: amountInt * 100, // paise (₹1000 → 100000)
        currency: 'INR',
        accept_partial: false,
        description: `${appointmentType === 'teleconsultation' ? 'Teleconsultation' : 'Hospital Visit'} - ${doctorName}`,
        customer: {
            name: patientName,
            contact: cleanPhone,
        },
        notify: {
            sms: false,   // We handle WhatsApp ourselves
            email: false,
        },
        reminder_enable: false,
        // 🔑 All booking data in notes so webhook can reconstruct the booking
        // ✅ Max 15 key-value pairs, max 256 chars each — we have 9 keys, all short
        notes: {
            patientName:     String(patientName).substring(0, 255),
            phone:           String(phone).substring(0, 50),
            doctorName:      String(doctorName).substring(0, 100),
            doctorId:        String(doctorId || '').substring(0, 100),
            department:      String(department || '').substring(0, 100),
            date:            String(date || '').substring(0, 20),
            timeSlot:        String(timeSlot || '').substring(0, 20),
            reason:          String(reason || '').substring(0, 255),
            appointmentType: String(appointmentType || 'paid_appointment').substring(0, 50),
        },
        callback_url: `https://surekhahospitals.in/payment-success`,
        callback_method: 'get',
    };

    const link = await razorpay.paymentLink.create(paymentLinkData);

    console.log(`✅ Payment link created: ${link.short_url} for ₹${amountInt}`);

    return {
        shortUrl: link.short_url,
        paymentLinkId: link.id,
    };
};

module.exports = { createPaymentLink };