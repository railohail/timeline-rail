import { createDatabase, initializeDatabase } from '../lib/database.js';

async function migrate() {
  console.log('Starting database migration...');

  try {
    // Create database connection
    const db = createDatabase();
    console.log('Database connection established');

    // Initialize database tables
    await initializeDatabase(db);
    console.log('Database tables created successfully');

    // Close connection
    await db.end();
    console.log('Migration completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
