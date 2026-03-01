import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router({ mergeParams: true });
router.use(authenticateToken);

const uploadsDir = path.join(__dirname, '..', 'uploads', 'tasks');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `task_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// POST /api/tasks/:id/photos
router.post('/:id/photos', upload.single('photo'), async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!taskId || !Number.isFinite(taskId)) return res.status(400).json({ error: 'Task id required' });
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

    const task = await db.getAsync('SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const photoType = ['before', 'after', 'progress', 'other'].includes(req.body.photo_type)
      ? req.body.photo_type
      : 'other';
    const caption = req.body.caption ? String(req.body.caption).trim().slice(0, 500) : null;

    const relativePath = path.join('uploads', 'tasks', req.file.filename);
    const result = await db.runAsync(
      'INSERT INTO task_photos (task_id, uploaded_by, photo_type, file_path, caption) VALUES (?, ?, ?, ?, ?)',
      [taskId, req.user.id, photoType, relativePath, caption]
    );
    const photo = await db.getAsync(
      `SELECT p.*, u.full_name AS uploaded_by_name FROM task_photos p
       LEFT JOIN users u ON u.id = p.uploaded_by WHERE p.id = ?`,
      [result.lastID]
    );
    res.status(201).json({ photo });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// GET /api/tasks/:id/photos
router.get('/:id/photos', async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!taskId || !Number.isFinite(taskId)) return res.status(400).json({ error: 'Task id required' });
    const photos = await db.allAsync(
      `SELECT p.*, u.full_name AS uploaded_by_name FROM task_photos p
       LEFT JOIN users u ON u.id = p.uploaded_by
       WHERE p.task_id = ? ORDER BY p.created_at ASC`,
      [taskId]
    );
    res.json({ photos: photos || [] });
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:taskId/photos/:photoId
router.delete('/:taskId/photos/:photoId', async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const photoId = Number(req.params.photoId);
    if (!taskId || !photoId) return res.status(400).json({ error: 'IDs required' });

    const photo = await db.getAsync('SELECT * FROM task_photos WHERE id = ? AND task_id = ?', [photoId, taskId]);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const fullPath = path.join(__dirname, '..', photo.file_path);
    try { fs.unlinkSync(fullPath); } catch (_) {}

    await db.runAsync('DELETE FROM task_photos WHERE id = ?', [photoId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
