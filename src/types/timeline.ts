export interface TimelineEvent {
  id: string
  title: string
  startDate: Date
  endDate?: Date
  description?: string
  color?: string
  category?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  tags?: string[]
  lane?: string
  dependencies?: string[] // IDs of events this depends on
  attachments?: TimelineAttachment[]
  metadata?: Record<string, string | number | boolean | Date>
  createdBy?: string
  createdAt?: Date
  updatedAt?: Date
  isRecurring?: boolean
  recurringPattern?: RecurringPattern
  visibility?: 'public' | 'private' | 'restricted'
  status?: 'planned' | 'in-progress' | 'completed' | 'cancelled'
}

export interface TimelineAttachment {
  id: string
  type: 'image' | 'video' | 'document' | 'link' | 'audio'
  url: string
  name: string
  size?: number
  thumbnail?: string
}

export interface RecurringPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  endDate?: Date
  occurrences?: number
}

export interface TimelineLane {
  id: string
  name: string
  color?: string
  height?: number
  collapsed?: boolean
  events?: string[] // Event IDs
  order?: number
}

export interface TimelineCategory {
  id: string
  name: string
  color: string
  icon?: string
  description?: string
}

export interface TimelineFilter {
  categories?: string[]
  tags?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  priorities?: ('low' | 'medium' | 'high' | 'critical')[]
  lanes?: string[]
  status?: ('planned' | 'in-progress' | 'completed' | 'cancelled')[]
  searchText?: string
}

export interface TimelineViewport {
  startDate: Date
  endDate: Date
  centerDate: Date
  zoomLevel: number
  pixelsPerUnit: number
}

export interface TimelineTheme {
  id: string
  name: string
  colors: {
    background: string
    surface: string
    primary: string
    secondary: string
    accent: string
    text: string
    textSecondary: string
    border: string
    gridLines: string
    currentTime: string
  }
  fonts: {
    primary: string
    secondary: string
  }
}

export interface TimelineSettings {
  theme: TimelineTheme
  showGrid: boolean
  showCurrentTime: boolean
  snapToGrid: boolean
  autoSave: boolean
  collaborative: boolean
  animations: boolean
  sounds: boolean
  miniMap: boolean
  defaultView: 'timeline' | 'gantt' | 'calendar'
  timeFormat: '12h' | '24h'
  dateFormat: string
}

export interface TimelineState {
  events: TimelineEvent[]
  lanes: TimelineLane[]
  categories: TimelineCategory[]
  selectedEvents: string[]
  selectedLanes: string[]
  filter: TimelineFilter
  viewport: TimelineViewport
  settings: TimelineSettings
  history: TimelineHistoryEntry[]
  historyIndex: number
}

export interface TimelineHistoryEntry {
  id: string
  timestamp: Date
  action: string
  data: Record<string, unknown>
  userId?: string
}

export interface TimelineExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'png' | 'svg'
  includeAttachments: boolean
  dateRange?: {
    start: Date
    end: Date
  }
  categories?: string[]
  lanes?: string[]
}

export interface TimelineCollaborator {
  id: string
  name: string
  email: string
  avatar?: string
  role: 'viewer' | 'editor' | 'admin'
  online: boolean
  cursor?: {
    x: number
    y: number
    date: Date
  }
}

export interface TimelineAnnotation {
  id: string
  x: number
  y: number
  date: Date
  text: string
  author: string
  timestamp: Date
  replies?: TimelineAnnotation[]
  resolved?: boolean
}
