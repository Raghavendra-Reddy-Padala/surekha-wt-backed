/**
 * WhatsApp message helpers for the booking bot.
 * Extends your existing whatsapp.util.js — add these functions to that file
 * OR keep them here and import alongside the existing ones.
 */

const axios = require('axios');

const WA_API = `https://graph.facebook.com/v25.0/${process.env.META_PHONE_ID}/messages`;
const HEADERS = { Authorization: `Bearer ${process.env.META_TOKEN}` };

// ─────────────────────────────────────────────
// REUSE your existing sendReply from whatsapp.util.js
// ─────────────────────────────────────────────
const sendReply = async (to, text) => {
    try {
        await axios.post(WA_API, {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text },
        }, { headers: HEADERS });
    } catch (e) {
        console.error('❌ sendReply failed:', e.response?.data || e.message);
    }
};

// ─────────────────────────────────────────────
// MAIN MENU (3 buttons — same as your existing sendMenu)
// ─────────────────────────────────────────────
const sendMainMenu = async (to) => {
    try {
        await axios.post(WA_API, {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: '🏥 *Welcome to Surekha Multi-Speciality Hospital!*\n\nHow can we help you today?',
                },
                action: {
                    buttons: [
                        { type: 'reply', reply: { id: 'btn_walkin', title: 'Walk-in Appointment' } },
                        { type: 'reply', reply: { id: 'btn_tele', title: 'Teleconsultation' } },
                        { type: 'reply', reply: { id: 'btn_info', title: 'Hospital Info' } },
                    ],
                },
            },
        }, { headers: HEADERS });
    } catch (e) {
        console.error('❌ sendMainMenu failed:', e.response?.data || e.message);
    }
};

// ─────────────────────────────────────────────
// DOCTOR LIST — WhatsApp List Message
// Grouped by department. Max 10 rows per section.
// doctors: array of { id, name, department, designation, appointmentcost }
// ─────────────────────────────────────────────
const sendDoctorList = async (to, doctors, appointmentType) => {
    try {
        // Group by department
        const grouped = {};
        for (const doc of doctors) {
            const dept = doc.department || 'General';
            if (!grouped[dept]) grouped[dept] = [];
            grouped[dept].push(doc);
        }

        // Build sections (WhatsApp allows max 10 sections, 10 rows each)
        const sections = Object.entries(grouped).map(([dept, docs]) => ({
            title: dept.substring(0, 24), // WA max 24 chars
            rows: docs.map(d => ({
                id: `doc_${d.id}`,
                title: d.name.substring(0, 24),
                description: `${d.designation || ''} | ₹${d.appointmentcost || 500}`.substring(0, 72),
            })),
        }));

        const typeLabel = appointmentType === 'teleconsultation' ? 'Teleconsultation' : 'Walk-in';

        await axios.post(WA_API, {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'list',
                body: {
                    text: `📋 *Select a Doctor for your ${typeLabel}*\n\nChoose from our specialists below:`,
                },
                action: {
                    button: 'View Doctors',
                    sections,
                },
            },
        }, { headers: HEADERS });
    } catch (e) {
        console.error('❌ sendDoctorList failed:', e.response?.data || e.message);
    }
};

// ─────────────────────────────────────────────
// TIME SLOT LIST — numbered text message
// WhatsApp list messages max out at 10 rows,
// so we use a clean numbered list for slots.
// ─────────────────────────────────────────────
const sendSlotList = async (to, slots, doctorName, date) => {
    const slotLines = slots.map((slot, i) => `  ${i + 1}. ${slot}`).join('\n');
    await sendReply(
        to,
        `🕐 *Available Time Slots*\n${doctorName} on ${date}:\n\n${slotLines}\n\nReply with the *slot number* (e.g. *1*)`
    );
};

// ─────────────────────────────────────────────
// PAYMENT LINK MESSAGE
// ─────────────────────────────────────────────
const sendPaymentLink = async (to, paymentUrl, patientName, doctorName, amount, appointmentType) => {
    const typeLabel = appointmentType === 'teleconsultation' ? 'Teleconsultation' : 'Hospital Visit';
    await sendReply(
        to,
        `💳 *Complete Your Booking*\n\n` +
        `Hi ${patientName}! Your appointment details are ready.\n\n` +
        `👨‍⚕️ Doctor: ${doctorName}\n` +
        `💰 Amount: ₹${amount}\n` +
        `📋 Type: ${typeLabel}\n\n` +
        `👇 *Tap the link below to pay securely:*\n${paymentUrl}\n\n` +
        `⏰ _This link expires in 1 hour._`
    );
};

// ─────────────────────────────────────────────
// BOOKING CONFIRMATION MESSAGE (after payment)
// ─────────────────────────────────────────────
const sendBookingConfirmation = async (to, booking) => {
    const { patientName, doctorName, date, timeSlot, department, appointmentType, bookingId, paymentDetails } = booking;
    const typeLabel = appointmentType === 'teleconsultation' ? '💻 Teleconsultation' : '🏥 Hospital Visit';

    await sendReply(
        to,
        `✅ *Appointment Confirmed!*\n\n` +
        `Hi ${patientName}, your booking is confirmed!\n\n` +
        `📋 *Booking Details:*\n` +
        `👨‍⚕️ Doctor: ${doctorName}\n` +
        `🏥 Department: ${department}\n` +
        `📅 Date: ${date}\n` +
        `🕐 Time: ${timeSlot}\n` +
        `📋 Type: ${typeLabel}\n` +
        `💰 Paid: ₹${paymentDetails?.amountPaid}\n` +
        `🔖 Booking ID: ${bookingId}\n\n` +
        `${appointmentType === 'teleconsultation'
            ? '🔗 Your video consultation link will be sent separately before the appointment.'
            : '📍 Please arrive 10 minutes early at Surekha Hospital.'
        }\n\n` +
        `Thank you for choosing Surekha Hospital! 🙏`
    );
};

// ─────────────────────────────────────────────
// RECEPTIONIST ALERT (after payment)
// ─────────────────────────────────────────────
const sendReceptionistAlert = async (booking) => {
    const { patientName, phone, doctorName, date, timeSlot, reason, appointmentType, bookingId, paymentDetails } = booking;
    const typeLabel = appointmentType === 'teleconsultation' ? 'TELECONSULTATION' : 'WALK-IN';

    const receptionistPhone = process.env.RECEPTIONIST_PHONE;
    if (!receptionistPhone) return;

    await sendReply(
        receptionistPhone,
        `🔔 *New ${typeLabel} Booking (WhatsApp)*\n\n` +
        `👤 Patient: ${patientName}\n` +
        `📞 Phone: ${phone}\n` +
        `👨‍⚕️ Doctor: ${doctorName}\n` +
        `📅 Date: ${date}\n` +
        `🕐 Time: ${timeSlot}\n` +
        `💬 Reason: ${reason || 'Not specified'}\n` +
        `💰 Paid: ₹${paymentDetails?.amountPaid}\n` +
        `🔖 Booking ID: ${bookingId}`
    );
};

module.exports = {
    sendReply,
    sendMainMenu,
    sendDoctorList,
    sendSlotList,
    sendPaymentLink,
    sendBookingConfirmation,
    sendReceptionistAlert,
};