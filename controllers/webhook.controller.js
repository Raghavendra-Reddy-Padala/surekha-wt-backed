/**
 * webhook.controller.js — UPDATED
 *
 * Routes all incoming WhatsApp messages through the conversation handler.
 * Replace your existing webhook.controller.js with this.
 */

const { handleMessage } = require('../handlers/conversation.handler');

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
    // Respond to Meta immediately — must be fast!
    res.sendStatus(200);

    try {
        const body = req.body;

        if (!body.object) return;
        if (!body.entry?.[0]?.changes?.[0]?.value?.messages) return;

        const value = body.entry[0].changes[0].value;
        const message = value.messages[0];
        const sender = message.from; // WhatsApp number e.g. "919032323095"
        const msgType = message.type;

        console.log(`📨 Message from ${sender} | type: ${msgType}`);

        // Delegate to conversation handler
        await handleMessage(sender, msgType, message);

    } catch (err) {
        console.error('❌ Webhook processing error:', err);
    }
};