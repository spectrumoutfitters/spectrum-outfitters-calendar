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

// Configure multer for file uploads
const getUploadsBaseDir = () => {
  return process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(getUploadsBaseDir(), 'products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

// GET /api/products - Get all active products (for employees) or all products (for admins)
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin 
      ? 'SELECT * FROM products ORDER BY created_at DESC'
      : 'SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC';
    
    const products = await db.allAsync(query);
    res.json({ products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/products - Create product (admin only)
router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, is_active } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

    const result = await db.runAsync(
      'INSERT INTO products (name, description, price, image_url, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, parseFloat(price), imageUrl, is_active !== 'false' ? 1 : 0]
    );

    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', [result.lastID]);
    res.status(201).json({ product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/products/:id - Update product (admin only)
router.put('/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, is_active } = req.body;

    const currentProduct = await db.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!currentProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : currentProduct.image_url;

    await db.runAsync(
      'UPDATE products SET name = ?, description = ?, price = ?, image_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [
        name || currentProduct.name,
        description !== undefined ? description : currentProduct.description,
        price !== undefined ? parseFloat(price) : currentProduct.price,
        imageUrl,
        is_active !== undefined ? (is_active === 'true' || is_active === true ? 1 : 0) : currentProduct.is_active,
        id
      ]
    );

    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    res.json({ product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/products/:id - Delete product (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

