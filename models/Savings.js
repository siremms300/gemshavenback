const mongoose = require('mongoose');

const savingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  memberId: {
    type: String,
    required: true
  },
  savingsType: {
    type: String,
    enum: ['regular', 'fixed', 'target', 'shares'],
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SavingsPlan'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  balance: {
    type: Number,
    required: true,
    default: function() { return this.amount; }
  },
  interestRate: {
    type: Number,
    default: 0
  },
  accruedInterest: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  maturityDate: Date,
  status: {
    type: String,
    enum: ['active', 'matured', 'withdrawn', 'paused'],
    default: 'active'
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  lastInterestCalculation: Date,
  transactions: [{
    type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'interest', 'penalty']
    },
    amount: Number,
    date: {
      type: Date,
      default: Date.now
    },
    reference: String,
    description: String,
    balance: Number
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate interest
savingsSchema.methods.calculateInterest = function() {
  const now = new Date();
  const lastCalc = this.lastInterestCalculation || this.startDate;
  const daysDiff = Math.floor((now - lastCalc) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > 0 && this.status === 'active') {
    const dailyRate = this.interestRate / 36500;
    const interest = this.balance * dailyRate * daysDiff;
    
    this.accruedInterest += interest;
    this.balance += interest;
    this.lastInterestCalculation = now;
    
    this.transactions.push({
      type: 'interest',
      amount: interest,
      description: `Interest accrued for ${daysDiff} days`,
      balance: this.balance,
      reference: `INT-${Date.now()}`
    });
  }
  
  return this.save();
};

module.exports = mongoose.model('Savings', savingsSchema);