import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import db from './database/db.js';
import { runStartupMigrations } from './database/startup.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import taskRoutes from './routes/tasks.js';
import timeRoutes from './routes/timeEntries.js';
import messageRoutes from './routes/messages.js';
import pdfParserRoutes from './routes/pdfParser.js';
import shopmonkeyRoutes from './routes/shopmonkey.js';
import turn14Routes from './routes/turn14.js';
import scheduleRoutes from './routes/schedule.js';
import googleCalendarRoutes from './routes/googleCalendar.js';
import notificationRoutes from './routes/notifications.js';
import analyticsRoutes from './routes/analytics.js';
import inventoryRoutes from './routes/inventory.js';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import payrollRoutes from './routes/payroll.js';
import adminWorkListRoutes from './routes/adminWorkList.js';
import myWorklistRoutes from './routes/myWorklist.js';
import complianceRoutes from './routes/compliance.js';
import updatesRoutes from './routes/updates.js';
import dashboardConfigRoutes from './routes/dashboardConfig.js';
import settingsRoutes from './routes/settings.js';
import plaidRoutes from './routes/plaid.js';
import { runPlaidTransactionsSync } from './routes/plaid.js';
import { isPlaidConfigured } from './utils/plaidClient.js';
import financeRoutes from './routes/finance.js';
import securityRoutes from './routes/security.js';
import geocodeRoutes from './routes/geocode.js';
import paymentProcessorRoutes from './routes/paymentProcessor.js';
import pushRoutes from './routes/push.js';
import { handleStripeWebhook } from './routes/paymentProcessor.js';
import { syncShopMonkeyRevenue } from './routes/shopmonkey.js';
import { syncStripeRevenue, syncValorPayRevenue, syncPaymentProcessorRevenue } from './routes/paymentProcessor.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import jwt from 'jsonwebtoken';
import { pullChangesFromGoogle } from './utils/googleCalendarService.js';
import { getSocketClientIP, startSession, endSession, heartbeatSession } from './utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from backend directory so keys (e.g. GOOGLE_MAPS_API_KEY) are found when started from project root
dotenv.config({ path: path.join(__dirname, '.env') });

// Get local IP address for network access
function getLocalIP() {
  const interfaces = networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  
  return addresses[0] || 'localhost';
}

const localIP = getLocalIP();

// Validate required environment variables
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_this_to_random_32_char_string_in_production') {
  console.error('❌ ERROR: JWT_SECRET is not set or is using default value!');
  console.error('Please set JWT_SECRET in backend/.env file');
  console.error('Example: JWT_SECRET=your_random_32_character_secret_key_here');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // trust first proxy hop (Nginx)
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

// Socket.io setup - Allow connections from localhost and network IP
const frontendPort = process.env.FRONTEND_PORT || 5173;
const allowedOrigins = [
  `http://localhost:${frontendPort}`,
  `https://localhost:${frontendPort}`,
  `http://127.0.0.1:${frontendPort}`,
  `https://127.0.0.1:${frontendPort}`,
  `http://${localIP}:${frontendPort}`,
  `https://${localIP}:${frontendPort}`,
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : [])
];
// In production, allow spectrumoutfitters.com and any subdomain (e.g. login.spectrumoutfitters.com)
const productionOriginRegex = process.env.NODE_ENV === 'production'
  ? /^https?:\/\/([a-z0-9-]+\.)*spectrumoutfitters\.com(:\d+)?$/i
  : null;

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/:\d+$/, '')))) {
        callback(null, true);
      } else if (productionOriginRegex && productionOriginRegex.test(origin)) {
        callback(null, true);
      } else {
        const isLocalNetwork = origin.match(/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|localhost|127\.0\.0\.1)/);
        if (isLocalNetwork) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.error('Socket auth: No token provided');
      return next(new Error('Authentication error'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // JWT token uses 'id' not 'userId', and doesn't have fullName
    socket.userId = decoded.id || decoded.userId;
    socket.userName = decoded.username;
    
    // Fetch full_name and role from database
    if (socket.userId) {
      const user = await db.getAsync(
        'SELECT full_name, role FROM users WHERE id = ?',
        [socket.userId]
      );
      socket.userFullName = user?.full_name || decoded.username || 'Unknown User';
      socket.userRole = user?.role || 'employee';
    } else {
      socket.userFullName = decoded.username || 'Unknown User';
      socket.userRole = 'employee';
    }
    
    console.log(`Socket authenticated: ${socket.userFullName} (ID: ${socket.userId}, Role: ${socket.userRole})`);
    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('Authentication error'));
  }
});

// Store connected users
const connectedUsers = new Map();

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.userFullName} (${socket.userId})`);
  const socketIP = getSocketClientIP(socket);
  const socketUA = socket.handshake.headers?.['user-agent'] || null;
  const sessionId = await startSession(socket.userId, socketIP, socketUA, socket.id);
  connectedUsers.set(socket.userId, {
    socketId: socket.id,
    userId: socket.userId,
    userName: socket.userName,
    userFullName: socket.userFullName,
    ip: socketIP,
    sessionId
  });

  // Broadcast user online status
  io.emit('user_online', {
    userId: socket.userId,
    userName: socket.userName,
    userFullName: socket.userFullName
  });

  // Heartbeat every 2 minutes to keep session alive
  const heartbeatInterval = setInterval(() => heartbeatSession(socket.id), 2 * 60 * 1000);
  socket.on('disconnect', () => clearInterval(heartbeatInterval));

  // Join rooms based on role
  socket.join('team'); // Everyone joins team room for team_board
  if (socket.userRole === 'admin') {
    socket.join('admin'); // Only admins join admin room for admin_board
  }
  console.log(`User ${socket.userFullName} joined team room. Socket ID: ${socket.id}`);
  if (socket.userRole === 'admin') {
    console.log(`Admin ${socket.userFullName} joined admin room.`);
  }

  // Handle private message
  socket.on('private_message', async (data) => {
    try {
      const { recipientId, message } = data;
      
      // Save message to database
      const result = await db.runAsync(
        `INSERT INTO messages (sender_id, recipient_id, message, is_team_message) 
         VALUES (?, ?, ?, 0)`,
        [socket.userId, recipientId, message]
      );

      const messageData = await db.getAsync(
        `SELECT m.*, u.full_name as sender_name 
         FROM messages m 
         JOIN users u ON m.sender_id = u.id 
         WHERE m.id = ?`,
        [result.lastID]
      );

      // Get initial read receipts for private message
      const readReceipts = [];
      
      // Send to recipient if online
      const recipient = connectedUsers.get(recipientId);
      if (recipient) {
        io.to(recipient.socketId).emit('new_message', {
          ...messageData,
          type: 'private',
          read_receipts: readReceipts,
          read_count: 0
        });
      }

      // Send confirmation to sender
      socket.emit('message_sent', {
        ...messageData,
        type: 'private',
        read_receipts: readReceipts,
        read_count: 0
      });
    } catch (error) {
      console.error('Error sending private message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Handle team board message (everyone can access)
  socket.on('team_board_message', async (data) => {
    try {
      const { message } = data;
      console.log(`Team board message from ${socket.userFullName} (${socket.userId}): ${message}`);
      
      // Parse @mentions
      const mentionedUsers = await parseMentions(message);
      
      // Save message to database
      const result = await db.runAsync(
        `INSERT INTO messages (sender_id, message, is_team_message, board_type) 
         VALUES (?, ?, 1, 'team_board')`,
        [socket.userId, message]
      );

      const messageData = await db.getAsync(
        `SELECT m.*, u.full_name as sender_name, u.username as sender_username
         FROM messages m 
         JOIN users u ON m.sender_id = u.id 
         WHERE m.id = ?`,
        [result.lastID]
      );

      if (!messageData) {
        console.error('Failed to retrieve message data after insert');
        socket.emit('message_error', { error: 'Failed to retrieve message' });
        return;
      }

      // Get initial read receipts (empty for new message)
      const readReceipts = [];
      
      // Broadcast to all users in team room (including sender)
      const broadcastData = {
        ...messageData,
        is_team_message: 1,
        board_type: 'team_board',
        type: 'team_board',
        mentions: mentionedUsers,
        read_receipts: readReceipts,
        read_count: 0
      };
      
      io.to('team').emit('new_message', broadcastData);
      
      // Send hard notifications to mentioned users
      if (mentionedUsers.length > 0) {
        for (const mentionedUser of mentionedUsers) {
          const mentionedSocket = connectedUsers.get(mentionedUser.id);
          if (mentionedSocket) {
            io.to(mentionedSocket.socketId).emit('mention_notification', {
              messageId: messageData.id,
              senderName: socket.userFullName,
              message: message,
              boardType: 'team_board',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending team board message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Handle admin board message (admin only)
  socket.on('admin_board_message', async (data) => {
    try {
      // Only admins can send admin board messages
      if (socket.userRole !== 'admin') {
        socket.emit('message_error', { error: 'Only admins can send admin board messages' });
        return;
      }

      const { message } = data;
      console.log(`Admin board message from ${socket.userFullName} (${socket.userId}): ${message}`);
      
      // Parse @mentions
      const mentionedUsers = await parseMentions(message);
      
      // Save message to database
      const result = await db.runAsync(
        `INSERT INTO messages (sender_id, message, is_team_message, board_type) 
         VALUES (?, ?, 1, 'admin_board')`,
        [socket.userId, message]
      );

      const messageData = await db.getAsync(
        `SELECT m.*, u.full_name as sender_name, u.username as sender_username
         FROM messages m 
         JOIN users u ON m.sender_id = u.id 
         WHERE m.id = ?`,
        [result.lastID]
      );

      if (!messageData) {
        console.error('Failed to retrieve message data after insert');
        socket.emit('message_error', { error: 'Failed to retrieve message' });
        return;
      }

      // Get initial read receipts (empty for new message)
      const readReceipts = [];
      
      // Broadcast to all admins in admin room (including sender)
      const broadcastData = {
        ...messageData,
        is_team_message: 1,
        board_type: 'admin_board',
        type: 'admin_board',
        mentions: mentionedUsers,
        read_receipts: readReceipts,
        read_count: 0
      };
      
      io.to('admin').emit('new_message', broadcastData);
      
      // Send hard notifications to mentioned users
      if (mentionedUsers.length > 0) {
        for (const mentionedUser of mentionedUsers) {
          const mentionedSocket = connectedUsers.get(mentionedUser.id);
          if (mentionedSocket) {
            io.to(mentionedSocket.socketId).emit('mention_notification', {
              messageId: messageData.id,
              senderName: socket.userFullName,
              message: message,
              boardType: 'admin_board',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending admin board message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Legacy team_message handler (for backward compatibility - routes to admin_board)
  socket.on('team_message', async (data) => {
    try {
      // Only admins can use legacy team_message (it goes to admin_board)
      if (socket.userRole !== 'admin') {
        socket.emit('message_error', { error: 'Legacy team messages are admin-only. Use team_board_message instead.' });
        return;
      }

      const { message } = data;
      console.log(`Legacy team message from ${socket.userFullName} (${socket.userId}): ${message}`);
      
      // Parse @mentions
      const mentionedUsers = await parseMentions(message);
      
      // Save message to database as admin_board
      const result = await db.runAsync(
        `INSERT INTO messages (sender_id, message, is_team_message, board_type) 
         VALUES (?, ?, 1, 'admin_board')`,
        [socket.userId, message]
      );

      const messageData = await db.getAsync(
        `SELECT m.*, u.full_name as sender_name, u.username as sender_username
         FROM messages m 
         JOIN users u ON m.sender_id = u.id 
         WHERE m.id = ?`,
        [result.lastID]
      );

      if (!messageData) {
        console.error('Failed to retrieve message data after insert');
        socket.emit('message_error', { error: 'Failed to retrieve message' });
        return;
      }

      // Get initial read receipts (empty for new message)
      const readReceipts = [];
      
      // Broadcast to all admins in admin room
      const broadcastData = {
        ...messageData,
        is_team_message: 1,
        board_type: 'admin_board',
        type: 'admin_board',
        mentions: mentionedUsers,
        read_receipts: readReceipts,
        read_count: 0
      };
      
      io.to('admin').emit('new_message', broadcastData);
      
      // Send hard notifications to mentioned users
      if (mentionedUsers.length > 0) {
        for (const mentionedUser of mentionedUsers) {
          const mentionedSocket = connectedUsers.get(mentionedUser.id);
          if (mentionedSocket) {
            io.to(mentionedSocket.socketId).emit('mention_notification', {
              messageId: messageData.id,
              senderName: socket.userFullName,
              message: message,
              boardType: 'admin_board',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending legacy team message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    if (data.type === 'team_board') {
      socket.to('team').emit('user_typing', {
        userId: socket.userId,
        userName: socket.userName,
        userFullName: socket.userFullName,
        type: 'team_board'
      });
    } else if (data.type === 'admin_board') {
      if (socket.userRole === 'admin') {
        socket.to('admin').emit('user_typing', {
          userId: socket.userId,
          userName: socket.userName,
          userFullName: socket.userFullName,
          type: 'admin_board'
        });
      }
    } else if (data.type === 'team') {
      // Legacy typing indicator for admin_board
      if (socket.userRole === 'admin') {
        socket.to('admin').emit('user_typing', {
          userId: socket.userId,
          userName: socket.userName,
          userFullName: socket.userFullName,
          type: 'admin_board'
        });
      }
    } else {
      const recipient = connectedUsers.get(data.recipientId);
      if (recipient) {
        io.to(recipient.socketId).emit('user_typing', {
          userId: socket.userId,
          userName: socket.userName,
          userFullName: socket.userFullName,
          type: 'private'
        });
      }
    }
  });

  // Handle messages read event (for real-time read receipt updates)
  socket.on('messages_read', async (data) => {
    try {
      const { messageIds, conversationId } = data;
      
      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return;
      }
      
      // Mark messages as read
      for (const messageId of messageIds) {
        await db.runAsync(
          `INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)`,
          [messageId, socket.userId]
        );
      }
      
      // Get updated read receipts for these messages
      const readReceiptsMap = new Map();
      for (const messageId of messageIds) {
        const receipts = await db.allAsync(`
          SELECT mr.user_id, mr.read_at, u.full_name, u.username
          FROM message_reads mr
          JOIN users u ON mr.user_id = u.id
          WHERE mr.message_id = ?
          ORDER BY mr.read_at ASC
        `, [messageId]);
        readReceiptsMap.set(messageId, receipts || []);
      }
      
      // Notify message senders about read receipts
      for (const messageId of messageIds) {
        const message = await db.getAsync('SELECT sender_id, board_type, is_team_message FROM messages WHERE id = ?', [messageId]);
        if (message) {
          const receipts = readReceiptsMap.get(messageId) || [];
          const readReceiptUpdate = {
            messageId: messageId,
            read_receipts: receipts,
            read_count: receipts.length
          };
          
          // Send to message sender
          const sender = connectedUsers.get(message.sender_id);
          if (sender) {
            io.to(sender.socketId).emit('read_receipt_update', readReceiptUpdate);
          }
          
          // For team messages, also broadcast to the appropriate room
          if (message.is_team_message === 1) {
            const boardType = message.board_type || 'team_board';
            if (boardType === 'admin_board') {
              io.to('admin').emit('read_receipt_update', readReceiptUpdate);
            } else {
              io.to('team').emit('read_receipt_update', readReceiptUpdate);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling messages_read:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.userFullName} (${socket.userId})`);
    await endSession(socket.id);
    connectedUsers.delete(socket.userId);
    io.emit('user_offline', {
      userId: socket.userId
    });
  });
});

// Make io available to routes
app.set('io', io);
// Make connectedUsers available to routes
app.set('connectedUsers', connectedUsers);

// Middleware - CORS with network access support
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/:\d+$/, '')))) {
      callback(null, true);
    } else {
      // In production, allow spectrumoutfitters.com and subdomains (e.g. login.spectrumoutfitters.com)
      if (productionOriginRegex && productionOriginRegex.test(origin)) {
        return callback(null, true);
      }
      // For development, allow any local network origin (HTTP or HTTPS for phone camera)
      const isLocalNetwork = origin.match(/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|localhost|127\.0\.0\.1)/);
      if (isLocalNetwork) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));
app.use(cookieParser());

// Stripe webhook needs raw body for signature verification (must be before express.json)
app.post('/api/payment-processor/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from frontend dist in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Maps API key for frontend (interactive Street View). Same key as backend; restrict by HTTP referrer for browser.
app.get('/api/config/maps-key', authenticateToken, (req, res) => {
  const key = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  res.json({ googleMapsApiKey: key });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/pdf', pdfParserRoutes);
app.use('/api/shopmonkey', shopmonkeyRoutes);
app.use('/api/turn14', turn14Routes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/admin/worklist', adminWorkListRoutes);
app.use('/api/my-worklist', myWorklistRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/updates', updatesRoutes);
app.use('/api/dashboard-config', dashboardConfigRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/plaid', plaidRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/payment-processor', paymentProcessorRoutes);
app.use('/api/admin/security', securityRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/push', pushRoutes);

// Serve uploaded files
const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Serve Dashboard Assistant installer — force download so the file saves instead of opening in a tab
const downloadsPath = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsPath)) fs.mkdirSync(downloadsPath, { recursive: true });
const dashboardInstallerName = 'SpectrumOutfittersAssistant-Setup.exe';
app.get('/downloads/dashboard-assistant', authenticateToken, requireAdmin, (req, res) => {
  const filePath = path.join(downloadsPath, dashboardInstallerName);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('Installer not found. Place SpectrumOutfittersAssistant-Setup.exe in backend/downloads.');
    return;
  }
  res.setHeader('Content-Disposition', `attachment; filename="${dashboardInstallerName}"`);
  res.sendFile(filePath);
});
app.use('/downloads', express.static(downloadsPath));

// Serve payroll system files (protected by authentication middleware in routes)
// Use PAYROLL_SYSTEM_PATH if set (e.g. on server), else ../Payroll System (inside app) or ../../Payroll System (sibling)
const payrollSystemPath = process.env.PAYROLL_SYSTEM_PATH
  ? path.resolve(process.env.PAYROLL_SYSTEM_PATH)
  : path.join(__dirname, '..', 'Payroll System');
if (fs.existsSync(payrollSystemPath)) {
  app.use('/payroll-system', express.static(payrollSystemPath));
} else {
  app.use('/payroll-system', (req, res) => res.status(404).send('Payroll System files not found. Upload the Payroll System folder to the server (see docs).'));
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Serve React app in production (SPA fallback + static assets)
// When deployed under a subpath (e.g. spectrumoutfitters.com/so-app), set BASE_PATH=/so-app
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '');
  const indexPath = path.join(frontendDist, 'index.html');
  if (basePath) {
    app.use(basePath, express.static(frontendDist));
    app.get(basePath, (req, res) => res.sendFile(indexPath));
    app.get(`${basePath}/*`, (req, res) => res.sendFile(indexPath));
  } else {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => res.sendFile(indexPath));
  }
} else {
  // 404 handler for API routes in development
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Test database connection on startup
db.getAsync('SELECT 1')
  .then(() => runStartupMigrations())
  .then(() => {
    console.log('✅ Database connection verified');
    startServer();
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    console.error('Please ensure the database is initialized: npm run init-db');
    process.exit(1);
  });

function startServer(retryCount = 0) {
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 1500;

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (retryCount < MAX_RETRIES) {
        console.warn(`⚠️  Port ${PORT} busy — retrying in ${RETRY_DELAY_MS}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(() => {
          httpServer.removeAllListeners('error');
          httpServer.listen(PORT, HOST);
          startServer(retryCount + 1);
        }, RETRY_DELAY_MS);
      } else {
        console.error(`\n❌ Port ${PORT} is still in use after ${MAX_RETRIES} retries.`);
        console.error('   Kill the other process or change PORT in .env\n');
        process.exit(1);
      }
      return;
    }
    console.error('❌ Server error:', err);
    process.exit(1);
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`\n🌐 Access the application from:`);
    console.log(`   Local:    http://localhost:${frontendPort}`);
    console.log(`   Network:  http://${localIP}:${frontendPort}`);
    console.log(`\n📡 Backend API:`);
    console.log(`   Local:    http://localhost:${PORT}/api`);
    console.log(`   Network:  http://${localIP}:${PORT}/api`);
    console.log(`\n💬 Socket.io ready for real-time messaging`);
    console.log(`\n📱 To access from other devices on the same WiFi:`);
    console.log(`   Use: http://${localIP}:${frontendPort}`);

    startBackgroundJobs();
  });
}

function startBackgroundJobs() {
  if (process.env.SHOPMONKEY_API_KEY && process.env.SHOPMONKEY_API_KEY !== 'your_shopmonkey_api_key_here') {
    let smSyncRunning = false;
    const SM_SYNC_INTERVAL = 5 * 60 * 1000;

    const runSmSync = () => {
      if (smSyncRunning) return;
      smSyncRunning = true;
      const sevenDays = new Date();
      sevenDays.setDate(sevenDays.getDate() - 7);
      syncShopMonkeyRevenue(sevenDays.toISOString().split('T')[0])
        .catch(err => console.warn('ShopMonkey revenue auto-sync failed:', err?.message || err))
        .finally(() => { smSyncRunning = false; });
    };

    runSmSync();
    setInterval(runSmSync, SM_SYNC_INTERVAL);
    console.log('📊 ShopMonkey revenue auto-sync enabled (every 5 minutes)');
  }

  if (process.env.VALOR_APP_ID && process.env.VALOR_APP_KEY) {
    let valorSyncRunning = false;
    const VALOR_SYNC_INTERVAL = 5 * 60 * 1000;
    const runValorSync = () => {
      if (valorSyncRunning) return;
      valorSyncRunning = true;
      const sevenDays = new Date();
      sevenDays.setDate(sevenDays.getDate() - 7);
      syncValorPayRevenue(sevenDays.toISOString().split('T')[0])
        .catch(err => console.warn('Valor Pay revenue auto-sync failed:', err?.message || err))
        .finally(() => { valorSyncRunning = false; });
    };
    runValorSync();
    setInterval(runValorSync, VALOR_SYNC_INTERVAL);
    console.log('💳 Valor Pay revenue auto-sync enabled (every 5 minutes)');
  } else if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
    let stripeSyncRunning = false;
    const STRIPE_SYNC_INTERVAL = 5 * 60 * 1000;
    const runStripeSync = () => {
      if (stripeSyncRunning) return;
      stripeSyncRunning = true;
      const sevenDays = new Date();
      sevenDays.setDate(sevenDays.getDate() - 7);
      syncStripeRevenue(sevenDays.toISOString().split('T')[0])
        .catch(err => console.warn('Stripe revenue auto-sync failed:', err?.message || err))
        .finally(() => { stripeSyncRunning = false; });
    };
    runStripeSync();
    setInterval(runStripeSync, STRIPE_SYNC_INTERVAL);
    console.log('💳 Stripe revenue auto-sync enabled (every 5 minutes)');
  }

  if (isPlaidConfigured()) {
    let plaidSyncRunning = false;
    const PLAID_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes
    const runPlaidSync = () => {
      if (plaidSyncRunning) return;
      plaidSyncRunning = true;
      runPlaidTransactionsSync()
        .then(({ synced_count }) => {
          if (synced_count > 0) console.log('Plaid: synced', synced_count, 'transaction(s)');
        })
        .catch(err => console.warn('Plaid expenses auto-sync failed:', err?.message || err))
        .finally(() => { plaidSyncRunning = false; });
    };
    runPlaidSync();
    setInterval(runPlaidSync, PLAID_SYNC_INTERVAL);
    console.log('🏦 Plaid bank/credit card expenses auto-sync enabled (every 30 minutes)');
  }

  const pollIntervalMs = parseInt(process.env.GOOGLE_CALENDAR_POLL_INTERVAL_MS || '300000', 10);
  let googleSyncRunning = false;
  setInterval(async () => {
    if (googleSyncRunning) return;
    googleSyncRunning = true;
    try {
      await pullChangesFromGoogle({ fullSync: false });
    } catch (err) {
      console.warn('Google Calendar polling sync failed:', err?.message || err);
    } finally {
      googleSyncRunning = false;
    }
  }, Number.isFinite(pollIntervalMs) ? pollIntervalMs : 300000);
}

