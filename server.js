require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const otpRoutes = require('./routes/otp.routes');
const paymentRoutes = require('./routes/payment.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const webhookRoutes = require('./routes/webhook.routes');
const agoraController = require('./controllers/agora.controller'); // <-- Import is fine here

const app = express();

app.use(express.json());
app.use(cors());

// 3. Mount Routes (AFTER app is initialized)
app.use('/', otpRoutes);
app.use('/', paymentRoutes);
app.use('/', appointmentRoutes);
app.use('/', webhookRoutes);

app.get('/agora-token/:channelName', agoraController.generateToken);

// Health Check / Status Route
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Surekha API | Status</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f4f7f6; }
                    .card { background: white; padding: 2.5rem; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; border-top: 6px solid #28a745; max-width: 400px; }
                    h1 { color: #2c3e50; margin-bottom: 0.5rem; font-size: 1.8rem; }
                    .status-box { background: #e8f5e9; color: #2e7d32; padding: 8px 15px; border-radius: 20px; display: inline-block; font-weight: 600; margin: 15px 0; }
                    p { color: #7f8c8d; line-height: 1.6; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Surekha Hospital</h1>
                    <div class="status-box">● API ONLINE</div>
                    <p>The backend engine is running perfectly and ready to handle hospital inquiries.</p>
                </div>
            </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Hospital Engine v2.0 running on port ${PORT}`);
    console.log(`✅ Firebase Client SDK initialized`);
    console.log(`💳 Razorpay initialized: ${process.env.RAZORPAY_KEY_ID}`);
});