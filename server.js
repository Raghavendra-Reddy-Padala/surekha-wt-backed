require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { db, doc, getDoc, setDoc, deleteDoc, serverTimestamp } = require('./firebase');

const app = express();
app.use(express.json());
app.use(cors());

const { 
    META_PHONE_ID, META_TOKEN, PORT, RECEPTIONIST_PHONE,
    TEMP_WALKIN_DOC, TEMP_PATIENT_ACK, TEMP_STAFF_ALERT, TEMP_CONFIRM, TEMP_OTP
} = process.env;

const MY_VERIFY_TOKEN = "hospital_secure_123";

// Helper: Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// WHATSAPP FUNCTIONS
const sendWhatsApp = async (to, templateName, bodyParams = [], buttonParams = []) => {
    try {
        const url = `https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`;

        const components = [
            {
                type: "body",
                parameters: bodyParams.map(p => ({
                    type: "text",
                    text: String(p)
                }))
            }
        ];

        if (buttonParams.length > 0) {
            components.push({
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: buttonParams.map(p => ({
                    type: "text",
                    text: String(p)
                }))
            });
        }

        await axios.post(url, {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
                name: templateName,
                language: { code: "en" },
                components
            }
        }, {
            headers: { Authorization: `Bearer ${META_TOKEN}` }
        });

        return true;

    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
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

// OTP APIs - FIRESTORE CLIENT SDK VERSION

app.post('/send-otp', async (req, res) => {
    const { phone, isResend = false } = req.body;
    
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    try {
        const docRef = doc(db, 'otp_requests', phone);
        const docSnap = await getDoc(docRef);

        // RATE LIMITING
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            let lastRequestTime = 0;
            if (data.createdAt) {
                if (typeof data.createdAt === 'number') {
                    lastRequestTime = data.createdAt;
                } else if (data.createdAt.toMillis) {
                    lastRequestTime = data.createdAt.toMillis();
                }
            }
            
            const timeSinceLastRequest = Date.now() - lastRequestTime;
            const cooldown = isResend ? 30000 : 60000;
            
            if (timeSinceLastRequest < cooldown) {
                const waitTime = Math.ceil((cooldown - timeSinceLastRequest) / 1000);
                return res.status(429).json({ 
                    success: false,
                    error: `Please wait ${waitTime} seconds before ${isResend ? 'resending' : 'requesting another OTP'}`,
                    waitTime: waitTime
                });
            }
        }

        const code = generateOTP();
        const now = Date.now();
        const expiresAt = now + 5 * 60 * 1000;

        // STORE IN FIRESTORE - Use Date.now() as NUMBER
        await setDoc(docRef, {
            code: code,
            expiresAt: expiresAt,
            createdAt: now,  // Store as number (milliseconds)
            resendCount: docSnap.exists() ? (docSnap.data().resendCount || 0) + 1 : 0,
            isResend: isResend
        });

        console.log(`🔐 OTP ${isResend ? 'RESENT' : 'SENT'} for ${phone}: ${code}`);

await sendWhatsApp(phone, TEMP_OTP, [code], [code]);
        
        res.status(200).json({ 
            success: true, 
            message: isResend ? "OTP resent successfully" : "OTP sent securely"
        });
        
    } catch (error) {
        console.error("OTP Error:", error);
        res.status(500).json({ success: false, error: "Failed to send OTP" });
    }
});

app.post('/verify-otp', async (req, res) => {
    const { phone, userCode } = req.body;

    if (!phone || !userCode) {
        return res.status(400).json({ success: false, error: "Phone and code required" });
    }

    try {
        const docRef = doc(db, 'otp_requests', phone);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return res.status(400).json({ 
                success: false, 
                error: "No OTP found. Please request a new one." 
            });
        }

        const data = docSnap.data();

        if (Date.now() > data.expiresAt) {
            await deleteDoc(docRef);
            return res.status(400).json({ 
                success: false, 
                error: "OTP expired. Please request a new one." 
            });
        }

        if (data.code === userCode) {
            await deleteDoc(docRef);
            return res.status(200).json({ 
                success: true, 
                message: "Verified Successfully!" 
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid code. Please try again." 
            });
        }
        
    } catch (error) {
        console.error("Verify Error:", error);
        res.status(500).json({ success: false, error: "Verification failed" });
    }
});


//  APIs

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

//for keping request - users

app.post('/web-request', async (req, res) => {
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

//for confirming appointment - recepionist 
app.post('/confirm-appointment', async (req, res) => {
    const { patientName, patientPhone, doctorName, doctorPhone, date, time, reason } = req.body;
    console.log(`👍 Confirming: ${patientName} with Dr. ${doctorName}`);

    try {
        await sendWhatsApp(patientPhone, TEMP_CONFIRM, [patientName, doctorName, date, time]);
        if (doctorPhone) {
            const bookingReason = reason || "Web Booking Confirmed";
            await sendWhatsApp(doctorPhone, TEMP_WALKIN_DOC, [doctorName, patientName, date, time, bookingReason]);
        }
        res.status(200).json({ success: true, message: "Confirmation sent to all" });
    } catch (error) {
        console.error("Confirmation Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
// direct walk in 

app.post('/walk-in', async (req, res) => {
    const { doctorName, patientName, doctorPhone, date, time, reason } = req.body;
    
    try {
        await sendWhatsApp(doctorPhone, TEMP_WALKIN_DOC, [doctorName, patientName, date, time, reason]);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
        console.log("✅ WEBHOOK VERIFIED!");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object) {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const message = body.entry[0].changes[0].value.messages[0];
            const sender = message.from;
            const msgType = message.type;

            if (msgType === 'text') {
                const text = message.text.body.toLowerCase();
                if (text.includes('hi') || text.includes('hello')) {
                    await sendMenu(sender);
                } else {
                    await sendReply(sender, "Please type 'Hi' to see the main menu.");
                }
            }

            if (msgType === 'interactive' && message.interactive.type === 'button_reply') {
                const btnId = message.interactive.button_reply.id;
                if (btnId === 'btn_book') {
                    await sendReply(sender, "📅 To book: https://surekhahospitals.in/contact");
                } else if (btnId === 'btn_doctors') {
                    await sendReply(sender, "👨‍⚕️ Doctors: https://surekhahospitals.in/doctors");
                } else if (btnId === 'btn_services') {
                    await sendReply(sender, "🏥 Services: https://surekhahospitals.in/services");
                }
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Hospital Engine v2.0 running on port ${PORT}`);
    console.log(`✅ Firebase Client SDK initialized`);
});
