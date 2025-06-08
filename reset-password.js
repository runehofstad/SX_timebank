// Simple password reset script
// Run with: node reset-password.js <email>

const email = process.argv[2];

if (!email) {
  console.log('Usage: node reset-password.js <email>');
  console.log('Example: node reset-password.js rune@studiox.no');
  console.log('\nThis will send a password reset email to the specified address.');
  process.exit(1);
}

console.log(`\nTo reset the password for ${email}:`);
console.log('\n1. Go to: https://console.firebase.google.com/u/0/project/sx-timebank/authentication/users');
console.log('2. Find the user with email:', email);
console.log('3. Click the 3-dot menu on the right');
console.log('4. Select "Reset password"');
console.log('5. Or click "Delete" to remove the user and create a new one');
console.log('\nAlternatively, visit: https://timebank.studiox.tech/login');
console.log('And click "Forgot password?" to receive a reset email.');