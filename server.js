require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

// Load env variables
const { 
    META_PHONE_ID, META_TOKEN, PORT, RECEPTIONIST_PHONE,
    TEMP_WALKIN_DOC, TEMP_PATIENT_ACK, TEMP_STAFF_ALERT, TEMP_CONFIRM 
} = process.env;

// --- HELPER: The "Send Message" Function ---
// We write this once so we don't repeat code 100 times
const sendWhatsApp = async (to, templateName, params) => {
    try {
        const url = `https://graph.facebook.com/v17.0/${META_PHONE_ID}/messages`;
        
        // Convert array of params ['Raju', '10AM'] into Meta format
        const components = [{
            type: "body",
            parameters: params.map(p => ({ type: "text", text: String(p) }))
        }];

        await axios.post(url, {
            messaging_product: "whatsapp",
            to: to,
            type: "template",
            template: {
                name: templateName,
                language: { code: "en" }, // standard "en" (or "en_US" if you selected that)
                components: components
            }
        }, {
            headers: { 'Authorization': `Bearer ${META_TOKEN}` }
        });
        return true;
    } catch (error) {
        console.error(`❌ Failed to send to ${to}:`, error.response ? error.response.data : error.message);
        throw new Error("WhatsApp Send Failed");
    }
};

// =================================================================
// API 1: WEB REQUEST (The "Spam Filter" Gatekeeper)
// Triggered by: Contact.js (Website)
// =================================================================
app.post('/web-request', async (req, res) => {
    const { patientName, patientPhone, doctorName, date } = req.body;
    console.log(`🌍 Web Request: ${patientName} -> Dr. ${doctorName}`);

    try {
        // STEP 1: Try to message the PATIENT first
        // Template: "Hi {1}, received request for {2}..."
        await sendWhatsApp(patientPhone, TEMP_PATIENT_ACK, [patientName, doctorName]);
        
        console.log("✅ Patient Number is Real! (Message delivered)");

        // STEP 2: If Step 1 didn't crash, message the RECEPTIONIST
        // Template: "Patient {1} ({2}) wants Dr {3} on {4}"
        await sendWhatsApp(RECEPTIONIST_PHONE, TEMP_STAFF_ALERT, [patientName, patientPhone, doctorName, date]);

        res.status(200).json({ success: true, message: "Inquiry processed" });

    } catch (error) {
        console.log("⛔ SPAM BLOCKED: Could not message patient, so NOT alerting staff.");
        res.status(400).json({ success: false, error: "Invalid Number or WhatsApp Error" });
    }
});

// =================================================================
// API 2: CONFIRM APPOINTMENT (The "Sync")
// Triggered by: Admin Panel "Confirm" Button
// =================================================================
// app.post('/confirm-appointment', async (req, res) => {
//     const { patientName, patientPhone, doctorName, doctorPhone, date, time } = req.body;
//     console.log(`👍 Confirming: ${patientName} with Dr. ${doctorName}`);

//     try {
//         // 1. Notify PATIENT
//         // Template: "Hi {1}, slot with {2} confirmed for {3} at {4}"
//         await sendWhatsApp(patientPhone, TEMP_CONFIRM, [patientName, doctorName, date, time]);

//         // 2. Notify DOCTOR
//         // Reuse same template or create specific one. Here sending same data structure:
//         // "Hi Dr {1}, slot with {2} confirmed for {3} at {4}"
//         // Note: You might want a specific template for doctors, but this works for now.
//         if (doctorPhone) {
//             await sendWhatsApp(doctorPhone, TEMP_CONFIRM, [`Dr. ${doctorName}`, `Patient ${patientName}`, date, time]);
//         }

//         res.status(200).json({ success: true, message: "Confirmation sent to all" });
//     } catch (error) {
//         res.status(500).json({ success: false, error: error.message });
//     }
// });

// =================================================================
// API 2: CONFIRM APPOINTMENT (The "Sync")
// Triggered by: Admin Panel "Confirm" Button
// =================================================================
app.post('/confirm-appointment', async (req, res) => {
    // We need 'reason' for the Doctor's template (e.g., "Web Booking Confirmed")
    const { patientName, patientPhone, doctorName, doctorPhone, date, time, reason } = req.body;
    
    console.log(`👍 Confirming: ${patientName} with Dr. ${doctorName}`);

    try {
        // 1. Notify PATIENT (Use the NEW template)
        // Template: appointment_confirmed 
        // "Hello {{1}}, your slot with Dr. {{2}} is confirmed for {{3}} at {{4}}."
        await sendWhatsApp(patientPhone, TEMP_CONFIRM, [patientName, doctorName, date, time]);

        // 2. Notify DOCTOR (Use the OLD template)
        // Template: new_appointment_alert (The one you already made)
        // "Patient: {{1}}, Date: {{2}}, Time: {{3}}, Reason: {{4}}"
        if (doctorPhone) {
            // If we don't have a specific reason, use a default string
            const bookingReason = reason || "Web Booking Confirmed";
            
            await sendWhatsApp(doctorPhone, TEMP_WALKIN_DOC, [patientName, date, time, bookingReason]);
        }

        res.status(200).json({ success: true, message: "Confirmation sent to all" });
    } catch (error) {
        console.error("Confirmation Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================================================================
// API 3: WALK-IN (The "Direct Line")
// Triggered by: Admin Panel "Walk-in" Form
// =================================================================
app.post('/walk-in', async (req, res) => {
    const { patientName, doctorPhone, date, time, reason } = req.body;
    
    // This is your ORIGINAL logic, direct to doctor
    try {
        await sendWhatsApp(doctorPhone, TEMP_WALKIN_DOC, [patientName, date, time, reason]);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Hospital Engine v2.0 running on port ${PORT}`);
});