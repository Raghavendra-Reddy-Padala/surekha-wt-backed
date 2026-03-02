/**
 * Creates a Razorpay Payment Link for WhatsApp booking flow.
 *
 * Why Payment Links (not Orders)?
 * - Payment Links have their own hosted payment page — user just taps the URL.
 * - Razorpay fires `payment_link.paid` webhook to YOUR server when paid.
 * - All booking context is embedded in `notes` so the webhook can reconstruct
 *   the full booking without any session lookup.
 * - Links can expire automatically — no dangling unpaid bookings.
 */

const razorpay = require('../config/razorpay');

/**
 * Create a Razorpay Payment Link.
 *
 * @param {Object} params
 * @param {string} params.phone         - Patient WhatsApp number e.g. "+919032323095"
 * @param {string} params.patientName   - Patient full name
 * @param {string} params.doctorName    - e.g. "Dr. Yanda Sireesha"
 * @param {string} params.doctorId      - Firestore doctor document ID
 * @param {string} params.department    - e.g. "Anaesthesia and Critical Care"
 * @param {string} params.date          - e.g. "2026-03-10"
 * @param {string} params.timeSlot      - e.g. "10:00 AM"
 * @param {string} params.reason        - Reason for visit
 * @param {number} params.amount        - Appointment cost in INR (integer)
 * @param {string} params.appointmentType - "paid_appointment" | "teleconsultation"
 *
 * @returns {{ shortUrl: string, paymentLinkId: string }}
 */
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

    // Expire link in 1 hour (Unix timestamp)
    const expireBy = Math.floor(Date.now() / 1000) + 3600;

    // Clean phone for Razorpay (needs digits only, no +91)
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');

    const paymentLinkData = {
        amount: amount * 100, // Razorpay expects paise
        currency: 'INR',
        accept_partial: false,
        expire_by: expireBy,
        description: `${appointmentType === 'teleconsultation' ? 'Teleconsultation' : 'Hospital Visit'} with ${doctorName}`,
        customer: {
            name: patientName,
            contact: cleanPhone,
        },
        notify: {
            sms: false,   // We handle WhatsApp ourselves
            email: false,
        },
        reminder_enable: false,
        // 🔑 ALL booking data stored in notes — webhook reads this to save to Firebase
        notes: {
            patientName,
            phone,
            doctorName,
            doctorId,
            department,
            date,
            timeSlot,
            reason,
            appointmentType,
            bookedVia: 'whatsapp',
        },
        callback_url: `https://surekhahospitals.in/payment-success`,
        callback_method: 'get',
    };

    const link = await razorpay.paymentLink.create(paymentLinkData);

    console.log(`💳 Payment link created: ${link.short_url} for ₹${amount} | ${patientName} | ${doctorName}`);

    return {
        shortUrl: link.short_url,
        paymentLinkId: link.id,
    };
};

module.exports = { createPaymentLink };