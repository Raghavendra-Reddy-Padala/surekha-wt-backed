const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const requireApiKey = require('../middlewares/auth.middleware');

router.post('/web-request', requireApiKey, appointmentController.webRequest);
router.post('/confirm-appointment', requireApiKey, appointmentController.confirmAppointment);
router.post('/walk-in', requireApiKey, appointmentController.walkIn);

module.exports = router;