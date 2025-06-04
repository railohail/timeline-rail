<template>
  <div class="timeline-controls">
    <!-- Main Toolbar -->
    <div class="toolbar">
      <div class="toolbar-section">
        <!-- File Operations -->
        <div class="control-group">
          <button @click="$emit('new')" class="btn btn-primary" title="New Timeline">
            <i class="icon">📄</i>
          </button>
          <button @click="$emit('save')" class="btn btn-secondary" title="Save">
            <i class="icon">💾</i>
          </button>
          <button @click="$emit('export')" class="btn btn-secondary" title="Export">
            <i class="icon">📤</i>
          </button>
          <button @click="$emit('import')" class="btn btn-secondary" title="Import">
            <i class="icon">📥</i>
          </button>
        </div>

        <!-- Undo/Redo -->
        <div class="control-group">
          <button
            @click="timelineStore.undo()"
            :disabled="!timelineStore.canUndo"
            class="btn btn-secondary"
            title="Undo"
          >
            <i class="icon">↶</i>
          </button>
          <button
            @click="timelineStore.redo()"
            :disabled="!timelineStore.canRedo"
            class="btn btn-secondary"
            title="Redo"
          >
            <i class="icon">↷</i>
          </button>
        </div>

        <!-- Tools -->
        <div class="control-group">
          <button
            v-for="tool in tools"
            :key="tool.id"
            @click="timelineStore.selectedTool = tool.id"
            :class="['btn', 'btn-tool', { active: timelineStore.selectedTool === tool.id }]"
            :title="tool.name"
          >
            <i class="icon">{{ tool.icon }}</i>
          </button>
        </div>

        <!-- Zoom Controls -->
        <div class="control-group">
          <button @click="timelineStore.zoomOut()" class="btn btn-secondary" title="Zoom Out">
            <i class="icon">🔍-</i>
          </button>
          <span class="zoom-level">{{ Math.round(timelineStore.viewport.zoomLevel * 100) }}%</span>
          <button @click="timelineStore.zoomIn()" class="btn btn-secondary" title="Zoom In">
            <i class="icon">🔍+</i>
          </button>
          <button @click="timelineStore.resetZoom()" class="btn btn-secondary" title="Reset Zoom">
            <i class="icon">🎯</i>
          </button>
        </div>

        <!-- View Controls -->
        <div class="control-group">
          <select v-model="timelineStore.settings.defaultView" class="select">
            <option value="timeline">Timeline</option>
            <option value="gantt">Gantt</option>
            <option value="calendar">Calendar</option>
          </select>
        </div>
      </div>

      <!-- Search and Filter -->
      <div class="toolbar-section">
        <div class="search-container">
          <input
            v-model="timelineStore.filter.searchText"
            type="text"
            placeholder="Search events..."
            class="search-input"
          />
          <i class="search-icon">🔍</i>
        </div>

        <button @click="showFilters = !showFilters" class="btn btn-secondary" title="Filters">
          <i class="icon">🔧</i>
          <span class="badge" v-if="activeFiltersCount">{{ activeFiltersCount }}</span>
        </button>
      </div>
    </div>

    <!-- Advanced Filters Panel -->
    <div v-if="showFilters" class="filters-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label>Categories:</label>
          <div class="category-filters">
            <label
              v-for="category in timelineStore.categories"
              :key="category.id"
              class="category-filter"
            >
              <input
                type="checkbox"
                :value="category.id"
                v-model="timelineStore.filter.categories"
              />
              <span class="category-label" :style="{ color: category.color }">
                {{ category.icon }} {{ category.name }}
              </span>
            </label>
          </div>
        </div>

        <div class="filter-group">
          <label>Priority:</label>
          <div class="priority-filters">
            <label v-for="priority in priorities" :key="priority" class="priority-filter">
              <input type="checkbox" :value="priority" v-model="timelineStore.filter.priorities" />
              <span :class="`priority-${priority}`">{{ priority }}</span>
            </label>
          </div>
        </div>

        <div class="filter-group">
          <label>Status:</label>
          <div class="status-filters">
            <label v-for="status in statuses" :key="status" class="status-filter">
              <input type="checkbox" :value="status" v-model="timelineStore.filter.status" />
              <span :class="`status-${status}`">{{ status }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="filter-row">
        <div class="filter-group">
          <label>Date Range:</label>
          <div class="date-range">
            <input type="date" v-model="dateRangeStart" class="date-input" />
            <span>to</span>
            <input type="date" v-model="dateRangeEnd" class="date-input" />
          </div>
        </div>

        <div class="filter-group">
          <label>Lanes:</label>
          <div class="lane-filters">
            <label v-for="lane in timelineStore.lanes" :key="lane.id" class="lane-filter">
              <input type="checkbox" :value="lane.id" v-model="timelineStore.filter.lanes" />
              <span class="lane-label" :style="{ color: lane.color }">
                {{ lane.name }}
              </span>
            </label>
          </div>
        </div>

        <div class="filter-actions">
          <button @click="timelineStore.clearFilter()" class="btn btn-secondary">Clear All</button>
          <button @click="showFilters = false" class="btn btn-primary">Apply</button>
        </div>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="stats-bar">
      <span class="stat">
        Events: {{ timelineStore.visibleEvents.length }} / {{ timelineStore.events.length }}
      </span>
      <span class="stat"> Lanes: {{ timelineStore.lanes.length }} </span>
      <span class="stat" v-if="timelineStore.selectedEvents.length">
        Selected: {{ timelineStore.selectedEvents.length }}
      </span>
      <span class="stat"> Zoom: {{ Math.round(timelineStore.viewport.zoomLevel * 100) }}% </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTimelineStore } from '@/stores/timeline'

const timelineStore = useTimelineStore()

const showFilters = ref(false)

const tools = [
  { id: 'select', name: 'Select', icon: '👆' },
  { id: 'pan', name: 'Pan', icon: '✋' },
  { id: 'zoom', name: 'Zoom', icon: '🔍' },
  { id: 'create', name: 'Create Event', icon: '➕' },
  { id: 'annotate', name: 'Annotate', icon: '💬' },
]

const priorities = ['low', 'medium', 'high', 'critical']
const statuses = ['planned', 'in-progress', 'completed', 'cancelled']

const activeFiltersCount = computed(() => {
  let count = 0
  if (timelineStore.filter.categories?.length) count++
  if (timelineStore.filter.priorities?.length) count++
  if (timelineStore.filter.status?.length) count++
  if (timelineStore.filter.lanes?.length) count++
  if (timelineStore.filter.dateRange) count++
  if (timelineStore.filter.searchText) count++
  return count
})

const dateRangeStart = computed({
  get: () => timelineStore.filter.dateRange?.start?.toISOString().split('T')[0] || '',
  set: (value: string) => {
    if (value) {
      const start = new Date(value)
      timelineStore.setFilter({
        dateRange: {
          start,
          end: timelineStore.filter.dateRange?.end || new Date(),
        },
      })
    }
  },
})

const dateRangeEnd = computed({
  get: () => timelineStore.filter.dateRange?.end?.toISOString().split('T')[0] || '',
  set: (value: string) => {
    if (value) {
      const end = new Date(value)
      timelineStore.setFilter({
        dateRange: {
          start: timelineStore.filter.dateRange?.start || new Date(),
          end,
        },
      })
    }
  },
})

defineEmits<{
  new: []
  save: []
  export: []
  import: []
}>()
</script>

<style scoped>
.timeline-controls {
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  gap: 16px;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-right: 1px solid #e0e0e0;
}

.control-group:last-child {
  border-right: none;
}

.btn {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-secondary {
  background: #ecf0f1;
  color: #2c3e50;
}

.btn-tool.active {
  background: #3498db;
  color: white;
}

.icon {
  font-size: 16px;
}

.zoom-level {
  font-size: 12px;
  color: #7f8c8d;
  min-width: 40px;
  text-align: center;
}

.select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-container {
  position: relative;
}

.search-input {
  padding: 8px 35px 8px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  width: 250px;
}

.search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #7f8c8d;
}

.badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #e74c3c;
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 10px;
  min-width: 18px;
  text-align: center;
}

.filters-panel {
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
  padding: 16px;
}

.filter-row {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 16px;
}

.filter-row:last-child {
  margin-bottom: 0;
}

.filter-group {
  flex: 1;
}

.filter-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #2c3e50;
}

.category-filters,
.priority-filters,
.status-filters,
.lane-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-filter,
.priority-filter,
.status-filter,
.lane-filter {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  cursor: pointer;
}

.category-label,
.lane-label {
  font-weight: 500;
}

.priority-low {
  color: #2ecc71;
}
.priority-medium {
  color: #f39c12;
}
.priority-high {
  color: #e67e22;
}
.priority-critical {
  color: #e74c3c;
}

.status-planned {
  color: #7f8c8d;
}
.status-in-progress {
  color: #3498db;
}
.status-completed {
  color: #2ecc71;
}
.status-cancelled {
  color: #95a5a6;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.filter-actions {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.stats-bar {
  background: #f1f2f6;
  padding: 8px 16px;
  display: flex;
  gap: 24px;
  font-size: 12px;
  color: #7f8c8d;
  border-top: 1px solid #e0e0e0;
}

.stat {
  font-weight: 500;
}
</style>
