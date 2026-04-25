const Loan = require('../models/Loan');
const User = require('../models/User');
const Savings = require('../models/Savings');
const { sendLoanApprovalEmail } = require('../utils/email.service');

exports.applyForLoan = async (req, res) => {
  try {
    const { 
      loanType, 
      amount, 
      purpose, 
      tenure, 
      guarantors,
      collateral 
    } = req.body;
    
    const userId = req.user.userId;
    const user = await User.findById(userId);

    // Check eligibility
    if (amount > user.loanEligibility) {
      return res.status(400).json({ 
        message: `You are only eligible for up to ₦${user.loanEligibility.toLocaleString()}` 
      });
    }

    // Check if user has active loan
    const activeLoan = await Loan.findOne({ 
      user: userId, 
      status: { $in: ['active', 'disbursed'] } 
    });

    if (activeLoan) {
      return res.status(400).json({ 
        message: 'You have an active loan. Please complete repayment before applying for a new loan.' 
      });
    }

    // Calculate interest rate based on loan type and tenure
    const interestRates = {
      personal: 12,
      business: 15,
      emergency: 8,
      education: 10,
      asset: 18
    };

    const interestRate = interestRates[loanType] || 12;
    const monthlyRate = interestRate / 100 / 12;
    const monthlyPayment = (amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
                          (Math.pow(1 + monthlyRate, tenure) - 1);
    const totalRepayment = monthlyPayment * tenure;

    const loan = new Loan({
      user: userId,
      memberId: user.memberId,
      loanType,
      amount,
      purpose,
      interestRate,
      tenure,
      monthlyPayment,
      totalRepayment,
      outstandingBalance: totalRepayment,
      guarantors,
      collateral,
      status: 'pending'
    });

    await loan.save();

    res.json({ 
      success: true, 
      message: 'Loan application submitted successfully',
      loan 
    });
  } catch (error) {
    console.error('Loan application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.checkEligibility = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    const eligibility = {
      maxAmount: user.loanEligibility,
      hasActiveLoan: await Loan.exists({ 
        user: req.user.userId, 
        status: { $in: ['active', 'disbursed'] } 
      }),
      totalSavings: user.totalSavings,
      memberSince: user.createdAt
    };

    res.json({ success: true, eligibility });
  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getActiveLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ 
      user: req.user.userId, 
      status: { $in: ['active', 'disbursed'] } 
    }).sort({ createdAt: -1 });

    res.json({ success: true, loans });
  } catch (error) {
    console.error('Get active loans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLoanHistory = async (req, res) => {
  try {
    const loans = await Loan.find({ 
      user: req.user.userId 
    }).sort({ createdAt: -1 });

    res.json({ success: true, loans });
  } catch (error) {
    console.error('Get loan history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.makeRepayment = async (req, res) => {
  try {
    const { loanId, amount, reference } = req.body;

    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    loan.amountPaid += amount;
    loan.outstandingBalance -= amount;

    loan.paymentHistory.push({
      amount,
      date: new Date(),
      reference,
      method: 'paystack'
    });

    // Update repayment schedule
    let remainingAmount = amount;
    for (let schedule of loan.repaymentSchedule) {
      if (schedule.status === 'pending' && remainingAmount > 0) {
        if (remainingAmount >= schedule.amount) {
          schedule.status = 'paid';
          schedule.paidAmount = schedule.amount;
          schedule.paidDate = new Date();
          remainingAmount -= schedule.amount;
        } else {
          schedule.status = 'partial';
          schedule.paidAmount = remainingAmount;
          remainingAmount = 0;
        }
      }
    }

    if (loan.outstandingBalance <= 0) {
      loan.status = 'completed';
      
      // Update user's active loan status
      await User.findByIdAndUpdate(loan.user, { activeLoan: false });
    }

    await loan.save();

    res.json({ 
      success: true, 
      message: 'Repayment successful',
      outstandingBalance: loan.outstandingBalance 
    });
  } catch (error) {
    console.error('Make repayment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getRepaymentSchedule = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    res.json({ 
      success: true, 
      schedule: loan.repaymentSchedule,
      totalAmount: loan.totalRepayment,
      paidAmount: loan.amountPaid,
      outstanding: loan.outstandingBalance
    });
  } catch (error) {
    console.error('Get repayment schedule error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLoanDetails = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('user', 'firstName lastName memberId email phone');

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    res.json({ success: true, loan });
  } catch (error) {
    console.error('Get loan details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.calculateLoanRepayment = async (req, res) => {
  try {
    const { amount, tenure, interestRate } = req.body;

    const monthlyRate = interestRate / 100 / 12;
    const monthlyPayment = (amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
                          (Math.pow(1 + monthlyRate, tenure) - 1);
    const totalRepayment = monthlyPayment * tenure;
    const totalInterest = totalRepayment - amount;

    // Generate amortization schedule
    const schedule = [];
    let balance = amount;
    
    for (let i = 1; i <= tenure; i++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      balance -= principalPayment;
      
      schedule.push({
        month: i,
        payment: monthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, balance)
      });
    }

    res.json({
      success: true,
      calculation: {
        monthlyPayment,
        totalRepayment,
        totalInterest,
        schedule
      }
    });
  } catch (error) {
    console.error('Calculate loan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin functions
exports.getAllLoans = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const loans = await Loan.find(query)
      .populate('user', 'firstName lastName memberId email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Loan.countDocuments(query);

    res.json({ 
      success: true, 
      loans,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all loans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPendingLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ status: 'pending' })
      .populate('user', 'firstName lastName memberId email totalSavings')
      .sort({ createdAt: -1 });

    res.json({ success: true, loans });
  } catch (error) {
    console.error('Get pending loans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.reviewLoanApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const loan = await Loan.findByIdAndUpdate(
      id,
      { 
        status: 'under-review',
        reviewNotes: notes,
        reviewedBy: req.user.userId
      },
      { new: true }
    );

    res.json({ success: true, loan });
  } catch (error) {
    console.error('Review loan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.approveLoan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const loan = await Loan.findById(id).populate('user');
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    loan.status = 'approved';
    loan.approvalDate = new Date();
    loan.reviewedBy = req.user.userId;

    // Generate repayment schedule
    const monthlyRate = loan.interestRate / 100 / 12;
    let balance = loan.totalRepayment;
    
    for (let i = 1; i <= loan.tenure; i++) {
      const dueDate = new Date(loan.approvalDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      
      loan.repaymentSchedule.push({
        dueDate,
        amount: loan.monthlyPayment,
        status: 'pending'
      });
    }

    await loan.save();

    // Send approval email
    await sendLoanApprovalEmail(loan.user.email, loan.user.firstName, {
      amount: loan.amount,
      interestRate: loan.interestRate,
      tenure: loan.tenure,
      monthlyPayment: loan.monthlyPayment
    });

    res.json({ success: true, loan });
  } catch (error) {
    console.error('Approve loan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.rejectLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const loan = await Loan.findByIdAndUpdate(
      id,
      { 
        status: 'rejected',
        reviewNotes: reason,
        reviewedBy: req.user.userId
      },
      { new: true }
    );

    res.json({ success: true, loan });
  } catch (error) {
    console.error('Reject loan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.disburseLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const { reference } = req.body;

    const loan = await Loan.findById(id);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    loan.status = 'disbursed';
    loan.disbursementDate = new Date();
    
    loan.paymentHistory.push({
      amount: loan.amount,
      date: new Date(),
      reference,
      method: 'bank_transfer',
      notes: 'Loan disbursement'
    });

    await loan.save();

    // Update user's active loan status
    await User.findByIdAndUpdate(loan.user, { activeLoan: true });

    res.json({ success: true, loan });
  } catch (error) {
    console.error('Disburse loan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};