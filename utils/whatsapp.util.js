const axios = require('axios');

const sendWhatsApp = async (to, templateName, bodyParams = [], buttonParams = []) => {
    try {
        const url = `https://graph.facebook.com/v21.0/${process.env.META_PHONE_ID}/messages`;
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
        await axios.post(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_ID}/messages`, {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: text }
        }, { headers: { 'Authorization': `Bearer ${process.env.META_TOKEN}` } });
    } catch (e) { 
        console.error("Reply failed", e.message); 
    }
};

const sendMenu = async (to) => {
    try {
        await axios.post(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_ID}/messages`, {
            messaging_product: "whatsapp",
            to,
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
        }, { headers: { 'Authorization': `Bearer ${process.env.META_TOKEN}` } });
    } catch (e) { 
        console.error("Menu failed", e.response ? e.response.data : e.message); 
    }
};

module.exports = { sendWhatsApp, sendReply, sendMenu };