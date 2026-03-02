/**
 * WhatsApp Booking Bot — Conversation Handler
 *
 * Manages the full multi-step booking flow via in-memory session state.
 *
 * STATES:
 *   idle              → User says hi → show main menu
 *   awaiting_type     → User picks Walk-in / Tele / Info
 *   awaiting_doctor   → Showing doctor list, waiting for selection
 *   awaiting_name     → Collecting patient full name
 *   awaiting_date     → Collecting preferred date
 *   awaiting_slot     → Showing time slots, waiting for slot number
 *   awaiting_reason   → Collecting reason for visit
 *   awaiting_payment  → Payment link sent, waiting for Razorpay webhook
 */

const { getSession, setSession, clearSession } = require('../utils/session.store');
const { getActiveDoctors, getDoctorByName } = require('../utils/firebase.bot.util');
const { createPaymentLink } = require('../utils/razorpay.link.util');
const {
    sendReply,
    sendMainMenu,
    sendDoctorList,
    sendSlotList,
    sendPaymentLink,
} = require('../utils/whatsapp.bot.util');

// ─────────────────────────────────────────────
// ENTRY POINT — called from webhook.controller.js
// ─────────────────────────────────────────────
const handleMessage = async (sender, msgType, message) => {
    const session = getSession(sender) || { state: 'idle' };

    // ── TEXT MESSAGES ──────────────────────────────────────────────────────────
    if (msgType === 'text') {
        const text = message.text.body.trim();
        const lower = text.toLowerCase();

        // Always respond to greetings with the main menu
        if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'start' || lower === 'menu') {
            clearSession(sender);
            await sendMainMenu(sender);
            setSession(sender, { state: 'awaiting_type' });
            return;
        }

        // Cancel anytime
        if (lower === 'cancel' || lower === 'quit' || lower === 'exit') {
            clearSession(sender);
            await sendReply(sender, '❌ Booking cancelled. Type *Hi* to start again.');
            return;
        }

        // Route based on current state
        switch (session.state) {

            case 'awaiting_name':
                return await handleName(sender, text, session);

            case 'awaiting_date':
                return await handleDate(sender, text, session);

            case 'awaiting_slot':
                return await handleSlotSelection(sender, text, session);

            case 'awaiting_reason':
                return await handleReason(sender, text, session);

            case 'awaiting_payment':
                await sendReply(
                    sender,
                    '⏳ We\'re waiting for your payment to complete.\n\n' +
                    'Please tap the payment link we sent you.\n' +
                    'Type *cancel* to start over.'
                );
                return;

            default:
                // Unexpected text — show menu
                await sendMainMenu(sender);
                setSession(sender, { state: 'awaiting_type' });
        }
    }

    // ── INTERACTIVE — BUTTON REPLY ─────────────────────────────────────────────
    if (msgType === 'interactive' && message.interactive.type === 'button_reply') {
        const btnId = message.interactive.button_reply.id;
        return await handleButtonReply(sender, btnId, session);
    }

    // ── INTERACTIVE — LIST REPLY (doctor selection) ────────────────────────────
    if (msgType === 'interactive' && message.interactive.type === 'list_reply') {
        const listId = message.interactive.list_reply.id;
        return await handleListReply(sender, listId, session);
    }
};

// ─────────────────────────────────────────────
// BUTTON REPLIES — Main menu + back buttons
// ─────────────────────────────────────────────
const handleButtonReply = async (sender, btnId, session) => {
    if (btnId === 'btn_walkin') {
        await startDoctorSelection(sender, 'paid_appointment');
        return;
    }

    if (btnId === 'btn_tele') {
        await startDoctorSelection(sender, 'teleconsultation');
        return;
    }

    if (btnId === 'btn_info') {
        await sendReply(
            sender,
            '🏥 *Surekha Multi-Speciality Hospital*\n\n' +
            '🌐 Website: https://surekhahospitals.in\n' +
            '📅 Appointments: https://surekhahospitals.in/contact\n' +
            '📞 Call us: +91 90002 70564\n\n' +
            'Type *Hi* to go back to the main menu.'
        );
        clearSession(sender);
        return;
    }
};

// ─────────────────────────────────────────────
// STEP 1 — Show doctor list
// ─────────────────────────────────────────────
const startDoctorSelection = async (sender, appointmentType) => {
    await sendReply(sender, '⏳ Fetching our doctors...');

    const doctors = await getActiveDoctors();

    if (!doctors.length) {
        await sendReply(sender, '😔 No doctors available right now. Please call us: +91 90002 70564');
        clearSession(sender);
        return;
    }

    // Cache the doctor list in session to avoid re-fetching
    setSession(sender, {
        state: 'awaiting_doctor',
        appointmentType,
        doctors, // cache full doctor objects
    });

    await sendDoctorList(sender, doctors, appointmentType);
};

// ─────────────────────────────────────────────
// STEP 2 — Doctor selected from list
// ─────────────────────────────────────────────
const handleListReply = async (sender, listId, session) => {
    if (session.state !== 'awaiting_doctor') {
        await sendMainMenu(sender);
        setSession(sender, { state: 'awaiting_type' });
        return;
    }

    if (!listId.startsWith('doc_')) {
        await sendReply(sender, '⚠️ Please select a doctor from the list.');
        return;
    }

    const doctorId = listId.replace('doc_', '');
    const cachedDoctors = session.doctors || [];
    const selectedDoctor = cachedDoctors.find(d => d.id === doctorId);

    if (!selectedDoctor) {
        await sendReply(sender, '⚠️ Doctor not found. Please try again.');
        return;
    }

    const appointmentCost = parseInt(selectedDoctor.appointmentcost || 500);

    setSession(sender, {
        state: 'awaiting_name',
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        department: selectedDoctor.department || '',
        appointmentCost,
        schedule: selectedDoctor.schedule || [],
        // Clear doctor cache to save memory
        doctors: null,
    });

    await sendReply(
        sender,
        `✅ Great choice!\n\n` +
        `👨‍⚕️ *${selectedDoctor.name}*\n` +
        `🏥 ${selectedDoctor.department}\n` +
        `💰 Consultation fee: ₹${appointmentCost}\n\n` +
        `Please tell me your *full name* to proceed:`
    );
};

// ─────────────────────────────────────────────
// STEP 3 — Collect patient name
// ─────────────────────────────────────────────
const handleName = async (sender, text, session) => {
    if (text.length < 2) {
        await sendReply(sender, '⚠️ Please enter your full name.');
        return;
    }

    setSession(sender, { state: 'awaiting_date', patientName: text });

    await sendReply(
        sender,
        `👋 Hi *${text}*!\n\n` +
        `📅 What date would you like your appointment?\n\n` +
        `Please reply in the format: *DD-MM-YYYY*\n` +
        `_(Example: 15-03-2026)_`
    );
};

// ─────────────────────────────────────────────
// STEP 4 — Collect date & show slots
// ─────────────────────────────────────────────
const handleDate = async (sender, text, session) => {
    // Accept DD-MM-YYYY or DD/MM/YYYY
    const normalised = text.replace(/\//g, '-').trim();
    const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = normalised.match(dateRegex);

    if (!match) {
        await sendReply(sender, '⚠️ Invalid date format. Please use *DD-MM-YYYY* (e.g. 15-03-2026)');
        return;
    }

    const [, day, month, year] = match;
    const parsedDate = new Date(`${year}-${month}-${day}`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(parsedDate.getTime())) {
        await sendReply(sender, '⚠️ That doesn\'t look like a valid date. Please try again.');
        return;
    }

    if (parsedDate < today) {
        await sendReply(sender, '⚠️ Please choose a future date.');
        return;
    }

    // Get day of week to filter slots
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[parsedDate.getDay()];

    // Find slots for that day from doctor's schedule
    const schedule = session.schedule || [];
    const daySchedule = schedule.find(s => s.day === dayName);
    const availableSlots = daySchedule?.slots || [];

    // ISO format for storing
    const isoDate = `${year}-${month}-${day}`;

    if (!availableSlots.length) {
        await sendReply(
            sender,
            `😔 ${session.doctorName} is not available on ${dayName} (${normalised}).\n\n` +
            `Please choose another date:`
        );
        return;
    }

    setSession(sender, {
        state: 'awaiting_slot',
        date: isoDate,
        availableSlots,
    });

    await sendSlotList(sender, availableSlots, session.doctorName, normalised);
};

// ─────────────────────────────────────────────
// STEP 5 — Slot selection
// ─────────────────────────────────────────────
const handleSlotSelection = async (sender, text, session) => {
    const num = parseInt(text.trim());
    const slots = session.availableSlots || [];

    if (isNaN(num) || num < 1 || num > slots.length) {
        await sendReply(sender, `⚠️ Please reply with a number between 1 and ${slots.length}.`);
        return;
    }

    const chosenSlot = slots[num - 1];
    setSession(sender, { state: 'awaiting_reason', timeSlot: chosenSlot });

    await sendReply(
        sender,
        `✅ Slot selected: *${chosenSlot}*\n\n` +
        `📝 Briefly describe your *reason for the visit*:\n_(Or type "skip" to leave this blank)_`
    );
};

// ─────────────────────────────────────────────
// STEP 6 — Reason → Create Payment Link
// ─────────────────────────────────────────────
const handleReason = async (sender, text, session) => {
    const reason = text.toLowerCase() === 'skip' ? '' : text;

    setSession(sender, { state: 'awaiting_payment', reason });

    await sendReply(sender, '⏳ Creating your payment link...');

    try {
        const updatedSession = getSession(sender);

        const { shortUrl } = await createPaymentLink({
            phone: sender,
            patientName: updatedSession.patientName,
            doctorName: updatedSession.doctorName,
            doctorId: updatedSession.doctorId,
            department: updatedSession.department,
            date: updatedSession.date,
            timeSlot: updatedSession.timeSlot,
            reason: updatedSession.reason,
            amount: updatedSession.appointmentCost,
            appointmentType: updatedSession.appointmentType,
        });

        await sendPaymentLink(
            sender,
            shortUrl,
            updatedSession.patientName,
            updatedSession.doctorName,
            updatedSession.appointmentCost,
            updatedSession.appointmentType
        );

    } catch (err) {
        console.error('❌ Payment link creation failed:', err);
        await sendReply(
            sender,
            '😔 Something went wrong creating your payment link.\n' +
            'Please call us: *+91 90002 70564*\n\n' +
            'Type *Hi* to start over.'
        );
        clearSession(sender);
    }
};

module.exports = { handleMessage };