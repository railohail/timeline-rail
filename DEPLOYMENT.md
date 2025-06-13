# Timeline App - Heroku Deployment Guide

This guide explains how to deploy the Timeline application to Heroku with PostgreSQL database support.

## Prerequisites

- Heroku CLI installed
- Git repository set up
- Heroku account

## Deployment Steps

### 1. Create Heroku App

```bash
heroku create your-timeline-app-name
```

### 2. Add PostgreSQL Database

```bash
heroku addons:create heroku-postgresql:essential-0 --app your-timeline-app-name
```

This will automatically set the `DATABASE_URL` environment variable.

### 3. Set Environment Variables

```bash
# Set a secure JWT secret (generate a random string)
heroku config:set JWT_SECRET="your-super-secure-jwt-secret-here" --app your-timeline-app-name

# Set Node environment
heroku config:set NODE_ENV=production --app your-timeline-app-name
```

### 4. Deploy the Application

```bash
git add .
git commit -m "Deploy to Heroku with PostgreSQL support"
git push heroku main
```

### 5. Run Database Migration

After deployment, initialize the database tables:

```bash
heroku run npm run db:migrate --app your-timeline-app-name
```

## Environment Variables

The application requires these environment variables:

- `DATABASE_URL` - PostgreSQL connection string (automatically set by Heroku)
- `JWT_SECRET` - Secret key for JWT token signing (set manually)
- `NODE_ENV` - Environment (set to "production" for Heroku)
- `PORT` - Port number (automatically set by Heroku)

## Database Schema

The application creates these tables:

- `users` - User accounts with authentication
- `timelines` - Timeline metadata and settings
- `events` - Timeline events with dates, descriptions, etc.
- `highlights` - Timeline highlight periods
- `images` - Base64-encoded images for events

## Features

### JSON Import/Export Compatibility

The application maintains full compatibility with the existing JSON export format:

- **Import**: Upload JSON files from the previous system
- **Export**: Download timelines in the same JSON format
- **User Isolation**: Each user's data is completely separate
- **Image Support**: Images are stored in PostgreSQL and included in exports

### API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `GET /api/timelines` - List user's timelines
- `GET /api/timelines/:id` - Get timeline with all data
- `POST /api/timelines` - Create new timeline
- `POST /api/timelines/import` - Import timeline from JSON
- `GET /api/timelines/:id/export` - Export timeline as JSON
- `POST /api/images/upload` - Upload images
- `GET /api/images/:filename` - Get images

### Migration from Local Storage

Users can migrate their existing data by:

1. Exporting timelines from the old system (JSON format)
2. Creating an account on the new system
3. Using the import feature to upload their JSON files
4. All events, highlights, and images will be preserved

## Troubleshooting

### Database Connection Issues

Check the DATABASE_URL:
```bash
heroku config:get DATABASE_URL --app your-timeline-app-name
```

### Migration Errors

If migration fails, check logs:
```bash
heroku logs --tail --app your-timeline-app-name
```

### Application Errors

View application logs:
```bash
heroku logs --tail --app your-timeline-app-name
```

## Local Development

For local development with PostgreSQL:

1. Install PostgreSQL locally
2. Create a database
3. Set DATABASE_URL environment variable
4. Run migration: `npm run db:migrate`
5. Start development server: `npm run dev`

## Security Notes

- JWT tokens expire after 7 days
- Passwords are hashed with bcrypt
- All API endpoints require authentication except registration/login
- Users can only access their own data
- Images are stored as base64 in the database (consider cloud storage for production)

## Performance Considerations

- Database indexes are created for optimal query performance
- Images are cached with appropriate headers
- Connection pooling is configured for PostgreSQL
- Consider upgrading to a larger Heroku Postgres plan for heavy usage 