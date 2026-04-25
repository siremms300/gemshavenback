const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.put('/password', userController.changePassword);
router.put('/bank-details', userController.updateBankDetails);
router.put('/next-of-kin', userController.updateNextOfKin);
router.get('/dashboard-stats', userController.getDashboardStats);
router.post('/upload-profile-picture', userController.uploadProfilePicture);

module.exports = router;