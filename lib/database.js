import pg from 'pg';

const { Pool } = pg;

export function createDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  return pool;
}

export async function initializeDatabase(db) {
  const client = await db.connect();

  try {
    // Drop existing tables if they exist (in correct order due to foreign keys)
    await client.query('DROP TABLE IF EXISTS highlights CASCADE');
    await client.query('DROP TABLE IF EXISTS events CASCADE');
    await client.query('DROP TABLE IF EXISTS images CASCADE');
    await client.query('DROP TABLE IF EXISTS timelines CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    // Create users table
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create timelines table
    await client.query(`
      CREATE TABLE timelines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        settings JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create events table
    await client.query(`
      CREATE TABLE events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timeline_id UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        start_date TIMESTAMP WITH TIME ZONE NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE,
        color VARCHAR(50),
        image_filename VARCHAR(255),
        link TEXT,
        track INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create highlights table
    await client.query(`
      CREATE TABLE highlights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timeline_id UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
        start_date TIMESTAMP WITH TIME ZONE NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        start_label VARCHAR(255),
        end_label VARCHAR(255),
        color VARCHAR(50) NOT NULL DEFAULT 'rgba(255, 235, 59, 0.25)',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create images table for storing base64 image data
    await client.query(`
      CREATE TABLE images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename VARCHAR(255) UNIQUE NOT NULL,
        data TEXT NOT NULL,
        mime_type VARCHAR(100),
        size INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX idx_timelines_user_id ON timelines(user_id);
      CREATE INDEX idx_events_timeline_id ON events(timeline_id);
      CREATE INDEX idx_events_start_date ON events(start_date);
      CREATE INDEX idx_highlights_timeline_id ON highlights(timeline_id);
      CREATE INDEX idx_highlights_dates ON highlights(start_date, end_date);
    `);

    console.log('Database tables initialized successfully');
  } finally {
    client.release();
  }
}

// Database helper functions
export class DatabaseHelpers {
  constructor(db) {
    this.db = db;
  }

  // User operations
  async createUser(username, email, passwordHash) {
    const result = await this.db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [username, email, passwordHash]
    );
    return result.rows[0];
  }

  async getUserByUsername(username) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0];
  }

  async getUserById(id) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  // Timeline operations
  async createTimeline(userId, name, settings = {}) {
    const result = await this.db.query(
      'INSERT INTO timelines (user_id, name, settings) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, JSON.stringify(settings)]
    );
    return result.rows[0];
  }

  async getTimelinesByUserId(userId) {
    const result = await this.db.query(
      'SELECT * FROM timelines WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    return result.rows;
  }

  async getTimelineById(id, userId) {
    const result = await this.db.query(
      'SELECT * FROM timelines WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0];
  }

  async updateTimeline(id, userId, updates) {
    const setClause = [];
    const values = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      setClause.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.settings !== undefined) {
      setClause.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(updates.settings));
    }

    setClause.push(`updated_at = NOW()`);
    values.push(id, userId);

    const result = await this.db.query(
      `UPDATE timelines SET ${setClause.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount++} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async deleteTimeline(id, userId) {
    const result = await this.db.query(
      'DELETE FROM timelines WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    return result.rows[0];
  }

  // Event operations
  async createEvent(timelineId, eventData) {
    const result = await this.db.query(
      `INSERT INTO events (timeline_id, title, description, start_date, end_date, color, image_filename, link, track)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        timelineId,
        eventData.title,
        eventData.description,
        eventData.startDate,
        eventData.endDate,
        eventData.color,
        eventData.image,
        eventData.link,
        eventData.track
      ]
    );
    return result.rows[0];
  }

  async getEventsByTimelineId(timelineId) {
    const result = await this.db.query(
      'SELECT * FROM events WHERE timeline_id = $1 ORDER BY start_date',
      [timelineId]
    );
    return result.rows;
  }

  async updateEvent(id, timelineId, updates) {
    const setClause = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['title', 'description', 'start_date', 'end_date', 'color', 'image_filename', 'link', 'track'];
    const fieldMap = {
      startDate: 'start_date',
      endDate: 'end_date',
      image: 'image_filename'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key] || key;
      if (allowedFields.includes(dbField) && value !== undefined) {
        setClause.push(`${dbField} = $${paramCount++}`);
        values.push(value);
      }
    }

    if (setClause.length === 0) return null;

    setClause.push(`updated_at = NOW()`);
    values.push(id, timelineId);

    const result = await this.db.query(
      `UPDATE events SET ${setClause.join(', ')} WHERE id = $${paramCount++} AND timeline_id = $${paramCount++} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async deleteEvent(id, timelineId) {
    const result = await this.db.query(
      'DELETE FROM events WHERE id = $1 AND timeline_id = $2 RETURNING *',
      [id, timelineId]
    );
    return result.rows[0];
  }

  // Highlight operations
  async createHighlight(timelineId, highlightData) {
    const result = await this.db.query(
      `INSERT INTO highlights (timeline_id, start_date, end_date, start_label, end_label, color)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        timelineId,
        highlightData.startDate,
        highlightData.endDate,
        highlightData.startLabel,
        highlightData.endLabel,
        highlightData.color
      ]
    );
    return result.rows[0];
  }

  async getHighlightsByTimelineId(timelineId) {
    const result = await this.db.query(
      'SELECT * FROM highlights WHERE timeline_id = $1 ORDER BY start_date',
      [timelineId]
    );
    return result.rows;
  }

  async updateHighlight(id, timelineId, updates) {
    const setClause = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['start_date', 'end_date', 'start_label', 'end_label', 'color'];
    const fieldMap = {
      startDate: 'start_date',
      endDate: 'end_date',
      startLabel: 'start_label',
      endLabel: 'end_label'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key] || key;
      if (allowedFields.includes(dbField) && value !== undefined) {
        setClause.push(`${dbField} = $${paramCount++}`);
        values.push(value);
      }
    }

    if (setClause.length === 0) return null;

    setClause.push(`updated_at = NOW()`);
    values.push(id, timelineId);

    const result = await this.db.query(
      `UPDATE highlights SET ${setClause.join(', ')} WHERE id = $${paramCount++} AND timeline_id = $${paramCount++} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async deleteHighlight(id, timelineId) {
    const result = await this.db.query(
      'DELETE FROM highlights WHERE id = $1 AND timeline_id = $2 RETURNING *',
      [id, timelineId]
    );
    return result.rows[0];
  }

  // Image operations
  async saveImage(filename, data, mimeType, size) {
    const result = await this.db.query(
      'INSERT INTO images (filename, data, mime_type, size) VALUES ($1, $2, $3, $4) ON CONFLICT (filename) DO UPDATE SET data = $2, mime_type = $3, size = $4 RETURNING *',
      [filename, data, mimeType, size]
    );
    return result.rows[0];
  }

  async getImage(filename) {
    const result = await this.db.query(
      'SELECT * FROM images WHERE filename = $1',
      [filename]
    );
    return result.rows[0];
  }

  async deleteImage(filename) {
    const result = await this.db.query(
      'DELETE FROM images WHERE filename = $1 RETURNING *',
      [filename]
    );
    return result.rows[0];
  }

  // Full timeline data operations (for import/export compatibility)
  async getFullTimelineData(timelineId, userId) {
    const timeline = await this.getTimelineById(timelineId, userId);
    if (!timeline) return null;

    const events = await this.getEventsByTimelineId(timelineId);
    const highlights = await this.getHighlightsByTimelineId(timelineId);

    return {
      id: timeline.id,
      name: timeline.name,
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startDate: event.start_date,
        endDate: event.end_date,
        color: event.color,
        image: event.image_filename,
        link: event.link,
        track: event.track
      })),
      highlights: highlights.map(highlight => ({
        id: highlight.id,
        startDate: highlight.start_date,
        endDate: highlight.end_date,
        startLabel: highlight.start_label,
        endLabel: highlight.end_label,
        color: highlight.color
      })),
      settings: timeline.settings,
      createdAt: timeline.created_at,
      updatedAt: timeline.updated_at
    };
  }
}
