const { sendMenu, sendReply } = require('../utils/whatsapp.util');
const MY_VERIFY_TOKEN = "hospital_secure_123";

exports.verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
        console.log("✅ WEBHOOK VERIFIED!");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
};

exports.handleWebhook = async (req, res) => {
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
                if (btnId === 'btn_book') await sendReply(sender, "📅 To book: https://surekhahospitals.in/contact");
                else if (btnId === 'btn_doctors') await sendReply(sender, "👨‍⚕️ Doctors: https://surekhahospitals.in/doctors");
                else if (btnId === 'btn_services') await sendReply(sender, "🏥 Services: https://surekhahospitals.in/services");
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
};