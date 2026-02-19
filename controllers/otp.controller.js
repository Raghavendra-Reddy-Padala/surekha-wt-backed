const { db, doc, getDoc, setDoc, deleteDoc } = require('../config/firebase');
const { sendWhatsApp } = require('../utils/whatsapp.util');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.sendOtp = async (req, res) => {
    const { phone, isResend = false } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    try {
        const docRef = doc(db, 'otp_requests', phone);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            let lastRequestTime = typeof data.createdAt === 'number' 
                ? data.createdAt 
                : data.createdAt?.toMillis?.() || 0;
            
            const timeSinceLastRequest = Date.now() - lastRequestTime;
            const cooldown = isResend ? 30000 : 60000;
            
            if (timeSinceLastRequest < cooldown) {
                const waitTime = Math.ceil((cooldown - timeSinceLastRequest) / 1000);
                return res.status(429).json({ 
                    success: false,
                    error: `Please wait ${waitTime} seconds before ${isResend ? 'resending' : 'requesting another OTP'}`,
                    waitTime
                });
            }
        }

        const code = generateOTP();
        const now = Date.now();
        await setDoc(docRef, {
            code,
            expiresAt: now + 5 * 60 * 1000,
            createdAt: now,
            resendCount: docSnap.exists() ? (docSnap.data().resendCount || 0) + 1 : 0,
            isResend
        });

        console.log(`🔐 OTP ${isResend ? 'RESENT' : 'SENT'} for ${phone}: ${code}`);
        await sendWhatsApp(phone, process.env.TEMP_OTP, [code], [code]);

        res.status(200).json({ success: true, message: isResend ? "OTP resent" : "OTP sent" });
    } catch (error) {
        console.error("OTP Error:", error);
        res.status(500).json({ success: false, error: "Failed to send OTP" });
    }
};

exports.verifyOtp = async (req, res) => {
    const { phone, userCode } = req.body;
    if (!phone || !userCode) {
        return res.status(400).json({ success: false, error: "Phone and code required" });
    }

    try {
        const docRef = doc(db, 'otp_requests', phone);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return res.status(400).json({ success: false, error: "No OTP found. Please request a new one." });
        }

        const data = docSnap.data();

        if (Date.now() > data.expiresAt) {
            await deleteDoc(docRef);
            return res.status(400).json({ success: false, error: "OTP expired. Please request a new one." });
        }

        if (data.code === userCode) {
            await deleteDoc(docRef);
            return res.status(200).json({ success: true, message: "Verified Successfully!" });
        } else {
            return res.status(400).json({ success: false, error: "Invalid code. Please try again." });
        }
    } catch (error) {
        console.error("Verify Error:", error);
        res.status(500).json({ success: false, error: "Verification failed" });
    }
};