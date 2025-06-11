import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  TimelineEvent,
  TimelineLane,
  TimelineCategory,
  TimelineFilter,
  TimelineViewport,
  TimelineSettings,
  TimelineHistoryEntry,
  TimelineTheme,
  TimelineExportOptions,
  TimelineCollaborator,
  TimelineAnnotation,
} from '@/types/timeline'

// Default theme
const defaultTheme: TimelineTheme = {
  id: 'default',
  name: 'Default',
  colors: {
    background: '#ffffff',
    surface: '#f8f9fa',
    primary: '#3498db',
    secondary: '#6c757d',
    accent: '#e74c3c',
    text: '#2c3e50',
    textSecondary: '#7f8c8d',
    border: '#dee2e6',
    gridLines: '#e9ecef',
    currentTime: '#e74c3c',
  },
  fonts: {
    primary: 'Inter, system-ui, sans-serif',
    secondary: 'system-ui, sans-serif',
  },
}

// Predefined categories
const defaultCategories: TimelineCategory[] = [
  { id: 'work', name: 'Work', color: '#3498db', icon: '💼' },
  { id: 'personal', name: 'Personal', color: '#2ecc71', icon: '🏠' },
  { id: 'milestone', name: 'Milestone', color: '#f39c12', icon: '🎯' },
  { id: 'deadline', name: 'Deadline', color: '#e74c3c', icon: '⏰' },
  { id: 'meeting', name: 'Meeting', color: '#9b59b6', icon: '🤝' },
  { id: 'travel', name: 'Travel', color: '#1abc9c', icon: '✈️' },
  { id: 'education', name: 'Education', color: '#34495e', icon: '📚' },
  { id: 'health', name: 'Health', color: '#e67e22', icon: '🏥' },
]

export const useTimelineStore = defineStore('timeline', () => {
  // Core state
  const events = ref<TimelineEvent[]>([])
  const lanes = ref<TimelineLane[]>([
    { id: 'main', name: 'Main Timeline', color: '#3498db', height: 120, order: 0 },
  ])
  const categories = ref<TimelineCategory[]>(defaultCategories)
  const selectedEvents = ref<string[]>([])
  const selectedLanes = ref<string[]>([])
  const annotations = ref<TimelineAnnotation[]>([])
  const collaborators = ref<TimelineCollaborator[]>([])

  // Filter state
  const filter = ref<TimelineFilter>({
    categories: [],
    tags: [],
    priorities: [],
    lanes: [],
    status: [],
    searchText: '',
  })

  // Viewport state
  const viewport = ref<TimelineViewport>({
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    centerDate: new Date(),
    zoomLevel: 1,
    pixelsPerUnit: 15,
  })

  // Settings state
  const settings = ref<TimelineSettings>({
    theme: defaultTheme,
    showGrid: true,
    showCurrentTime: true,
    snapToGrid: false,
    autoSave: true,
    collaborative: false,
    animations: true,
    sounds: false,
    miniMap: true,
    defaultView: 'timeline',
    timeFormat: '24h',
    dateFormat: 'MM/dd/yyyy',
  })

  // History state
  const history = ref<TimelineHistoryEntry[]>([])
  const historyIndex = ref(-1)

  // UI state
  const isLoading = ref(false)
  const selectedTool = ref<'select' | 'pan' | 'zoom' | 'annotate' | 'create'>('select')
  const showSidebar = ref(true)
  const showMiniMap = ref(true)
  const draggedEvent = ref<string | null>(null)

  // Computed properties
  const filteredEvents = computed(() => {
    let filtered = events.value

    // Filter by search text
    if (filter.value.searchText) {
      const searchLower = filter.value.searchText.toLowerCase()
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(searchLower) ||
          event.description?.toLowerCase().includes(searchLower) ||
          event.tags?.some((tag) => tag.toLowerCase().includes(searchLower)),
      )
    }

    // Filter by categories
    if (filter.value.categories && filter.value.categories.length > 0) {
      filtered = filtered.filter((event) => filter.value.categories!.includes(event.category || ''))
    }

    // Filter by priorities
    if (filter.value.priorities && filter.value.priorities.length > 0) {
      filtered = filtered.filter((event) =>
        filter.value.priorities!.includes(event.priority || 'medium'),
      )
    }

    // Filter by lanes
    if (filter.value.lanes && filter.value.lanes.length > 0) {
      filtered = filtered.filter((event) => filter.value.lanes!.includes(event.lane || 'main'))
    }

    // Filter by status
    if (filter.value.status && filter.value.status.length > 0) {
      filtered = filtered.filter((event) =>
        filter.value.status!.includes(event.status || 'planned'),
      )
    }

    // Filter by date range
    if (filter.value.dateRange) {
      const { start, end } = filter.value.dateRange
      filtered = filtered.filter((event) => event.startDate >= start && event.startDate <= end)
    }

    // Filter by tags
    if (filter.value.tags && filter.value.tags.length > 0) {
      filtered = filtered.filter((event) =>
        event.tags?.some((tag) => filter.value.tags!.includes(tag)),
      )
    }

    return filtered
  })

  const visibleEvents = computed(() => {
    return filteredEvents.value.filter((event) => {
      const eventStart = event.startDate.getTime()
      const eventEnd = (event.endDate || event.startDate).getTime()
      const viewStart = viewport.value.startDate.getTime()
      const viewEnd = viewport.value.endDate.getTime()

      // Check if event overlaps with viewport
      return eventStart <= viewEnd && eventEnd >= viewStart
    })
  })

  const eventsByLane = computed(() => {
    const byLane: Record<string, TimelineEvent[]> = {}
    lanes.value.forEach((lane) => {
      byLane[lane.id] = visibleEvents.value.filter((event) => event.lane === lane.id)
    })
    return byLane
  })

  const totalTimespan = computed(() => {
    if (events.value.length === 0) return 0
    const dates = events.value.flatMap((e) => [e.startDate, e.endDate].filter(Boolean))
    const earliest = Math.min(...dates.map((d) => d!.getTime()))
    const latest = Math.max(...dates.map((d) => d!.getTime()))
    return latest - earliest
  })

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  // Actions
  const addEvent = (event: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEvent: TimelineEvent = {
      ...event,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lane: event.lane || 'main',
      status: event.status || 'planned',
      priority: event.priority || 'medium',
    }
    events.value.push(newEvent)
    addToHistory('add_event', newEvent)
  }

  const updateEvent = (id: string, updates: Partial<TimelineEvent>) => {
    const eventIndex = events.value.findIndex((e) => e.id === id)
    if (eventIndex !== -1) {
      const oldEvent = { ...events.value[eventIndex] }
      events.value[eventIndex] = {
        ...events.value[eventIndex],
        ...updates,
        updatedAt: new Date(),
      }
      addToHistory('update_event', { old: oldEvent, new: events.value[eventIndex] })
    }
  }

  const deleteEvent = (id: string) => {
    const eventIndex = events.value.findIndex((e) => e.id === id)
    if (eventIndex !== -1) {
      const deletedEvent = events.value[eventIndex]
      events.value.splice(eventIndex, 1)
      selectedEvents.value = selectedEvents.value.filter((eid) => eid !== id)
      addToHistory('delete_event', deletedEvent)
    }
  }

  const duplicateEvent = (id: string) => {
    const original = events.value.find((e) => e.id === id)
    if (original) {
      const duplicate = {
        ...original,
        title: `${original.title} (Copy)`,
        startDate: new Date(original.startDate.getTime() + 24 * 60 * 60 * 1000), // Next day
        endDate: original.endDate
          ? new Date(original.endDate.getTime() + 24 * 60 * 60 * 1000)
          : undefined,
      }
      addEvent(duplicate)
    }
  }

  const addLane = (lane: Omit<TimelineLane, 'id' | 'order'>) => {
    const newLane: TimelineLane = {
      ...lane,
      id: generateId(),
      order: lanes.value.length,
      height: lane.height || 120,
    }
    lanes.value.push(newLane)
    addToHistory('add_lane', newLane)
  }

  const updateLane = (id: string, updates: Partial<TimelineLane>) => {
    const laneIndex = lanes.value.findIndex((l) => l.id === id)
    if (laneIndex !== -1) {
      const oldLane = { ...lanes.value[laneIndex] }
      lanes.value[laneIndex] = { ...lanes.value[laneIndex], ...updates }
      addToHistory('update_lane', { old: oldLane, new: lanes.value[laneIndex] })
    }
  }

  const deleteLane = (id: string) => {
    if (lanes.value.length <= 1) return // Keep at least one lane

    const laneIndex = lanes.value.findIndex((l) => l.id === id)
    if (laneIndex !== -1) {
      const deletedLane = lanes.value[laneIndex]
      lanes.value.splice(laneIndex, 1)

      // Move events from deleted lane to main lane
      events.value.forEach((event) => {
        if (event.lane === id) {
          event.lane = 'main'
        }
      })

      addToHistory('delete_lane', deletedLane)
    }
  }

  const setFilter = (newFilter: Partial<TimelineFilter>) => {
    filter.value = { ...filter.value, ...newFilter }
  }

  const clearFilter = () => {
    filter.value = {
      categories: [],
      tags: [],
      priorities: [],
      lanes: [],
      status: [],
      searchText: '',
    }
  }

  const setViewport = (newViewport: Partial<TimelineViewport>) => {
    viewport.value = { ...viewport.value, ...newViewport }
  }

  const zoomIn = () => {
    viewport.value.zoomLevel = Math.min(viewport.value.zoomLevel * 2, 16)
    viewport.value.pixelsPerUnit = Math.min(viewport.value.pixelsPerUnit * 1.5, 100)
  }

  const zoomOut = () => {
    viewport.value.zoomLevel = Math.max(viewport.value.zoomLevel / 2, 0.125)
    viewport.value.pixelsPerUnit = Math.max(viewport.value.pixelsPerUnit / 1.5, 2)
  }

  const resetZoom = () => {
    viewport.value.zoomLevel = 1
    viewport.value.pixelsPerUnit = 15
  }

  const centerOnDate = (date: Date) => {
    viewport.value.centerDate = date
  }

  const centerOnEvent = (eventId: string) => {
    const event = events.value.find((e) => e.id === eventId)
    if (event) {
      centerOnDate(event.startDate)
    }
  }

  const selectEvent = (eventId: string, multi = false) => {
    if (multi) {
      if (selectedEvents.value.includes(eventId)) {
        selectedEvents.value = selectedEvents.value.filter((id) => id !== eventId)
      } else {
        selectedEvents.value.push(eventId)
      }
    } else {
      selectedEvents.value = [eventId]
    }
  }

  const clearSelection = () => {
    selectedEvents.value = []
    selectedLanes.value = []
  }

  const undo = () => {
    if (canUndo.value) {
      historyIndex.value--
      applyHistoryEntry(history.value[historyIndex.value], true)
    }
  }

  const redo = () => {
    if (canRedo.value) {
      historyIndex.value++
      applyHistoryEntry(history.value[historyIndex.value], false)
    }
  }

  const addToHistory = (action: string, data: unknown) => {
    const entry: TimelineHistoryEntry = {
      id: generateId(),
      timestamp: new Date(),
      action,
      data: data as Record<string, unknown>,
    }

    // Remove any history entries after current index
    history.value.splice(historyIndex.value + 1)
    history.value.push(entry)
    historyIndex.value = history.value.length - 1

    // Limit history to 100 entries
    if (history.value.length > 100) {
      history.value.shift()
      historyIndex.value--
    }
  }

  const applyHistoryEntry = (entry: TimelineHistoryEntry, isUndo: boolean) => {
    // Implementation would depend on the specific action
    // This is a simplified version
    switch (entry.action) {
      case 'add_event':
        if (isUndo) {
          const event = entry.data as unknown as TimelineEvent
          deleteEvent(event.id)
        }
        break
      case 'delete_event':
        if (!isUndo) {
          const event = entry.data as unknown as TimelineEvent
          events.value.push(event)
        }
        break
      // Add more cases as needed
    }
  }

  const exportTimeline = async (options: TimelineExportOptions) => {
    const exportData = {
      events: filteredEvents.value,
      lanes: lanes.value,
      categories: categories.value,
      settings: settings.value,
      exportedAt: new Date(),
    }

    switch (options.format) {
      case 'json':
        return JSON.stringify(exportData, null, 2)
      case 'csv':
        return convertToCSV(exportData.events)
      // Add other export formats
      default:
        return JSON.stringify(exportData, null, 2)
    }
  }

  const importTimeline = (data: string, format: 'json' | 'csv' = 'json') => {
    try {
      if (format === 'json') {
        const imported = JSON.parse(data)
        if (imported.events) events.value = imported.events
        if (imported.lanes) lanes.value = imported.lanes
        if (imported.categories) categories.value = imported.categories
      }
      // Add CSV import logic
    } catch (error) {
      console.error('Failed to import timeline data:', error)
      throw new Error('Invalid timeline data format')
    }
  }

  // Utility functions
  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  const convertToCSV = (events: TimelineEvent[]): string => {
    const headers = [
      'Title',
      'Start Date',
      'End Date',
      'Description',
      'Link',
      'Category',
      'Priority',
      'Status',
    ]
    const rows = events.map((event) => [
      event.title,
      event.startDate.toISOString(),
      event.endDate?.toISOString() || '',
      event.description || '',
      event.link || '',
      event.category || '',
      event.priority || '',
      event.status || '',
    ])

    return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
  }

  return {
    // State
    events,
    lanes,
    categories,
    selectedEvents,
    selectedLanes,
    annotations,
    collaborators,
    filter,
    viewport,
    settings,
    history,
    historyIndex,
    isLoading,
    selectedTool,
    showSidebar,
    showMiniMap,
    draggedEvent,

    // Computed
    filteredEvents,
    visibleEvents,
    eventsByLane,
    totalTimespan,
    canUndo,
    canRedo,

    // Actions
    addEvent,
    updateEvent,
    deleteEvent,
    duplicateEvent,
    addLane,
    updateLane,
    deleteLane,
    setFilter,
    clearFilter,
    setViewport,
    zoomIn,
    zoomOut,
    resetZoom,
    centerOnDate,
    centerOnEvent,
    selectEvent,
    clearSelection,
    undo,
    redo,
    exportTimeline,
    importTimeline,
  }
})
