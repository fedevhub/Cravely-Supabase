const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const uploadImage = require('../middlewares/uploadImage');
const userController = require('../controllers/userController');
const inventoryController = require('../controllers/inventoryController');
const analyticsController = require('../controllers/analyticsController');
const reviewController = require('../controllers/reviewController');

router.get('/', adminController.getDashboard);
router.post('/pre-order/toggle', adminController.togglePreOrder);
router.get('/inventory', inventoryController.getInventory);
router.post('/inventory/materials', inventoryController.createMaterial);
router.post('/inventory/materials/:id', inventoryController.updateMaterial);
router.post('/inventory/expenses', inventoryController.createExpense);
router.get('/analytics', analyticsController.getAnalytics);
router.get('/reviews', reviewController.getReviews);
router.post('/reviews/:id/toggle', reviewController.toggleReview);

router.get('/products', productController.getDaftarProduct);

router.get('/tambahProducts', productController.getTambahProduct);
router.post('/tambahProducts', uploadImage.single('image'), productController.tambahProduct);
router.get('/editProducts/:id', productController.getEditProduct);
router.post('/editProducts/:id', uploadImage.single('image'), productController.updateProduct);

router.post('/deleteProducts/:id', productController.deleteProduct);

router.get('/detailProducts/:id', productController.getDetailProduct);

router.post(
  '/detailProducts/:id',
  uploadImage.array('gallery', 5),
  productController.updateDetailProduct,
);

router.post('/detailProducts/:id/deleteImage/:imageIndex', productController.deleteDetailImage);

router.post('/detailProducts/:id/delete', productController.deleteDetailProduct);

router.post('/detailProducts/:id/add', productController.addDetailProduct);

router.post(
  '/detailProducts/:id/update',
  uploadImage.fields([
    { name: 'image', maxCount: 1 },
    { name: 'gallery', maxCount: 5 },
  ]),
  productController.updateDetailProduct,
);

router.get('/users', userController.getDaftarUser);

router.get('/users/tambah', userController.getTambahUser);
router.post('/users/tambah', userController.tambahUser);

router.get('/users/edit/:id', userController.getEditUser);
router.post('/users/edit/:id', userController.updateUser);

router.post('/users/delete/:id', userController.deleteUser);

module.exports = router;
