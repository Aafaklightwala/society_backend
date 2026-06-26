// ─────────────────────────────────────────────────────────────────────────────
//  utils/hashPassword.js
//
//  Run this from terminal to generate bcrypt hashes for any password.
//
//  Usage:
//    node utils/hashPassword.js mypassword123
//    node utils/hashPassword.js chairman@2025
//
//  Then copy the printed hash and paste it directly into the SQL INSERT below.
// ─────────────────────────────────────────────────────────────────────────────

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.log('\n❌  Please provide a password as argument.');
  console.log('    Usage: node utils/hashPassword.js yourpassword\n');
  process.exit(1);
}

const SALT_ROUNDS = 12; // Higher = more secure but slower. 12 is industry standard.

bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }

  console.log('\n✅  Password Hash Generated');
  console.log('─'.repeat(70));
  console.log('Original Password :', password);
  console.log('bcrypt Hash       :', hash);
  console.log('─'.repeat(70));
  console.log('\n📋  Copy the hash above and use it in your SQL INSERT statement.\n');
});
