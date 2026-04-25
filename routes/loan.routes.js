const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loan.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post('/apply', loanController.applyForLoan);
router.get('/eligibility', loanController.checkEligibility);
router.get('/active', loanController.getActiveLoans);
router.get('/history', loanController.getLoanHistory);
router.post('/repay', loanController.makeRepayment);
router.get('/:id/schedule', loanController.getRepaymentSchedule);
router.get('/:id/details', loanController.getLoanDetails);
router.post('/calculator', loanController.calculateLoanRepayment);

// Admin only
router.get('/admin/all', authorize(['admin', 'super-admin']), loanController.getAllLoans);
router.get('/admin/pending', authorize(['admin', 'super-admin']), loanController.getPendingLoans);
router.put('/admin/:id/review', authorize(['admin', 'super-admin']), loanController.reviewLoanApplication);
router.put('/admin/:id/approve', authorize(['admin', 'super-admin']), loanController.approveLoan);
router.put('/admin/:id/reject', authorize(['admin', 'super-admin']), loanController.rejectLoan);
router.put('/admin/:id/disburse', authorize(['admin', 'super-admin']), loanController.disburseLoan);

module.exports = router;