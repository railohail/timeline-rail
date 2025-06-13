import { createDatabase } from '../lib/database.js';

async function migrateProduction() {
  console.log('Starting production database migration...');

  try {
    // Create database connection
    const db = createDatabase();
    console.log('Database connection established');

    const client = await db.connect();

    try {
      // Check if tables exist and create them if they don't
      console.log('Ensuring all tables exist...');

      // Create users table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create timelines table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS timelines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          settings JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create events table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timeline_id UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
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

      // Create highlights table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS highlights (
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

      // Create images table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS images (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          filename VARCHAR(255) UNIQUE NOT NULL,
          data TEXT NOT NULL,
          mime_type VARCHAR(100),
          size INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Update existing events table to change title from VARCHAR to TEXT
      console.log('Updating events table schema...');
      try {
        await client.query(`
          ALTER TABLE events ALTER COLUMN title TYPE TEXT;
        `);
        console.log('Successfully updated events.title column to TEXT');
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log('Events table title column already correct or table does not exist');
        } else {
          console.warn('Warning: Could not update events.title column:', error.message);
        }
      }

      // Create indexes if they don't exist
      console.log('Creating indexes...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_timelines_user_id ON timelines(user_id);
        CREATE INDEX IF NOT EXISTS idx_events_timeline_id ON events(timeline_id);
        CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
        CREATE INDEX IF NOT EXISTS idx_highlights_timeline_id ON highlights(timeline_id);
        CREATE INDEX IF NOT EXISTS idx_highlights_dates ON highlights(start_date, end_date);
      `);

      console.log('Database migration completed successfully');
    } finally {
      client.release();
    }

    // Close connection
    await db.end();
    console.log('Database connection closed');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateProduction();
