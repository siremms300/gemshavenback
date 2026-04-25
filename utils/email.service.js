const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Brand colors from the flyer
const brandColors = {
  primary: '#1a3a5c',
  secondary: '#c4963d',
  accent: '#e8c77a'
};

const emailTemplate = (content, title) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background: #f5f7fa;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, ${brandColors.primary} 0%, #2d5a7b 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.95;
      font-style: italic;
    }
    .content {
      padding: 30px;
    }
    .footer {
      background: ${brandColors.primary};
      color: white;
      padding: 20px;
      text-align: center;
      font-size: 14px;
    }
    .accent-text {
      color: ${brandColors.secondary};
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: linear-gradient(135deg, ${brandColors.secondary} 0%, ${brandColors.accent} 100%);
      color: ${brandColors.primary};
      text-decoration: none;
      border-radius: 25px;
      font-weight: bold;
      margin: 20px 0;
      transition: transform 0.3s ease;
    }
    .button:hover {
      transform: translateY(-2px);
    }
    .info-box {
      background: #f0f4f8;
      border-left: 4px solid ${brandColors.secondary};
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GEMS HAVEN</h1>
      <p>Multipurpose Cooperative Society</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Gems Haven Cooperative Society</p>
      <p>for business growth and wealth creation...</p>
      <p>📞 08029204837 | 📧 Gemshaven@consultant.com</p>
    </div>
  </div>
</body>
</html>
`;

exports.sendVerificationEmail = async (email, token, firstName) => {
  const verificationLink = `${process.env.CLIENT_URL}/verify-email/${token}`;
  
  const content = `
    <h2 style="color: ${brandColors.primary};">Welcome, ${firstName}! 🎉</h2>
    <p>Thank you for joining Gems Haven Cooperative Society. We're excited to have you on board!</p>
    <p>Please verify your email address to activate your account and start your journey towards financial growth.</p>
    <div style="text-align: center;">
      <a href="${verificationLink}" class="button">Verify Email Address</a>
    </div>
    <div class="info-box">
      <strong>🌟 Your Benefits:</strong><br>
      • Access to savings plans with competitive interest rates<br>
      • Loan facilities with flexible repayment options<br>
      • Business support and mentorship<br>
      • Community of forward-thinking entrepreneurs
    </div>
    <p>If the button doesn't work, copy and paste this link:</p>
    <p style="word-break: break-all;">${verificationLink}</p>
    <p><small>This link expires in 24 hours.</small></p>
  `;

  await transporter.sendMail({
    from: `"Gems Haven" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify Your Email - Gems Haven Cooperative',
    html: emailTemplate(content, 'Email Verification')
  });
};

exports.sendWelcomeEmail = async (email, firstName) => {
  const content = `
    <h2 style="color: ${brandColors.primary};">Welcome to Gems Haven, ${firstName}! 🌟</h2>
    <p>Your email has been verified successfully. You now have full access to our platform.</p>
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL}/dashboard" class="button">Go to Dashboard</a>
    </div>
    <h3 style="color: ${brandColors.secondary};">Getting Started:</h3>
    <ul>
      <li><strong>Complete Your Profile:</strong> Update your personal and banking information</li>
      <li><strong>Start Saving:</strong> Choose from our various savings plans</li>
      <li><strong>Build Credit:</strong> Consistent savings improve your loan eligibility</li>
      <li><strong>Connect:</strong> Join our community of entrepreneurs</li>
    </ul>
    <div class="info-box">
      <strong>💡 Did you know?</strong><br>
      Members who save regularly for 6 months become eligible for loans up to 3x their savings balance!
    </div>
  `;

  await transporter.sendMail({
    from: `"Gems Haven" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Welcome to Gems Haven! 🎉',
    html: emailTemplate(content, 'Welcome')
  });
};

exports.sendPasswordResetEmail = async (email, token, firstName) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;
  
  const content = `
    <h2 style="color: ${brandColors.primary};">Password Reset Request</h2>
    <p>Hello ${firstName},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    <p>This link expires in 1 hour for security reasons.</p>
    <p>If you didn't request this, please ignore this email or contact support if you have concerns.</p>
    <div class="info-box">
      <strong>🔒 Security Tip:</strong><br>
      Never share your password or verification links with anyone. Gems Haven will never ask for your password.
    </div>
  `;

  await transporter.sendMail({
    from: `"Gems Haven Security" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Reset Your Password - Gems Haven',
    html: emailTemplate(content, 'Password Reset')
  });
};

exports.sendLoanApprovalEmail = async (email, firstName, loanDetails) => {
  const content = `
    <h2 style="color: ${brandColors.primary};">🎊 Congratulations, ${firstName}!</h2>
    <p>Your loan application has been <strong style="color: #10b981;">APPROVED</strong>!</p>
    <div class="info-box">
      <h3 style="margin-top: 0;">Loan Details:</h3>
      <p><strong>Amount:</strong> ₦${loanDetails.amount.toLocaleString()}</p>
      <p><strong>Interest Rate:</strong> ${loanDetails.interestRate}% per annum</p>
      <p><strong>Tenure:</strong> ${loanDetails.tenure} months</p>
      <p><strong>Monthly Payment:</strong> ₦${loanDetails.monthlyPayment.toLocaleString()}</p>
    </div>
    <p>The funds will be disbursed to your registered bank account within 24 hours.</p>
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL}/dashboard/loans" class="button">View Loan Details</a>
    </div>
  `;

  await transporter.sendMail({
    from: `"Gems Haven Loans" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '🎉 Loan Approved! - Gems Haven',
    html: emailTemplate(content, 'Loan Approval')
  });
};