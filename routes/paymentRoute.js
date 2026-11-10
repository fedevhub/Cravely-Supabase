const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/', paymentController.getAllPayments);

router.post('/:id/status', paymentController.updatePaymentStatus);

router.delete('/:id', paymentController.deletePayment);

module.exports = router;
