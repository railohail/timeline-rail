<template>
  <div class="timeline-container">
    <div class="timeline-header">
      <div class="timeline-controls">
        <button @click="zoomIn" class="timeline-btn">+</button>
        <button @click="zoomOut" class="timeline-btn">-</button>
        <button @click="resetView" class="timeline-btn">Reset</button>
        <span class="timeline-date">{{ formatDate(currentDate) }}</span>
      </div>
    </div>

    <div class="timeline-wrapper" ref="timelineWrapper">
      <div
        class="timeline-track"
        ref="timelineTrack"
        :style="{ transform: `translateX(${offset}px)` }"
        @mousedown="startDrag"
        @wheel="handleWheel"
      >
        <!-- Major time markers -->
        <div
          v-for="marker in visibleMarkers"
          :key="marker.date.getTime()"
          class="time-marker"
          :class="{ major: marker.isMajor }"
          :style="{ left: `${getPositionForDate(marker.date)}px` }"
        >
          <div class="marker-line"></div>
          <div class="marker-label">{{ formatMarkerDate(marker.date) }}</div>
        </div>

        <!-- Timeline events -->
        <div
          v-for="event in visibleEvents"
          :key="event.id"
          class="timeline-event"
          :class="{ duration: event.endDate }"
          :style="getEventStyle(event)"
          @click="selectEvent(event)"
        >
          <div class="event-marker" :style="{ backgroundColor: event.color || '#3498db' }"></div>
          <div class="event-label">{{ event.title }}</div>
          <div v-if="event.endDate" class="event-duration-bar"></div>
        </div>
      </div>

      <!-- Current time indicator -->
      <div class="current-time-indicator" :style="{ left: `${getCurrentTimePosition()}px` }"></div>
    </div>

    <!-- Event details panel -->
    <div v-if="selectedEvent" class="event-details">
      <h3>{{ selectedEvent.title }}</h3>
      <p><strong>Start:</strong> {{ formatDate(selectedEvent.startDate) }}</p>
      <p v-if="selectedEvent.endDate">
        <strong>End:</strong> {{ formatDate(selectedEvent.endDate) }}
      </p>
      <p v-if="selectedEvent.description">{{ selectedEvent.description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface TimelineEvent {
  id: string
  title: string
  startDate: Date
  endDate?: Date
  description?: string
  color?: string
}

interface TimeMarker {
  date: Date
  isMajor: boolean
}

// Props
const props = defineProps<{
  events?: TimelineEvent[]
  startDate?: Date
  endDate?: Date
  initialDate?: Date
  intervalUnit?: 'year' | 'month' | 'day' | 'hour'
  pixelsPerUnit?: number
}>()

// Reactive data
const timelineWrapper = ref<HTMLElement>()
const timelineTrack = ref<HTMLElement>()
const offset = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, offset: 0 })
const selectedEvent = ref<TimelineEvent | null>(null)

// Timeline configuration
const zoomLevel = ref(1)
const pixelsPerDay = ref(props.pixelsPerUnit || 10)
const currentDate = ref(props.initialDate || new Date())

// Computed properties
const timelineStart = computed(() => {
  if (props.startDate) return props.startDate
  const dates = props.events?.map((e) => e.startDate) || []
  if (dates.length === 0) return new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
  return new Date(Math.min(...dates.map((d) => d.getTime())) - 30 * 24 * 60 * 60 * 1000) // 30 days before earliest
})

const timelineEnd = computed(() => {
  if (props.endDate) return props.endDate
  const dates = [
    ...(props.events?.map((e) => e.startDate) || []),
    ...(props.events?.map((e) => e.endDate).filter(Boolean) || []),
  ]
  if (dates.length === 0) return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
  return new Date(Math.max(...dates.map((d) => d.getTime())) + 30 * 24 * 60 * 60 * 1000) // 30 days after latest
})

const totalDays = computed(() => {
  return Math.ceil(
    (timelineEnd.value.getTime() - timelineStart.value.getTime()) / (24 * 60 * 60 * 1000),
  )
})

const visibleMarkers = computed(() => {
  const markers: TimeMarker[] = []
  const current = new Date(timelineStart.value)
  const interval = getIntervalDays()

  while (current <= timelineEnd.value) {
    const isMajor = isMarkerMajor(current)
    markers.push({ date: new Date(current), isMajor })
    current.setDate(current.getDate() + interval)
  }

  return markers
})

const visibleEvents = computed(() => {
  return props.events || []
})

// Methods
const getIntervalDays = (): number => {
  switch (props.intervalUnit) {
    case 'year':
      return 365
    case 'month':
      return 30
    case 'day':
      return 1
    case 'hour':
      return 1 / 24
    default:
      return Math.max(1, Math.floor(30 / zoomLevel.value))
  }
}

const isMarkerMajor = (date: Date): boolean => {
  switch (props.intervalUnit) {
    case 'year':
      return date.getMonth() === 0
    case 'month':
      return date.getDate() === 1
    case 'day':
      return date.getHours() === 0
    default:
      return date.getDate() === 1 || date.getDate() % 7 === 1
  }
}

const getPositionForDate = (date: Date): number => {
  const daysDiff = (date.getTime() - timelineStart.value.getTime()) / (24 * 60 * 60 * 1000)
  return daysDiff * pixelsPerDay.value * zoomLevel.value
}

const getDateForPosition = (position: number): Date => {
  const daysDiff = position / (pixelsPerDay.value * zoomLevel.value)
  return new Date(timelineStart.value.getTime() + daysDiff * 24 * 60 * 60 * 1000)
}

const getCurrentTimePosition = (): number => {
  const wrapperWidth = timelineWrapper.value?.clientWidth || 0
  return wrapperWidth / 2 + offset.value
}

const getEventStyle = (event: TimelineEvent): Record<string, string> => {
  const startPos = getPositionForDate(event.startDate)
  const style: Record<string, string> = {
    left: `${startPos}px`,
  }

  if (event.endDate) {
    const endPos = getPositionForDate(event.endDate)
    style.width = `${endPos - startPos}px`
  }

  return style
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatMarkerDate = (date: Date): string => {
  switch (props.intervalUnit) {
    case 'year':
      return date.getFullYear().toString()
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    case 'day':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    default:
      return formatDate(date)
  }
}

const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value * 2, 16)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value / 2, 0.25)
}

const resetView = () => {
  zoomLevel.value = 1
  offset.value = 0
  currentDate.value = props.initialDate || new Date()
}

const selectEvent = (event: TimelineEvent) => {
  selectedEvent.value = event
  // Center on event
  const eventPos = getPositionForDate(event.startDate)
  const wrapperWidth = timelineWrapper.value?.clientWidth || 0
  offset.value = wrapperWidth / 2 - eventPos
}

const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  dragStart.value = { x: e.clientX, offset: offset.value }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  const deltaX = e.clientX - dragStart.value.x
  offset.value = dragStart.value.offset + deltaX
  updateCurrentDate()
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

const updateCurrentDate = () => {
  const wrapperWidth = timelineWrapper.value?.clientWidth || 0
  const centerPosition = wrapperWidth / 2 - offset.value
  currentDate.value = getDateForPosition(centerPosition)
}

onMounted(() => {
  // Center the timeline initially
  const wrapperWidth = timelineWrapper.value?.clientWidth || 0
  const initialPos = getPositionForDate(currentDate.value)
  offset.value = wrapperWidth / 2 - initialPos
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.timeline-container {
  width: 100%;
  height: 400px;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  background: #fafafa;
}

.timeline-header {
  height: 50px;
  background: #fff;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-btn {
  padding: 4px 8px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.timeline-btn:hover {
  background: #2980b9;
}

.timeline-date {
  margin-left: 16px;
  font-weight: 500;
  color: #2c3e50;
}

.timeline-wrapper {
  position: relative;
  height: calc(100% - 50px);
  overflow: hidden;
  cursor: grab;
}

.timeline-wrapper:active {
  cursor: grabbing;
}

.timeline-track {
  position: relative;
  height: 100%;
  user-select: none;
}

.time-marker {
  position: absolute;
  top: 20px;
  height: calc(100% - 40px);
}

.marker-line {
  width: 1px;
  height: 100%;
  background: #ddd;
  margin-bottom: 4px;
}

.time-marker.major .marker-line {
  background: #999;
  width: 2px;
}

.marker-label {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  transform: translateX(-50%);
  margin-left: 1px;
}

.time-marker.major .marker-label {
  font-weight: 600;
  color: #333;
}

.timeline-event {
  position: absolute;
  top: 60px;
  min-width: 8px;
  height: 60px;
  cursor: pointer;
  z-index: 10;
}

.event-marker {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  margin-bottom: 4px;
}

.event-label {
  font-size: 11px;
  color: #333;
  font-weight: 500;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-event.duration .event-duration-bar {
  position: absolute;
  top: 3px;
  left: 4px;
  right: 0;
  height: 2px;
  background: currentColor;
  opacity: 0.6;
}

.current-time-indicator {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: #e74c3c;
  z-index: 20;
  pointer-events: none;
}

.current-time-indicator::before {
  content: '';
  position: absolute;
  top: 20px;
  left: -4px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 8px solid #e74c3c;
}

.event-details {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid #ddd;
  padding: 16px;
  max-height: 150px;
  overflow-y: auto;
}

.event-details h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 16px;
}

.event-details p {
  margin: 4px 0;
  font-size: 13px;
  color: #555;
}

.event-details strong {
  color: #2c3e50;
}
</style>
