import bcrypt from 'bcryptjs';
import db from './database/db.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function resetPassword() {
  try {
    console.log('\n=== Password Reset Tool ===\n');
    
    const username = await question('Enter username: ');
    
    // Check if user exists
    const user = await db.getAsync(
      'SELECT id, username, full_name, role, is_active FROM users WHERE username = ?',
      [username]
    );
    
    if (!user) {
      console.log(`\n❌ User "${username}" not found!`);
      process.exit(1);
    }
    
    console.log(`\nFound user: ${user.full_name} (${user.role})`);
    console.log(`Active: ${user.is_active ? 'Yes' : 'No'}`);
    
    if (user.is_active !== 1) {
      console.log('\n⚠️  User account is inactive. Activating account...');
      await db.runAsync('UPDATE users SET is_active = 1 WHERE id = ?', [user.id]);
      console.log('✅ Account activated');
    }
    
    const newPassword = await question('\nEnter new password (min 6 characters): ');
    
    if (newPassword.length < 6) {
      console.log('\n❌ Password must be at least 6 characters!');
      process.exit(1);
    }
    
    const confirmPassword = await question('Confirm new password: ');
    
    if (newPassword !== confirmPassword) {
      console.log('\n❌ Passwords do not match!');
      process.exit(1);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await db.runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
    
    console.log(`\n✅ Password reset successful for user "${username}"`);
    console.log(`\nYou can now login with:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${newPassword}\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    rl.close();
    process.exit(0);
  }
}

resetPassword();


