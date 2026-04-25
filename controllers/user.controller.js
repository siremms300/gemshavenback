const User = require('../models/User');
const Savings = require('../models/Savings');
const Loan = require('../models/Loan');
const bcrypt = require('bcryptjs');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      'firstName', 'lastName', 'phone', 'dateOfBirth', 
      'address', 'occupation', 'employer', 'monthlyIncome'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.userId);
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateBankDetails = async (req, res) => {
  try {
    const { bankName, accountNumber, accountName } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { 
        bankDetails: { bankName, accountNumber, accountName },
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update bank details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateNextOfKin = async (req, res) => {
  try {
    const { fullName, relationship, phone, email } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { 
        nextOfKin: { fullName, relationship, phone, email },
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update next of kin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    
    const totalSavings = await Savings.aggregate([
      { $match: { user: userId, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);

    const activeLoans = await Loan.find({ 
      user: userId, 
      status: { $in: ['active', 'disbursed'] } 
    });

    const recentTransactions = await Savings.aggregate([
      { $match: { user: userId } },
      { $unwind: '$transactions' },
      { $sort: { 'transactions.date': -1 } },
      { $limit: 5 },
      { $project: {
        type: '$transactions.type',
        amount: '$transactions.amount',
        date: '$transactions.date',
        description: '$transactions.description'
      }}
    ]);

    const stats = {
      totalSavings: totalSavings[0]?.total || 0,
      activeLoanAmount: activeLoans.reduce((sum, loan) => sum + loan.outstandingBalance, 0),
      totalShares: user.totalShares || 0,
      loanEligibility: user.loanEligibility || 0,
      recentTransactions
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    const { imageUrl } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { profilePicture: imageUrl },
      { new: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};