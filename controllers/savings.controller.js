const Savings = require('../models/Savings');
const User = require('../models/User');
const SavingsPlan = require('../models/SavingsPlan');

exports.makeDeposit = async (req, res) => {
  try {
    const { amount, savingsType, planId, reference } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    
    let savings = await Savings.findOne({ user: userId, savingsType, status: 'active' });
    
    if (!savings) {
      savings = new Savings({
        user: userId,
        memberId: user.memberId,
        savingsType,
        planId,
        amount: 0,
        balance: 0
      });
    }

    savings.amount += amount;
    savings.balance += amount;
    
    savings.transactions.push({
      type: 'deposit',
      amount,
      reference,
      description: `Deposit to ${savingsType} savings`,
      balance: savings.balance
    });

    await savings.save();

    user.totalSavings += amount;
    user.loanEligibility = user.totalSavings * 3;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Deposit successful',
      balance: savings.balance 
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, savingsType, reason } = req.body;
    const userId = req.user.userId;

    const savings = await Savings.findOne({ user: userId, savingsType, status: 'active' });
    
    if (!savings) {
      return res.status(404).json({ message: 'Savings account not found' });
    }

    if (savings.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    savings.transactions.push({
      type: 'withdrawal',
      amount: -amount,
      description: `Withdrawal request: ${reason}`,
      balance: savings.balance,
      status: 'pending'
    });

    await savings.save();

    res.json({ 
      success: true, 
      message: 'Withdrawal request submitted for approval' 
    });
  } catch (error) {
    console.error('Withdrawal request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSavingsBalance = async (req, res) => {
  try {
    const userId = req.user.userId;

    const savings = await Savings.find({ user: userId, status: 'active' })
      .populate('planId', 'name interestRate');

    const totalBalance = savings.reduce((sum, s) => sum + s.balance, 0);

    res.json({ 
      success: true, 
      savings,
      totalBalance 
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const savings = await Savings.find({ user: userId });
    
    const allTransactions = savings.reduce((acc, s) => {
      const transactions = s.transactions.map(t => ({
        ...t.toObject(),
        savingsType: s.savingsType
      }));
      return [...acc, ...transactions];
    }, []);

    allTransactions.sort((a, b) => b.date - a.date);

    const start = (page - 1) * limit;
    const paginatedTransactions = allTransactions.slice(start, start + parseInt(limit));

    res.json({ 
      success: true, 
      transactions: paginatedTransactions,
      total: allTransactions.length,
      page: parseInt(page),
      totalPages: Math.ceil(allTransactions.length / limit)
    });
  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.subscribeToPlan = async (req, res) => {
  try {
    const { planId, initialDeposit } = req.body;
    const userId = req.user.userId;

    const plan = await SavingsPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    if (initialDeposit < plan.minimumDeposit) {
      return res.status(400).json({ 
        message: `Minimum deposit for this plan is ₦${plan.minimumDeposit}` 
      });
    }

    const user = await User.findById(userId);

    const savings = new Savings({
      user: userId,
      memberId: user.memberId,
      savingsType: plan.type,
      planId,
      amount: initialDeposit,
      balance: initialDeposit,
      interestRate: plan.interestRate,
      maturityDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000)
    });

    savings.transactions.push({
      type: 'deposit',
      amount: initialDeposit,
      description: `Initial deposit for ${plan.name}`,
      balance: initialDeposit
    });

    await savings.save();

    user.totalSavings += initialDeposit;
    await user.save();

    res.json({ 
      success: true, 
      message: `Successfully subscribed to ${plan.name}`,
      savings 
    });
  } catch (error) {
    console.error('Subscribe to plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAvailablePlans = async (req, res) => {
  try {
    const plans = await SavingsPlan.find({ status: 'active' });
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Get plans error:', error);
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

exports.calculateInterest = async (req, res) => {
  try {
    const { amount, duration, rate } = req.query;

    const principal = parseFloat(amount) || 0;
    const months = parseInt(duration) || 1;
    const annualRate = (parseFloat(rate) || 0) / 100;

    const monthlyRate = annualRate / 12;
    const interest = principal * monthlyRate * months;
    const total = principal + interest;

    res.json({
      success: true,
      calculation: {
        principal,
        interest,
        total,
        monthlyInterest: interest / months,
        annualRate: annualRate * 100
      }
    });
  } catch (error) {
    console.error('Interest calculation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createTargetSavings = async (req, res) => {
  try {
    const { name, targetAmount, duration, monthlyContribution } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);

    const savings = new Savings({
      user: userId,
      memberId: user.memberId,
      savingsType: 'target',
      amount: 0,
      balance: 0,
      name,
      targetAmount,
      monthlyContribution,
      targetDate: new Date(Date.now() + duration * 30 * 24 * 60 * 60 * 1000)
    });

    await savings.save();

    res.json({ 
      success: true, 
      message: 'Target savings created successfully',
      savings 
    });
  } catch (error) {
    console.error('Create target savings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin functions
exports.getAllSavings = async (req, res) => {
  try {
    const savings = await Savings.find()
      .populate('user', 'firstName lastName memberId email')
      .sort({ createdAt: -1 });

    res.json({ success: true, savings });
  } catch (error) {
    console.error('Get all savings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPendingWithdrawals = async (req, res) => {
  try {
    const savings = await Savings.find({ 'transactions.status': 'pending' })
      .populate('user', 'firstName lastName memberId email');

    const pendingWithdrawals = savings.reduce((acc, s) => {
      const pending = s.transactions
        .filter(t => t.status === 'pending' && t.type === 'withdrawal')
        .map(t => ({
          ...t.toObject(),
          savingsId: s._id,
          user: s.user,
          savingsType: s.savingsType
        }));
      return [...acc, ...pending];
    }, []);

    res.json({ success: true, withdrawals: pendingWithdrawals });
  } catch (error) {
    console.error('Get pending withdrawals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const savings = await Savings.findById(id);
    
    if (!savings) {
      return res.status(404).json({ message: 'Savings account not found' });
    }

    const withdrawal = savings.transactions.find(t => 
      t._id.toString() === id || (t.status === 'pending' && t.type === 'withdrawal')
    );
    
    if (withdrawal) {
      withdrawal.status = 'completed';
      savings.balance += withdrawal.amount; // amount is negative
      await savings.save();
    }

    res.json({ success: true, message: 'Withdrawal approved' });
  } catch (error) {
    console.error('Approve withdrawal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const savings = await Savings.findById(id);
    
    if (!savings) {
      return res.status(404).json({ message: 'Savings account not found' });
    }

    const withdrawal = savings.transactions.find(t => 
      t._id.toString() === id || (t.status === 'pending' && t.type === 'withdrawal')
    );
    
    if (withdrawal) {
      withdrawal.status = 'rejected';
      withdrawal.rejectionReason = reason;
      await savings.save();
    }

    res.json({ success: true, message: 'Withdrawal rejected' });
  } catch (error) {
    console.error('Reject withdrawal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};