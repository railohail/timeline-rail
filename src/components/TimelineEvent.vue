<template>
  <div
    ref="eventRef"
    class="timeline-event"
    :class="eventClasses"
    :style="eventStyle"
    @mousedown="handleMouseDown"
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <!-- Event Marker -->
    <div class="event-marker" :style="{ backgroundColor: event.color || '#3498db' }">
      <span class="event-icon">{{ categoryIcon }}</span>
    </div>

    <!-- Duration Bar (for events with end date) -->
    <div v-if="event.endDate" class="event-duration-bar" :style="durationBarStyle">
      <div class="duration-fill" :style="{ backgroundColor: event.color || '#3498db' }"></div>
      <div class="duration-label">{{ durationText }}</div>
    </div>

    <!-- Event Label -->
    <div class="event-label" :style="labelStyle">
      <div class="event-title">{{ event.title }}</div>
      <div class="event-meta">
        <span class="event-date">{{ formatDate(event.startDate) }}</span>
        <span
          v-if="event.priority !== 'medium'"
          class="event-priority"
          :class="`priority-${event.priority}`"
        >
          {{ priorityIcon }}
        </span>
        <span
          v-if="event.status !== 'planned'"
          class="event-status"
          :class="`status-${event.status}`"
        >
          {{ statusIcon }}
        </span>
      </div>
    </div>

    <!-- Dependencies Lines -->
    <div v-if="event.dependencies?.length" class="dependency-lines">
      <svg class="dependency-svg">
        <path
          v-for="depId in event.dependencies"
          :key="depId"
          :d="getDependencyPath(depId)"
          class="dependency-path"
          stroke="#95a5a6"
          stroke-width="2"
          fill="none"
          marker-end="url(#arrowhead)"
        />
      </svg>
    </div>

    <!-- Resize Handles (for duration events) -->
    <div v-if="event.endDate && isSelected" class="resize-handles">
      <div class="resize-handle resize-left" @mousedown.stop="startResize('left', $event)"></div>
      <div class="resize-handle resize-right" @mousedown.stop="startResize('right', $event)"></div>
    </div>

    <!-- Selection Indicator -->
    <div v-if="isSelected" class="selection-indicator"></div>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        v-if="showTooltip && !isDragging"
        ref="tooltipRef"
        class="event-tooltip"
        :style="tooltipStyle"
      >
        <div class="tooltip-header">
          <h4>{{ event.title }}</h4>
          <span class="tooltip-category" :style="{ color: event.color }">
            {{ categoryName }}
          </span>
        </div>
        <div class="tooltip-content">
          <p><strong>Start:</strong> {{ formatDateTime(event.startDate) }}</p>
          <p v-if="event.endDate"><strong>End:</strong> {{ formatDateTime(event.endDate) }}</p>
          <p v-if="event.description">{{ event.description }}</p>
          <div v-if="event.tags?.length" class="tooltip-tags">
            <span v-for="tag in event.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="showContextMenu"
        ref="contextMenuRef"
        class="context-menu"
        :style="contextMenuStyle"
        @click.stop
      >
        <div class="context-menu-item" @click="editEvent"><i class="icon">✏️</i> Edit</div>
        <div class="context-menu-item" @click="duplicateEvent">
          <i class="icon">📋</i> Duplicate
        </div>
        <div class="context-menu-item" @click="deleteEvent"><i class="icon">🗑️</i> Delete</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" @click="centerOnEvent">
          <i class="icon">🎯</i> Center View
        </div>
        <div class="context-menu-item" @click="showDependencies">
          <i class="icon">🔗</i> Show Dependencies
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import type { TimelineEvent } from '@/types/timeline'

interface Props {
  event: TimelineEvent
  pixelsPerUnit: number
  zoomLevel: number
  getPositionForDate: (date: Date) => number
  timelineStart: Date
}

const props = defineProps<Props>()

const timelineStore = useTimelineStore()

const eventRef = ref<HTMLElement>()
const tooltipRef = ref<HTMLElement>()
const contextMenuRef = ref<HTMLElement>()

const showTooltip = ref(false)
const showContextMenu = ref(false)
const isDragging = ref(false)
const isResizing = ref(false)
const dragStart = ref({ x: 0, y: 0, originalDate: new Date() })
const resizeStart = ref({ x: 0, side: 'left' as 'left' | 'right', originalDate: new Date() })

const tooltipStyle = ref({ top: '0px', left: '0px' })
const contextMenuStyle = ref({ top: '0px', left: '0px' })

const isSelected = computed(() => timelineStore.selectedEvents.includes(props.event.id))

const eventClasses = computed(() => ({
  'event-selected': isSelected.value,
  'event-dragging': isDragging.value,
  'event-resizing': isResizing.value,
  'event-duration': !!props.event.endDate,
  [`event-priority-${props.event.priority}`]: true,
  [`event-status-${props.event.status}`]: true,
}))

const eventStyle = computed(() => {
  const startPos = props.getPositionForDate(props.event.startDate)
  const style: Record<string, string> = {
    left: `${startPos}px`,
    zIndex: isSelected.value ? '100' : '10',
  }

  if (props.event.endDate) {
    const endPos = props.getPositionForDate(props.event.endDate)
    style.width = `${Math.max(endPos - startPos, 20)}px`
  }

  return style
})

const durationBarStyle = computed(() => {
  if (!props.event.endDate) return {}

  const startPos = props.getPositionForDate(props.event.startDate)
  const endPos = props.getPositionForDate(props.event.endDate)
  const width = Math.max(endPos - startPos, 20)

  return {
    width: `${width}px`,
    opacity: isSelected.value ? '0.8' : '0.6',
  }
})

const labelStyle = computed(() => ({
  maxWidth: props.event.endDate ? 'none' : '200px',
  fontSize: `${12 * Math.min(props.zoomLevel, 2)}px`,
}))

const categoryIcon = computed(() => {
  const category = timelineStore.categories.find((c) => c.id === props.event.category)
  return category?.icon || '📅'
})

const categoryName = computed(() => {
  const category = timelineStore.categories.find((c) => c.id === props.event.category)
  return category?.name || 'Uncategorized'
})

const priorityIcon = computed(() => {
  const icons = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  }
  return icons[props.event.priority || 'medium']
})

const statusIcon = computed(() => {
  const icons = {
    planned: '📋',
    'in-progress': '⚠️',
    completed: '✅',
    cancelled: '❌',
  }
  return icons[props.event.status || 'planned']
})

const durationText = computed(() => {
  if (!props.event.endDate) return ''

  const start = props.event.startDate
  const end = props.event.endDate
  const diffMs = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return '1 day'
  if (diffDays < 30) return `${diffDays} days`
  if (diffDays < 365) return `${Math.round(diffDays / 30)} months`
  return `${Math.round(diffDays / 365)} years`
})

const handleMouseDown = (e: MouseEvent) => {
  if (timelineStore.selectedTool !== 'select') return

  e.preventDefault()
  isDragging.value = true
  dragStart.value = {
    x: e.clientX,
    y: e.clientY,
    originalDate: new Date(props.event.startDate),
  }

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', handleDragEnd)
}

const handleDrag = (e: MouseEvent) => {
  if (!isDragging.value) return

  const deltaX = e.clientX - dragStart.value.x
  const deltaTime = (deltaX / (props.pixelsPerUnit * props.zoomLevel)) * 24 * 60 * 60 * 1000
  const newStartDate = new Date(dragStart.value.originalDate.getTime() + deltaTime)

  // Update event position temporarily (visual feedback)
  const updatedEvent = { ...props.event }
  updatedEvent.startDate = newStartDate
  if (props.event.endDate) {
    const duration = props.event.endDate.getTime() - props.event.startDate.getTime()
    updatedEvent.endDate = new Date(newStartDate.getTime() + duration)
  }

  // You would emit this to update the actual event
  // emit('update-event', updatedEvent)
}

const handleDragEnd = () => {
  if (!isDragging.value) return

  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', handleDragEnd)

  // Commit the drag operation
  // This would typically save the new position
}

const handleClick = (e: MouseEvent) => {
  e.stopPropagation()
  timelineStore.selectEvent(props.event.id, e.ctrlKey || e.metaKey)
}

const handleContextMenu = (e: MouseEvent) => {
  e.preventDefault()
  showContextMenu.value = true

  nextTick(() => {
    if (contextMenuRef.value) {
      const rect = contextMenuRef.value.getBoundingClientRect()
      contextMenuStyle.value = {
        top: `${Math.min(e.clientY, window.innerHeight - rect.height)}px`,
        left: `${Math.min(e.clientX, window.innerWidth - rect.width)}px`,
      }
    }
  })
}

const startResize = (side: 'left' | 'right', e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()

  isResizing.value = true
  resizeStart.value = {
    x: e.clientX,
    side,
    originalDate: side === 'left' ? props.event.startDate : props.event.endDate!,
  }

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', handleResizeEnd)
}

const handleResize = (e: MouseEvent) => {
  if (!isResizing.value) return

  const deltaX = e.clientX - resizeStart.value.x
  const deltaTime = (deltaX / (props.pixelsPerUnit * props.zoomLevel)) * 24 * 60 * 60 * 1000
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _newDate = new Date(resizeStart.value.originalDate.getTime() + deltaTime)

  // Update event duration temporarily
  // Implementation would depend on which side is being resized
  // console.log('Resizing to:', newDate)
}

const handleResizeEnd = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', handleResizeEnd)
}

const editEvent = () => {
  showContextMenu.value = false
  // Emit edit event
}

const duplicateEvent = () => {
  showContextMenu.value = false
  timelineStore.duplicateEvent(props.event.id)
}

const deleteEvent = () => {
  showContextMenu.value = false
  timelineStore.deleteEvent(props.event.id)
}

const centerOnEvent = () => {
  showContextMenu.value = false
  timelineStore.centerOnEvent(props.event.id)
}

const showDependencies = () => {
  showContextMenu.value = false
  // Implementation for showing dependencies
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getDependencyPath = (_depId: string): string => {
  // Calculate SVG path for dependency arrow
  // This is a simplified version
  return 'M 0 0 L 50 50'
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

const formatDateTime = (date: Date): string => {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Close context menu when clicking outside
const handleClickOutside = (e: Event) => {
  if (contextMenuRef.value && !contextMenuRef.value.contains(e.target as Node)) {
    showContextMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', handleDragEnd)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', handleResizeEnd)
})
</script>

<style scoped>
.timeline-event {
  position: absolute;
  min-width: 12px;
  height: 80px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.timeline-event:hover {
  transform: translateY(-2px);
  z-index: 50 !important;
}

.event-selected {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.event-dragging {
  z-index: 1000 !important;
  opacity: 0.8;
  transform: rotate(2deg);
}

.event-marker {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  position: relative;
  z-index: 2;
}

.event-duration-bar {
  position: absolute;
  top: 5px;
  left: 6px;
  height: 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.duration-fill {
  height: 100%;
  border-radius: 2px;
  opacity: 0.8;
}

.duration-label {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #666;
  white-space: nowrap;
  pointer-events: none;
}

.event-label {
  position: relative;
  z-index: 1;
}

.event-title {
  font-weight: 600;
  color: #2c3e50;
  line-height: 1.2;
  margin-bottom: 2px;
  word-wrap: break-word;
  hyphens: auto;
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.event-date {
  font-size: 10px;
  color: #7f8c8d;
}

.event-priority,
.event-status {
  font-size: 10px;
}

.resize-handles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  top: 0;
  width: 4px;
  height: 100%;
  background: #3498db;
  cursor: ew-resize;
  pointer-events: all;
  opacity: 0;
  transition: opacity 0.2s;
}

.timeline-event:hover .resize-handle,
.event-selected .resize-handle {
  opacity: 1;
}

.resize-left {
  left: -2px;
}

.resize-right {
  right: -2px;
}

.selection-indicator {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border: 2px solid #3498db;
  border-radius: 4px;
  pointer-events: none;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.dependency-lines {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}

.dependency-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 200px;
  height: 200px;
  overflow: visible;
}

.dependency-path {
  stroke-dasharray: 4, 2;
  opacity: 0.7;
}

.event-tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  max-width: 250px;
  z-index: 10000;
  pointer-events: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.tooltip-header {
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 8px;
}

.tooltip-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.tooltip-category {
  font-size: 11px;
  font-weight: 500;
}

.tooltip-content p {
  margin: 4px 0;
  line-height: 1.4;
}

.tooltip-tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 10px;
}

.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  z-index: 10000;
  min-width: 150px;
  overflow: hidden;
}

.context-menu-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background: #f8f9fa;
}

.context-menu-separator {
  height: 1px;
  background: #e0e0e0;
  margin: 4px 0;
}

/* Priority styles */
.event-priority-low {
  border-left: 3px solid #2ecc71;
}
.event-priority-medium {
  border-left: 3px solid #f39c12;
}
.event-priority-high {
  border-left: 3px solid #e67e22;
}
.event-priority-critical {
  border-left: 3px solid #e74c3c;
}

/* Status styles */
.event-status-planned {
  opacity: 0.8;
}
.event-status-in-progress {
  animation: pulse-blue 2s infinite;
}
.event-status-completed {
  opacity: 0.7;
  filter: grayscale(0.3);
}
.event-status-cancelled {
  opacity: 0.5;
  filter: grayscale(0.8);
}

@keyframes pulse-blue {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(52, 152, 219, 0);
  }
}
</style>
