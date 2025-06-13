import express from 'express';
import { DatabaseHelpers } from '../lib/database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Apply authentication to all timeline routes
router.use(authenticateToken);

// Get all timelines for the current user
router.get('/', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);
    const timelines = await db.getTimelinesByUserId(req.user.id);

    res.json(timelines.map(timeline => ({
      id: timeline.id,
      name: timeline.name,
      settings: timeline.settings,
      createdAt: timeline.created_at,
      updatedAt: timeline.updated_at
    })));
  } catch (error) {
    console.error('Get timelines error:', error);
    res.status(500).json({ error: 'Failed to get timelines' });
  }
});

// Get a specific timeline with all its data
router.get('/:id', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);
    const timelineData = await db.getFullTimelineData(req.params.id, req.user.id);

    if (!timelineData) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    res.json(timelineData);
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

// Create a new timeline
router.post('/', async (req, res) => {
  try {
    const { name, settings = {} } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Timeline name is required' });
    }

    const db = new DatabaseHelpers(req.db);
    const timeline = await db.createTimeline(req.user.id, name, settings);

    res.status(201).json({
      id: timeline.id,
      name: timeline.name,
      settings: timeline.settings,
      createdAt: timeline.created_at,
      updatedAt: timeline.updated_at
    });
  } catch (error) {
    console.error('Create timeline error:', error);
    res.status(500).json({ error: 'Failed to create timeline' });
  }
});

// Update a timeline
router.put('/:id', async (req, res) => {
  try {
    const { name, settings } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (settings !== undefined) updates.settings = settings;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const db = new DatabaseHelpers(req.db);
    const timeline = await db.updateTimeline(req.params.id, req.user.id, updates);

    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    res.json({
      id: timeline.id,
      name: timeline.name,
      settings: timeline.settings,
      createdAt: timeline.created_at,
      updatedAt: timeline.updated_at
    });
  } catch (error) {
    console.error('Update timeline error:', error);
    res.status(500).json({ error: 'Failed to update timeline' });
  }
});

// Delete a timeline
router.delete('/:id', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);
    const timeline = await db.deleteTimeline(req.params.id, req.user.id);

    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    res.json({ message: 'Timeline deleted successfully' });
  } catch (error) {
    console.error('Delete timeline error:', error);
    res.status(500).json({ error: 'Failed to delete timeline' });
  }
});

// Export timeline as JSON (compatible with existing format)
router.get('/:id/export', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);
    const timelineData = await db.getFullTimelineData(req.params.id, req.user.id);

    if (!timelineData) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    // Include images in export
    const imagesData = {};
    for (const event of timelineData.events) {
      if (event.image) {
        try {
          const imageRecord = await db.getImage(event.image);
          if (imageRecord) {
            imagesData[event.image] = imageRecord.data;
          }
        } catch (error) {
          console.warn(`Failed to load image ${event.image}:`, error);
        }
      }
    }

    const exportData = {
      timeline: {
        ...timelineData,
        exportedAt: new Date(),
        version: '1.0'
      },
      images: imagesData
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${timelineData.name}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Export timeline error:', error);
    res.status(500).json({ error: 'Failed to export timeline' });
  }
});

// Import timeline from JSON (compatible with existing format)
router.post('/import', async (req, res) => {
  try {
    const importData = req.body;

    let timelineData;
    let images = {};

    // Handle different import formats
    if (importData.timeline && importData.images) {
      // Full export with images
      timelineData = importData.timeline;
      images = importData.images;
    } else {
      // Timeline only
      timelineData = importData;
    }

    if (!timelineData.name) {
      return res.status(400).json({ error: 'Timeline name is required' });
    }

    const db = new DatabaseHelpers(req.db);

    // Create timeline
    const timeline = await db.createTimeline(
      req.user.id,
      timelineData.name,
      timelineData.settings || {}
    );

    // Import images first
    for (const [filename, base64Data] of Object.entries(images)) {
      try {
        // Extract mime type from base64 data
        const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const size = Math.round((base64Data.length * 3) / 4); // Approximate size

        await db.saveImage(filename, base64Data, mimeType, size);
      } catch (error) {
        console.warn(`Failed to import image ${filename}:`, error);
      }
    }

    // Import events
    if (timelineData.events) {
      for (const eventData of timelineData.events) {
        try {
          await db.createEvent(timeline.id, {
            title: eventData.title,
            description: eventData.description,
            startDate: new Date(eventData.startDate),
            endDate: eventData.endDate ? new Date(eventData.endDate) : null,
            color: eventData.color,
            image: eventData.image,
            link: eventData.link,
            track: eventData.track || 0
          });
        } catch (error) {
          console.warn(`Failed to import event ${eventData.title}:`, error);
        }
      }
    }

    // Import highlights
    if (timelineData.highlights) {
      for (const highlightData of timelineData.highlights) {
        try {
          await db.createHighlight(timeline.id, {
            startDate: new Date(highlightData.startDate),
            endDate: new Date(highlightData.endDate),
            startLabel: highlightData.startLabel,
            endLabel: highlightData.endLabel,
            color: highlightData.color || 'rgba(255, 235, 59, 0.25)'
          });
        } catch (error) {
          console.warn(`Failed to import highlight:`, error);
        }
      }
    }

    // Return the complete imported timeline
    const fullTimelineData = await db.getFullTimelineData(timeline.id, req.user.id);
    res.status(201).json(fullTimelineData);
  } catch (error) {
    console.error('Import timeline error:', error);
    res.status(500).json({ error: 'Failed to import timeline' });
  }
});

// Event routes
// Create event
router.post('/:id/events', async (req, res) => {
  try {
    const { title, description, startDate, endDate, color, image, link, track } = req.body;

    if (!title || !startDate) {
      return res.status(400).json({ error: 'Title and start date are required' });
    }

    const db = new DatabaseHelpers(req.db);

    // Verify timeline belongs to user
    const timeline = await db.getTimelineById(req.params.id, req.user.id);
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    const event = await db.createEvent(req.params.id, {
      title,
      description,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      color,
      image,
      link,
      track: track || 0
    });

    res.status(201).json({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      color: event.color,
      image: event.image_filename,
      link: event.link,
      track: event.track
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event
router.put('/:id/events/:eventId', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);

    // Verify timeline belongs to user
    const timeline = await db.getTimelineById(req.params.id, req.user.id);
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    const event = await db.updateEvent(req.params.eventId, req.params.id, req.body);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      color: event.color,
      image: event.image_filename,
      link: event.link,
      track: event.track
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/:id/events/:eventId', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);

    // Verify timeline belongs to user
    const timeline = await db.getTimelineById(req.params.id, req.user.id);
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    const event = await db.deleteEvent(req.params.eventId, req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Delete associated image if exists
    if (event.image_filename) {
      try {
        await db.deleteImage(event.image_filename);
      } catch (error) {
        console.warn(`Failed to delete image ${event.image_filename}:`, error);
      }
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Highlight routes
// Create highlight
router.post('/:id/highlights', async (req, res) => {
  try {
    const { startDate, endDate, startLabel, endLabel, color } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const db = new DatabaseHelpers(req.db);

    // Verify timeline belongs to user
    const timeline = await db.getTimelineById(req.params.id, req.user.id);
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    const highlight = await db.createHighlight(req.params.id, {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      startLabel,
      endLabel,
      color: color || 'rgba(255, 235, 59, 0.25)'
    });

    res.status(201).json({
      id: highlight.id,
      startDate: highlight.start_date,
      endDate: highlight.end_date,
      startLabel: highlight.start_label,
      endLabel: highlight.end_label,
      color: highlight.color
    });
  } catch (error) {
    console.error('Create highlight error:', error);
    res.status(500).json({ error: 'Failed to create highlight' });
  }
});

// Update highlight
router.put('/:id/highlights/:highlightId', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);

    // Verify timeline belongs to user
    const timeline = await db.getTimelineById(req.params.id, req.user.id);
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    const highlight = await db.updateHighlight(req.params.highlightId, req.params.id, req.body);

    if (!highlight) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    res.json({
      id: highlight.id,
      startDate: highlight.start_date,
      endDate: highlight.end_date,
      startLabel: highlight.start_label,
      endLabel: highlight.end_label,
      color: highlight.color
    });
  } catch (error) {
    console.error('Update highlight error:', error);
    res.status(500).json({ error: 'Failed to update highlight' });
  }
});

// Delete highlight
router.delete('/:id/highlights/:highlightId', async (req, res) => {
  try {
    const db = new DatabaseHelpers(req.db);

    // Verify timeline belongs to user
    const timeline = await db.getTimelineById(req.params.id, req.user.id);
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    const highlight = await db.deleteHighlight(req.params.highlightId, req.params.id);

    if (!highlight) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    res.json({ message: 'Highlight deleted successfully' });
  } catch (error) {
    console.error('Delete highlight error:', error);
    res.status(500).json({ error: 'Failed to delete highlight' });
  }
});

export default router;
