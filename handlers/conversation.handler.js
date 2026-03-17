const { getSession, setSession, clearSession } = require('../utils/session.store');
const { getActiveDoctors } = require('../utils/firebase.bot.util');
const { createPaymentLink } = require('../utils/razorpay.link.util');
const {
    sendReply,
    sendMainMenu,
    sendDepartmentList,   // ← new import
    sendDoctorList,
    sendSlotList,
    sendPaymentLink,
} = require('../utils/whatsapp.bot.util');

// ─────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────
const handleMessage = async (sender, msgType, message) => {
    const session = getSession(sender) || { state: 'idle' };

    if (msgType === 'text') {
        const text = message.text.body.trim();
        const lower = text.toLowerCase();

        if (['hi', 'hello', 'hey', 'start', 'menu'].includes(lower)) {
            clearSession(sender);
            await sendMainMenu(sender);
            setSession(sender, { state: 'awaiting_type' });
            return;
        }

        if (['cancel', 'quit', 'exit'].includes(lower)) {
            clearSession(sender);
            await sendReply(sender, '❌ Booking cancelled. Type *Hi* to start again.');
            return;
        }

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
                await sendMainMenu(sender);
                setSession(sender, { state: 'awaiting_type' });
        }
    }

    if (msgType === 'interactive' && message.interactive.type === 'button_reply') {
        const btnId = message.interactive.button_reply.id;
        return await handleButtonReply(sender, btnId, session);
    }

    if (msgType === 'interactive' && message.interactive.type === 'list_reply') {
        const listId = message.interactive.list_reply.id;
        return await handleListReply(sender, listId, session);
    }
};

// ─────────────────────────────────────────────
// BUTTON REPLIES — main menu
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
// STEP 1 — Fetch doctors, show dept list or doctor list
// ─────────────────────────────────────────────
const startDoctorSelection = async (sender, appointmentType) => {
    await sendReply(sender, '⏳ Fetching our doctors...');

    const doctors = await getActiveDoctors();

    if (!doctors.length) {
        await sendReply(sender, '😔 No doctors available right now. Please call us: +91 90002 70564');
        clearSession(sender);
        return;
    }

    // ≤10 doctors total — skip department step
    if (doctors.length <= 10) {
        setSession(sender, { state: 'awaiting_doctor', appointmentType, doctors });
        await sendDoctorList(sender, doctors, appointmentType);
        return;
    }

    // >10 doctors — group by department
    const deptMap = {};
    for (const doc of doctors) {
        const dept = doc.department || 'General';
        if (!deptMap[dept]) deptMap[dept] = [];
        deptMap[dept].push(doc);
    }

    const deptNames = Object.keys(deptMap).sort();

    setSession(sender, {
        state: 'awaiting_department',
        appointmentType,
        deptMap,
        allDeptNames: deptNames,
    });

    // Show first page of departments (max 9 + 1 "More" button)
    await sendDepartmentList(sender, deptNames, appointmentType, 0);
};
// ─────────────────────────────────────────────
// LIST REPLIES — routes to dept or doctor handler
// ─────────────────────────────────────────────
const handleListReply = async (sender, listId, session) => {

    // Route: department selected
    if (session.state === 'awaiting_department') {
        return await handleDepartmentReply(sender, listId, session);
    }

    // Route: doctor selected
    if (session.state === 'awaiting_doctor') {
        return await handleDoctorReply(sender, listId, session);
    }

    // Unexpected state — reset
    await sendMainMenu(sender);
    setSession(sender, { state: 'awaiting_type' });
};

// ─────────────────────────────────────────────
// STEP 1b — Department chosen → show doctors in that dept
// ─────────────────────────────────────────────
 const handleDepartmentReply = async (sender, listId, session) => {

    // User tapped "More departments → page N"
    if (listId.startsWith('dept_page_')) {
        const page = parseInt(listId.replace('dept_page_', ''));
        await sendDepartmentList(sender, session.allDeptNames, session.appointmentType, page);
        return;
    }

    if (!listId.startsWith('dept_')) {
        await sendReply(sender, '⚠️ Please select a department from the list.');
        return;
    }

    const deptName = listId.replace('dept_', '');
    const deptMap = session.deptMap || {};
    const doctors = deptMap[deptName];

    if (!doctors || !doctors.length) {
        await sendReply(sender, '⚠️ Department not found. Please try again.');
        return;
    }

    setSession(sender, {
        state: 'awaiting_doctor',
        appointmentType: session.appointmentType,
        doctors,
        deptMap: null,
        allDeptNames: null,
    });

    await sendDoctorList(sender, doctors, session.appointmentType);
};

// ─────────────────────────────────────────────
// STEP 2 — Doctor chosen → collect name
// ─────────────────────────────────────────────
const handleDoctorReply = async (sender, listId, session) => {
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
        doctors: null,  // free memory
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

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[parsedDate.getDay()];

    const schedule = session.schedule || [];
    const daySchedule = schedule.find(s => s.day === dayName);
    const availableSlots = daySchedule?.slots || [];
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
// STEP 6 — Reason → Create payment link
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