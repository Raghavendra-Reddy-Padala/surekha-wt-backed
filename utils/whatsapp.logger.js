/**
 * whatsapp.logger.js
 *
 * Saves every WhatsApp event (incoming / outgoing / error) to Firestore
 * so the admin panel can display full conversation history without
 * needing server logs.
 *
 * Collection: `whatsapp_logs`
 * Structure:
 *   {
 *     phone:       string,          // e.g. "917989561517"
 *     direction:   "in" | "out",
 *     type:        string,          // "text" | "interactive" | "template" | "error" | ...
 *     content:     string,          // message body or template name
 *     status:      "ok" | "error",
 *     errorMsg:    string | null,
 *     createdAt:   serverTimestamp
 *   }
 */

const { db, collection, serverTimestamp } = require('../config/firebase');
const { addDoc } = require('firebase/firestore');

/**
 * Log an event to whatsapp_logs.
 * Fire-and-forget — never throws, never blocks the main flow.
 */
const logWhatsApp = async ({
    phone,
    direction,   // "in" | "out"
    type,        // "text" | "interactive" | "template" | "otp" | "error" | ...
    content,     // message body, template name, or error summary
    status = 'ok',
    errorMsg = null,
}) => {
    try {
        await addDoc(collection(db, 'whatsapp_logs'), {
            phone: String(phone || ''),
            direction: direction || 'out',
            type: type || 'text',
            content: String(content || '').substring(0, 1000), // cap at 1000 chars
            status,
            errorMsg: errorMsg ? String(errorMsg).substring(0, 500) : null,
            createdAt: serverTimestamp(),
        });
    } catch (err) {
        // Never let logging break the main flow
        console.warn('⚠️ WhatsApp log write failed:', err.message);
    }
};

/**
 * Convenience: log an incoming WhatsApp message.
 */
const logIncoming = (phone, type, content = '') =>
    logWhatsApp({ phone, direction: 'in', type, content, status: 'ok' });

/**
 * Convenience: log an outgoing WhatsApp message (text or template).
 */
const logOutgoing = (phone, type, content, err = null) =>
    logWhatsApp({
        phone,
        direction: 'out',
        type,
        content,
        status: err ? 'error' : 'ok',
        errorMsg: err ? err.message || String(err) : null,
    });

module.exports = { logWhatsApp, logIncoming, logOutgoing };
