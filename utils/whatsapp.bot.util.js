const axios = require('axios');
const { logOutgoing } = require('./whatsapp.logger');

const WA_API = `https://graph.facebook.com/v25.0/${process.env.META_PHONE_ID}/messages`;
const HEADERS = { Authorization: `Bearer ${process.env.META_TOKEN}` };

// ─────────────────────────────────────────────
// SEND PLAIN TEXT REPLY
// ─────────────────────────────────────────────
const sendReply = async (to, text) => {
    try {
        await axios.post(WA_API, {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text },
        }, { headers: HEADERS });
        // Log outgoing message (non-blocking)
        logOutgoing(to, 'text', text.substring(0, 200));
    } catch (e) {
        console.error('❌ sendReply failed:', e.response?.data || e.message);
        logOutgoing(to, 'text', text.substring(0, 200), e);
    }
};

// ─────────────────────────────────────────────
// MAIN MENU (3 buttons)
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
        logOutgoing(to, 'interactive', '[Main Menu]');
    } catch (e) {
        console.error('❌ sendMainMenu failed:', e.response?.data || e.message);
        logOutgoing(to, 'interactive', '[Main Menu]', e);
    }
};

// ─────────────────────────────────────────────
// STEP 1 (only when >10 doctors) — Department list
// WhatsApp hard limit: max 10 rows total across all sections
// ─────────────────────────────────────────────
// Supports unlimited departments via pagination (9 per page + 1 "More" row)
const sendDepartmentList = async (to, allDeptNames, appointmentType, page = 0) => {
    const typeLabel = appointmentType === 'teleconsultation' ? 'Teleconsultation' : 'Walk-in';
    const PAGE_SIZE = 9; // reserve 1 row for "More" button
    const start = page * PAGE_SIZE;
    const pageItems = allDeptNames.slice(start, start + PAGE_SIZE);
    const hasMore = start + PAGE_SIZE < allDeptNames.length;
    const nextPage = page + 1;
    const totalPages = Math.ceil(allDeptNames.length / PAGE_SIZE);

    const rows = pageItems.map(dept => ({
        id: `dept_${dept}`,
        title: dept.substring(0, 24),
    }));

    // Add "More departments" row if there are more pages
    if (hasMore) {
        rows.push({
            id: `dept_page_${nextPage}`,
            title: '➡️ More departments',
            description: `Page ${nextPage + 1} of ${totalPages}`,
        });
    }

    try {
        await axios.post(WA_API, {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'list',
                body: {
                    text: `📋 *Select a Department for your ${typeLabel}*` +
                          (totalPages > 1 ? `\n\n_Page ${page + 1} of ${totalPages}_` : ''),
                },
                action: {
                    button: 'View Departments',
                    sections: [{ title: 'Departments', rows }],
                },
            },
        }, { headers: HEADERS });
        logOutgoing(to, 'interactive', `[Department List page=${page}]`);
    } catch (e) {
        console.error('❌ sendDepartmentList failed:', e.response?.data || e.message);
        logOutgoing(to, 'interactive', `[Department List page=${page}]`, e);
    }
};
// ─────────────────────────────────────────────
// STEP 2 — Doctor list (always ≤10 doctors passed in)
// ─────────────────────────────────────────────
const sendDoctorList = async (to, doctors, appointmentType) => {
    const typeLabel = appointmentType === 'teleconsultation' ? 'Teleconsultation' : 'Walk-in';
    try {
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
                    sections: [
                        {
                            title: 'Doctors',
                            rows: doctors.slice(0, 10).map(d => ({
                                id: `doc_${d.id}`,
                                title: d.name.substring(0, 24),
                                description: `${d.designation || ''} | ₹${d.appointmentcost || 500}`.substring(0, 72),
                            })),
                        },
                    ],
                },
            },
        }, { headers: HEADERS });
        logOutgoing(to, 'interactive', `[Doctor List count=${doctors.length}]`);
    } catch (e) {
        console.error('❌ sendDoctorList failed:', e.response?.data || e.message);
        logOutgoing(to, 'interactive', `[Doctor List count=${doctors.length}]`, e);
    }
};

// ─────────────────────────────────────────────
// TIME SLOTS — numbered text message
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
// BOOKING CONFIRMATION (after payment webhook)
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
// RECEPTIONIST ALERT (after payment webhook)
// Supports multiple receptionist phones via RECEPTIONIST_PHONE
// env var as a comma-separated list, e.g.:
//   RECEPTIONIST_PHONE=+919032323095,+916305700197
// ─────────────────────────────────────────────
const sendReceptionistAlert = async (booking) => {
    const { patientName, phone, doctorName, date, timeSlot, reason, appointmentType, bookingId, paymentDetails } = booking;
    const typeLabel = appointmentType === 'teleconsultation' ? 'TELECONSULTATION' : 'WALK-IN';

    const receptionistPhonesRaw = process.env.RECEPTIONIST_PHONE;
    if (!receptionistPhonesRaw) return;

    // Support comma-separated list of receptionist phones
    const receptionistPhones = receptionistPhonesRaw
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

    const alertText =
        `🔔 *New ${typeLabel} Booking (WhatsApp)*\n\n` +
        `👤 Patient: ${patientName}\n` +
        `📞 Phone: ${phone}\n` +
        `👨‍⚕️ Doctor: ${doctorName}\n` +
        `📅 Date: ${date}\n` +
        `🕐 Time: ${timeSlot}\n` +
        `💬 Reason: ${reason || 'Not specified'}\n` +
        `💰 Paid: ₹${paymentDetails?.amountPaid}\n` +
        `🔖 Booking ID: ${bookingId}`;

    for (const receptionistPhone of receptionistPhones) {
        await sendReply(receptionistPhone, alertText);
    }
};

module.exports = {
    sendReply,
    sendMainMenu,
    sendDepartmentList,   // ← new export
    sendDoctorList,
    sendSlotList,
    sendPaymentLink,
    sendBookingConfirmation,
    sendReceptionistAlert,
};