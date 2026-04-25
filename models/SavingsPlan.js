const mongoose = require('mongoose');

const savingsPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['regular', 'fixed', 'target', 'shares'],
    required: true
  },
  description: String,
  minimumDeposit: {
    type: Number,
    required: true
  },
  maximumDeposit: Number,
  interestRate: {
    type: Number,
    required: true
  },
  duration: {
    type: Number, // in days
    required: true
  },
  withdrawalRestriction: {
    type: String,
    enum: ['none', 'partial', 'full-lock'],
    default: 'none'
  },
  penaltyRate: {
    type: Number,
    default: 0
  },
  features: [String],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SavingsPlan', savingsPlanSchema);