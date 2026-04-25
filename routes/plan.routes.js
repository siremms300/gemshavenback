const express = require('express');
const router = express.Router();
const planController = require('../controllers/plan.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/', planController.getPublicPlans);
router.get('/:id', planController.getPlanDetails);

router.use(authenticate);
router.post('/subscribe', planController.subscribeToPlan);
router.get('/my/active', planController.getMyActivePlans);
router.get('/my/history', planController.getMyPlanHistory);
router.post('/:id/cancel', planController.cancelSubscription);

module.exports = router;