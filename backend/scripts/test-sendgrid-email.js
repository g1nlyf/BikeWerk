// Quick manual test for SendGrid / EmailService
// Usage (PowerShell example from project root):
//   cd backend
//   $env:SENDGRID_API_KEY = 'YOUR_KEY_HERE'
//   $env:EMAIL_FROM = 'noreply@bikewerk.ru'
//   $env:EMAIL_FROM_NAME = 'BikeWerk'
//   $env:EMAIL_REPLY_TO = 'support@bikewerk.ru'
//   node scripts/test-sendgrid-email.js

const EmailService = require('../src/services/EmailService');
const { DatabaseManager } = require('../src/js/mysql-config');

async function main() {
  const target = process.env.TEST_EMAIL || 'hackerios222@gmail.com';

  console.log('📧 Testing SendGrid email delivery to:', target);
  const db = new DatabaseManager();
  await db.initialize();

  // Simple test verification code
  const code = '123456';

  console.log('➡️  Sending verification code email...');
  const res1 = await EmailService.sendVerificationCode(target, code);
  console.log('Verification email result:', res1);

  console.log('➡️  Sending welcome email...');
  const res2 = await EmailService.sendWelcomeEmail(target, 'BikeWerk Tester');
  console.log('Welcome email result:', res2);

  console.log('✅ Test finished. Check inbox and spam folder for emails.');
  await db.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

