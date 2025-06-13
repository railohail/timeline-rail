import type { TimelineData } from '@/stores/timelineStore'

// API configuration
const API_BASE_URL = '/api'

// API response types
interface ApiTimelineResponse {
  id: string
  name: string
  events: Array<{
    id: string
    title: string
    description?: string
    startDate: string
    endDate?: string
    color?: string
    image?: string
    link?: string
    track?: number
  }>
  highlights: Array<{
    id: string
    startDate: string
    endDate: string
    startLabel?: string
    endLabel?: string
    color: string
  }>
  settings: {
    centerDate: string
    pixelsPerDay: number
    theme?: string
  }
  createdAt: string
  updatedAt: string
}

interface ApiTimelineListResponse {
  id: string
  name: string
  settings: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// API client for timeline operations
class ApiStorageAdapter {
  private token: string | null = null

  setAuthToken(token: string | null) {
    this.token = token
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${API_BASE_URL}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    return response
  }

  // Timeline operations
  async saveTimeline(timeline: TimelineData): Promise<void> {
    if (timeline.id && await this.timelineExists(timeline.id)) {
      // Update existing timeline
      await this.makeRequest(`/timelines/${timeline.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: timeline.name,
          settings: timeline.settings
        })
      })

      // Update events and highlights separately
      await this.syncTimelineData(timeline)
    } else {
      // Create new timeline via import
      await this.makeRequest('/timelines/import', {
        method: 'POST',
        body: JSON.stringify(timeline)
      })
    }
  }

      async loadTimeline(id: string): Promise<TimelineData> {
    const response = await this.makeRequest(`/timelines/${id}`)
    const data = await response.json() as ApiTimelineResponse

    return {
      id: data.id,
      name: data.name,
      events: data.events.map((e) => ({
        ...e,
        startDate: new Date(e.startDate),
        endDate: e.endDate ? new Date(e.endDate) : undefined
      })),
      highlights: data.highlights.map((h) => ({
        ...h,
        startDate: new Date(h.startDate),
        endDate: new Date(h.endDate)
      })),
      settings: {
        ...data.settings,
        centerDate: new Date(data.settings.centerDate),
        pixelsPerDay: data.settings.pixelsPerDay || 50
      },
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    }
  }

  async deleteTimeline(id: string): Promise<void> {
    await this.makeRequest(`/timelines/${id}`, {
      method: 'DELETE'
    })
  }

  async listTimelines(): Promise<string[]> {
    const response = await this.makeRequest('/timelines')
    const timelines = await response.json() as ApiTimelineListResponse[]
    return timelines.map((t) => t.id)
  }

  async timelineExists(id: string): Promise<boolean> {
    try {
      await this.makeRequest(`/timelines/${id}`)
      return true
    } catch {
      return false
    }
  }

  // Helper method to sync timeline data (events and highlights)
  private async syncTimelineData(timeline: TimelineData): Promise<void> {
    // Get current timeline data to compare
    const currentData = await this.loadTimeline(timeline.id)

    // Sync events
    const currentEventIds = new Set(currentData.events.map(e => e.id))
    const newEventIds = new Set(timeline.events.map(e => e.id))

    // Delete removed events
    for (const event of currentData.events) {
      if (!newEventIds.has(event.id)) {
        await this.makeRequest(`/timelines/${timeline.id}/events/${event.id}`, {
          method: 'DELETE'
        })
      }
    }

    // Create or update events
    for (const event of timeline.events) {
      if (currentEventIds.has(event.id)) {
        // Update existing event
        await this.makeRequest(`/timelines/${timeline.id}/events/${event.id}`, {
          method: 'PUT',
          body: JSON.stringify(event)
        })
      } else {
        // Create new event
        await this.makeRequest(`/timelines/${timeline.id}/events`, {
          method: 'POST',
          body: JSON.stringify(event)
        })
      }
    }

    // Sync highlights
    const currentHighlightIds = new Set(currentData.highlights.map(h => h.id))
    const newHighlightIds = new Set(timeline.highlights.map(h => h.id))

    // Delete removed highlights
    for (const highlight of currentData.highlights) {
      if (!newHighlightIds.has(highlight.id)) {
        await this.makeRequest(`/timelines/${timeline.id}/highlights/${highlight.id}`, {
          method: 'DELETE'
        })
      }
    }

    // Create or update highlights
    for (const highlight of timeline.highlights) {
      if (currentHighlightIds.has(highlight.id)) {
        // Update existing highlight
        await this.makeRequest(`/timelines/${timeline.id}/highlights/${highlight.id}`, {
          method: 'PUT',
          body: JSON.stringify(highlight)
        })
      } else {
        // Create new highlight
        await this.makeRequest(`/timelines/${timeline.id}/highlights`, {
          method: 'POST',
          body: JSON.stringify(highlight)
        })
      }
    }
  }

  // Image operations
  async saveImage(filename: string, base64Data: string): Promise<void> {
    // Extract the actual base64 data and mime type
    const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/)
    if (!base64Match) {
      throw new Error('Invalid base64 data format')
    }

    const mimeType = base64Match[1]
    const base64Content = base64Match[2]

    // Convert base64 to blob for upload
    const byteCharacters = atob(base64Content)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: mimeType })

    // Create form data
    const formData = new FormData()
    formData.append('image', blob, filename)

    // Upload image
    const headers: Record<string, string> = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${API_BASE_URL}/images/upload`, {
      method: 'POST',
      headers,
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }
  }

  async loadImage(filename: string): Promise<string> {
    const response = await this.makeRequest(`/images/${filename}`)

    // Convert response to base64
    const arrayBuffer = await response.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const contentType = response.headers.get('Content-Type') || 'image/jpeg'

    return `data:${contentType};base64,${base64}`
  }

  async deleteImage(filename: string): Promise<void> {
    await this.makeRequest(`/images/${filename}`, {
      method: 'DELETE'
    })
  }

  // Export/Import operations
  async exportTimeline(timeline: TimelineData): Promise<Blob> {
    const response = await this.makeRequest(`/timelines/${timeline.id}/export`)
    return await response.blob()
  }

  async importTimeline(file: File): Promise<TimelineData> {
    const text = await file.text()
    const importData = JSON.parse(text)

    const response = await this.makeRequest('/timelines/import', {
      method: 'POST',
      body: JSON.stringify(importData)
    })

        const data = await response.json() as ApiTimelineResponse

    return {
      id: data.id,
      name: data.name,
      events: data.events.map((e) => ({
        ...e,
        startDate: new Date(e.startDate),
        endDate: e.endDate ? new Date(e.endDate) : undefined
      })),
      highlights: data.highlights.map((h) => ({
        ...h,
        startDate: new Date(h.startDate),
        endDate: new Date(h.endDate)
      })),
      settings: {
        ...data.settings,
        centerDate: new Date(data.settings.centerDate),
        pixelsPerDay: data.settings.pixelsPerDay || 50
      },
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    }
  }

  // Utility methods
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  async getStorageInfo(): Promise<{
    totalTimelines: number
    totalImages: number
    storageSize: number
  }> {
    const response = await this.makeRequest('/timelines')
    const timelines = await response.json()

    return {
      totalTimelines: timelines.length,
      totalImages: 0, // Would need additional endpoint
      storageSize: 0  // Would need additional endpoint
    }
  }
}

// Storage manager that uses API
class ApiStorageManager {
  private adapter: ApiStorageAdapter

  constructor() {
    this.adapter = new ApiStorageAdapter()
  }

  setAuthToken(token: string | null) {
    this.adapter.setAuthToken(token)
  }

  async init(): Promise<void> {
    // No initialization needed for API storage
    return Promise.resolve()
  }

  // Timeline operations
  async saveTimeline(timeline: TimelineData): Promise<void> {
    return this.adapter.saveTimeline(timeline)
  }

  async loadTimeline(id: string): Promise<TimelineData> {
    return this.adapter.loadTimeline(id)
  }

  async deleteTimeline(id: string): Promise<void> {
    return this.adapter.deleteTimeline(id)
  }

  async listTimelines(): Promise<string[]> {
    return this.adapter.listTimelines()
  }

  async timelineExists(id: string): Promise<boolean> {
    return this.adapter.timelineExists(id)
  }

  // Image operations
  async saveImage(filename: string, base64Data: string): Promise<void> {
    return this.adapter.saveImage(filename, base64Data)
  }

  async loadImage(filename: string): Promise<string> {
    return this.adapter.loadImage(filename)
  }

  async deleteImage(filename: string): Promise<void> {
    return this.adapter.deleteImage(filename)
  }

  // Export/Import operations
  async exportTimeline(timeline: TimelineData): Promise<Blob> {
    return this.adapter.exportTimeline(timeline)
  }

  async importTimeline(file: File): Promise<TimelineData> {
    return this.adapter.importTimeline(file)
  }

  // Utility methods
  generateId(): string {
    return this.adapter.generateId()
  }

  async getStorageInfo(): Promise<{
    totalTimelines: number
    totalImages: number
    storageSize: number
  }> {
    return this.adapter.getStorageInfo()
  }
}

// Export singleton instance
export const apiStorageManager = new ApiStorageManager()

// Export types
export type { TimelineData }
