<template>
  <div
    class="timeline-container"
    :class="{ dragging: isDragging || isOverviewDragging }"
    ref="timelineContainer"
  >
    <!-- Add Event Form -->
    <div v-if="showAddForm" class="add-event-form" @click.stop>
      <div class="form-container">
        <div class="form-header">
          <h3>Add New Event</h3>
          <Button @click="closeAddForm" class="close-btn">×</Button>
        </div>
        <form @submit.prevent="addEvent">
          <div class="form-group">
            <label>Title *</label>
            <input v-model="newEvent.title" type="text" required placeholder="Event title" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea
              v-model="newEvent.description"
              placeholder="Event description"
              rows="3"
            ></textarea>
          </div>
          <div class="form-group">
            <label>Start Date *</label>
            <input v-model="newEvent.startDate" type="datetime-local" required />
          </div>
          <div class="form-group">
            <label>
              <input v-model="newEvent.isRange" type="checkbox" />
              This is a date range
            </label>
          </div>
          <div v-if="newEvent.isRange" class="form-group">
            <label>End Date</label>
            <input v-model="newEvent.endDate" type="datetime-local" />
          </div>
          <div class="form-group">
            <label>Color</label>
            <input v-model="newEvent.color" type="color" />
          </div>
          <div class="form-group">
            <label>Image</label>
            <input @change="handleImageUpload" type="file" accept="image/*" />
            <div v-if="newEvent.image" class="image-preview">
              <img :src="newEvent.image" alt="Preview" />
              <Button @click="removeImage" type="Button" class="remove-image">×</Button>
            </div>
          </div>
          <div class="form-actions">
            <Button type="Button" @click="closeAddForm" class="btn-cancel">Cancel</Button>
            <Button type="submit" class="btn-submit">Add Event</Button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Highlight Form -->
    <div v-if="showHighlightForm" class="add-event-form" @click.stop>
      <div class="form-container">
        <div class="form-header">
          <h3>Add Timeline Highlight</h3>
          <Button @click="closeHighlightForm" class="close-btn">×</Button>
        </div>
        <form @submit.prevent="addHighlight">
          <div class="form-group">
            <label>Start Time *</label>
            <input v-model="newHighlight.startDate" type="datetime-local" required />
          </div>
          <div class="form-group">
            <label>End Time *</label>
            <input v-model="newHighlight.endDate" type="datetime-local" required />
          </div>
          <div class="form-group">
            <label>Start Label</label>
            <input v-model="newHighlight.startLabel" type="text" placeholder="Start label" />
          </div>
          <div class="form-group">
            <label>End Label</label>
            <input v-model="newHighlight.endLabel" type="text" placeholder="End label" />
          </div>
          <div class="form-group">
            <label>Color</label>
            <input v-model="newHighlight.color" type="color" />
          </div>
          <div class="form-actions">
            <Button type="Button" @click="closeHighlightForm" class="btn-cancel">Cancel</Button>
            <Button type="submit" class="btn-submit">Add Highlight</Button>
          </div>
        </form>
      </div>
    </div>

    <!-- Main Detail Band -->
    <div class="timeline-band detail-band">
      <!-- Time axis -->
      <canvas
        ref="detailCanvas"
        class="timeline-canvas"
        @mousedown="startDrag"
        @mousemove="handleDrag"
        @mouseup="stopDrag"
        @wheel="handleZoom"
        @dblclick="handleCanvasDoubleClick"
      />

      <!-- Events layer -->
      <div class="events-layer">
        <div
          v-for="event in visibleEvents"
          :key="event.id"
          :data-event-id="event.id"
          class="timeline-event"
          :class="{ 'event-range': event.endDate, 'event-dragging': draggedEventId === event.id }"
          :style="getEventPosition(event)"
          @mousedown="startEventDrag(event, $event)"
          @mouseenter="handleEventHover(event)"
          @mouseleave="handleEventLeave(event)"
          @dblclick="handleEventDoubleClick(event, $event)"
        >
          <div
            v-if="event.endDate"
            class="event-range-bar"
            :style="getEventRangeStyle(event)"
          ></div>
          <div class="event-dot" :style="{ backgroundColor: event.color || defaultEventColor }"></div>
          <div class="event-label" v-if="shouldShowEventLabel()">{{ event.title }}</div>
        </div>
      </div>

      <!-- Highlights in Detail Band -->
      <div class="highlights-layer" v-if="timelineStore.highlights.length > 0">
        <div
          v-for="highlight in visibleHighlights"
          :key="`hl-${highlight.id}`"
          class="timeline-highlight"
          :style="getHighlightStyle(highlight, false)"
        >
          <div class="highlight-label highlight-start-label" v-if="highlight.startLabel">
            {{ highlight.startLabel }}
          </div>
          <div class="highlight-label highlight-end-label" v-if="highlight.endLabel">
            {{ highlight.endLabel }}
          </div>
        </div>
      </div>
    </div>

    <!-- Overview Band -->
    <div class="timeline-band overview-band">
      <canvas
        ref="overviewCanvas"
        class="timeline-canvas"
        @mousedown="startOverviewDrag"
        @mousemove="handleOverviewDrag"
        @mouseup="stopOverviewDrag($event)"
      />

      <!-- Events layer -->
      <div class="events-layer">
        <div
          v-for="event in overviewVisibleEvents"
          :key="`ov-${event.id}`"
          class="timeline-event overview-event"
          :style="getOverviewEventPosition(event)"
        >
          <div class="event-dot-small" :style="{ backgroundColor: event.color || defaultEventColor }"></div>
        </div>
      </div>

      <!-- Highlights in Overview Band -->
      <div class="highlights-layer overview-highlights-layer" v-if="timelineStore.highlights.length > 0">
        <div
          v-for="highlight in overviewVisibleHighlights"
          :key="`ovhl-${highlight.id}`"
          class="timeline-highlight overview-highlight"
          :style="getHighlightStyle(highlight, true)"
        ></div>
      </div>

      <!-- Viewport indicator -->
      <div class="viewport-indicator" :style="getViewportStyle()"></div>
    </div>

    <!-- Connections Layer -->
    <svg class="connections-layer" :width="containerWidth" :height="containerHeight">
      <path
        v-for="detail in eventDetails"
        :key="`line-${detail.event.id}`"
        :ref="(el) => setConnectionLineRef(el as Element | null, detail.event.id)"
        :d="detail.connectionPathD"
        :stroke="detail.event.color || defaultEventColor"
        :stroke-width="detail.isDragging ? 3 : 2"
        :stroke-dasharray="detail.isPinned ? 'none' : '5,5'"
        :opacity="detail.isPinned ? 0.7 : 0.5"
        fill="none"
        class="connection-line"
        :class="{ 'line-dragging': detail.isDragging }"
      />
    </svg>

    <!-- Event Details Panels -->
    <div
      v-for="detail in eventDetails"
      :key="`detail-${detail.event.id}`"
      :ref="(el) => setDetailPanelRef(el as HTMLElement | null, detail.event.id)"
      class="event-detail-panel"
      :class="{ 'detail-dragging': detail.isDragging, 'detail-pinned': detail.isPinned }"
      :style="{
        ...detail.position,
        borderColor: detail.isPinned ? detail.event.color || defaultEventColor : 'var(--border)',
        zIndex: detail.zIndex,
      }"
      @mousedown="startDetailDrag(detail, $event)"
      @click.stop
    >
      <div class="detail-header">
        <h4>{{ detail.event.title }}</h4>
        <div class="detail-header-actions">
          <Button
            @click="togglePin(detail)"
            class="pin-btn"
            :class="{ pinned: detail.isPinned }"
            title="Double-click event to pin/unpin"
          >
            📌
          </Button>
          <Button @click="removeEventDetail(detail.event.id)" class="close-btn">×</Button>
        </div>
      </div>
      <div class="detail-content">
        <div class="detail-date">
          <strong>{{ formatEventDate(detail.event) }}</strong>
        </div>
        <div v-if="detail.event.description" class="detail-description">
          {{ detail.event.description }}
        </div>
        <div v-if="detail.event.image" class="detail-image">
          <img :src="detail.event.image" :alt="detail.event.title" />
        </div>
        <div class="detail-actions">
          <Button @click="editEvent(detail.event)" class="btn-edit">Edit</Button>
          <Button @click="deleteEvent(detail.event.id)" class="btn-delete">Delete</Button>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div
      ref="controlsRef"
      class="timeline-controls"
      :class="{ 'controls-dragging': isControlsDragging }"
      :style="{
        bottom: `${controlsPosition.bottom}px`,
        left: `${controlsPosition.left}px`,
        right: 'auto',
        top: 'auto'
      }"
    >
      <div
        class="controls-handle"
        @mousedown="startControlsDrag"
        title="Drag to move controls"
      >
        <div class="handle-lines">
          <div class="handle-line"></div>
          <div class="handle-line"></div>
          <div class="handle-line"></div>
        </div>
      </div>
      <div class="controls-content">
        <Button @click="showAddEventForm" class="btn-add">+ Add Event</Button>
        <Button @click="showAddHighlightForm" class="btn-highlight">+ Add Highlight</Button>
        <Button @click="goToToday">Today</Button>
        <Button
          @click="zoomIn"
          :disabled="Math.abs(pixelsPerDay - maxPixelsPerDay) < 0.01"
          :class="{ 'btn-disabled': Math.abs(pixelsPerDay - maxPixelsPerDay) < 0.01 }"
        >+</Button>
        <Button
          @click="zoomOut"
          :disabled="Math.abs(pixelsPerDay - minPixelsPerDay) < 0.01"
          :class="{ 'btn-disabled': Math.abs(pixelsPerDay - minPixelsPerDay) < 0.01 }"
        >−</Button>
        <Button @click="fitToData">Fit All</Button>
        <span class="current-center">{{ formatDate(new Date(centerTime)) }}</span>
        <span class="zoom-level">{{ getZoomLevelText() }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'

interface TimelineEvent {
  id: string
  title: string
  startDate: Date
  endDate?: Date
  description?: string
  color?: string
  image?: string
  track?: number
}



interface EventDetail {
  event: TimelineEvent
  position: Record<string, string>
  isPinned: boolean
  isDragging?: boolean
  dragStart?: { x: number; y: number; left: number; top: number }
  velocity?: { x: number; y: number }
  mass?: number
  connectionPathD?: string
  zIndex: number
}

interface Props {
  events: TimelineEvent[]
  centerDate?: Date
}

const props = withDefaults(defineProps<Props>(), {
  centerDate: () => new Date(),
})

const emit = defineEmits<{
  'events-updated': [events: TimelineEvent[]]
}>()

// Template refs
const timelineContainer = ref<HTMLElement>()
const detailCanvas = ref<HTMLCanvasElement>()
const overviewCanvas = ref<HTMLCanvasElement>()

// Dimensions
const containerWidth = ref(1200)
const containerHeight = ref(800)
const detailHeight = 350
const overviewHeight = 80

// Timeline state
const centerTime = ref(props.centerDate.getTime())
const pixelsPerDay = ref(50)
const isDragging = ref(false)
const isOverviewDragging = ref(false)
const dragStartX = ref(0)
const dragStartTime = ref(0)
const hasDragged = ref(false)
const isRedrawing = ref(false)

// Controls bar dragging state
const controlsPosition = ref({ bottom: 150, left: 280 }) // Change these values to adjust initial position
const isControlsDragging = ref(false)
const controlsDragStart = ref({ x: 0, y: 0, left: 0, bottom: 0 })
const controlsRef = ref<HTMLElement>()

// Event management
const events = ref<TimelineEvent[]>([...props.events])
const draggedEventId = ref<string | null>(null)
const eventDragStart = ref({ x: 0, y: 0, originalDate: new Date() })

// Import the timeline store to save highlights
import { useTimelineStore, type TimelineHighlight } from '@/stores/timelineStore'
const timelineStore = useTimelineStore()

// UI state
const eventDetails = ref<EventDetail[]>([])
const hoveredEventId = ref<string | null>(null)
const hoverTimeout = ref<number | null>(null)
const draggingDetailId = ref<string | null>(null)
const physicsAnimationId = ref<number | null>(null)
const connectionLineRefs = ref<Map<string, SVGPathElement>>(new Map())
const detailPanelRefs = ref<Map<string, HTMLElement>>(new Map())

// Add event form
const showAddForm = ref(false)
const newEvent = ref({
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  isRange: false,
  color: '#4285f4',
  image: '',
})

// Highlights management
const showHighlightForm = ref(false)
const newHighlight = ref({
  startDate: '',
  endDate: '',
  startLabel: '',
  endLabel: '',
  color: 'rgba(255, 235, 59, 0.25)',
})

// Constants
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const YEAR_MS = 365.25 * DAY_MS
const MONTH_MS = 30.44 * DAY_MS

// Event tracks for collision avoidance
const eventTracks = ref<Map<string, number>>(new Map())

// Add this after the other ref declarations
const lastInteractionCounter = ref(0)

// After the ref declarations, add a theme observer ref
const themeObserver = ref<MutationObserver | null>(null)

// Add a computed property for the default color
const defaultEventColor = computed(() => {
  if (timelineContainer.value) {
    const computedStyle = getComputedStyle(timelineContainer.value)
    return computedStyle.getPropertyValue('--primary') || '#4285f4'
  }
  return '#4285f4'
})

// Computed properties for adaptive zoom
const minPixelsPerDay = computed(() => {
  // Set a reasonable minimum that allows viewing decades/centuries
  // Don't make it dependent on events to avoid zoom lock
  return Math.max(0.01, containerWidth.value / (100 * 365)) // Can view ~100 years
})

const maxPixelsPerDay = computed(() => {
  return 200 * 24 // 4800 pixels per day (very detailed view)
})

const zoomLevel = computed(() => {
  const logMin = Math.log(minPixelsPerDay.value)
  const logMax = Math.log(maxPixelsPerDay.value)
  const logCurrent = Math.log(pixelsPerDay.value)
  return Math.max(0, Math.min(1, (logCurrent - logMin) / (logMax - logMin)))
})

// Adaptive time intervals
const timeInterval = computed(() => {
  const viewSpanDays = containerWidth.value / pixelsPerDay.value

  if (viewSpanDays > 3650) {
    return { unit: 'decade', ms: 10 * YEAR_MS, format: 'decade' }
  } else if (viewSpanDays > 1825) {
    return { unit: 'year', ms: YEAR_MS, format: 'year' }
  } else if (viewSpanDays > 365) {
    return { unit: 'quarter', ms: YEAR_MS / 4, format: 'quarter' }
  } else if (viewSpanDays > 90) {
    return { unit: 'month', ms: MONTH_MS, format: 'month' }
  } else if (viewSpanDays > 14) {
    return { unit: 'week', ms: 7 * DAY_MS, format: 'week' }
  } else if (viewSpanDays > 2) {
    return { unit: 'day', ms: DAY_MS, format: 'day' }
  } else if (viewSpanDays > 0.5) {
    return { unit: '6hour', ms: 6 * HOUR_MS, format: 'hour' }
  } else {
    return { unit: 'hour', ms: HOUR_MS, format: 'hour' }
  }
})

const overviewTimeInterval = computed(() => {
  const overviewScale = pixelsPerDay.value * 0.1
  const viewSpanDays = containerWidth.value / overviewScale

  if (viewSpanDays > 36500) {
    return { unit: 'century', ms: 100 * YEAR_MS, format: 'century' }
  } else if (viewSpanDays > 18250) {
    return { unit: '50year', ms: 50 * YEAR_MS, format: '50year' }
  } else if (viewSpanDays > 3650) {
    return { unit: 'decade', ms: 10 * YEAR_MS, format: 'decade' }
  } else if (viewSpanDays > 1825) {
    return { unit: '5year', ms: 5 * YEAR_MS, format: '5year' }
  } else if (viewSpanDays > 365) {
    return { unit: 'year', ms: YEAR_MS, format: 'year' }
  } else if (viewSpanDays > 90) {
    return { unit: 'quarter', ms: YEAR_MS / 4, format: 'quarter' }
  } else if (viewSpanDays > 30) {
    return { unit: 'month', ms: MONTH_MS, format: 'month' }
  } else {
    return { unit: 'week', ms: 7 * DAY_MS, format: 'week' }
  }
})

const visibleEvents = computed(() => {
  const viewSpan = (containerWidth.value / pixelsPerDay.value) * DAY_MS
  const startTime = centerTime.value - viewSpan
  const endTime = centerTime.value + viewSpan

  return events.value.filter((event) => {
    const eventStartTime = event.startDate.getTime()
    const eventEndTime = event.endDate ? event.endDate.getTime() : eventStartTime
    return eventEndTime >= startTime && eventStartTime <= endTime
  })
})

const overviewVisibleEvents = computed(() => {
  const overviewScale = pixelsPerDay.value * 0.1
  const viewSpan = (containerWidth.value / overviewScale) * DAY_MS
  const startTime = centerTime.value - viewSpan
  const endTime = centerTime.value + viewSpan

  return events.value.filter((event) => {
    const eventStartTime = event.startDate.getTime()
    const eventEndTime = event.endDate ? event.endDate.getTime() : eventStartTime
    return eventEndTime >= startTime && eventStartTime <= endTime
  })
})

// Add these after the existing computed properties
const visibleHighlights = computed(() => {
  const viewSpan = (containerWidth.value / pixelsPerDay.value) * DAY_MS
  const startTime = centerTime.value - viewSpan
  const endTime = centerTime.value + viewSpan

  return timelineStore.highlights.filter((highlight: TimelineHighlight) => {
    return highlight.endDate.getTime() >= startTime && highlight.startDate.getTime() <= endTime
  })
})

const overviewVisibleHighlights = computed(() => {
  const overviewScale = pixelsPerDay.value * 0.1
  const viewSpan = (containerWidth.value / overviewScale) * DAY_MS
  const startTime = centerTime.value - viewSpan
  const endTime = centerTime.value + viewSpan

  return timelineStore.highlights.filter((highlight: TimelineHighlight) => {
    return highlight.endDate.getTime() >= startTime && highlight.startDate.getTime() <= endTime
  })
})

// Methods
function timeToPixel(time: number): number {
  const offsetTime = time - centerTime.value
  const offsetDays = offsetTime / DAY_MS
  return containerWidth.value / 2 + offsetDays * pixelsPerDay.value
}

function pixelToTime(pixel: number): number {
  const offsetPixels = pixel - containerWidth.value / 2
  const offsetDays = offsetPixels / pixelsPerDay.value
  return centerTime.value + offsetDays * DAY_MS
}

function getEventPosition(event: TimelineEvent): Record<string, string> {
  const x = timeToPixel(event.startDate.getTime())
  const track = getEventTrack(event)
  const y = 40 + track * 30

  return {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    transform: 'translate(-50%, -50%)',
  }
}

function getEventRangeStyle(event: TimelineEvent): Record<string, string> {
  if (!event.endDate) return {}

  const startX = timeToPixel(event.startDate.getTime())
  const endX = timeToPixel(event.endDate.getTime())
  const width = Math.max(endX - startX, 20)

  return {
    width: `${width}px`,
    backgroundColor: event.color || defaultEventColor.value,
    opacity: '0.3',
  }
}

function getOverviewEventPosition(event: TimelineEvent): Record<string, string> {
  const overviewScale = pixelsPerDay.value * 0.1
  const offsetTime = event.startDate.getTime() - centerTime.value
  const offsetDays = offsetTime / DAY_MS
  const x = containerWidth.value / 2 + offsetDays * overviewScale
  const y = 25

  return {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    transform: 'translate(-50%, -50%)',
  }
}

function getEventTrack(event: TimelineEvent): number {
  if (event.track !== undefined) return event.track

  if (!eventTracks.value.has(event.id)) {
    // Collision avoidance algorithm
    const eventTime = event.startDate.getTime()
    const eventEndTime = event.endDate ? event.endDate.getTime() : eventTime
    const usedTracks = new Set<number>()

    // Check for overlapping events
    for (const otherEvent of events.value) {
      if (otherEvent.id === event.id) continue

      const otherTime = otherEvent.startDate.getTime()
      const otherEndTime = otherEvent.endDate ? otherEvent.endDate.getTime() : otherTime

      // Check if events overlap
      if (!(eventEndTime < otherTime || eventTime > otherEndTime)) {
        const otherTrack = eventTracks.value.get(otherEvent.id)
        if (otherTrack !== undefined) {
          usedTracks.add(otherTrack)
        }
      }
    }

    // Find first available track
    let track = 0
    while (usedTracks.has(track)) {
      track++
    }

    eventTracks.value.set(event.id, track)
    event.track = track
  }

  return eventTracks.value.get(event.id) || 0
}

function getViewportStyle(): Record<string, string> {
  const detailViewSpan = (containerWidth.value / pixelsPerDay.value) * DAY_MS
  const overviewScale = pixelsPerDay.value * 0.1
  const overviewViewSpan = (containerWidth.value / overviewScale) * DAY_MS

  const indicatorWidthRatio = detailViewSpan / overviewViewSpan
  const indicatorWidth = Math.max(containerWidth.value * indicatorWidthRatio, 20)

  // Check if dark mode is active
  const isDarkMode = document.documentElement.classList.contains('dark') ||
                     document.body.classList.contains('dark')

  // Use brighter colors for dark mode
  const bgColor = isDarkMode ? 'rgba(255, 180, 0, 0.25)' : 'rgba(255, 200, 0, 0.3)'
  const borderColor = isDarkMode ? '#ffae00' : '#ffa500'

  return {
    position: 'absolute',
    left: `${containerWidth.value / 2 - indicatorWidth / 2}px`,
    top: '0',
    width: `${indicatorWidth}px`,
    height: '100%',
    backgroundColor: bgColor,
    border: `1px solid ${borderColor}`,
    pointerEvents: 'none',
  }
}

function shouldShowEventLabel(): boolean {
  return zoomLevel.value > 0.2
}

function startDrag(event: MouseEvent): void {
  const rect = detailCanvas.value?.getBoundingClientRect()
  if (!rect) return

  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartTime.value = centerTime.value
  hasDragged.value = false
  event.preventDefault()

  document.body.style.cursor = 'grabbing'
}

function handleDrag(event: MouseEvent): void {
  if (!isDragging.value && !isOverviewDragging.value) return

  const deltaX = event.clientX - dragStartX.value

  // Set drag threshold to distinguish from clicks
  if (Math.abs(deltaX) > 3) {
    hasDragged.value = true
  }

  // Use the appropriate scale based on which canvas is being dragged
  let scale = pixelsPerDay.value
  if (isOverviewDragging.value) {
    scale = pixelsPerDay.value * 0.1 // Overview scale
  }

  const deltaDays = deltaX / scale
  const deltaTime = deltaDays * DAY_MS

  // Correct direction: drag right (+deltaX) = see earlier times (-deltaTime)
  centerTime.value = dragStartTime.value - deltaTime

  // Use requestAnimationFrame for smooth updates
  if (!isRedrawing.value) {
    isRedrawing.value = true
    requestAnimationFrame(() => {
      redrawCanvases()
      isRedrawing.value = false
    })
  }
}

function stopDrag(): void {
  isDragging.value = false
  isOverviewDragging.value = false

  // Reset cursor
  document.body.style.cursor = ''

  // Reset drag flag immediately
  hasDragged.value = false
}

function handleZoom(event: WheelEvent): void {
  event.preventDefault()

  // Use consistent zoom factors and make them more responsive
  const zoomFactor = event.deltaY < 0 ? 1.2 : 1 / 1.2
  const newPixelsPerDay = pixelsPerDay.value * zoomFactor

  // Apply zoom limits
  const clampedValue = Math.max(
    minPixelsPerDay.value,
    Math.min(maxPixelsPerDay.value, newPixelsPerDay),
  )

  // Only update if the value actually changes (prevents zoom lock)
  if (Math.abs(clampedValue - pixelsPerDay.value) > 0.001) {
    pixelsPerDay.value = clampedValue
    redrawCanvases()
  }
}

function goToToday(): void {
  centerTime.value = Date.now()
  redrawCanvases()
}

function zoomIn(): void {
  const zoomFactor = 1.2
  const newPixelsPerDay = Math.min(maxPixelsPerDay.value, pixelsPerDay.value * zoomFactor)

  if (Math.abs(newPixelsPerDay - pixelsPerDay.value) > 0.001) {
    pixelsPerDay.value = newPixelsPerDay
    redrawCanvases()
  }
}

function zoomOut(): void {
  const zoomFactor = 1 / 1.2
  const newPixelsPerDay = Math.max(minPixelsPerDay.value, pixelsPerDay.value * zoomFactor)

  if (Math.abs(newPixelsPerDay - pixelsPerDay.value) > 0.001) {
    pixelsPerDay.value = newPixelsPerDay
    redrawCanvases()
  }
}

function fitToData(): void {
  if (events.value.length === 0) {
    // If no events, show a reasonable default view (1 year)
    pixelsPerDay.value = containerWidth.value / 365
    centerTime.value = Date.now()
    redrawCanvases()
    return
  }

  const dates = events.value.map((e) => e.startDate.getTime())
  const minTime = Math.min(...dates)
  const maxTime = Math.max(...dates)
  const span = Math.max(maxTime - minTime, DAY_MS) // At least 1 day
  const padding = span * 0.1

  centerTime.value = (minTime + maxTime) / 2

  const totalSpan = span + 2 * padding
  const totalDays = totalSpan / DAY_MS
  const idealPixelsPerDay = (containerWidth.value * 0.8) / totalDays

  pixelsPerDay.value = Math.max(
    minPixelsPerDay.value,
    Math.min(maxPixelsPerDay.value, idealPixelsPerDay),
  )

  redrawCanvases()
}

function drawTimeAxis(canvas: HTMLCanvasElement, scale: number, isOverview = false): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Get computed styles from the timeline container
  const computedStyle = timelineContainer.value ? getComputedStyle(timelineContainer.value) : null

  // Check if dark mode is active
  const isDarkMode = document.documentElement.classList.contains('dark') ||
                     document.body.classList.contains('dark')

  // Background
  if (computedStyle) {
    const bgColor = isOverview ? computedStyle.getPropertyValue('--muted') : computedStyle.getPropertyValue('--card')
    ctx.fillStyle = bgColor
  } else {
    ctx.fillStyle = isOverview ? '#f0f0f0' : '#f8f8f8'
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Grid and labels - use higher contrast in dark mode
  if (computedStyle) {
    // Use higher contrast colors in dark mode for better visibility
    if (isDarkMode) {
      ctx.strokeStyle = isOverview ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.2)'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    } else {
      ctx.strokeStyle = computedStyle.getPropertyValue('--border')
      ctx.fillStyle = computedStyle.getPropertyValue('--foreground')
    }
  } else {
    ctx.strokeStyle = '#ddd'
    ctx.fillStyle = '#333'
  }
  ctx.font = isOverview ? '10px Arial' : '11px Arial'
  ctx.textAlign = 'center'

  // Use appropriate time interval based on canvas type
  const interval = isOverview ? overviewTimeInterval.value : timeInterval.value
  const pixelsPerInterval = (interval.ms / DAY_MS) * scale

  // Ensure minimum spacing between markers
  const minSpacing = isOverview ? 60 : 40 // Minimum pixels between markers
  if (pixelsPerInterval < minSpacing) {
    // Skip drawing if intervals would be too close together
    return
  }

  const numIntervals = Math.ceil(canvas.width / pixelsPerInterval) + 2

  for (let i = -numIntervals; i <= numIntervals; i++) {
    const time = centerTime.value + i * interval.ms
    const x = isOverview
      ? canvas.width / 2 + i * pixelsPerInterval
      : canvas.width / 2 + i * pixelsPerInterval

    if (x >= -50 && x <= canvas.width + 50) {
      // Grid line
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()

      // Label
      const date = new Date(time)
      const label = formatTimeLabel(date, interval.format, isOverview)

      ctx.fillText(label, x, canvas.height - 5)
    }
  }

  // Current time line (only show in detail view)
  if (!isOverview) {
    const nowX = timeToPixel(Date.now())
    if (nowX >= 0 && nowX <= canvas.width) {
      // Make the current time line more visible in dark mode
      if (isDarkMode) {
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.85)' // Brighter red in dark mode
      } else {
        ctx.strokeStyle = computedStyle ? computedStyle.getPropertyValue('--destructive') : '#ff4444'
      }
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(nowX, 0)
      ctx.lineTo(nowX, canvas.height)
      ctx.stroke()
      ctx.lineWidth = 1
    }
  }
}

function formatTimeLabel(date: Date, format: string, isOverview = false): string {
  switch (format) {
    case 'century':
      return `${Math.floor(date.getFullYear() / 100) * 100}s`
    case '50year':
      return `${Math.floor(date.getFullYear() / 50) * 50}s`
    case '5year':
      return `${Math.floor(date.getFullYear() / 5) * 5}`
    case 'decade':
      return `${Math.floor(date.getFullYear() / 10) * 10}s`
    case 'year':
      return date.getFullYear().toString()
    case 'quarter':
      const quarter = Math.floor(date.getMonth() / 3) + 1
      return isOverview
        ? `Q${quarter} '${date.getFullYear().toString().slice(-2)}`
        : `Q${quarter} ${date.getFullYear()}`
    case 'month':
      return isOverview
        ? date.toLocaleDateString('en', { month: 'short' })
        : date.toLocaleDateString('en', { month: 'short', year: 'numeric' })
    case 'week':
      return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    case 'day':
      return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    case 'hour':
      return date.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
    default:
      return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }
}

function getZoomLevelText(): string {
  const viewSpanDays = containerWidth.value / pixelsPerDay.value
  const isAtMinZoom = Math.abs(pixelsPerDay.value - minPixelsPerDay.value) < 0.01
  const isAtMaxZoom = Math.abs(pixelsPerDay.value - maxPixelsPerDay.value) < 0.01

  let zoomText = ''
  if (viewSpanDays > 3650) zoomText = `${Math.round(viewSpanDays / 365)} years`
  else if (viewSpanDays > 365) zoomText = `${Math.round(viewSpanDays / 30)} months`
  else if (viewSpanDays > 30) zoomText = `${Math.round(viewSpanDays)} days`
  else if (viewSpanDays > 1) zoomText = `${Math.round(viewSpanDays * 24)} hours`
  else zoomText = `${Math.round(viewSpanDays * 24 * 60)} minutes`

  // Add zoom limit indicators
  if (isAtMinZoom) zoomText += ' (min)'
  else if (isAtMaxZoom) zoomText += ' (max)'

  return zoomText
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function redrawCanvases(): void {
  if (detailCanvas.value) {
    drawTimeAxis(detailCanvas.value, pixelsPerDay.value, false)
  }
  if (overviewCanvas.value) {
    drawTimeAxis(overviewCanvas.value, pixelsPerDay.value * 0.1, true)
  }
  updateAllConnectionPaths()
}

function resizeHandler(): void {
  if (!timelineContainer.value) return

  const rect = timelineContainer.value.getBoundingClientRect()
  containerWidth.value = rect.width

  if (detailCanvas.value) {
    detailCanvas.value.width = containerWidth.value
    detailCanvas.value.height = detailHeight
  }

  if (overviewCanvas.value) {
    overviewCanvas.value.width = containerWidth.value
    overviewCanvas.value.height = overviewHeight
  }

  redrawCanvases()
}

function startOverviewDrag(event: MouseEvent): void {
  const rect = overviewCanvas.value?.getBoundingClientRect()
  if (!rect) return

  isOverviewDragging.value = true
  dragStartX.value = event.clientX
  dragStartTime.value = centerTime.value
  hasDragged.value = false
  event.preventDefault()

  // Add dragging class to body for global cursor
  document.body.style.cursor = 'grabbing'
}

function handleOverviewDrag(event: MouseEvent): void {
  if (!isOverviewDragging.value) return

  const deltaX = event.clientX - dragStartX.value

  // Set drag threshold to distinguish from clicks
  if (Math.abs(deltaX) > 3) {
    hasDragged.value = true
  }

  // Use overview scale for drag calculation
  const overviewScale = pixelsPerDay.value * 0.1
  const deltaDays = deltaX / overviewScale
  const deltaTime = deltaDays * DAY_MS

  centerTime.value = dragStartTime.value - deltaTime
  redrawCanvases()
}

function stopOverviewDrag(event?: MouseEvent): void {
  // If we didn't drag, treat it as a click
  if (!hasDragged.value && event) {
    const rect = overviewCanvas.value?.getBoundingClientRect()
    if (rect) {
      const x = event.clientX - rect.left
      // Use overview scale for click calculation
      const overviewScale = pixelsPerDay.value * 0.1
      const centerPixel = containerWidth.value / 2
      const offsetPixels = x - centerPixel
      const offsetDays = offsetPixels / overviewScale
      const clickTime = centerTime.value + offsetDays * DAY_MS

      centerTime.value = clickTime
      redrawCanvases()
    }
  }

  isOverviewDragging.value = false
  // Reset cursor
  document.body.style.cursor = ''
}

function showAddEventForm(): void {
  showAddForm.value = true
  // Pre-set the start date to current center time for convenience
  const centerDate = new Date(centerTime.value)
  newEvent.value.startDate = centerDate.toISOString().slice(0, 16)
}

function closeAddForm(): void {
  showAddForm.value = false
  // Reset form
  newEvent.value = {
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    isRange: false,
    color: defaultEventColor.value,
    image: '',
  }
  // If we were editing, the original event was deleted.
  // Its line ref would have been removed by the :ref function when the element was unmounted.
  // If the event is re-added (which happens via a new event object usually), a new ref will be made.
}

async function addEvent(): Promise<void> {
  try {
    await timelineStore.addEvent({
      title: newEvent.value.title,
      description: newEvent.value.description,
      startDate: new Date(newEvent.value.startDate),
      endDate:
        newEvent.value.isRange && newEvent.value.endDate
          ? new Date(newEvent.value.endDate)
          : undefined,
      color: newEvent.value.color,
      image: newEvent.value.image,
    })

    // Update local events to match store
    events.value = [...timelineStore.events]
    emit('events-updated', events.value)
    closeAddForm()
  } catch (error) {
    console.error('Failed to add event:', error)
  }
}

function handleImageUpload(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      newEvent.value.image = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

function removeImage(): void {
  newEvent.value.image = ''
}

function handleEventHover(event: TimelineEvent): void {
  // Don't show details if dragging
  if (isDragging.value || draggedEventId.value) return

  hoveredEventId.value = event.id

  // Clear any existing timeout
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
  }

  // Show details after a short delay
  hoverTimeout.value = window.setTimeout(() => {
    showEventDetailOnHover(event)
  }, 300)
}

function handleEventLeave(event: TimelineEvent): void {
  hoveredEventId.value = null

  // Clear timeout
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
    hoverTimeout.value = null
  }

  // Remove non-pinned details for this event
  const detailIndex = eventDetails.value.findIndex((d) => d.event.id === event.id && !d.isPinned)
  if (detailIndex >= 0) {
    eventDetails.value.splice(detailIndex, 1)
  }
}

function handleEventDoubleClick(event: TimelineEvent, mouseEvent: MouseEvent): void {
  mouseEvent.stopPropagation()
  mouseEvent.preventDefault()

  const existingDetail = eventDetails.value.find((d) => d.event.id === event.id)

  if (existingDetail) {
    existingDetail.isPinned = !existingDetail.isPinned
    existingDetail.connectionPathD = getConnectionPath(existingDetail)
    // Bring to front when toggling pin
    lastInteractionCounter.value++
    existingDetail.zIndex = lastInteractionCounter.value
  } else {
    const position = calculateDetailPosition(mouseEvent, event)
    lastInteractionCounter.value++
    const newDetail: EventDetail = {
      event,
      position,
      isPinned: true,
      velocity: { x: 0, y: 0 },
      mass: 1,
      connectionPathD: '',
      zIndex: lastInteractionCounter.value,
    }
    newDetail.connectionPathD = getConnectionPath(newDetail)
    eventDetails.value.push(newDetail)
  }
}

function showEventDetailOnHover(event: TimelineEvent): void {
  // Don't show if already exists
  if (eventDetails.value.some((d) => d.event.id === event.id)) return

  // Get event element position
  const eventElement = document.querySelector(`[data-event-id="${event.id}"]`)
  if (!eventElement) return

  const rect = eventElement.getBoundingClientRect()
  const containerRect = timelineContainer.value?.getBoundingClientRect()
  if (!containerRect) return

  const mouseEvent = {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }

  const position = calculateDetailPosition(mouseEvent as MouseEvent, event)
  lastInteractionCounter.value++
  const newDetail: EventDetail = {
    event,
    position,
    isPinned: false,
    velocity: { x: 0, y: 0 },
    mass: 1,
    connectionPathD: '',
    zIndex: lastInteractionCounter.value,
  }
  newDetail.connectionPathD = getConnectionPath(newDetail)
  eventDetails.value.push(newDetail)
}

function calculateDetailPosition(
  mouseEvent: MouseEvent,
  event: TimelineEvent,
): Record<string, string> {
  const rect = timelineContainer.value?.getBoundingClientRect()
  if (!rect) return {}

  // Calculate initial position relative to timeline container
  let left = mouseEvent.clientX - rect.left + 20
  let top = mouseEvent.clientY - rect.top + 20

  const detailWidth = 300
  const detailHeight = 250
  const margin = 10

  // Check collision with existing details and adjust position
  const existingDetails = eventDetails.value.filter((d) => d.event.id !== event.id)

  for (let i = 0; i < 10; i++) {
    // Max 10 attempts to find a good position
    let hasCollision = false

    for (const detail of existingDetails) {
      const detailLeft = parseInt(detail.position.left || '0')
      const detailTop = parseInt(detail.position.top || '0')

      // Check for overlap
      if (
        left < detailLeft + detailWidth + margin &&
        left + detailWidth + margin > detailLeft &&
        top < detailTop + detailHeight + margin &&
        top + detailHeight + margin > detailTop
      ) {
        hasCollision = true
        // Try to position to the right
        left = detailLeft + detailWidth + margin

        // If too far right, go to next row
        if (left + detailWidth > containerWidth.value - 20) {
          left = 20
          top = detailTop + detailHeight + margin
        }
        break
      }
    }

    if (!hasCollision) break
  }

  // Keep within bounds
  left = Math.max(20, Math.min(left, containerWidth.value - detailWidth - 20))
  top = Math.max(20, Math.min(top, rect.height - detailHeight - 20))

  return {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${detailWidth}px`,
    zIndex: '9999',
  }
}

function startEventDrag(event: TimelineEvent, mouseEvent: MouseEvent): void {
  mouseEvent.stopPropagation()
  mouseEvent.preventDefault()

  draggedEventId.value = event.id
  eventDragStart.value = {
    x: mouseEvent.clientX,
    y: mouseEvent.clientY,
    originalDate: new Date(event.startDate),
  }

  // Set dragging flag to prevent click events
  hasDragged.value = true

  document.addEventListener('mousemove', handleEventDrag)
  document.addEventListener('mouseup', stopEventDrag)
}

function handleEventDrag(mouseEvent: MouseEvent): void {
  if (!draggedEventId.value) return

  const deltaX = mouseEvent.clientX - eventDragStart.value.x
  const deltaTime = (deltaX / pixelsPerDay.value) * DAY_MS
  const newStartDate = new Date(eventDragStart.value.originalDate.getTime() + deltaTime)

  // Update event
  const eventIndex = events.value.findIndex((e) => e.id === draggedEventId.value)
  if (eventIndex >= 0) {
    const event = events.value[eventIndex]
    const duration = event.endDate ? event.endDate.getTime() - event.startDate.getTime() : 0

    event.startDate = newStartDate
    if (event.endDate) {
      event.endDate = new Date(newStartDate.getTime() + duration)
    }

    // Clear track cache to recalculate collision avoidance
    eventTracks.value.delete(event.id)
  }
}

async function stopEventDrag(): Promise<void> {
  if (draggedEventId.value) {
    // Save the updated event to the store
    const draggedEvent = events.value.find(e => e.id === draggedEventId.value)
    if (draggedEvent) {
      try {
        await timelineStore.updateEvent(draggedEvent.id, {
          startDate: draggedEvent.startDate,
          endDate: draggedEvent.endDate
        })
      } catch (error) {
        console.error('Failed to save event position:', error)
      }
    }

    emit('events-updated', events.value)
    draggedEventId.value = null
  }

  // Reset drag flag after a small delay to prevent immediate clicks
  setTimeout(() => {
    hasDragged.value = false
  }, 100)

  document.removeEventListener('mousemove', handleEventDrag)
  document.removeEventListener('mouseup', stopEventDrag)
}

function editEvent(event: TimelineEvent): void {
  // Pre-fill form with event data
  newEvent.value = {
    title: event.title,
    description: event.description || '',
    startDate: event.startDate.toISOString().slice(0, 16),
    endDate: event.endDate ? event.endDate.toISOString().slice(0, 16) : '',
    isRange: !!event.endDate,
    color: event.color || defaultEventColor.value,
    image: event.image || '',
  }

  // Remove the event from the list (will be re-added when form is submitted)
  deleteEvent(event.id)
  showAddForm.value = true
}

async function deleteEvent(id: string): Promise<void> {
  try {
    await timelineStore.deleteEvent(id)

    // Update local events to match store
    events.value = [...timelineStore.events]
    eventTracks.value.delete(id)
    emit('events-updated', events.value)

    // Also remove any open details for this event
    removeEventDetail(id)
  } catch (error) {
    console.error('Failed to delete event:', error)
  }
}

function removeEventDetail(id: string): void {
  const index = eventDetails.value.findIndex((d) => d.event.id === id)
  if (index >= 0) {
    eventDetails.value.splice(index, 1)
    connectionLineRefs.value.delete(id)
    detailPanelRefs.value.delete(id)
  }
}

function handleCanvasDoubleClick(event: MouseEvent): void {
  // Don't add event if we're dragging
  if (isDragging.value || hasDragged.value) return

  const rect = detailCanvas.value?.getBoundingClientRect()
  if (!rect) return

  const x = event.clientX - rect.left
  const clickTime = pixelToTime(x)
  const clickDate = new Date(clickTime)

  // Pre-fill form with clicked time
  newEvent.value.startDate = clickDate.toISOString().slice(0, 16)
  showAddForm.value = true
}

function formatEventDate(event: TimelineEvent): string {
  const start = event.startDate.toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  if (event.endDate) {
    const end = event.endDate.toLocaleDateString('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    return `${start} - ${end}`
  }

  return start
}

function startDetailDrag(detail: EventDetail, mouseEvent: MouseEvent): void {
  // Only drag from header
  if (!(mouseEvent.target as Element).closest('.detail-header')) return

  mouseEvent.preventDefault()

  const detailLeft = parseInt(detail.position.left || '0')
  const detailTop = parseInt(detail.position.top || '0')

  detail.isDragging = true
  detail.dragStart = {
    x: mouseEvent.clientX,
    y: mouseEvent.clientY,
    left: detailLeft,
    top: detailTop,
  }

  // Reset velocity when starting to drag
  detail.velocity = { x: 0, y: 0 }

  // Increment counter and set z-index
  lastInteractionCounter.value++
  detail.zIndex = lastInteractionCounter.value

  draggingDetailId.value = detail.event.id

  document.addEventListener('mousemove', handleDetailDrag)
  document.addEventListener('mouseup', stopDetailDrag)
}

function handleDetailDrag(mouseEvent: MouseEvent): void {
  const detail = eventDetails.value.find((d) => d.event.id === draggingDetailId.value)
  if (!detail || !detail.dragStart) return

  const deltaX = mouseEvent.clientX - detail.dragStart.x
  const deltaY = mouseEvent.clientY - detail.dragStart.y

  const newLeft = detail.dragStart.left + deltaX
  const newTop = detail.dragStart.top + deltaY

  // Direct DOM manipulation for immediate feedback during drag
  const panelElement = detailPanelRefs.value.get(detail.event.id)
  if (panelElement) {
    panelElement.style.left = `${newLeft}px`
    panelElement.style.top = `${newTop}px`
  }

  // Update the connection line
  const newPathD = getConnectionPath(detail, newLeft, newTop)
  const pathElement = connectionLineRefs.value.get(detail.event.id)
  if (pathElement) {
    pathElement.setAttribute('d', newPathD)
  }

  // Store velocity for physics
  detail.velocity = { x: deltaX * 0.03, y: deltaY * 0.03 }
}

function stopDetailDrag(): void {
  const detail = eventDetails.value.find((d) => d.event.id === draggingDetailId.value)
  if (detail) {
    // Get the final position from the DOM element
    const panelElement = detailPanelRefs.value.get(detail.event.id)
    if (panelElement) {
      const finalLeft = parseInt(panelElement.style.left)
      const finalTop = parseInt(panelElement.style.top)

      // Update Vue's reactive state with the final position
      detail.position.left = `${finalLeft}px`
      detail.position.top = `${finalTop}px`
      detail.connectionPathD = getConnectionPath(detail, finalLeft, finalTop)

      // Keep the high z-index after dragging
      panelElement.style.zIndex = detail.zIndex.toString()
    }

    detail.isDragging = false
    detail.dragStart = undefined
  }

  draggingDetailId.value = null

  document.removeEventListener('mousemove', handleDetailDrag)
  document.removeEventListener('mouseup', stopDetailDrag)
}

function startPhysicsSimulation(): void {
  if (physicsAnimationId.value) return

  const animate = () => {
    applyPhysics()
    physicsAnimationId.value = requestAnimationFrame(animate)
  }

  physicsAnimationId.value = requestAnimationFrame(animate)

  // Stop simulation after a while if no movement
  setTimeout(() => {
    const hasMovement = eventDetails.value.some(
      (d) => d.velocity && (Math.abs(d.velocity.x) > 0.1 || Math.abs(d.velocity.y) > 0.1),
    )
    if (!hasMovement && !draggingDetailId.value) {
      stopPhysicsSimulation()
    }
  }, 3000)
}

function stopPhysicsSimulation(): void {
  if (physicsAnimationId.value) {
    cancelAnimationFrame(physicsAnimationId.value)
    physicsAnimationId.value = null
  }
}

function applyPhysics(): void {
  const detailWidth = 300
  const detailHeight = 250
  const damping = 0.95
  const bounciness = 0.8
  const minVelocity = 0.1

  for (const detail of eventDetails.value) {
    if (detail.isDragging) continue
    if (!detail.velocity) detail.velocity = { x: 0, y: 0 }

    let left = parseInt(detail.position.left || '0')
    let top = parseInt(detail.position.top || '0')

    left += detail.velocity.x
    top += detail.velocity.y

    detail.velocity.x *= damping
    detail.velocity.y *= damping

    if (Math.abs(detail.velocity.x) < minVelocity) detail.velocity.x = 0
    if (Math.abs(detail.velocity.y) < minVelocity) detail.velocity.y = 0

    if (left <= 0 || left >= containerWidth.value - detailWidth) {
      detail.velocity.x *= -bounciness
      left = Math.max(0, Math.min(left, containerWidth.value - detailWidth))
    }
    if (top <= 0 || top >= containerHeight.value - detailHeight) {
      detail.velocity.y *= -bounciness
      top = Math.max(0, Math.min(top, containerHeight.value - detailHeight))
    }

    detail.position.left = `${left}px`
    detail.position.top = `${top}px`
    detail.connectionPathD = getConnectionPath(detail)
  }

  for (let i = 0; i < eventDetails.value.length; i++) {
    for (let j = i + 1; j < eventDetails.value.length; j++) {
      checkAndResolveCollision(
        eventDetails.value[i],
        eventDetails.value[j],
        detailWidth,
        detailHeight,
      )
    }
  }
}

function checkAndResolveCollision(
  detail1: EventDetail,
  detail2: EventDetail,
  width: number,
  height: number,
): void {
  const left1 = parseInt(detail1.position.left || '0')
  const top1 = parseInt(detail1.position.top || '0')
  const left2 = parseInt(detail2.position.left || '0')
  const top2 = parseInt(detail2.position.top || '0')

  // Check if collision
  if (
    left1 < left2 + width &&
    left1 + width > left2 &&
    top1 < top2 + height &&
    top1 + height > top2
  ) {
    // Calculate collision response
    const cx1 = left1 + width / 2
    const cy1 = top1 + height / 2
    const cx2 = left2 + width / 2
    const cy2 = top2 + height / 2

    const dx = cx2 - cx1
    const dy = cy2 - cy1
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance === 0) return

    // Normalize collision vector
    const nx = dx / distance
    const ny = dy / distance

    // Minimum separation distance
    const minDistance = Math.sqrt(width * width + height * height) / 2
    const overlap = minDistance - distance

    if (overlap > 0) {
      // Separate panels
      const separationX = nx * overlap * 0.5
      const separationY = ny * overlap * 0.5

      // Move panels apart
      if (!detail1.isDragging) {
        detail1.position.left = `${left1 - separationX}px`
        detail1.position.top = `${top1 - separationY}px`
        detail1.connectionPathD = getConnectionPath(detail1)
      }

      if (!detail2.isDragging) {
        detail2.position.left = `${left2 + separationX}px`
        detail2.position.top = `${top2 + separationY}px`
        detail2.connectionPathD = getConnectionPath(detail2)
      }

      // Calculate relative velocity
      if (!detail1.velocity) detail1.velocity = { x: 0, y: 0 }
      if (!detail2.velocity) detail2.velocity = { x: 0, y: 0 }

      const relativeVx = detail1.velocity.x - detail2.velocity.x
      const relativeVy = detail1.velocity.y - detail2.velocity.y

      // Velocity along collision normal
      const velocityAlongNormal = relativeVx * nx + relativeVy * ny

      // Don't resolve if velocities are separating
      if (velocityAlongNormal > 0) return

      // Restitution (bounciness)
      const restitution = 0.8
      const mass1 = detail1.mass || 1
      const mass2 = detail2.mass || 1

      // Calculate impulse scalar
      const impulse = (2 * velocityAlongNormal) / (mass1 + mass2)

      // Apply impulse to velocity
      if (!detail1.isDragging) {
        detail1.velocity.x -= impulse * mass2 * nx * restitution
        detail1.velocity.y -= impulse * mass2 * ny * restitution
      }

      if (!detail2.isDragging) {
        detail2.velocity.x += impulse * mass1 * nx * restitution
        detail2.velocity.y += impulse * mass1 * ny * restitution
      }

      // Start physics simulation if not already running
      startPhysicsSimulation()
    }
  }
}

function togglePin(detail: EventDetail): void {
  detail.isPinned = !detail.isPinned
}

function getEventConnectionPoint(event: TimelineEvent): { x: number; y: number } {
  const x = timeToPixel(event.startDate.getTime())
  const track = getEventTrack(event)
  const y = 40 + track * 30

  return { x, y }
}

function getDetailConnectionPoint(
  detail: EventDetail,
  overrideX?: number,
  overrideY?: number,
): { x: number; y: number } {
  const left = overrideX !== undefined ? overrideX : parseInt(detail.position.left || '0')
  const top = overrideY !== undefined ? overrideY : parseInt(detail.position.top || '0')

  // Connect to the middle of the detail panel, vertically centered
  return {
    x: left + 150, // Half of panel width (300/2)
    y: top + 125, // Half of panel height (250/2)
  }
}

function getConnectionPath(detail: EventDetail, overrideX?: number, overrideY?: number): string {
  const start = getEventConnectionPoint(detail.event)
  const end = getDetailConnectionPoint(detail, overrideX, overrideY)

  // Create a curved path for better aesthetics
  const midX = (start.x + end.x) / 2
  const controlPointY = Math.min(start.y, end.y) - 30

  return `M ${start.x},${start.y} Q ${midX},${controlPointY} ${end.x},${end.y}`
}

function updateAllConnectionPaths() {
  for (const detail of eventDetails.value) {
    detail.connectionPathD = getConnectionPath(detail)
  }
}

const setConnectionLineRef = (el: Element | null, id: string) => {
  if (el) {
    connectionLineRefs.value.set(id, el as SVGPathElement)
  } else {
    connectionLineRefs.value.delete(id)
  }
}

const setDetailPanelRef = (el: HTMLElement | null, id: string) => {
  if (el) {
    detailPanelRefs.value.set(id, el)
  } else {
    detailPanelRefs.value.delete(id)
  }
}

// Lifecycle
onMounted(async () => {
  // Initialize timeline store if not already done
  if (!timelineStore.currentTimeline) {
    try {
      await timelineStore.initialize()
    } catch (error) {
      console.error('Failed to initialize timeline store:', error)
    }
  }

  // Sync local events with store
  events.value = [...timelineStore.events]

  // Set initial timeline settings
  if (timelineStore.currentTimeline) {
    centerTime.value = timelineStore.settings.centerDate.getTime()
    pixelsPerDay.value = timelineStore.settings.pixelsPerDay
  } else {
    centerTime.value = new Date().getTime()
    pixelsPerDay.value = 100
  }

  resizeHandler()
  window.addEventListener('resize', resizeHandler)

  // Set up theme change observer
  setupThemeObserver()

  document.addEventListener('mousemove', (e) => {
    if (isDragging.value || isOverviewDragging.value) {
      if (isDragging.value) {
        handleDrag(e)
      } else if (isOverviewDragging.value) {
        handleOverviewDrag(e)
      }
    }
  })

  document.addEventListener('mouseup', () => {
    if (isDragging.value || isOverviewDragging.value) {
      stopDrag()
    }
  })

  document.addEventListener('click', (e) => {
    const target = e.target as Element

    // Close event details if clicking outside any detail panel
    if (!target.closest('.event-detail-panel') && !target.closest('.timeline-event')) {
      eventDetails.value = []
    }

    // Close add form if clicking outside the form
    if (showAddForm.value && !target.closest('.add-event-form') && !target.closest('.btn-add')) {
      closeAddForm()
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeHandler)
  stopPhysicsSimulation()

  // Disconnect theme observer
  if (themeObserver.value) {
    themeObserver.value.disconnect()
    themeObserver.value = null
  }

  // Clear any timeouts
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
  }
})

// Add a new function to set up the theme observer
function setupThemeObserver(): void {
  // First, handle initial drawing with correct theme
  redrawCanvases()

  // Set up observer for theme changes (when classes are added or removed from html or body)
  themeObserver.value = new MutationObserver((mutations) => {
    let needsRedraw = false

    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        needsRedraw = true
        break
      }
    }

    if (needsRedraw) {
      // Use requestAnimationFrame to avoid multiple redraws in quick succession
      requestAnimationFrame(() => {
        redrawCanvases()
      })
    }
  })

  // Observe html and body elements for class changes
  const htmlElement = document.documentElement
  const bodyElement = document.body

  if (htmlElement) {
    themeObserver.value.observe(htmlElement, { attributes: true, attributeFilter: ['class'] })
  }

  if (bodyElement) {
    themeObserver.value.observe(bodyElement, { attributes: true, attributeFilter: ['class'] })
  }
}

function showAddHighlightForm(): void {
  showHighlightForm.value = true

  // Pre-set the dates to current view for convenience
  // Default to highlighting a period of the current visible span
  const viewSpanMs = (containerWidth.value / pixelsPerDay.value) * DAY_MS * 0.25
  const startDate = new Date(centerTime.value - viewSpanMs / 2)
  const endDate = new Date(centerTime.value + viewSpanMs / 2)

  newHighlight.value.startDate = startDate.toISOString().slice(0, 16)
  newHighlight.value.endDate = endDate.toISOString().slice(0, 16)
}

function closeHighlightForm(): void {
  showHighlightForm.value = false

  // Reset form
  newHighlight.value = {
    startDate: '',
    endDate: '',
    startLabel: '',
    endLabel: '',
    color: 'rgba(255, 235, 59, 0.25)',
  }
}

async function addHighlight(): Promise<void> {
  try {
    await timelineStore.addHighlight({
      startDate: new Date(newHighlight.value.startDate),
      endDate: new Date(newHighlight.value.endDate),
      startLabel: newHighlight.value.startLabel || undefined,
      endLabel: newHighlight.value.endLabel || undefined,
      color: newHighlight.value.color,
    })
    closeHighlightForm()
    redrawCanvases()
  } catch (error) {
    console.error('Failed to add highlight:', error)
  }
}

function getHighlightStyle(highlight: TimelineHighlight, isOverview: boolean): Record<string, string> {
  let startX, endX, width;

  if (isOverview) {
    // Use the same scaling approach as the overview events
    const overviewScale = pixelsPerDay.value * 0.1

    const startOffsetTime = highlight.startDate.getTime() - centerTime.value
    const startOffsetDays = startOffsetTime / DAY_MS
    startX = containerWidth.value / 2 + startOffsetDays * overviewScale

    const endOffsetTime = highlight.endDate.getTime() - centerTime.value
    const endOffsetDays = endOffsetTime / DAY_MS
    endX = containerWidth.value / 2 + endOffsetDays * overviewScale

    width = Math.max(endX - startX, 5)
  } else {
    // For detail panel, use the regular timeToPixel function
    startX = timeToPixel(highlight.startDate.getTime())
    endX = timeToPixel(highlight.endDate.getTime())
    width = Math.max(endX - startX, 10)
  }

  // Height depends on which band we're in
  const height = '100%'
  const top = '0'

  // Use a semi-transparent version of the color for the background
  let bgColor = highlight.color
  if (!bgColor.includes('rgba')) {
    // Convert hex or rgb to rgba with 0.25 opacity
    if (bgColor.startsWith('#')) {
      const r = parseInt(bgColor.slice(1, 3), 16)
      const g = parseInt(bgColor.slice(3, 5), 16)
      const b = parseInt(bgColor.slice(5, 7), 16)
      bgColor = `rgba(${r}, ${g}, ${b}, 0.25)`
    } else if (bgColor.startsWith('rgb(')) {
      bgColor = bgColor.replace('rgb(', 'rgba(').replace(')', ', 0.25)')
    }
  }

  const styles: Record<string, string> = {
    position: 'absolute',
    left: `${startX}px`,
    top,
    width: `${width}px`,
    height,
    backgroundColor: bgColor,
    zIndex: isOverview ? '4' : '5',
  };

  if (isOverview) {
    styles.borderTopColor = highlight.color;
    styles.borderBottomColor = highlight.color;
  } else {
    styles.borderLeft = `2px solid ${highlight.color}`;
    styles.borderRight = `2px solid ${highlight.color}`;
  }

  return styles;
}

// Controls drag functionality
function startControlsDrag(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()

  isControlsDragging.value = true
  controlsDragStart.value = {
    x: event.clientX,
    y: event.clientY,
    left: controlsPosition.value.left,
    bottom: controlsPosition.value.bottom,
  }

  document.addEventListener('mousemove', handleControlsDrag)
  document.addEventListener('mouseup', stopControlsDrag)
  document.body.style.cursor = 'grabbing'
}

function handleControlsDrag(event: MouseEvent): void {
  if (!isControlsDragging.value) return

  const deltaX = event.clientX - controlsDragStart.value.x
  const deltaY = event.clientY - controlsDragStart.value.y

  // Calculate new position
  const newLeft = Math.max(0, Math.min(
    containerWidth.value - 400, // Approximate controls width
    controlsDragStart.value.left + deltaX
  ))

  const newBottom = Math.max(20, Math.min(
    containerHeight.value - 100, // Approximate controls height
    controlsDragStart.value.bottom - deltaY // Subtract because bottom increases upward
  ))

  controlsPosition.value = {
    left: newLeft,
    bottom: newBottom,
  }
}

function stopControlsDrag(): void {
  isControlsDragging.value = false
  document.removeEventListener('mousemove', handleControlsDrag)
  document.removeEventListener('mouseup', stopControlsDrag)
  document.body.style.cursor = ''
}
</script>

<style scoped>
.timeline-container {
  width: 100%;
  height: 100vh;
  background: var(--background);
  font-family: Arial, sans-serif;
  position: relative;
  overflow: hidden;
}

.timeline-band {
  position: relative;
  width: 100%;
  border-bottom: 1px solid var(--border);
  background: var(--card);
}

.detail-band {
  height: 350px;
}

.overview-band {
  height: 80px;
  background: var(--muted);
}

.timeline-canvas {
  position: absolute;
  top: 0;
  left: 0;
  cursor: grab;
  z-index: 1;
  transition: opacity 0.2s ease;
}

.timeline-canvas:active {
  cursor: grabbing;
}

.timeline-canvas:hover {
  opacity: 0.95;
}

.timeline-container.dragging {
  user-select: none;
}

.timeline-container.dragging .timeline-canvas {
  cursor: grabbing !important;
}

.events-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.timeline-event {
  position: absolute;
  pointer-events: all;
  cursor: pointer;
  transition: all 0.2s ease;
}

.timeline-event.event-range {
  cursor: move;
}

.timeline-event.event-dragging {
  opacity: 0.8;
  transform: scale(1.1);
  z-index: 100;
}

.event-range-bar {
  position: absolute;
  height: 4px;
  top: -2px;
  left: 0;
  border-radius: 2px;
}

.event-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--card);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.dark .event-dot {
  border-color: var(--background);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.event-dot-small {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--card);
}

.dark .event-dot-small {
  border-color: var(--background);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.event-label {
  position: absolute;
  left: 18px;
  top: -8px;
  white-space: nowrap;
  background: var(--card);
  opacity: 0.9;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--card-foreground);
}

.dark .event-label {
  background: var(--background);
  opacity: 0.95;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.overview-event .event-label {
  display: none;
}

.viewport-indicator {
  z-index: 5;
}

.timeline-controls {
  position: absolute;
  background: var(--card);
  opacity: 0.95;
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1100;
  display: flex;
  align-items: center;
  gap: 0;
  user-select: none;
  transition: box-shadow 0.2s ease;
}

.timeline-controls.controls-dragging {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  cursor: grabbing;
}

.controls-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  cursor: grab;
  border-right: 1px solid var(--border);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  background: var(--muted);
  transition: background-color 0.2s ease;
}

.controls-handle:hover {
  background: var(--accent);
}

.controls-handle:active {
  cursor: grabbing;
}

.handle-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.handle-line {
  width: 12px;
  height: 2px;
  background: var(--muted-foreground);
  border-radius: 1px;
  opacity: 0.7;
}

.controls-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}

.timeline-controls Button {
  margin: 0 3px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--card-foreground);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
}

.timeline-controls Button:hover {
  background: var(--muted);
}

.timeline-controls Button:disabled,
.timeline-controls Button.btn-disabled {
  background: var(--muted) !important;
  color: var(--muted-foreground) !important;
  cursor: not-allowed !important;
  opacity: 0.5;
}

.timeline-controls Button:disabled:hover,
.timeline-controls Button.btn-disabled:hover {
  background: var(--muted) !important;
}

.btn-add {
  background: var(--primary) !important;
  color: var(--primary-foreground) !important;
  border-color: var(--primary) !important;
}

.btn-highlight {
  background: var(--accent) !important;
  color: var(--accent-foreground) !important;
  border-color: var(--accent) !important;
}

.current-center {
  margin-left: 12px;
  font-size: 12px;
  color: var(--muted-foreground);
  font-weight: bold;
}

.zoom-level {
  margin-left: 8px;
  font-size: 11px;
  color: var(--muted-foreground);
  opacity: 0.7;
  font-style: italic;
}

.add-event-form {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.form-container {
  background: var(--card);
  padding: 20px;
  border-radius: var(--radius-lg);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.form-header h3 {
  margin: 0;
  color: var(--card-foreground);
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--muted-foreground);
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--foreground);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: var(--foreground);
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--input);
  border-radius: var(--radius-sm);
  font-size: 14px;
  box-sizing: border-box;
  background: var(--background);
  color: var(--foreground);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--ring);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.btn-cancel,
.btn-submit {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-cancel {
  background: var(--secondary);
  color: var(--secondary-foreground);
}

.btn-cancel:hover {
  background: var(--accent);
}

.btn-submit {
  background: var(--primary);
  color: var(--primary-foreground);
}

.btn-submit:hover {
  opacity: 0.9;
}

.image-preview {
  margin-top: 10px;
  position: relative;
  display: inline-block;
}

.image-preview img {
  max-width: 200px;
  max-height: 150px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.remove-image {
  position: absolute;
  top: -5px;
  right: -5px;
  background: var(--destructive);
  color: var(--destructive-foreground);
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.event-detail-panel {
  position: absolute;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 300px;
  min-height: 200px;
  z-index: 1000;
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  user-select: none;
  will-change: transform;
}

.event-detail-panel:not(.detail-dragging) {
  transition:
    left 0.05s linear,
    top 0.05s linear,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.event-detail-panel.detail-dragging {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  cursor: move !important;
  z-index: 1001 !important;
}

.event-detail-panel.detail-pinned {
  border-width: 2px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--muted);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  cursor: move;
}

.detail-header:hover {
  opacity: 0.9;
}

.detail-header h4 {
  margin: 0;
  color: var(--foreground);
  font-size: 16px;
}

.detail-content {
  padding: 16px;
}

.detail-date {
  margin-bottom: 12px;
  color: var(--muted-foreground);
  font-size: 14px;
}

.detail-description {
  margin-bottom: 12px;
  color: var(--foreground);
  line-height: 1.4;
}

.detail-image {
  margin-bottom: 12px;
}

.detail-image img {
  max-width: 100%;
  border-radius: var(--radius-sm);
}

.detail-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-edit,
.btn-delete {
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
}

.btn-edit {
  background: var(--primary);
  color: var(--primary-foreground);
}

.btn-edit:hover {
  opacity: 0.9;
}

.btn-delete {
  background: var(--secondary);
  color: var(--secondary-foreground);
}

.btn-delete:hover {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

.detail-header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pin-btn {
  background: none;
  border: none;
  font-size: 16px;
  color: var(--muted-foreground);
  cursor: pointer;
  padding: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.pin-btn:hover {
  background: var(--accent);
}

.pin-btn.pinned {
  color: var(--primary);
  transform: rotate(45deg);
}

.timeline-event:hover .event-dot {
  transform: scale(1.3);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
}

.connections-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.connection-line {
  transition: all 0.15s ease;
}

.dark .connection-line {
  opacity: 0.7 !important; /* Slightly more visible in dark mode */
}

.connection-line:not(.detail-pinned):not(.line-dragging) {
  animation: dashAnimation 20s linear infinite;
}

.dark .connection-line:not(.detail-pinned):not(.line-dragging) {
  animation: dashAnimation 15s linear infinite; /* Faster animation in dark mode for better visibility */
}

.connection-line.line-dragging {
  stroke-width: 3 !important; /* Ensure override */
  opacity: 1 !important; /* Ensure override */
  animation: none;
}

@keyframes dashAnimation {
  to {
    stroke-dashoffset: -40;
  }
}

.highlights-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

.overview-highlights-layer {
  z-index: 3;
}

.timeline-highlight {
  position: absolute;
  pointer-events: none;
  z-index: 5;
}

.overview-highlight {
  z-index: 4;
  opacity: 0.8;
  border-top: 1px solid;
  border-bottom: 1px solid;
  top: 0 !important;
}

.highlight-label {
  position: absolute;
  background: var(--card);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: var(--card-foreground);
  white-space: nowrap;
  top: 50%;
  transform: translateY(-50%);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.highlight-start-label {
  left: 0;
  transform: translate(-50%, -50%);
}

.highlight-end-label {
  right: 0;
  transform: translate(50%, -50%);
}

.dark .highlight-label {
  background: var(--background);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.btn-disabled {
  background-color: #ccc;
  color: #999;
  cursor: not-allowed;
}
</style>
