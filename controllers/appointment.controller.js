const { sendWhatsApp } = require('../utils/whatsapp.util');

exports.webRequest = async (req, res) => {
    const { patientName, patientPhone, doctorName, date } = req.body;
    try {
        await sendWhatsApp(patientPhone, process.env.TEMP_PATIENT_ACK, [patientName, doctorName]);
        await sendWhatsApp(process.env.RECEPTIONIST_PHONE, process.env.TEMP_STAFF_ALERT, [patientName, patientPhone, doctorName, date]);
        res.status(200).json({ success: true, message: "Inquiry processed" });
    } catch (error) {
        res.status(400).json({ success: false, error: "Invalid Number or WhatsApp Error" });
    }
};

exports.confirmAppointment = async (req, res) => {
    const { patientName, patientPhone, doctorName, doctorPhone, date, time, reason } = req.body;
    try {
        await sendWhatsApp(patientPhone, process.env.TEMP_CONFIRM, [patientName, doctorName, date, time]);
        if (doctorPhone) {
            const bookingReason = reason || "Web Booking Confirmed";
            await sendWhatsApp(doctorPhone, process.env.TEMP_WALKIN_DOC, [doctorName, patientName, date, time, bookingReason]);
        }
        res.status(200).json({ success: true, message: "Confirmation sent to all" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.walkIn = async (req, res) => {
    const { doctorName, patientName, doctorPhone, date, time, reason } = req.body;
    try {
        await sendWhatsApp(doctorPhone, process.env.TEMP_WALKIN_DOC, [doctorName, patientName, date, time, reason]);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.sendPrescription = async (req, res) => {
    const { patientName, patientPhone, prescriptionLink } = req.body;
    try {
        await sendWhatsApp(patientPhone, process.env.TEMP_PRESCRIPTION, [patientName, prescriptionLink]);
        res.status(200).json({ success: true, message: "Prescription sent via WhatsApp" });
    } catch (error) {
        console.error("Prescription WhatsApp Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.sendTeleconsultationLinks = async (req, res) => {
    const { patientName, patientPhone, doctorName, doctorPhone, date, time, bookingId } = req.body;

    try {
        const channelName = `room-${bookingId}`;
        const baseUrl = "https://surekhahospitals.in";

        const doctorLink = `${baseUrl}/video-call/${channelName}?role=host`;
        const patientLink = `${baseUrl}/video-call/${channelName}?role=audience`;

        await sendWhatsApp(
            patientPhone,
            process.env.TEMP_TELE_PATIENT,
            [patientName, doctorName, date, time, patientLink]
        );

        // Send doctor their host link (if phone available)
        if (doctorPhone) {
            // Template variables: [doctorName, patientName, date, time, doctorLink]
            await sendWhatsApp(
                doctorPhone,
                process.env.TEMP_TELE_DOCTOR,
                [doctorName, patientName, date, time, doctorLink]
            );
        }

res.status(200).json({ 
    success: true, 
    message: "Teleconsultation links sent via WhatsApp",
    patientLink,   
    doctorLink,    
    roomId: channelName 
});    } catch (error) {
        console.error("Teleconsultation WhatsApp Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};