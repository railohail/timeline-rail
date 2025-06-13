import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize database tables
async function initDatabase() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create timelines table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS timelines (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// API Routes

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = await pool.query(
      'INSERT INTO users (id, username, email, password) VALUES ($1, $2, $3, $4) RETURNING id, username, email, created_at',
      [userId, username, email, hashedPassword]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get user
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Return user without password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
app.get('/api/auth/user/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save timeline
app.post('/api/timelines', async (req, res) => {
  try {
    const { timeline, userId } = req.body;

    if (!timeline || !userId) {
      return res.status(400).json({ error: 'Timeline and userId are required' });
    }

    // Check if timeline exists for this user
    const existing = await pool.query(
      'SELECT id FROM timelines WHERE id = $1 AND user_id = $2',
      [timeline.id, userId]
    );

    if (existing.rows.length > 0) {
      // Update existing timeline
      await pool.query(
        `UPDATE timelines SET
         name = $3,
         data = $4,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2`,
        [timeline.id, userId, timeline.name, JSON.stringify(timeline)]
      );
    } else {
      // Insert new timeline
      await pool.query(
        `INSERT INTO timelines (id, user_id, name, data, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [timeline.id, userId, timeline.name, JSON.stringify(timeline)]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save timeline error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get timeline
app.get('/api/timelines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    const result = await pool.query(
      'SELECT data FROM timelines WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    res.json({ timeline: JSON.parse(result.rows[0].data) });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List timelines
app.get('/api/timelines', async (req, res) => {
  try {
    const { userId } = req.query;

    const result = await pool.query(
      'SELECT id FROM timelines WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );

    res.json({ timelines: result.rows.map(row => row.id) });
  } catch (error) {
    console.error('List timelines error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete timeline
app.delete('/api/timelines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    const result = await pool.query(
      'DELETE FROM timelines WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete timeline error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle client-side routing - send all other requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Initialize database and start server
const port = process.env.PORT || 3000;

initDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
