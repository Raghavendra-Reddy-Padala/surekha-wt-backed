/**
 * In-memory session store for WhatsApp conversation state.
 * Keyed by phone number. Sessions expire after 30 minutes of inactivity.
 */

const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get session for a phone number. Returns null if expired or not found.
 */
const getSession = (phone) => {
    const session = sessions.get(phone);
    if (!session) return null;

    const now = Date.now();
    if (now - session.lastActivity > SESSION_TTL_MS) {
        sessions.delete(phone);
        return null;
    }

    return session;
};

/**
 * Set or update session for a phone number.
 * Automatically refreshes lastActivity timestamp.
 */
const setSession = (phone, data) => {
    const existing = sessions.get(phone) || {};
    sessions.set(phone, {
        ...existing,
        ...data,
        lastActivity: Date.now(),
    });
};

/**
 * Delete session for a phone number (booking complete / cancel).
 */
const clearSession = (phone) => {
    sessions.delete(phone);
};

/**
 * Cleanup expired sessions — run periodically.
 */
const cleanupExpiredSessions = () => {
    const now = Date.now();
    for (const [phone, session] of sessions.entries()) {
        if (now - session.lastActivity > SESSION_TTL_MS) {
            sessions.delete(phone);
        }
    }
};

// Auto-cleanup every 10 minutes
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);

module.exports = { getSession, setSession, clearSession };