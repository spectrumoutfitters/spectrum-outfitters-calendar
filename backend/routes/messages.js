import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/messages/team-board - Get team board messages (everyone can access)
router.get('/team-board', async (req, res) => {
  try {
    const messages = await db.allAsync(`
      SELECT m.*, u.full_name as sender_name, u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.is_team_message = 1 AND (m.board_type = 'team_board' OR m.board_type IS NULL)
      ORDER BY m.created_at DESC
      LIMIT 100
    `);

    // Mark messages as read when viewing
    for (let message of messages) {
      // Only mark messages from others as read
      if (message.sender_id !== req.user.id) {
        await db.runAsync(
          `INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)`,
          [message.id, req.user.id]
        );
      }
      
      const readStatus = await db.getAsync(
        'SELECT read_at FROM message_reads WHERE message_id = ? AND user_id = ?',
        [message.id, req.user.id]
      );
      message.is_read = !!readStatus;
    }

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Error fetching team board messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages/admin-board - Get admin board messages (admin only)
router.get('/admin-board', async (req, res) => {
  try {
    // Only admins can access admin board
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can access admin board' });
    }

    const messages = await db.allAsync(`
      SELECT m.*, u.full_name as sender_name, u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.is_team_message = 1 AND m.board_type = 'admin_board'
      ORDER BY m.created_at DESC
      LIMIT 100
    `);

    // Mark messages as read when viewing and get read receipts
    for (let message of messages) {
      // Only mark messages from others as read
      if (message.sender_id !== req.user.id) {
        await db.runAsync(
          `INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)`,
          [message.id, req.user.id]
        );
      }
      
      const readStatus = await db.getAsync(
        'SELECT read_at FROM message_reads WHERE message_id = ? AND user_id = ?',
        [message.id, req.user.id]
      );
      message.is_read = !!readStatus;
      
      // Get read receipts (who has read this message)
      const readReceipts = await db.allAsync(`
        SELECT mr.user_id, mr.read_at, u.full_name, u.username
        FROM message_reads mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id = ?
        ORDER BY mr.read_at ASC
      `, [message.id]);
      message.read_receipts = readReceipts || [];
      message.read_count = readReceipts.length;
    }

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Error fetching admin board messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages/team - Legacy endpoint (returns admin board for admins, team board for employees)
router.get('/team', async (req, res) => {
  try {
    // For backward compatibility, redirect to appropriate board
    if (req.user.role === 'admin') {
      // Redirect to admin board
      const messages = await db.allAsync(`
        SELECT m.*, u.full_name as sender_name, u.username as sender_username
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.is_team_message = 1 AND m.board_type = 'admin_board'
        ORDER BY m.created_at DESC
        LIMIT 100
      `);

      for (let message of messages) {
        if (message.sender_id !== req.user.id) {
          await db.runAsync(
            `INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)`,
            [message.id, req.user.id]
          );
        }
        
        const readStatus = await db.getAsync(
          'SELECT read_at FROM message_reads WHERE message_id = ? AND user_id = ?',
          [message.id, req.user.id]
        );
        message.is_read = !!readStatus;
      }

      res.json({ messages: messages.reverse() });
    } else {
      // Redirect to team board
      const messages = await db.allAsync(`
        SELECT m.*, u.full_name as sender_name, u.username as sender_username
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.is_team_message = 1 AND (m.board_type = 'team_board' OR m.board_type IS NULL)
        ORDER BY m.created_at DESC
        LIMIT 100
      `);

      for (let message of messages) {
        if (message.sender_id !== req.user.id) {
          await db.runAsync(
            `INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)`,
            [message.id, req.user.id]
          );
        }
        
        const readStatus = await db.getAsync(
          'SELECT read_at FROM message_reads WHERE message_id = ? AND user_id = ?',
          [message.id, req.user.id]
        );
        message.is_read = !!readStatus;
        
        // Get read receipts
        const readReceipts = await db.allAsync(`
          SELECT mr.user_id, mr.read_at, u.full_name, u.username
          FROM message_reads mr
          JOIN users u ON mr.user_id = u.id
          WHERE mr.message_id = ?
          ORDER BY mr.read_at ASC
        `, [message.id]);
        message.read_receipts = readReceipts || [];
        message.read_count = readReceipts.length;
      }

      res.json({ messages: messages.reverse() });
    }
  } catch (error) {
    console.error('Error fetching team messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages/private/:userId - Get private messages with a specific user
router.get('/private/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const messages = await db.allAsync(`
      SELECT m.*, u.full_name as sender_name, u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.is_team_message = 0
        AND ((m.sender_id = ? AND m.recipient_id = ?) 
             OR (m.sender_id = ? AND m.recipient_id = ?))
      ORDER BY m.created_at ASC
      LIMIT 100
    `, [currentUserId, userId, userId, currentUserId]);

    // Mark messages as read and get read receipts
    for (let message of messages) {
      if (message.sender_id !== currentUserId && !message.read_at) {
        await db.runAsync(
          `INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)`,
          [message.id, currentUserId]
        );
        await db.runAsync(
          'UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND read_at IS NULL',
          [message.id]
        );
      }
      
      // Get read receipts for private messages
      const readReceipts = await db.allAsync(`
        SELECT mr.user_id, mr.read_at, u.full_name, u.username
        FROM message_reads mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id = ?
        ORDER BY mr.read_at ASC
      `, [message.id]);
      message.read_receipts = readReceipts || [];
      message.read_count = readReceipts.length;
    }

    res.json({ messages });
  } catch (error) {
    console.error('Error fetching private messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages/conversations - Get list of conversations
router.get('/conversations', async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Get all unique conversations (team + private)
    const conversations = [];

    // Team Board conversation - everyone can access
    const teamBoardLastMessage = await db.getAsync(`
      SELECT m.*, u.full_name as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.is_team_message = 1 AND (m.board_type = 'team_board' OR m.board_type IS NULL)
      ORDER BY m.created_at DESC
      LIMIT 1
    `);

    const teamBoardUnreadCount = await db.getAsync(`
      SELECT COUNT(*) as count
      FROM messages m
      LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = ?
      WHERE m.is_team_message = 1 
        AND (m.board_type = 'team_board' OR m.board_type IS NULL)
        AND m.created_at > COALESCE(mr.read_at, '1970-01-01')
        AND m.sender_id != ?
    `, [currentUserId, currentUserId]);

    conversations.push({
      id: 'team_board',
      name: 'Team Board',
      type: 'team_board',
      boardType: 'team_board',
      lastMessage: teamBoardLastMessage || null,
      unreadCount: teamBoardUnreadCount?.count || 0,
      isTeam: true
    });

    // Admin Board conversation - only for admins
    if (req.user.role === 'admin') {
      const adminBoardLastMessage = await db.getAsync(`
        SELECT m.*, u.full_name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.is_team_message = 1 AND m.board_type = 'admin_board'
        ORDER BY m.created_at DESC
        LIMIT 1
      `);

      const adminBoardUnreadCount = await db.getAsync(`
        SELECT COUNT(*) as count
        FROM messages m
        LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = ?
        WHERE m.is_team_message = 1 
          AND m.board_type = 'admin_board'
          AND m.created_at > COALESCE(mr.read_at, '1970-01-01')
          AND m.sender_id != ?
      `, [currentUserId, currentUserId]);

      conversations.push({
        id: 'admin_board',
        name: 'Admin Board',
        type: 'admin_board',
        boardType: 'admin_board',
        lastMessage: adminBoardLastMessage || null,
        unreadCount: adminBoardUnreadCount?.count || 0,
        isTeam: true
      });
    }

    // Private conversations
    const privateConversations = await db.allAsync(`
      SELECT DISTINCT
        CASE 
          WHEN m.sender_id = ? THEN m.recipient_id
          ELSE m.sender_id
        END as other_user_id,
        u.full_name as other_user_name,
        u.username as other_user_username,
        MAX(m.created_at) as last_message_time
      FROM messages m
      JOIN users u ON (
        CASE 
          WHEN m.sender_id = ? THEN u.id = m.recipient_id
          ELSE u.id = m.sender_id
        END
      )
      WHERE m.is_team_message = 0
        AND (m.sender_id = ? OR m.recipient_id = ?)
      GROUP BY other_user_id
      ORDER BY last_message_time DESC
    `, [currentUserId, currentUserId, currentUserId, currentUserId]);

    for (let conv of privateConversations) {
      const lastMessage = await db.getAsync(`
        SELECT m.*, u.full_name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.is_team_message = 0
          AND ((m.sender_id = ? AND m.recipient_id = ?) 
               OR (m.sender_id = ? AND m.recipient_id = ?))
        ORDER BY m.created_at DESC
        LIMIT 1
      `, [currentUserId, conv.other_user_id, conv.other_user_id, currentUserId]);

      const unreadCount = await db.getAsync(`
        SELECT COUNT(*) as count
        FROM messages m
        LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = ?
        WHERE m.is_team_message = 0
          AND m.sender_id = ?
          AND m.recipient_id = ?
          AND (m.created_at > COALESCE(mr.read_at, '1970-01-01') OR mr.read_at IS NULL)
      `, [currentUserId, conv.other_user_id, currentUserId]);

      conversations.push({
        id: conv.other_user_id,
        name: conv.other_user_name,
        username: conv.other_user_username,
        type: 'private',
        lastMessage: lastMessage,
        unreadCount: unreadCount?.count || 0,
        isTeam: false
      });
    }

    res.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages/unread-count - Get total unread message count
router.get('/unread-count', async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Team board unread count
    const teamBoardUnread = await db.getAsync(`
      SELECT COUNT(*) as count
      FROM messages m
      LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = ?
      WHERE m.is_team_message = 1 
        AND (m.board_type = 'team_board' OR m.board_type IS NULL)
        AND m.created_at > COALESCE(mr.read_at, '1970-01-01')
        AND m.sender_id != ?
    `, [currentUserId, currentUserId]);

    // Admin board unread count (only for admins)
    let adminBoardUnread = { count: 0 };
    if (req.user.role === 'admin') {
      adminBoardUnread = await db.getAsync(`
        SELECT COUNT(*) as count
        FROM messages m
        LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = ?
        WHERE m.is_team_message = 1 
          AND m.board_type = 'admin_board'
          AND m.created_at > COALESCE(mr.read_at, '1970-01-01')
          AND m.sender_id != ?
      `, [currentUserId, currentUserId]);
    }

    // Private unread count
    const privateUnread = await db.getAsync(`
      SELECT COUNT(*) as count
      FROM messages m
      LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = ?
      WHERE m.is_team_message = 0
        AND m.recipient_id = ?
        AND (m.created_at > COALESCE(mr.read_at, '1970-01-01') OR mr.read_at IS NULL)
    `, [currentUserId, currentUserId]);

    const totalUnread = (teamBoardUnread?.count || 0) + (adminBoardUnread?.count || 0) + (privateUnread?.count || 0);

    res.json({ 
      teamBoardUnread: teamBoardUnread?.count || 0,
      adminBoardUnread: adminBoardUnread?.count || 0,
      privateUnread: privateUnread?.count || 0,
      totalUnread 
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/messages/:id - Delete a message (admin only)
router.delete('/:id', async (req, res) => {
  try {
    // Only admins can delete messages
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete messages' });
    }

    const { id } = req.params;

    // Get the message to check its board type
    const message = await db.getAsync('SELECT * FROM messages WHERE id = ?', [id]);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Delete message reads first (foreign key constraint)
    await db.runAsync('DELETE FROM message_reads WHERE message_id = ?', [id]);

    // Delete the message
    await db.runAsync('DELETE FROM messages WHERE id = ?', [id]);

    // Get Socket.io instance to notify users
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    
    if (io) {
      // Determine which room to notify based on message type
      if (message.is_team_message === 1) {
        const boardType = message.board_type || 'team_board';
        if (boardType === 'admin_board') {
          // Notify admin room
          io.to('admin').emit('message_deleted', { messageId: parseInt(id), boardType: 'admin_board' });
        } else {
          // Notify team room
          io.to('team').emit('message_deleted', { messageId: parseInt(id), boardType: 'team_board' });
        }
      } else {
        // Private message - notify both sender and recipient
        if (message.sender_id && connectedUsers) {
          const senderUser = connectedUsers.get(message.sender_id);
          if (senderUser) {
            io.to(senderUser.socketId).emit('message_deleted', { messageId: parseInt(id) });
          }
        }
        if (message.recipient_id && connectedUsers) {
          const recipientUser = connectedUsers.get(message.recipient_id);
          if (recipientUser) {
            io.to(recipientUser.socketId).emit('message_deleted', { messageId: parseInt(id) });
          }
        }
      }
    }

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

