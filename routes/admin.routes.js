const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize(['admin', 'super-admin']));

// Member management
router.get('/members', adminController.getAllMembers);
router.get('/members/:id', adminController.getMemberDetails);
router.put('/members/:id/status', adminController.updateMemberStatus);
router.put('/members/:id/role', authorize(['super-admin']), adminController.updateMemberRole);
router.delete('/members/:id', authorize(['super-admin']), adminController.deleteMember);

// Dashboard stats
router.get('/stats', adminController.getDashboardStats);
router.get('/recent-activities', adminController.getRecentActivities);

// Reports
router.get('/reports/savings', adminController.getSavingsReport);
router.get('/reports/loans', adminController.getLoansReport);
router.get('/reports/members', adminController.getMembersReport);
router.get('/reports/transactions', adminController.getTransactionReport);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// Savings plans management
router.post('/plans', adminController.createSavingsPlan);
router.put('/plans/:id', adminController.updateSavingsPlan);
router.delete('/plans/:id', adminController.deleteSavingsPlan);

module.exports = router;