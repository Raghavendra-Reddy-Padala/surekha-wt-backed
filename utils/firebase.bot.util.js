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
 * e.g. "Dr. Yanda Sireesha" (stored as-is in Firestore)
 */
const getDoctorByName = async (doctorName) => {
    try {
        // Name stored WITH "Dr." prefix in Firestore e.g. "Dr. Yanda Sireesha"
        const q = query(
            collection(db, 'doctors'),
            where('name', '==', doctorName)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
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
 * Also saves to `website_appointments` so the admin panel always shows
 * WhatsApp bookings alongside web bookings (with bookedVia: 'whatsapp').
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

    // 2. Also save to website_appointments so the admin panel shows WhatsApp bookings
    //    alongside web bookings (bookedVia: 'whatsapp' helps staff distinguish them)
    try {
        await setDoc(
            doc(db, 'website_appointments', bookingId),
            { ...fullData, bookingId }
        );
        console.log(`✅ Booking mirrored to website_appointments with ID: ${bookingId}`);
    } catch (mirrorErr) {
        console.warn('⚠️ Could not mirror booking to website_appointments:', mirrorErr.message);
    }

    // 3. Save to user's subcollection
    const phone = bookingData.phone;
    if (phone) {
        await setDoc(
            doc(db, 'users', phone, targetCollection, bookingId),
            { ...fullData, bookingId }
        );
    }

    // 4. Save to doctor's subcollection
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