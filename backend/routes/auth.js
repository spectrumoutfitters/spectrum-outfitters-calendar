import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { ensureUserColumns } from '../database/startup.js';
import { authenticateToken } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { getClientIP, lookupIPGeo, computeOnPremScore, recordLoginEvent } from '../utils/security.js';

const router = express.Router();

// Rate limiting for login - more lenient to avoid blocking legitimate users
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (reduced from 15)
  max: 30, // 30 attempts per window (increased from 5)
  message: 'Too many login attempts, please try again in a few minutes',
  standardHeaders: true,
  legacyHeaders: false,
  // Use a key generator that's more forgiving
  keyGenerator: (req) => {
    // Use username + IP to be more specific, but still allow retries
    return req.body?.username ? `${req.ip}-${req.body.username.toLowerCase()}` : req.ip;
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const clientIP = getClientIP(req);
  const forwardedFor = req.headers['x-forwarded-for'] || null;
  const userAgent = req.headers['user-agent'] || null;
  const browserGeo = req.body.browserGeo || null; // { lat, lng, accuracy }
  const ipGeo = lookupIPGeo(clientIP);

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    await ensureUserColumns();

    const user = await db.getAsync(
      'SELECT id, username, email, full_name, role, hourly_rate, weekly_salary, show_clock_in_header, payroll_access, is_master_admin, password_hash FROM users WHERE LOWER(username) = LOWER(?) AND is_active = 1',
      [username]
    );

    if (!user || !user.password_hash) {
      console.log(`Login attempt failed: User "${username}" not found or invalid`);
      const premScore = await computeOnPremScore(clientIP, browserGeo, ipGeo);
      recordLoginEvent({
        userId: null, username, success: false, reason: 'user_not_found',
        ip: clientIP, forwardedFor, userAgent, browserGeo, ipGeo,
        networkOk: premScore.networkOk, geoOk: premScore.geoOk, score: premScore.score
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.log(`Login attempt failed: Invalid password for user "${username}"`);
      const premScore = await computeOnPremScore(clientIP, browserGeo, ipGeo);
      recordLoginEvent({
        userId: user.id, username, success: false, reason: 'bad_password',
        ip: clientIP, forwardedFor, userAgent, browserGeo, ipGeo,
        networkOk: premScore.networkOk, geoOk: premScore.geoOk, score: premScore.score
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`Login successful: User "${username}" (ID: ${user.id})`);

    // Update last_login timestamp
    try {
      await db.runAsync(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );
    } catch (loginUpdateError) {
      console.warn('Could not update last_login:', loginUpdateError.message);
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        payroll_access: user.payroll_access === 1,
        is_master_admin: user.is_master_admin === 1
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set httpOnly cookie (but allow access from iframes for payroll system)
    res.cookie('token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    // Record successful login event
    const premScore = await computeOnPremScore(clientIP, browserGeo, ipGeo);
    recordLoginEvent({
      userId: user.id, username: user.username, success: true, reason: null,
      ip: clientIP, forwardedFor, userAgent, browserGeo, ipGeo,
      networkOk: premScore.networkOk, geoOk: premScore.geoOk, score: premScore.score
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        hourly_rate: user.hourly_rate,
        weekly_salary: user.weekly_salary ?? 0,
        show_clock_in_header: (user.show_clock_in_header !== 0 && user.show_clock_in_header != null),
        payroll_access: user.payroll_access === 1,
        is_master_admin: user.is_master_admin === 1
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Server error during login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    await ensureUserColumns();

    const user = await db.getAsync(
      'SELECT id, username, email, full_name, role, hourly_rate, weekly_salary, show_clock_in_header, payroll_access, is_master_admin FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        ...user,
        show_clock_in_header: user.show_clock_in_header !== 0 && user.show_clock_in_header != null,
        payroll_access: user.payroll_access === 1,
        is_master_admin: user.is_master_admin === 1
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

