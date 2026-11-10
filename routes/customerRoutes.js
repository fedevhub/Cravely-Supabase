const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const customerOrderController = require('../controllers/customerOrderController');
const uploadImage = require('../middlewares/uploadImage');

router.get('/home', customerController.getHome);
router.get('/products', customerController.getProducts);
router.get('/detailProducts/:id', customerController.getProductDetail);
router.post('/detailProducts/:id/reviews', customerController.createReview);
router.get('/cart', customerOrderController.getCart);
router.post('/cart/:productId', customerOrderController.addToCart);
router.post('/cart/:productId/update', customerOrderController.updateCart);
router.post('/cart/:productId/remove', customerOrderController.removeFromCart);
router.get('/checkout', customerOrderController.getCheckout);
router.post('/checkout', customerOrderController.createOrder);
router.get('/payment/:orderId', customerOrderController.getPayment);
router.post(
  '/payment',
  uploadImage.single('paymentProof'),
  require('../controllers/paymentController').createPayment,
);
router.get('/history', customerOrderController.getHistory);
router.get('/tracking/:orderId', customerOrderController.getTracking);
router.get('/receipt/:orderId', customerOrderController.getReceipt);
router.get('/wishlist', customerOrderController.getWishlist);
router.post('/wishlist/:productId', customerOrderController.toggleWishlist);

module.exports = router;
