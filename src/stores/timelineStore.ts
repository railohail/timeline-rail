import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storageManager } from '@/lib/storage'

export interface TimelineEvent {
  id: string
  title: string
  startDate: Date
  endDate?: Date
  description?: string
  color?: string
  image?: string
  track?: number
}

export interface TimelineHighlight {
  id: string
  startDate: Date
  endDate: Date
  startLabel?: string
  endLabel?: string
  color: string
}

export interface TimelineData {
  id: string
  name: string
  events: TimelineEvent[]
  highlights: TimelineHighlight[]
  settings: {
    centerDate: Date
    pixelsPerDay: number
    theme?: string
  }
  createdAt: Date
  updatedAt: Date
}

export const useTimelineStore = defineStore('timeline', () => {
  // State
  const currentTimeline = ref<TimelineData | null>(null)
  const availableTimelines = ref<string[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const events = computed(() => currentTimeline.value?.events || [])
  const highlights = computed(() => currentTimeline.value?.highlights || [])
  const settings = computed(() => currentTimeline.value?.settings || {
    centerDate: new Date(),
    pixelsPerDay: 50
  })

  // Actions
  async function createTimeline(name: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const newTimeline: TimelineData = {
        id: generateId(),
        name,
        events: [],
        highlights: [],
        settings: {
          centerDate: new Date(),
          pixelsPerDay: 50
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await saveTimelineToFile(newTimeline)
      currentTimeline.value = newTimeline
      await loadAvailableTimelines()
    } catch (err) {
      error.value = `Failed to create timeline: ${err}`
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function loadTimeline(id: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const timeline = await loadTimelineFromFile(id)
      currentTimeline.value = timeline
    } catch (err) {
      error.value = `Failed to load timeline: ${err}`
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function saveCurrentTimeline(): Promise<void> {
    if (!currentTimeline.value) return

    isLoading.value = true
    error.value = null

    try {
      currentTimeline.value.updatedAt = new Date()
      await saveTimelineToFile(currentTimeline.value)
    } catch (err) {
      error.value = `Failed to save timeline: ${err}`
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function addEvent(event: Omit<TimelineEvent, 'id'>): Promise<void> {
    if (!currentTimeline.value) return

    const newEvent: TimelineEvent = {
      ...event,
      id: generateId(),
      startDate: new Date(event.startDate),
      endDate: event.endDate ? new Date(event.endDate) : undefined
    }

    currentTimeline.value.events.push(newEvent)
    await saveCurrentTimeline()
  }

  async function updateEvent(id: string, updates: Partial<TimelineEvent>): Promise<void> {
    if (!currentTimeline.value) return

    const eventIndex = currentTimeline.value.events.findIndex(e => e.id === id)
    if (eventIndex === -1) return

    currentTimeline.value.events[eventIndex] = {
      ...currentTimeline.value.events[eventIndex],
      ...updates
    }

    await saveCurrentTimeline()
  }

  async function deleteEvent(id: string): Promise<void> {
    if (!currentTimeline.value) return

    const eventIndex = currentTimeline.value.events.findIndex(e => e.id === id)
    if (eventIndex === -1) return

    // Delete associated image if exists
    const event = currentTimeline.value.events[eventIndex]
    if (event.image) {
      await deleteImage(event.image)
    }

    currentTimeline.value.events.splice(eventIndex, 1)
    await saveCurrentTimeline()
  }

  async function addHighlight(highlight: Omit<TimelineHighlight, 'id'>): Promise<void> {
    if (!currentTimeline.value) return

    const newHighlight: TimelineHighlight = {
      ...highlight,
      id: generateId(),
      startDate: new Date(highlight.startDate),
      endDate: new Date(highlight.endDate)
    }

    currentTimeline.value.highlights.push(newHighlight)
    await saveCurrentTimeline()
  }

  async function deleteHighlight(id: string): Promise<void> {
    if (!currentTimeline.value) return

    const highlightIndex = currentTimeline.value.highlights.findIndex(h => h.id === id)
    if (highlightIndex === -1) return

    currentTimeline.value.highlights.splice(highlightIndex, 1)
    await saveCurrentTimeline()
  }

  async function saveImage(file: File): Promise<string> {
    try {
      const imageId = generateId()
      const extension = file.name.split('.').pop() || 'jpg'
      const filename = `event-${imageId}.${extension}`

      // Convert file to base64 for storage
      const base64 = await fileToBase64(file)

      // Save to our storage system
      await saveImageFile(filename, base64)

      return filename
    } catch (err) {
      throw new Error(`Failed to save image: ${err}`)
    }
  }

  async function loadAvailableTimelines(): Promise<void> {
    try {
      availableTimelines.value = await getAvailableTimelineIds()
    } catch (err) {
      error.value = `Failed to load available timelines: ${err}`
    }
  }

  async function exportTimeline(id?: string): Promise<Blob> {
    const timelineToExport = id ? await loadTimelineFromFile(id) : currentTimeline.value
    if (!timelineToExport) throw new Error('No timeline to export')

    const exportData = {
      ...timelineToExport,
      exportedAt: new Date(),
      version: '1.0'
    }

    return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  }

  async function importTimeline(file: File): Promise<void> {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as TimelineData

      // Validate and sanitize data
      const timeline: TimelineData = {
        ...data,
        id: generateId(), // Generate new ID to avoid conflicts
        updatedAt: new Date(),
        events: data.events.map(e => ({
          ...e,
          startDate: new Date(e.startDate),
          endDate: e.endDate ? new Date(e.endDate) : undefined
        })),
        highlights: data.highlights.map(h => ({
          ...h,
          startDate: new Date(h.startDate),
          endDate: new Date(h.endDate)
        }))
      }

      await saveTimelineToFile(timeline)
      currentTimeline.value = timeline
      await loadAvailableTimelines()
    } catch (err) {
      throw new Error(`Failed to import timeline: ${err}`)
    }
  }

    // Initialize store
  async function initialize(): Promise<void> {
    // Initialize storage manager first
    await storageManager.init()

    await loadAvailableTimelines()

    // Load default timeline or create one
    if (availableTimelines.value.length === 0) {
      await createTimeline('Default Timeline')
    } else {
      await loadTimeline(availableTimelines.value[0])
    }
  }

    async function deleteTimeline(id: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      await storageManager.deleteTimeline(id)

      // If we deleted the current timeline, load another one or create a new one
      if (currentTimeline.value?.id === id) {
        await loadAvailableTimelines()
        if (availableTimelines.value.length > 0) {
          await loadTimeline(availableTimelines.value[0])
        } else {
          await createTimeline('Default Timeline')
        }
      } else {
        await loadAvailableTimelines()
      }
    } catch (err) {
      error.value = `Failed to delete timeline: ${err}`
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    currentTimeline,
    availableTimelines,
    isLoading,
    error,

    // Computed
    events,
    highlights,
    settings,

    // Actions
    createTimeline,
    loadTimeline,
    saveCurrentTimeline,
    addEvent,
    updateEvent,
    deleteEvent,
    addHighlight,
    deleteHighlight,
    deleteTimeline,
    saveImage,
    loadAvailableTimelines,
    exportTimeline,
    importTimeline,
    initialize
  }
})

// Utility functions
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
  })
}

// Storage functions using the storage manager
async function saveTimelineToFile(timeline: TimelineData): Promise<void> {
  await storageManager.saveTimeline(timeline)
}

async function loadTimelineFromFile(id: string): Promise<TimelineData> {
  const timeline = await storageManager.loadTimeline(id)
  return {
    ...timeline,
    events: timeline.events.map(e => ({
      ...e,
      startDate: new Date(e.startDate),
      endDate: e.endDate ? new Date(e.endDate) : undefined
    })),
    highlights: timeline.highlights.map(h => ({
      ...h,
      startDate: new Date(h.startDate),
      endDate: new Date(h.endDate)
    })),
    settings: {
      ...timeline.settings,
      centerDate: new Date(timeline.settings.centerDate)
    }
  }
}

async function getAvailableTimelineIds(): Promise<string[]> {
  return await storageManager.listTimelines()
}

async function saveImageFile(filename: string, base64Data: string): Promise<void> {
  await storageManager.saveImage(filename, base64Data)
}

async function deleteImage(filename: string): Promise<void> {
  await storageManager.deleteImage(filename)
}
