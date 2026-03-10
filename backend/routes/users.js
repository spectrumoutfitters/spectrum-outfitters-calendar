import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sanitizeInput, validateEmail, toTitleCase } from '../utils/helpers.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/users - List all users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await db.allAsync(
      'SELECT id, username, email, full_name, role, hourly_rate, weekly_salary, is_active, created_at, payroll_access, is_master_admin, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period FROM users ORDER BY created_at DESC'
    );
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/active - Get active users for messaging (all authenticated users)
router.get('/active', async (req, res) => {
  try {
    const users = await db.allAsync(
      'SELECT id, username, email, full_name, role, payroll_access, is_master_admin FROM users WHERE is_active = 1 ORDER BY full_name ASC'
    );
    res.json({ users });
  } catch (error) {
    console.error('Get active users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/me/preferences - Update own preferences
router.put('/me/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const { show_clock_in_header } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (show_clock_in_header !== undefined) {
      updateFields.push('show_clock_in_header = ?');
      updateValues.push(show_clock_in_header ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No preferences to update' });
    }

    updateValues.push(userId);

    await db.runAsync(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updatedUser = await db.getAsync(
      'SELECT id, username, email, full_name, role, hourly_rate, weekly_salary, show_clock_in_header FROM users WHERE id = ?',
      [userId]
    );

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users - Create new user
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, password, email, full_name, role, hourly_rate, weekly_salary } = req.body;

    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Username, password, and full name required' });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.runAsync(
      `INSERT INTO users (username, password_hash, email, full_name, role, hourly_rate, weekly_salary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizeInput(username),
        passwordHash,
        email ? sanitizeInput(email) : null,
        toTitleCase(sanitizeInput(full_name)),
        role === 'admin' ? 'admin' : 'employee',
        hourly_rate || 0,
        weekly_salary || 0
      ]
    );

    // Get the last inserted ID - now properly returned from our custom runAsync
    const userId = result.lastID;
    
    if (!userId) {
      throw new Error('Failed to get new user ID from database');
    }

    const newUser = await db.getAsync(
      'SELECT id, username, email, full_name, role, hourly_rate, weekly_salary, is_active FROM users WHERE id = ?',
      [userId]
    );

    if (!newUser) {
      throw new Error('Failed to retrieve created user');
    }

    res.status(201).json({ user: newUser });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint') || error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Create user error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    res.status(500).json({ 
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, full_name, role, hourly_rate, weekly_salary, is_active, split_reimbursable_amount, split_reimbursable_notes, split_reimbursable_period } = req.body;

    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if username is being changed and if it's already taken
    if (username) {
      const existingUser = await db.getAsync('SELECT id FROM users WHERE username = ? AND id != ?', [sanitizeInput(username), id]);
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (username) {
      updateFields.push('username = ?');
      updateValues.push(sanitizeInput(username));
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email ? sanitizeInput(email) : null);
    }
    if (full_name) {
      updateFields.push('full_name = ?');
      updateValues.push(sanitizeInput(full_name));
    }
    if (role) {
      updateFields.push('role = ?');
      updateValues.push(role === 'admin' ? 'admin' : 'employee');
    }
    if (hourly_rate !== undefined) {
      updateFields.push('hourly_rate = ?');
      updateValues.push(hourly_rate || 0);
    }
    if (weekly_salary !== undefined) {
      updateFields.push('weekly_salary = ?');
      updateValues.push(weekly_salary || 0);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }
    if (split_reimbursable_amount !== undefined) {
      updateFields.push('split_reimbursable_amount = ?');
      updateValues.push(parseFloat(split_reimbursable_amount) || 0);
    }
    if (split_reimbursable_notes !== undefined) {
      updateFields.push('split_reimbursable_notes = ?');
      updateValues.push((split_reimbursable_notes || '').trim() || null);
    }
    if (split_reimbursable_period !== undefined) {
      const period = split_reimbursable_period === 'monthly' ? 'monthly' : 'weekly';
      updateFields.push('split_reimbursable_period = ?');
      updateValues.push(period);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(id);

    await db.runAsync(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updatedUser = await db.getAsync(
      'SELECT id, username, email, full_name, role, hourly_rate, weekly_salary, is_active FROM users WHERE id = ?',
      [id]
    );

    res.json({ user: updatedUser });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/me/username - Change own username (admin only)
router.put('/me/username', async (req, res) => {
  try {
    const { newUsername } = req.body;
    const userId = req.user.id;

    if (!newUsername || newUsername.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check if username is already taken
    const existingUser = await db.getAsync('SELECT id FROM users WHERE username = ? AND id != ?', [sanitizeInput(newUsername), userId]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Update username (keep original case for usernames, but we'll apply title case for consistency)
    await db.runAsync('UPDATE users SET username = ? WHERE id = ?', [sanitizeInput(newUsername), userId]);

    const updatedUser = await db.getAsync(
      'SELECT id, username, email, full_name, role, hourly_rate, weekly_salary FROM users WHERE id = ?',
      [userId]
    );

    res.json({ user: updatedUser, message: 'Username changed successfully' });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    console.error('Change username error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/me/password - Change own password
router.put('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get current user
    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id - Soft delete user
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    await db.runAsync('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/:id/reset-password - Reset password (admin only)
router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
