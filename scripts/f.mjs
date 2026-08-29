/**
 * One-time script: add Hima Bindu's WhatsApp booking to website_appointments
 * so it appears in the admin panel.
 *
 * Run: node scripts/migrate_hima_bindu.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

// ── Init Firebase Admin ──────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── The booking to migrate ───────────────────────────────────────────────────
const BOOKING_ID = 'x5eJaCweHtiR8cYHXrao'; // existing ID in paid_appointments

const bookingData = {
    bookedVia:   'whatsapp',
    createdAt:   new Date('2026-08-28T17:19:25.000Z'), // original timestamp
    date:        '2026-08-29',
    department:  'Obstetrics & Gynaecology',
    doctorId:    'sOSk3Hr3ThIkZbAzzu87',
    doctorName:  'Dr. Surekha Mamidi',
    email:       '',
    patientName: 'Hima Bindu',
    paymentDetails: {
        amountPaid:    350,
        currency:      'INR',
        orderId:       'plink_TVGiw63Q5x7dJB',
        paidAt:        '2026-08-28T17:19:24.890Z',
        paymentId:     'pay_TVGmPu2ys4XNE4',
        paymentMethod: 'upi',
        paymentStatus: 'captured',
    },
    phone:      '917989561517',
    reason:     'I have PVOD and Thyroid Recently tests were done again as a package I want to start medication too for same Im using 125 mcg thyronorm tablets now since 3 months',
    status:     'confirmed',
    timeSlot:   '10:00 AM',
    type:       'paid_appointment',
    bookingId:  BOOKING_ID,
};

async function run() {
    try {
        // Save to website_appointments with the same ID so it doesn't duplicate
        await db.collection('website_appointments').doc(BOOKING_ID).set(bookingData);
        console.log(`✅ Booking ${BOOKING_ID} added to website_appointments`);
        console.log(`   Patient: ${bookingData.patientName} | Doctor: ${bookingData.doctorName}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

run();
