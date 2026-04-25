const User = require('../models/User');
const Savings = require('../models/Savings');
const Loan = require('../models/Loan');
const SavingsPlan = require('../models/SavingsPlan');

// Member Management
exports.getAllMembers = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { memberId: { $regex: search, $options: 'i' } }
      ];
    }

    const members = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({ 
      success: true, 
      members,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all members error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMemberDetails = async (req, res) => {
  try {
    const member = await User.findById(req.params.id)
      .select('-password');
    
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const savings = await Savings.find({ user: member._id });
    const loans = await Loan.find({ user: member._id });

    res.json({ 
      success: true, 
      member,
      savings,
      loans
    });
  } catch (error) {
    console.error('Get member details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateMemberStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const member = await User.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({ success: true, member });
  } catch (error) {
    console.error('Update member status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    const member = await User.findByIdAndUpdate(
      req.params.id,
      { role, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({ success: true, member });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteMember = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    
    // Delete related data
    await Savings.deleteMany({ user: req.params.id });
    await Loan.deleteMany({ user: req.params.id });

    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Dashboard Stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalMembers = await User.countDocuments();
    const activeMembers = await User.countDocuments({ status: 'active' });
    const pendingMembers = await User.countDocuments({ status: 'pending' });
    
    const totalSavings = await Savings.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);

    const activeLoans = await Loan.aggregate([
      { $match: { status: { $in: ['active', 'disbursed'] } } },
      { $group: { _id: null, total: { $sum: '$outstandingBalance' }, count: { $sum: 1 } } }
    ]);

    const pendingLoans = await Loan.countDocuments({ status: 'pending' });
    
    const monthlyStats = await getMonthlyStats();

    res.json({
      success: true,
      stats: {
        members: {
          total: totalMembers,
          active: activeMembers,
          pending: pendingMembers
        },
        savings: {
          total: totalSavings[0]?.total || 0
        },
        loans: {
          active: activeLoans[0]?.count || 0,
          totalOutstanding: activeLoans[0]?.total || 0,
          pending: pendingLoans
        },
        monthlyStats
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getRecentActivities = async (req, res) => {
  try {
    const recentMembers = await User.find()
      .select('firstName lastName memberId createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentSavings = await Savings.find()
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentLoans = await Loan.find()
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      activities: {
        recentMembers,
        recentSavings,
        recentLoans
      }
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reports
exports.getSavingsReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const savings = await Savings.find(query)
      .populate('user', 'firstName lastName memberId')
      .sort({ createdAt: -1 });

    const summary = {
      totalDeposits: savings.reduce((sum, s) => 
        sum + s.transactions.filter(t => t.type === 'deposit').reduce((a, t) => a + t.amount, 0), 0),
      totalWithdrawals: savings.reduce((sum, s) => 
        sum + s.transactions.filter(t => t.type === 'withdrawal').reduce((a, t) => a + Math.abs(t.amount), 0), 0),
      totalInterest: savings.reduce((sum, s) => s.accruedInterest, 0),
      activeAccounts: savings.filter(s => s.status === 'active').length
    };

    res.json({ success: true, savings, summary });
  } catch (error) {
    console.error('Get savings report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLoansReport = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    const query = {};
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (status) query.status = status;

    const loans = await Loan.find(query)
      .populate('user', 'firstName lastName memberId')
      .sort({ createdAt: -1 });

    const summary = {
      totalLoans: loans.length,
      totalAmount: loans.reduce((sum, l) => sum + l.amount, 0),
      totalRepaid: loans.reduce((sum, l) => sum + l.amountPaid, 0),
      totalOutstanding: loans.reduce((sum, l) => sum + l.outstandingBalance, 0),
      byStatus: loans.reduce((acc, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({ success: true, loans, summary });
  } catch (error) {
    console.error('Get loans report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMembersReport = async (req, res) => {
  try {
    const members = await User.find().select('-password');
    
    const summary = {
      total: members.length,
      active: members.filter(m => m.status === 'active').length,
      pending: members.filter(m => m.status === 'pending').length,
      suspended: members.filter(m => m.status === 'suspended').length,
      byMonth: members.reduce((acc, m) => {
        const month = m.createdAt.toISOString().slice(0, 7);
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Get members report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTransactionReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const savings = await Savings.find({
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });

    const allTransactions = savings.reduce((acc, s) => {
      const transactions = s.transactions.map(t => ({
        ...t.toObject(),
        memberId: s.memberId,
        savingsType: s.savingsType
      }));
      return [...acc, ...transactions];
    }, []);

    const summary = {
      totalTransactions: allTransactions.length,
      totalVolume: allTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      byType: allTransactions.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({ success: true, transactions: allTransactions, summary });
  } catch (error) {
    console.error('Get transaction report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Settings
exports.getSettings = async (req, res) => {
  try {
    // This would typically come from a Settings model
    const settings = {
      interestRates: {
        savings: 5,
        fixed: 8,
        target: 6
      },
      loanSettings: {
        maxLoanMultiplier: 3,
        minLoanAmount: 10000,
        maxLoanAmount: 5000000
      },
      fees: {
        withdrawalFee: 100,
        latePaymentFee: 500
      }
    };

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = req.body;
    // Save settings to database
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Savings Plans Management
exports.createSavingsPlan = async (req, res) => {
  try {
    const plan = new SavingsPlan(req.body);
    await plan.save();
    res.json({ success: true, plan });
  } catch (error) {
    console.error('Create savings plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateSavingsPlan = async (req, res) => {
  try {
    const plan = await SavingsPlan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, plan });
  } catch (error) {
    console.error('Update savings plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteSavingsPlan = async (req, res) => {
  try {
    await SavingsPlan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Delete savings plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function
async function getMonthlyStats() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const members = await User.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    { $group: {
      _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
      count: { $sum: 1 }
    }},
    { $sort: { _id: 1 } }
  ]);

  const savings = await Savings.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    { $group: {
      _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
      total: { $sum: "$amount" }
    }},
    { $sort: { _id: 1 } }
  ]);

  return { members, savings };
}