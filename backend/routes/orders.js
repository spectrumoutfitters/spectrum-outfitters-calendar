import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for order photo uploads
const getUploadsBaseDir = () => {
  return process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(getUploadsBaseDir(), 'orders');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'order-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// All routes require authentication
router.use(authenticateToken);

// GET /api/orders - Get orders (user's own orders for employees, all for admins)
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let query = `
      SELECT o.*, 
             u.full_name as user_name,
             u.username,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      JOIN users u ON o.user_id = u.id
    `;
    const params = [];

    if (!isAdmin) {
      query += ' WHERE o.user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY o.created_at DESC';

    const orders = await db.allAsync(query, params);

    // Get order items for each order
    for (let order of orders) {
      const items = await db.allAsync(`
        SELECT oi.*, p.name as product_name, p.description as product_description
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
        ORDER BY oi.created_at ASC
      `, [order.id]);
      order.items = items;
    }

    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/:id - Get single order
router.get('/:id', async (req, res) => {
  try {
    const order = await db.getAsync(`
      SELECT o.*, u.full_name as user_name, u.username
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [req.params.id]);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check permissions
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get order items
    const items = await db.allAsync(`
      SELECT oi.*, p.name as product_name, p.description as product_description
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.created_at ASC
    `, [order.id]);

    order.items = items;
    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orders - Create order with photo
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    // Parse items from JSON string if needed
    let items = req.body.items;
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }
    const { zelle_qr_code, notes } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    // Calculate total
    let totalAmount = 0;
    for (const item of items) {
      const product = await db.getAsync('SELECT price FROM products WHERE id = ? AND is_active = 1', [item.product_id]);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.product_id} not found or inactive` });
      }
      totalAmount += product.price * (item.quantity || 1);
    }

    const photoUrl = req.file ? `/uploads/orders/${req.file.filename}` : null;

    // Create order
    const orderResult = await db.runAsync(
      'INSERT INTO orders (user_id, total_amount, photo_url, zelle_qr_code, notes, status) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, totalAmount, photoUrl, zelle_qr_code || null, notes || null, 'pending']
    );

    const orderId = orderResult.lastID;

    // Create order items
    for (const item of items) {
      const product = await db.getAsync('SELECT price FROM products WHERE id = ?', [item.product_id]);
      await db.runAsync(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity || 1, product.price]
      );
    }

    const order = await db.getAsync(`
      SELECT o.*, u.full_name as user_name, u.username
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [orderId]);

    const orderItems = await db.allAsync(`
      SELECT oi.*, p.name as product_name, p.description as product_description
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.created_at ASC
    `, [orderId]);

    order.items = orderItems;

    // Notify admins of new order via Socket.io
    const io = req.app.get('io');
    if (io) {
      const user = await db.getAsync('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
      io.to('admin').emit('new_order', {
        order,
        user_name: user?.full_name || req.user.username,
        message: `New order #${orderId} from ${user?.full_name || req.user.username} - $${totalAmount.toFixed(2)}`
      });
    }

    res.status(201).json({ order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/orders/:id/status - Update order status (admin only)
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'paid', 'fulfilled', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const updateParams = [status];

    if (status === 'paid') {
      updateFields.push('paid_at = CURRENT_TIMESTAMP');
    }
    if (status === 'fulfilled') {
      updateFields.push('fulfilled_at = CURRENT_TIMESTAMP');
    }

    updateParams.push(id);

    await db.runAsync(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    const order = await db.getAsync(`
      SELECT o.*, u.full_name as user_name, u.username
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [id]);

    const items = await db.allAsync(`
      SELECT oi.*, p.name as product_name, p.description as product_description
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.created_at ASC
    `, [id]);

    order.items = items;

    res.json({ order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/orders/:id - Update order (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, notes, status, total_amount } = req.body;

    // Check if order exists
    const existingOrder = await db.getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updateFields = ['updated_at = CURRENT_TIMESTAMP'];
    const updateParams = [];

    // Update notes if provided
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateParams.push(notes || null);
    }

    // Update status if provided
    if (status !== undefined) {
      const validStatuses = ['pending', 'paid', 'fulfilled', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updateFields.push('status = ?');
      updateParams.push(status);

      if (status === 'paid' && existingOrder.status !== 'paid') {
        updateFields.push('paid_at = CURRENT_TIMESTAMP');
      }
      if (status === 'fulfilled' && existingOrder.status !== 'fulfilled') {
        updateFields.push('fulfilled_at = CURRENT_TIMESTAMP');
      }
    }

    // Update items if provided
    let finalTotalAmount = existingOrder.total_amount;
    if (items !== undefined && Array.isArray(items)) {
      // Delete existing order items
      await db.runAsync('DELETE FROM order_items WHERE order_id = ?', [id]);

      // Calculate new total and insert new items
      finalTotalAmount = 0;
      for (const item of items) {
        if (!item.product_id || !item.quantity) {
          continue;
        }
        const product = await db.getAsync('SELECT price FROM products WHERE id = ?', [item.product_id]);
        if (!product) {
          return res.status(400).json({ error: `Product ${item.product_id} not found` });
        }
        const itemPrice = item.price !== undefined ? parseFloat(item.price) : product.price;
        const quantity = parseInt(item.quantity) || 1;
        finalTotalAmount += itemPrice * quantity;

        await db.runAsync(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [id, item.product_id, quantity, itemPrice]
        );
      }

      updateFields.push('total_amount = ?');
      updateParams.push(finalTotalAmount);
    } else if (total_amount !== undefined) {
      // Allow manual total override
      updateFields.push('total_amount = ?');
      updateParams.push(parseFloat(total_amount));
      finalTotalAmount = parseFloat(total_amount);
    }

    updateParams.push(id);

    // Update order
    await db.runAsync(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    // Fetch updated order with items
    const order = await db.getAsync(`
      SELECT o.*, u.full_name as user_name, u.username
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [id]);

    const orderItems = await db.allAsync(`
      SELECT oi.*, p.name as product_name, p.description as product_description
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.created_at ASC
    `, [id]);

    order.items = orderItems;

    res.json({ order });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/orders/:id - Delete order (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if order exists
    const order = await db.getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Delete order photo if it exists
    if (order.photo_url) {
      try {
        const photoPath = path.join(__dirname, '..', order.photo_url);
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      } catch (fileError) {
        console.warn('Error deleting order photo:', fileError);
        // Continue with order deletion even if photo deletion fails
      }
    }

    // Delete order (order_items will be deleted automatically due to CASCADE)
    await db.runAsync('DELETE FROM orders WHERE id = ?', [id]);

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

