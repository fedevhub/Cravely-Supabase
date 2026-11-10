const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/', orderController.getAllOrders);

router.get('/:id/receipt', orderController.getReceipt);

router.post('/:id/status', orderController.updateOrderStatus);

router.delete('/:id', orderController.deleteOrder);

router.get('/dummy', orderController.createDummyOrder);

module.exports = router;
