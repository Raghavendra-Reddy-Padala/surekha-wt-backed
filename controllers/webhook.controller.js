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
    console.log("🚨 WEBHOOK KNOCK! Payload:", JSON.stringify(req.body, null, 2));
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
           // Inside webhook.controller.js

if (msgType === 'interactive' && message.interactive.type === 'button_reply') {
    const btnId = message.interactive.button_reply.id;
    
    if (btnId === 'btn_walkin') {
        await sendReply(sender, "📅 To book a physical visit: https://surekhahospitals.in/contact");
    } 
    else if (btnId === 'btn_tele') {
        await sendReply(sender, "💻 To book a video call: https://surekhahospitals.in/teleconsult");
    } 
    else if (btnId === 'btn_info') {
        await sendInfoLinks(sender); // <-- Uses your new util function!
    }
}
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
};