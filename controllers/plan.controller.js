const SavingsPlan = require('../models/SavingsPlan');
const Savings = require('../models/Savings');
const User = require('../models/User');

exports.getPublicPlans = async (req, res) => {
  try {
    const plans = await SavingsPlan.find({ status: 'active' })
      .select('name type description minimumDeposit interestRate duration features');
    
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Get public plans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPlanDetails = async (req, res) => {
  try {
    const plan = await SavingsPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }
    res.json({ success: true, plan });
  } catch (error) {
    console.error('Get plan details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.subscribeToPlan = async (req, res) => {
  try {
    const { planId, initialDeposit, autoRenew } = req.body;
    const userId = req.user.userId;

    const plan = await SavingsPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    if (initialDeposit < plan.minimumDeposit) {
      return res.status(400).json({ 
        message: `Minimum deposit for this plan is ₦${plan.minimumDeposit.toLocaleString()}` 
      });
    }

    const user = await User.findById(userId);

    // Check if already subscribed to this plan type
    const existingSubscription = await Savings.findOne({ 
      user: userId, 
      planId, 
      status: 'active' 
    });

    if (existingSubscription) {
      return res.status(400).json({ 
        message: 'You already have an active subscription to this plan' 
      });
    }

    const maturityDate = new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000);

    const savings = new Savings({
      user: userId,
      memberId: user.memberId,
      savingsType: plan.type,
      planId,
      amount: initialDeposit,
      balance: initialDeposit,
      interestRate: plan.interestRate,
      maturityDate,
      autoRenew: autoRenew || false
    });

    savings.transactions.push({
      type: 'deposit',
      amount: initialDeposit,
      description: `Initial deposit for ${plan.name}`,
      balance: initialDeposit
    });

    await savings.save();

    user.totalSavings += initialDeposit;
    user.loanEligibility = user.totalSavings * 3;
    await user.save();

    res.json({ 
      success: true, 
      message: `Successfully subscribed to ${plan.name}`,
      savings: {
        id: savings._id,
        plan: plan.name,
        balance: savings.balance,
        interestRate: savings.interestRate,
        maturityDate: savings.maturityDate
      }
    });
  } catch (error) {
    console.error('Subscribe to plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyActivePlans = async (req, res) => {
  try {
    const activePlans = await Savings.find({ 
      user: req.user.userId, 
      status: 'active' 
    }).populate('planId', 'name type description interestRate duration');

    // Calculate interest for each plan
    for (let plan of activePlans) {
      await plan.calculateInterest();
    }

    res.json({ success: true, plans: activePlans });
  } catch (error) {
    console.error('Get my active plans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyPlanHistory = async (req, res) => {
  try {
    const history = await Savings.find({ 
      user: req.user.userId,
      status: { $in: ['matured', 'withdrawn'] }
    }).populate('planId', 'name type');

    res.json({ success: true, history });
  } catch (error) {
    console.error('Get plan history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const savings = await Savings.findOne({ 
      _id: id, 
      user: req.user.userId,
      status: 'active'
    }).populate('planId');

    if (!savings) {
      return res.status(404).json({ message: 'Active subscription not found' });
    }

    // Apply penalty if applicable
    let penalty = 0;
    if (savings.planId.penaltyRate > 0) {
      penalty = savings.balance * (savings.planId.penaltyRate / 100);
    }

    const finalAmount = savings.balance - penalty;

    savings.status = 'withdrawn';
    savings.transactions.push({
      type: 'withdrawal',
      amount: -finalAmount,
      description: `Plan cancelled: ${reason || 'User requested cancellation'}`,
      balance: 0
    });

    if (penalty > 0) {
      savings.transactions.push({
        type: 'penalty',
        amount: -penalty,
        description: 'Early withdrawal penalty',
        balance: 0
      });
    }

    await savings.save();

    res.json({ 
      success: true, 
      message: 'Subscription cancelled successfully',
      refundAmount: finalAmount,
      penalty
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};