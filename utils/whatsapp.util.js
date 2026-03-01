const axios = require('axios');

const sendWhatsApp = async (to, templateName, bodyParams = [], buttonParams = []) => {
    try {
        const url = `https://graph.facebook.com/v25.0/${process.env.META_PHONE_ID}/messages`;
        const components = [
            {
                type: "body",
                parameters: bodyParams.map(p => ({ type: "text", text: String(p) }))
            }
        ];
        if (buttonParams.length > 0) {
            components.push({
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: buttonParams.map(p => ({ type: "text", text: String(p) }))
            });
        }
        await axios.post(url, {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: { name: templateName, language: { code: "en" }, components }
        }, { headers: { Authorization: `Bearer ${process.env.META_TOKEN}` } });
        return true;
    } catch (error) {
        console.error("WhatsApp Send Failed:", error.response ? error.response.data : error.message);
        throw new Error("WhatsApp Send Failed");
    }
};

const sendReply = async (to, text) => {
    try {
        const res = await axios.post(`https://graph.facebook.com/v25.0/${process.env.META_PHONE_ID}/messages`, {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: text }
        }, { headers: { 'Authorization': `Bearer ${process.env.META_TOKEN}` } });
        console.log("✅ Reply sent to", to);
        return res.data;
    } catch (e) {
        console.error("❌ Reply failed:", e.response ? JSON.stringify(e.response.data) : e.message);
    }
};

const sendMenu = async (to) => {
    try {
        const res = await axios.post(`https://graph.facebook.com/v25.0/${process.env.META_PHONE_ID}/messages`, {
            messaging_product: "whatsapp",
            to,
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: "Welcome to Surekha Multi-Speciality Hospital! 🏥\nHow can we help you today?" },
                action: {
                    buttons: [
                        { type: "reply", reply: { id: "btn_walkin", title: "Walk-in Appointment" } },
                        { type: "reply", reply: { id: "btn_tele", title: "Teleconsultation" } },
                        { type: "reply", reply: { id: "btn_info", title: "Hospital Info" } }
                    ]
                }
            }
        }, { headers: { 'Authorization': `Bearer ${process.env.META_TOKEN}` } });
        console.log("✅ Menu sent to", to);
        return res.data;
    } catch (e) {
        console.error("❌ Menu failed:", e.response ? JSON.stringify(e.response.data) : e.message);
    }
};

const sendInfoLinks = async (to) => {
    try {
        const res = await axios.post(`https://graph.facebook.com/v25.0/${process.env.META_PHONE_ID}/messages`, {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: {
                body: "🏥 *Surekha Multi-Speciality Hospital*\n\n" +
                      "🌐 Website: https://surekhahospitals.in\n" +
                      "📅 Appointments: https://surekhahospitals.in/appointment\n" +
                      "📞 Call us: +91 90002 70564\n\n" +
                      "Type *Hi* to go back to the main menu."
            }
        }, { headers: { 'Authorization': `Bearer ${process.env.META_TOKEN}` } });
        console.log("✅ Info links sent to", to);
        return res.data;
    } catch (e) {
        console.error("❌ Info links failed:", e.response ? JSON.stringify(e.response.data) : e.message);
    }
};

module.exports = { sendWhatsApp, sendReply, sendMenu, sendInfoLinks };