import pg from 'pg'
import type { TimelineData } from '@/stores/timelineStore'

const { Pool } = pg

// Database connection pool
let pool: pg.Pool | null = null

// Initialize database connection
export function initDatabase() {
  if (!pool) {
    pool = new Pool({
      connectionString: import.meta.env.VITE_DATABASE_URL || process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })
  }
  return pool
}

// Initialize database tables
export async function createTables() {
  const client = initDatabase()

  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create timelines table
    await client.query(`
      CREATE TABLE IF NOT EXISTS timelines (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    console.log('Database tables created successfully')
  } catch (error) {
    console.error('Error creating tables:', error)
    throw error
  }
}

// User operations
export async function createUser(user: {
  id: string
  username: string
  email: string
  password: string
}) {
  const client = initDatabase()

  try {
    const result = await client.query(
      'INSERT INTO users (id, username, email, password) VALUES ($1, $2, $3, $4) RETURNING id, username, email, created_at',
      [user.id, user.username, user.email, user.password]
    )
    return result.rows[0]
  } catch (error) {
    console.error('Error creating user:', error)
    throw error
  }
}

export async function getUserByUsername(username: string) {
  const client = initDatabase()

  try {
    const result = await client.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting user by username:', error)
    throw error
  }
}

export async function getUserByEmail(email: string) {
  const client = initDatabase()

  try {
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting user by email:', error)
    throw error
  }
}

export async function getUserById(id: string) {
  const client = initDatabase()

  try {
    const result = await client.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting user by id:', error)
    throw error
  }
}

// Timeline operations
export async function saveTimeline(timeline: TimelineData, userId: string) {
  const client = initDatabase()

  try {
    const result = await client.query(
      `INSERT INTO timelines (id, user_id, name, data, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (id)
       DO UPDATE SET
         name = EXCLUDED.name,
         data = EXCLUDED.data,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [timeline.id, userId, timeline.name, JSON.stringify(timeline)]
    )
    return result.rows[0]
  } catch (error) {
    console.error('Error saving timeline:', error)
    throw error
  }
}

export async function getTimeline(id: string, userId: string): Promise<TimelineData | null> {
  const client = initDatabase()

  try {
    const result = await client.query(
      'SELECT data FROM timelines WHERE id = $1 AND user_id = $2',
      [id, userId]
    )
    return result.rows[0] ? JSON.parse(result.rows[0].data) : null
  } catch (error) {
    console.error('Error getting timeline:', error)
    throw error
  }
}

export async function listTimelines(userId: string): Promise<string[]> {
  const client = initDatabase()

  try {
    const result = await client.query(
      'SELECT id FROM timelines WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    )
    return result.rows.map(row => row.id)
  } catch (error) {
    console.error('Error listing timelines:', error)
    throw error
  }
}

export async function deleteTimeline(id: string, userId: string) {
  const client = initDatabase()

  try {
    const result = await client.query(
      'DELETE FROM timelines WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    )
    return result.rows.length > 0
  } catch (error) {
    console.error('Error deleting timeline:', error)
    throw error
  }
}

export async function timelineExists(id: string, userId: string): Promise<boolean> {
  const client = initDatabase()

  try {
    const result = await client.query(
      'SELECT 1 FROM timelines WHERE id = $1 AND user_id = $2',
      [id, userId]
    )
    return result.rows.length > 0
  } catch (error) {
    console.error('Error checking timeline existence:', error)
    throw error
  }
}
