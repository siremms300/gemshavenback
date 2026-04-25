const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  memberId: {
    type: String,
    required: true
  },
  loanType: {
    type: String,
    enum: ['personal', 'business', 'emergency', 'education', 'asset'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  purpose: {
    type: String,
    required: true
  },
  interestRate: {
    type: Number,
    required: true
  },
  tenure: {
    type: Number,
    required: true,
    min: 1
  },
  monthlyPayment: {
    type: Number,
    required: true
  },
  totalRepayment: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  outstandingBalance: {
    type: Number,
    required: true
  },
  applicationDate: {
    type: Date,
    default: Date.now
  },
  approvalDate: Date,
  disbursementDate: Date,
  expectedEndDate: Date,
  status: {
    type: String,
    enum: ['pending', 'under-review', 'approved', 'rejected', 'disbursed', 'active', 'completed', 'defaulted'],
    default: 'pending'
  },
  guarantors: [{
    name: String,
    memberId: String,
    relationship: String,
    phone: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }],
  collateral: {
    type: String,
    description: String,
    value: Number
  },
  documents: [{
    type: String,
    url: String,
    uploadedAt: Date
  }],
  repaymentSchedule: [{
    dueDate: Date,
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'partial'],
      default: 'pending'
    },
    paidAmount: Number,
    paidDate: Date,
    lateFee: {
      type: Number,
      default: 0
    }
  }],
  paymentHistory: [{
    amount: Number,
    date: Date,
    reference: String,
    method: String,
    notes: String
  }],
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate repayment schedule
loanSchema.pre('save', function(next) {
  if (this.isNew && this.status === 'approved') {
    this.approvalDate = new Date();
    this.expectedEndDate = new Date(this.approvalDate);
    this.expectedEndDate.setMonth(this.expectedEndDate.getMonth() + this.tenure);
    
    // Generate repayment schedule
    for (let i = 1; i <= this.tenure; i++) {
      const dueDate = new Date(this.approvalDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      
      this.repaymentSchedule.push({
        dueDate: dueDate,
        amount: this.monthlyPayment
      });
    }
  }
  next();
});

module.exports = mongoose.model('Loan', loanSchema);