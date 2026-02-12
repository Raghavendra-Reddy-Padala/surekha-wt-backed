require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

const { 
    META_PHONE_ID, META_TOKEN, PORT, RECEPTIONIST_PHONE,
    TEMP_WALKIN_DOC, TEMP_PATIENT_ACK, TEMP_STAFF_ALERT, TEMP_CONFIRM 
} = process.env;

const MY_VERIFY_TOKEN = "hospital_secure_123";

const sendWhatsApp = async (to, templateName, params) => {
    try {
        const url = `https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`;
        
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




const sendReply = async (to, text) => {
    try {
        await axios.post(`https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`, {
            messaging_product: "whatsapp",
            to: to,
            type: "text",
            text: { body: text }
        }, { headers: { 'Authorization': `Bearer ${META_TOKEN}` } });
    } catch (e) { console.error("Reply failed", e.message); }
};

const sendMenu = async (to) => {
    try {
        await axios.post(`https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`, {
            messaging_product: "whatsapp",
            to: to,
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: "Welcome to Surekha Multi-Speciality Hospital! 🏥\nHow can we help you today?" },
                action: {
                    buttons: [
                        { type: "reply", reply: { id: "btn_book", title: "Book Appointment" } },
                        { type: "reply", reply: { id: "btn_doctors", title: "View Doctors" } },
                        { type: "reply", reply: { id: "btn_services", title: "Our Services" } }
                    ]
                }
            }
        }, { headers: { 'Authorization': `Bearer ${META_TOKEN}` } });
    } catch (e) { console.error("Menu failed", e.response ? e.response.data : e.message); }
};


app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Surekha API | Status</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f4f7f6; }
                    .card { background: white; padding: 2.5rem; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; border-top: 6px solid #28a745; max-width: 400px; }
                    h1 { color: #2c3e50; margin-bottom: 0.5rem; font-size: 1.8rem; }
                    .status-box { background: #e8f5e9; color: #2e7d32; padding: 8px 15px; border-radius: 20px; display: inline-block; font-weight: 600; margin: 15px 0; }
                    p { color: #7f8c8d; line-height: 1.6; }
                    .footer { margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1rem; color: #bdc3c7; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Surekha Hospital</h1>
                    <div class="status-box">● API ONLINE</div>
                    <p>The backend engine is running perfectly and ready to handle hospital inquiries.</p>
                    <div class="footer">Secure Meta Webhook Node</div>
                </div>
            </body>
        </html>
    `);
});

// API 1: WEB REQUEST 
// Triggered by: Contact.js (Website)
+app.post('/web-request', async (req, res) => {
    const { patientName, patientPhone, doctorName, date } = req.body;
    console.log(`🌍 Web Request: ${patientName} -> Dr. ${doctorName}`);

    try {
     
        await sendWhatsApp(patientPhone, TEMP_PATIENT_ACK, [patientName, doctorName]);
        
        console.log("✅ Patient Number is Real! (Message delivered)");

        
        await sendWhatsApp(RECEPTIONIST_PHONE, TEMP_STAFF_ALERT, [patientName, patientPhone, doctorName, date]);

        res.status(200).json({ success: true, message: "Inquiry processed" });

    } catch (error) {
        console.log("⛔ SPAM BLOCKED: Could not message patient, so NOT alerting staff.");
        res.status(400).json({ success: false, error: "Invalid Number or WhatsApp Error" });
    }
});



// API 2: CONFIRM APPOINTMENT 
// Triggered by: Admin Panel "Confirm" Button
app.post('/confirm-appointment', async (req, res) => {
    const { patientName, patientPhone, doctorName, doctorPhone, date, time, reason } = req.body;
    
    console.log(`👍 Confirming: ${patientName} with Dr. ${doctorName}`);

    try {

        await sendWhatsApp(patientPhone, TEMP_CONFIRM, [patientName, doctorName, date, time]);

 
        if (doctorPhone) {
            const bookingReason = reason || "Web Booking Confirmed";
            
            await sendWhatsApp(doctorPhone, TEMP_WALKIN_DOC, [doctorName,patientName, date, time, bookingReason]);
        }

        res.status(200).json({ success: true, message: "Confirmation sent to all" });
    } catch (error) {
        console.error("Confirmation Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API 3: WALK-IN 
// Triggered by: Admin Panel "Walk-in" Form
app.post('/walk-in', async (req, res) => {
    const {doctorName, patientName, doctorPhone, date, time, reason } = req.body;
    
    try {
        await sendWhatsApp(doctorPhone, TEMP_WALKIN_DOC, [doctorName,patientName, date, time, reason]);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🆕 NEW: WEBHOOK VERIFICATION (Meta calls this to check if you exist)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('🔔 META VERIFICATION ATTEMPT:');
    console.log(`   Mode: ${mode}`);
    console.log(`   Token Received: ${token}`);
    console.log(`   Expected Token: ${MY_VERIFY_TOKEN}`);

    if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
        console.log("✅ ✅ ✅ WEBHOOK VERIFIED! META CONNECTED SUCCESSFULLY! ✅ ✅ ✅");
        console.log(`   Challenge: ${challenge}`);
        res.status(200).send(challenge);
    } else {
        console.log("❌ VERIFICATION FAILED - Token mismatch or wrong mode");
        res.sendStatus(403);
    }
});

app.post('/webhook', async (req, res) => {
    console.log('🔥 WEBHOOK POST RECEIVED!');
    console.log('📦 Full Body:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;

    if (body.object) {
        console.log('✅ Object exists:', body.object);
        
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const message = body.entry[0].changes[0].value.messages[0];
            const sender = message.from;
            const msgType = message.type;

            console.log(`📩 Incoming from ${sender}: ${msgType}`);

            if (msgType === 'text') {
                const text = message.text.body.toLowerCase();
                console.log(`💬 Text message: "${text}"`);
                
                if (text.includes('hi') || text.includes('hello')) {
                    console.log('🎯 Sending menu...');
                    await sendMenu(sender);
                } else {
                    console.log('📝 Sending instruction...');
                    await sendReply(sender, "Please type 'Hi' to see the main menu.");
                }
            }

            if (msgType === 'interactive' && message.interactive.type === 'button_reply') {
                const btnId = message.interactive.button_reply.id;
                console.log(`🔘 Button clicked: ${btnId}`);

                if (btnId === 'btn_book') {
                    await sendReply(sender, "📅 To book an appointment, please visit our website: https://surekhahospitals.in/contact");
                } 
                else if (btnId === 'btn_doctors') {
                    await sendReply(sender, "👨‍⚕️ Meet our specialists here: https://surekhahospitals.in/doctors");
                } 
                else if (btnId === 'btn_services') {
                    await sendReply(sender, "🏥 We offer Cardiology, Pediatrics, and more. Details: https://surekhahospitals.in/services");
                }
            }
        } else {
            console.log('⚠️ No messages in webhook data');
        }
        res.sendStatus(200);
    } else {
        console.log('❌ No object in body');
        res.sendStatus(404);
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Hospital Engine v2.0 running on port ${PORT}`);
});