import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendPushToAdmins } from '../utils/pushNotifications.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/notifications/quick - Send quick notification to admins
router.post('/quick', async (req, res) => {
  try {
    const { type, taskId, taskTitle, distributor } = req.body;
    const userId = req.user.id;
    const userName = req.user.full_name || req.user.username;

    // Validate required fields based on type
    if (type === 'parts_arrived') {
      // Accept either taskId (for backward compatibility) or taskTitle (new way)
      if (!taskTitle && !taskId) {
        return res.status(400).json({ error: 'Missing required field: taskTitle or taskId' });
      }
      if (!distributor) {
        return res.status(400).json({ error: 'Missing required field: distributor' });
      }
    } else if (type === 'need_assistance') {
      if (!req.body.urgency) {
        return res.status(400).json({ error: 'Missing required field: urgency' });
      }
    }

    // Only allow employees to send quick notifications
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot send quick notifications' });
    }

    // Get all admins
    const admins = await db.allAsync(
      'SELECT id FROM users WHERE role = ?',
      ['admin']
    );

    if (admins.length === 0) {
      return res.status(404).json({ error: 'No admins found' });
    }

    // Create notification message based on type
    let notificationMessage = '';
    if (type === 'parts_arrived') {
      // Use vehicle if provided, otherwise use taskTitle for backward compatibility
      const vehicleInfo = req.body.vehicle || taskTitle || 'Unknown Vehicle';
      notificationMessage = `📦 Parts Arrived: ${userName} reports that parts have arrived for ${vehicleInfo} from ${distributor}.`;
    } else if (type === 'need_assistance') {
      const urgency = req.body.urgency || 'convenience';
      const urgencyText = urgency === 'immediate' ? '🚨 IMMEDIATE' : '⏰ At First Convenience';
      notificationMessage = `${urgencyText} Assistance Needed: ${userName} needs assistance (${urgency === 'immediate' ? 'urgent' : 'when convenient'}).`;
    } else if (type === 'customer_arrived') {
      notificationMessage = `👋 Customer Arrived: ${userName} reports that a customer has arrived at the shop.`;
    } else {
      notificationMessage = `🔔 Quick Notification: ${userName} sent a notification.`;
    }

    // Get Socket.io instance
    const io = req.app.get('io');
    if (!io) {
      return res.status(500).json({ error: 'Socket.io not available' });
    }

    // Save notification as an admin board message so admins can see it
    try {
      const result = await db.runAsync(
        `INSERT INTO messages (sender_id, message, is_team_message, board_type) 
         VALUES (?, ?, 1, 'admin_board')`,
        [userId, notificationMessage]
      );

      const messageData = await db.getAsync(
        `SELECT m.*, u.full_name as sender_name 
         FROM messages m 
         JOIN users u ON m.sender_id = u.id 
         WHERE m.id = ?`,
        [result.lastID]
      );

      if (messageData) {
        // Emit to admin room (all admins are in admin room)
        io.to('admin').emit('new_message', {
          ...messageData,
          is_team_message: 1,
          board_type: 'admin_board',
          type: 'admin_board'
        });
      }
    } catch (msgError) {
      console.error('Error saving notification message:', msgError);
      // Don't fail the request if message saving fails
    }

    // Also emit a direct admin notification event
    const notificationData = {
      type: type,
      employeeName: userName,
      employeeId: userId,
      message: notificationMessage,
      timestamp: new Date().toISOString()
    };

    // Add type-specific fields
    if (type === 'parts_arrived') {
      // Include taskId if provided (for backward compatibility), otherwise just use taskTitle
      if (taskId) {
        notificationData.taskId = taskId;
      }
      notificationData.taskTitle = taskTitle || 'Unknown Task';
      notificationData.distributor = distributor;
    } else if (type === 'need_assistance') {
      notificationData.urgency = req.body.urgency;
    }

    io.to('admin').emit('admin_notification', notificationData);

    // Also send push notification to admins
    sendPushToAdmins({
      title: 'Spectrum Outfitters',
      body: notificationMessage.replace(/^[\p{Emoji}\s]+/u, '').trim() || notificationMessage,
      url: '/admin?tab=status',
      tag: `quick-notification-${type}`
    }).catch(err => console.error('Push to admins failed:', err));

    res.json({
      success: true,
      message: 'Notification sent to admins',
      notification: notificationMessage
    });
  } catch (error) {
    console.error('Error sending quick notification:', error);
    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

export default router;

