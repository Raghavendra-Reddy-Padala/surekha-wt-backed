/**
 * Firebase helpers used by the WhatsApp bot.
 * Uses the same Client SDK already configured in your project.
 */

const { db, collection, doc, serverTimestamp } = require('../config/firebase');
const {
    getDocs,
    query,
    where,
    addDoc,
    setDoc,
} = require('firebase/firestore');

/**
 * Fetch all active doctors from Firestore.
 * Returns array of doctor objects with id attached.
 */
const getActiveDoctors = async () => {
    try {
        const q = query(
            collection(db, 'doctors'),
            where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error('❌ getActiveDoctors error:', err);
        return [];
    }
};

/**
 * Fetch a single doctor by their display name.
 * e.g. "Dr. Yanda Sireesha"
 */
const getDoctorByName = async (doctorName) => {
    try {
        // Name stored without "Dr." prefix in Firestore (e.g. "Yanda Sireesha")
        // but let's handle both cases gracefully
        const nameToQuery = doctorName.replace(/^Dr\.\s*/i, '').trim();
        const q = query(
            collection(db, 'doctors'),
            where('name', '==', nameToQuery)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            // Try with "Dr." prefix just in case
            const q2 = query(
                collection(db, 'doctors'),
                where('name', '==', `Dr. ${nameToQuery}`)
            );
            const snap2 = await getDocs(q2);
            if (snap2.empty) return null;
            return { id: snap2.docs[0].id, ...snap2.docs[0].data() };
        }
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (err) {
        console.error('❌ getDoctorByName error:', err);
        return null;
    }
};

/**
 * Save booking to all relevant Firestore collections.
 * Mirrors exactly what payment.controller.js does for web bookings.
 *
 * @param {Object} bookingData - Full booking details
 * @param {string} appointmentType - "paid_appointment" | "teleconsultation"
 * @returns {string} bookingId
 */
const saveBookingToFirestore = async (bookingData, appointmentType) => {
    const targetCollection =
        appointmentType === 'teleconsultation' ? 'teleconsultations' : 'paid_appointments';

    const fullData = {
        ...bookingData,
        status: 'confirmed',
        bookedVia: 'whatsapp',
        type: appointmentType,
        createdAt: serverTimestamp(),
    };

    // 1. Save to main collection (paid_appointments / teleconsultations)
    const apptRef = await addDoc(collection(db, targetCollection), fullData);
    const bookingId = apptRef.id;

    // 2. Save to user's subcollection
    const phone = bookingData.phone;
    if (phone) {
        await setDoc(
            doc(db, 'users', phone, targetCollection, bookingId),
            { ...fullData, bookingId }
        );
    }

    // 3. Save to doctor's subcollection
    const doctorId = bookingData.doctorId;
    if (doctorId) {
        await setDoc(
            doc(db, 'doctors', doctorId, targetCollection, bookingId),
            { ...fullData, bookingId, doctorId }
        );
    }

    console.log(`✅ Booking saved to ${targetCollection} with ID: ${bookingId}`);
    return bookingId;
};

module.exports = { getActiveDoctors, getDoctorByName, saveBookingToFirestore };