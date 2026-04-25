const express = require('express');
const router = express.Router();
const savingsController = require('../controllers/savings.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Member routes
router.post('/deposit', savingsController.makeDeposit);
router.post('/withdraw', savingsController.requestWithdrawal);
router.get('/balance', savingsController.getSavingsBalance);
router.get('/transactions', savingsController.getTransactionHistory);
router.post('/plan/subscribe', savingsController.subscribeToPlan);
router.get('/plans', savingsController.getAvailablePlans);
router.get('/plans/:id', savingsController.getPlanDetails);
router.get('/interest/calculate', savingsController.calculateInterest);
router.post('/target/create', savingsController.createTargetSavings);

// Admin only routes
router.get('/admin/all', authorize(['admin', 'super-admin']), savingsController.getAllSavings);
router.get('/admin/withdrawals/pending', authorize(['admin', 'super-admin']), savingsController.getPendingWithdrawals);
router.put('/admin/withdrawal/:id/approve', authorize(['admin', 'super-admin']), savingsController.approveWithdrawal);
router.put('/admin/withdrawal/:id/reject', authorize(['admin', 'super-admin']), savingsController.rejectWithdrawal);

module.exports = router; 