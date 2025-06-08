// Direct SendGrid test - bypasses our application
const sgMail = require('@sendgrid/mail');

const API_KEY = process.env.SENDGRID_API_KEY || 'YOUR-API-KEY-HERE';
const FROM_EMAIL = 'timebank@studiox.tech';
const TO_EMAIL = process.argv[2];

if (!TO_EMAIL) {
  console.log('Usage: node sendgrid-direct-test.js <email>');
  console.log('Example: node sendgrid-direct-test.js test@example.com');
  process.exit(1);
}

console.log('Setting up SendGrid with API key...');
sgMail.setApiKey(API_KEY);

const msg = {
  to: TO_EMAIL,
  from: FROM_EMAIL,
  subject: 'Direct SendGrid Test',
  text: 'This is a direct test from SendGrid, bypassing the Timebank application.',
  html: '<p>This is a <strong>direct test</strong> from SendGrid, bypassing the Timebank application.</p>',
};

console.log('Sending email to:', TO_EMAIL);
console.log('From:', FROM_EMAIL);

sgMail
  .send(msg)
  .then((response) => {
    console.log('Email sent successfully!');
    console.log('Status code:', response[0].statusCode);
    console.log('Headers:', response[0].headers);
  })
  .catch((error) => {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('Error body:', error.response.body);
    }
  });