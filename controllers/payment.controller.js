const paystackService = require('../utils/paystack');
const User = require('../models/User');
const Savings = require('../models/Savings');
const Loan = require('../models/Loan');

exports.initializePayment = async (req, res) => {
  try {
    const { amount, purpose, metadata } = req.body;
    const user = await User.findById(req.user.userId);

    const response = await paystackService.initializeTransaction(
      user.email,
      amount,
      {
        userId: user._id,
        memberId: user.memberId,
        purpose,
        ...metadata
      }
    );

    res.json({
      success: true,
      authorizationUrl: response.data.authorization_url,
      reference: response.data.reference
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({ message: 'Payment initialization failed' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await paystackService.verifyTransaction(reference);

    if (response.data.status === 'success') {
      const { metadata } = response.data;
      
      // Handle different payment purposes
      if (metadata.purpose === 'savings_deposit') {
        await handleSavingsDeposit(metadata.userId, response.data);
      } else if (metadata.purpose === 'loan_repayment') {
        await handleLoanRepayment(metadata.userId, response.data);
      }

      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: response.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ message: 'Payment verification failed' });
  }
};

exports.getBankList = async (req, res) => {
  try {
    const banks = [
      { code: '044', name: 'Access Bank' },
      { code: '023', name: 'Citibank' },
      { code: '050', name: 'Ecobank' },
      { code: '070', name: 'Fidelity Bank' },
      { code: '011', name: 'First Bank' },
      { code: '058', name: 'GTBank' },
      { code: '030', name: 'Heritage Bank' },
      { code: '082', name: 'Keystone Bank' },
      { code: '076', name: 'Polaris Bank' },
      { code: '039', name: 'Stanbic IBTC' },
      { code: '232', name: 'Sterling Bank' },
      { code: '032', name: 'Union Bank' },
      { code: '033', name: 'United Bank for Africa' },
      { code: '215', name: 'Unity Bank' },
      { code: '035', name: 'Wema Bank' },
      { code: '057', name: 'Zenith Bank' }
    ];

    res.json({ success: true, banks });
  } catch (error) {
    console.error('Get banks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyBankAccount = async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;
    
    // This would call Paystack's resolve account API
    // For now, return mock response
    res.json({
      success: true,
      accountName: 'JOHN DOE',
      accountNumber,
      bankCode
    });
  } catch (error) {
    console.error('Verify account error:', error);
    res.status(500).json({ message: 'Account verification failed' });
  }
};

exports.getPaymentHistory = async (req, res) => {
  try {
    // This would fetch from a Payment model
    res.json({
      success: true,
      payments: []
    });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    const event = req.body;
    
    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    // Handle different event types
    if (event.event === 'charge.success') {
      // Process successful charge
      console.log('Charge successful:', event.data);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
};

// Helper functions
async function handleSavingsDeposit(userId, paymentData) {
  const { amount, metadata } = paymentData;
  
  const user = await User.findById(userId);
  let savings = await Savings.findOne({ user: userId, savingsType: metadata.savingsType });
  
  if (!savings) {
    savings = new Savings({
      user: userId,
      memberId: user.memberId,
      savingsType: metadata.savingsType,
      amount: 0,
      balance: 0
    });
  }

  savings.amount += amount / 100;
  savings.balance += amount / 100;
  
  savings.transactions.push({
    type: 'deposit',
    amount: amount / 100,
    reference: paymentData.reference,
    description: 'Savings deposit via Paystack',
    balance: savings.balance
  });

  await savings.save();

  user.totalSavings += amount / 100;
  user.loanEligibility = user.totalSavings * 3;
  await user.save();
}

async function handleLoanRepayment(userId, paymentData) {
  const { amount, metadata } = paymentData;
  
  const loan = await Loan.findById(metadata.loanId);
  
  if (loan) {
    loan.amountPaid += amount / 100;
    loan.outstandingBalance -= amount / 100;
    
    loan.paymentHistory.push({
      amount: amount / 100,
      date: new Date(),
      reference: paymentData.reference,
      method: 'paystack'
    });

    if (loan.outstandingBalance <= 0) {
      loan.status = 'completed';
    }

    await loan.save();
  }
}