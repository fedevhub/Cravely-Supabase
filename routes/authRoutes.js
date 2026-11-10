const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const authMiddleware = require('../middlewares/auth');

router.get('/register', authController.getRegister);
router.get('/login', authController.getLogin);

router.post('/register', authMiddleware.validateRegister, authController.register);

router.post('/login', authMiddleware.validateLogin, authController.login);

router.get('/logout', authController.logout);

module.exports = router;
