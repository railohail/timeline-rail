<template>
  <div class="timeline-demo">
    <!-- Navigation Tabs -->
    <div class="demo-tabs">
      <button
        @click="switchToViewer"
        :class="{ active: activeTab === 'viewer' }"
        class="tab-button"
      >
        Timeline Viewer
      </button>
      <button
        @click="switchToManager"
        :class="{ active: activeTab === 'manager' }"
        class="tab-button"
      >
        Timeline Manager
      </button>
    </div>

    <!-- Timeline Viewer Tab -->
    <div v-if="activeTab === 'viewer'" class="tab-content">
      <SimileTimelineViewer
        :events="timelineStore.events"
        :center-date="timelineStore.settings.centerDate"
        @events-updated="handleEventsUpdated"
      />
    </div>

    <!-- Timeline Manager Tab -->
    <div v-if="activeTab === 'manager'" class="tab-content">
      <TimelineManager />
    </div>

    <!-- Quick Actions Floating Panel -->
    <div
      v-if="activeTab === 'viewer'"
      ref="quickActionsRef"
      class="quick-actions"
      :class="{ 'actions-dragging': isQuickActionsDragging }"
      :style="{
        top: `${quickActionsPosition.top}px`,
        right: `${quickActionsPosition.right}px`,
        left: 'auto',
        bottom: 'auto'
      }"
    >
      <div
        class="actions-handle"
        @mousedown="startQuickActionsDrag"
        title="Drag to move panel"
      >
        <div class="handle-lines">
          <div class="handle-line"></div>
          <div class="handle-line"></div>
          <div class="handle-line"></div>
        </div>
      </div>
      <div class="actions-header">
        <h4>Quick Actions</h4>
        <button @click="showQuickActions = !showQuickActions" class="toggle-btn">
          {{ showQuickActions ? '−' : '+' }}
        </button>
      </div>
      <div v-if="showQuickActions" class="actions-content">
        <button @click="saveTimeline" class="action-btn save-btn">
          💾 Save Timeline
        </button>
        <button @click="exportTimeline" class="action-btn export-btn">
          📤 Export Timeline
        </button>
        <button @click="switchToManager" class="action-btn manager-btn">
          ⚙️ Manage Timelines
        </button>
        <div class="auto-save-toggle">
          <label>
            <input v-model="autoSave" type="checkbox" />
            Auto-save changes
          </label>
        </div>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
      <div class="status-left">
        <span v-if="timelineStore.isLoading" class="status-item loading">
          🔄 Loading...
        </span>
        <span v-else-if="timelineStore.error" class="status-item error">
          ❌ {{ timelineStore.error }}
        </span>
        <span v-else class="status-item success">
          ✅ Ready
        </span>
      </div>
      <div class="status-right">
        <span class="status-item">
          Storage: {{ getStorageType() }}
        </span>
        <span class="status-item" v-if="timelineStore.currentTimeline">
          Last saved: {{ formatLastSaved() }}
        </span>
      </div>
    </div>

    <!-- Debug Panel -->
    <!-- <DebugPanel /> -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import SimileTimelineViewer from '@/components/SimileTimelineViewer.vue'
import TimelineManager from '@/components/TimelineManager.vue'
// import DebugPanel from '@/components/DebugPanel.vue'
import { useTimelineStore } from '@/stores/timelineStore'
import type { TimelineEvent } from '@/stores/timelineStore'

const timelineStore = useTimelineStore()

// UI State
const activeTab = ref<'viewer' | 'manager'>('viewer')
const showQuickActions = ref(false)
const autoSave = ref(true)
const lastSaveTime = ref<Date | null>(null)

// Quick Actions dragging state
const quickActionsPosition = ref({ top: 1, right: 20 })
const isQuickActionsDragging = ref(false)
const quickActionsDragStart = ref({ x: 0, y: 0, top: 0, right: 0 })
const quickActionsRef = ref<HTMLElement>()

// Methods
async function handleEventsUpdated(events: TimelineEvent[]): Promise<void> {
  // Update the store with new events
  if (timelineStore.currentTimeline) {
    timelineStore.currentTimeline.events = events

    // Auto-save if enabled
    if (autoSave.value) {
      await saveTimeline()
    }
  }
}

async function saveTimeline(): Promise<void> {
  try {
    await timelineStore.saveCurrentTimeline()
    lastSaveTime.value = new Date()
  } catch (error) {
    console.error('Failed to save timeline:', error)
  }
}

async function exportTimeline(): Promise<void> {
  try {
    if (!timelineStore.currentTimeline) return

    const blob = await timelineStore.exportTimeline()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${timelineStore.currentTimeline.name}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export timeline:', error)
  }
}

function switchToManager(): void {
  activeTab.value = 'manager'
}

function switchToViewer(): void {
  console.log('Switching to viewer tab')
  activeTab.value = 'viewer'
}

function getStorageType(): string {
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    return 'IndexedDB'
  }
  return 'LocalStorage'
}

function formatLastSaved(): string {
  if (!lastSaveTime.value && timelineStore.currentTimeline) {
    return new Date(timelineStore.currentTimeline.updatedAt).toLocaleTimeString()
  }
  return lastSaveTime.value ? lastSaveTime.value.toLocaleTimeString() : 'Never'
}

// Quick Actions drag functionality
function startQuickActionsDrag(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()

  isQuickActionsDragging.value = true
  quickActionsDragStart.value = {
    x: event.clientX,
    y: event.clientY,
    top: quickActionsPosition.value.top,
    right: quickActionsPosition.value.right,
  }

  document.addEventListener('mousemove', handleQuickActionsDrag)
  document.addEventListener('mouseup', stopQuickActionsDrag)
  document.body.style.cursor = 'grabbing'
}

function handleQuickActionsDrag(event: MouseEvent): void {
  if (!isQuickActionsDragging.value) return

  const deltaX = event.clientX - quickActionsDragStart.value.x
  const deltaY = event.clientY - quickActionsDragStart.value.y

  // Calculate new position
  const newRight = Math.max(20, Math.min(
    window.innerWidth - 220, // Approximate panel width
    quickActionsDragStart.value.right - deltaX // Subtract because right increases leftward
  ))

  const newTop = Math.max(20, Math.min(
    window.innerHeight - 300, // Approximate panel height
    quickActionsDragStart.value.top + deltaY
  ))

  quickActionsPosition.value = {
    right: newRight,
    top: newTop,
  }
}

function stopQuickActionsDrag(): void {
  isQuickActionsDragging.value = false
  document.removeEventListener('mousemove', handleQuickActionsDrag)
  document.removeEventListener('mouseup', stopQuickActionsDrag)
  document.body.style.cursor = ''
}

// Auto-save watcher with debouncing
let autoSaveTimeout: number | null = null

watch(
  () => timelineStore.currentTimeline?.events,
  async () => {
    if (autoSave.value && timelineStore.currentTimeline) {
      // Clear existing timeout
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }

      // Debounce auto-save
      autoSaveTimeout = setTimeout(async () => {
        try {
          await saveTimeline()
        } catch (error) {
          console.error('Auto-save failed:', error)
        }
      }, 2000) // 2 second delay
    }
  },
  { deep: true }
)

// Also watch highlights
watch(
  () => timelineStore.currentTimeline?.highlights,
  async () => {
    if (autoSave.value && timelineStore.currentTimeline) {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }

      autoSaveTimeout = setTimeout(async () => {
        try {
          await saveTimeline()
        } catch (error) {
          console.error('Auto-save failed:', error)
        }
      }, 2000)
    }
  },
  { deep: true }
)

// Initialize
onMounted(async () => {
  try {
    await timelineStore.initialize()
  } catch (error) {
    console.error('Failed to initialize timeline store:', error)
  }
})
</script>

<style scoped>
.timeline-demo {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--background);
  color: var(--foreground);
}

.demo-tabs {
  display: flex;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 0 20px;
}

.tab-button {
  padding: 12px 24px;
  background: none;
  border: none;
  color: var(--muted-foreground);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.tab-button:hover {
  color: var(--foreground);
  background: var(--accent);
}

.tab-button.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.tab-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}





.quick-actions {
  position: fixed;
  background: var(--card);
  opacity: 0.95;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  user-select: none;
  transition: box-shadow 0.2s ease;
}

.quick-actions.actions-dragging {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  cursor: grabbing;
}

.actions-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  cursor: grab;
  border-bottom: 1px solid var(--border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--muted);
  transition: background-color 0.2s ease;
}

.actions-handle:hover {
  background: var(--accent);
}

.actions-handle:active {
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

.actions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
}

.actions-header h4 {
  margin: 0;
  color: var(--card-foreground);
  font-size: 14px;
}

.toggle-btn {
  background: none;
  border: none;
  color: var(--muted-foreground);
  cursor: pointer;
  font-size: 16px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}

.toggle-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

.actions-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--background);
  color: var(--foreground);
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--accent);
}

.save-btn:hover {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: var(--primary);
}

.export-btn:hover {
  background: var(--secondary);
  color: var(--secondary-foreground);
}

.manager-btn:hover {
  background: var(--accent);
}

.auto-save-toggle {
  padding: 8px 0;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}

.auto-save-toggle label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted-foreground);
  cursor: pointer;
}

.auto-save-toggle input[type="checkbox"] {
  margin: 0;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  background: var(--muted);
  border-top: 1px solid var(--border);
  font-size: 12px;
}

.status-left,
.status-right {
  display: flex;
  gap: 16px;
  align-items: center;
}

.status-item {
  color: var(--muted-foreground);
}

.status-item.loading {
  color: var(--primary);
}

.status-item.error {
  color: var(--destructive);
}

.status-item.success {
  color: var(--primary);
}

/* Responsive design */
@media (max-width: 768px) {
  .quick-actions {
    position: static;
    margin: 16px;
    order: -1;
    min-width: auto;
    width: calc(100% - 32px);
  }

  .actions-handle {
    display: none; /* Hide drag handle on mobile */
  }



  .status-bar {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .status-left,
  .status-right {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
