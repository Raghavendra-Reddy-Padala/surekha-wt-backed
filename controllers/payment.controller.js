const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const { db, serverTimestamp } = require('../config/firebase');
const { getDocs, collection, query, where, addDoc, setDoc, doc: firestoreDoc } = require('firebase/firestore');
const { sendWhatsApp } = require('../utils/whatsapp.util');

exports.createOrder = async (req, res) => {
    const { doctorName, patientPhone, patientName } = req.body;

    if (!doctorName || !patientPhone) {
        return res.status(400).json({ success: false, error: "Doctor name and patient phone required" });
    }

    try {
        const doctorsSnap = await getDocs(query(collection(db, "doctors"), where("name", "==", doctorName)));
        let appointmentCost = 500; 

        if (!doctorsSnap.empty) {
            const doctorData = doctorsSnap.docs[0].data();
            appointmentCost = parseInt(doctorData.appointmentCost || doctorData.appointmentcost || 500);
        }

        const amountInPaise = appointmentCost * 100;
        const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `appt_${Date.now()}`,
            notes: { doctorName, patientPhone, patientName: patientName || "" }
        });

        console.log(`💳 Razorpay order created: ${order.id} for ₹${appointmentCost}`);
        res.status(200).json({
            success: true, orderId: order.id, amount: amountInPaise, 
            amountDisplay: appointmentCost, currency: "INR", 
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error("Create Order Error:", error);
        res.status(500).json({ success: false, error: "Failed to create payment order" });
    }
};

exports.verifyPayment = async (req, res) => {
    const {
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        patientName, patientPhone, email, doctorName, date, timeSlot, department, reason
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, error: "Payment details missing" });
    }

    try {
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.error("❌ Payment signature mismatch! Possible tampering.");
            return res.status(400).json({ success: false, error: "Payment verification failed. Invalid signature." });
        }

        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        const amountPaid = payment.amount / 100; 

        const appointmentData = {
            patientName, phone: patientPhone, email: email || "",
            doctorName, date, timeSlot: timeSlot || "", department: department || "",
            reason: reason || "", status: "confirmed", bookedVia: "web",
            payment: {
                orderId: razorpay_order_id, paymentId: razorpay_payment_id,
                amount: amountPaid, status: "paid", paidAt: new Date().toISOString(),
            },
            createdAt: serverTimestamp(),
        };

        const apptRef = await addDoc(collection(db, "appointments"), appointmentData);
        const appointmentId = apptRef.id;

        if (patientPhone) {
            await setDoc(firestoreDoc(db, "users", patientPhone, "appointments", appointmentId), { ...appointmentData, appointmentId });
        }

        try {
            const doctorsSnap = await getDocs(query(collection(db, "doctors"), where("name", "==", doctorName)));
            if (!doctorsSnap.empty) {
                const doctorId = doctorsSnap.docs[0].id;
                await setDoc(firestoreDoc(db, "doctors", doctorId, "appointments", appointmentId), { ...appointmentData, appointmentId, doctorId });
            }
        } catch (err) { console.warn("Doctor subcollection write failed:", err); }

        try {
            await sendWhatsApp(patientPhone, process.env.TEMP_PATIENT_ACK, [patientName, doctorName]);
            await sendWhatsApp(process.env.RECEPTIONIST_PHONE, process.env.TEMP_STAFF_ALERT, [patientName, patientPhone, doctorName, date]);
        } catch (waErr) { console.warn("WhatsApp failed but payment was successful:", waErr.message); }

        res.status(200).json({ success: true, appointmentId, message: "Payment verified and appointment booked!" });
    } catch (error) {
        console.error("Verify Payment Error:", error);
        res.status(500).json({ success: false, error: "Payment verification failed" });
    }
};