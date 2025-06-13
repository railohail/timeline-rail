import express from 'express';
import multer from 'multer';
import { DatabaseHelpers } from '../lib/database.js';
import { authenticateToken } from './auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Apply authentication to all image routes
router.use(authenticateToken);

// Upload image
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const db = new DatabaseHelpers(req.db);

    // Generate unique filename
    const fileExtension = req.file.originalname.split('.').pop() || 'jpg';
    const filename = `event-${uuidv4()}.${fileExtension}`;

    // Convert buffer to base64
    const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Save to database
    await db.saveImage(filename, base64Data, req.file.mimetype, req.file.size);

    res.json({
      filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error('Image upload error:', error);
    if (error.message === 'Only image files are allowed') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }
});

// Get image by filename
router.get('/:filename', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);
    const image = await db.getImage(req.params.filename);

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Extract base64 data and mime type
    const base64Match = image.data.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      return res.status(500).json({ error: 'Invalid image data format' });
    }

    const mimeType = base64Match[1];
    const base64Data = base64Match[2];

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Set appropriate headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    res.send(buffer);
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ error: 'Failed to get image' });
  }
});

// Delete image
router.delete('/:filename', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);
    const image = await db.deleteImage(req.params.filename);

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Get image info (metadata only)
router.get('/:filename/info', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);
    const image = await db.getImage(req.params.filename);

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({
      filename: image.filename,
      mimeType: image.mime_type,
      size: image.size,
      createdAt: image.created_at
    });
  } catch (error) {
    console.error('Get image info error:', error);
    res.status(500).json({ error: 'Failed to get image info' });
  }
});

export default router;
