<template>
  <div class="timeline-manager">
    <!-- Header -->
    <div class="manager-header">
      <h2>Timeline Manager</h2>
      <div class="header-actions">
        <Button @click="showCreateForm = true" class="btn-primary">
          + New Timeline
        </Button>
        <Button @click="showImportDialog = true" class="btn-secondary">
          Import Timeline
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="timelineStore.isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading timelines...</p>
    </div>

    <!-- Error State -->
    <div v-if="timelineStore.error" class="error-state">
      <p>{{ timelineStore.error }}</p>
      <Button @click="timelineStore.error = null" class="btn-secondary">
        Dismiss
      </Button>
    </div>

    <!-- Timeline List -->
    <div v-if="!timelineStore.isLoading" class="timeline-list">
      <div class="list-header">
        <h3>Your Timelines ({{ timelineStore.availableTimelines.length }})</h3>
        <div class="list-actions">
          <Button @click="refreshTimelines" class="btn-ghost" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      <div v-if="timelineStore.availableTimelines.length === 0" class="empty-state">
        <p>No timelines found. Create your first timeline to get started!</p>
      </div>

      <div v-else class="timeline-cards">
        <div
          v-for="timelineId in timelineStore.availableTimelines"
          :key="timelineId"
          class="timeline-card"
          :class="{ active: timelineStore.currentTimeline?.id === timelineId }"
        >
          <div class="card-content">
            <div class="card-header">
              <h4>{{ getTimelineName(timelineId) }}</h4>
              <div class="card-actions">
                <Button
                  @click="loadTimeline(timelineId)"
                  class="btn-ghost"
                  size="sm"
                  :disabled="timelineStore.currentTimeline?.id === timelineId"
                >
                  {{ timelineStore.currentTimeline?.id === timelineId ? 'Current' : 'Load' }}
                </Button>
                <Button
                  @click="exportTimeline(timelineId)"
                  class="btn-ghost"
                  size="sm"
                >
                  Export
                </Button>
                <Button
                  @click="deleteTimeline(timelineId)"
                  class="btn-ghost btn-danger"
                  size="sm"
                >
                  Delete
                </Button>
              </div>
            </div>
            <div class="card-meta">
              <span class="timeline-id">ID: {{ timelineId }}</span>
              <span class="timeline-stats">
                {{ getTimelineStats(timelineId) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Current Timeline Info -->
    <div v-if="timelineStore.currentTimeline" class="current-timeline">
      <h3>Current Timeline</h3>
      <div class="timeline-info">
        <div class="info-item">
          <label>Name:</label>
          <span>{{ timelineStore.currentTimeline.name }}</span>
        </div>
        <div class="info-item">
          <label>Events:</label>
          <span>{{ timelineStore.events.length }}</span>
        </div>
        <div class="info-item">
          <label>Highlights:</label>
          <span>{{ timelineStore.highlights.length }}</span>
        </div>
        <div class="info-item">
          <label>Last Updated:</label>
          <span>{{ formatDate(timelineStore.currentTimeline.updatedAt) }}</span>
        </div>
      </div>
      <div class="timeline-actions">
        <Button @click="saveCurrentTimeline" class="btn-primary">
          Save Timeline
        </Button>
        <Button @click="exportCurrentTimeline" class="btn-secondary">
          Export Current
        </Button>
      </div>
    </div>

    <!-- Create Timeline Form -->
    <div v-if="showCreateForm" class="modal-overlay" @click="closeCreateForm">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Create New Timeline</h3>
          <Button @click="closeCreateForm" class="close-btn">×</Button>
        </div>
        <form @submit.prevent="createTimeline">
          <div class="form-group">
            <label>Timeline Name *</label>
            <input
              v-model="newTimelineName"
              type="text"
              required
              placeholder="Enter timeline name"
              maxlength="100"
            />
          </div>
          <div class="form-actions">
            <Button type="button" @click="closeCreateForm" class="btn-secondary">
              Cancel
            </Button>
            <Button type="submit" class="btn-primary" :disabled="!newTimelineName.trim()">
              Create Timeline
            </Button>
          </div>
        </form>
      </div>
    </div>

    <!-- Import Timeline Dialog -->
    <div v-if="showImportDialog" class="modal-overlay" @click="closeImportDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Import Timeline</h3>
          <Button @click="closeImportDialog" class="close-btn">×</Button>
        </div>
        <div class="import-content">
          <div class="file-drop-zone" @drop="handleFileDrop" @dragover.prevent @dragenter.prevent>
            <input
              ref="fileInput"
              type="file"
              accept=".json"
              @change="handleFileSelect"
              style="display: none"
            />
            <div class="drop-zone-content">
              <p>Drop a timeline file here or</p>
                             <Button @click="fileInput?.click()" class="btn-secondary">
                 Choose File
               </Button>
            </div>
          </div>
          <div v-if="importFile" class="selected-file">
            <p>Selected: {{ importFile.name }}</p>
            <Button @click="importTimeline" class="btn-primary">
              Import Timeline
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Storage Info -->
    <div class="storage-info">
      <h3>Storage Information</h3>
      <div class="storage-stats">
        <div class="stat-item">
          <label>Total Timelines:</label>
          <span>{{ timelineStore.availableTimelines.length }}</span>
        </div>
        <div class="stat-item">
          <label>Storage Type:</label>
          <span>{{ getStorageType() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { useTimelineStore } from '@/stores/timelineStore'

const timelineStore = useTimelineStore()

// UI State
const showCreateForm = ref(false)
const showImportDialog = ref(false)
const newTimelineName = ref('')
const importFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement>()

// Timeline cache for metadata
const timelineCache = ref<Map<string, unknown>>(new Map())

// Methods
async function refreshTimelines(): Promise<void> {
  await timelineStore.loadAvailableTimelines()
  timelineCache.value.clear()
}

async function loadTimeline(id: string): Promise<void> {
  try {
    await timelineStore.loadTimeline(id)
  } catch (error) {
    console.error('Failed to load timeline:', error)
  }
}

async function createTimeline(): Promise<void> {
  if (!newTimelineName.value.trim()) return

  try {
    await timelineStore.createTimeline(newTimelineName.value.trim())
    closeCreateForm()
  } catch (error) {
    console.error('Failed to create timeline:', error)
  }
}

async function deleteTimeline(id: string): Promise<void> {
  if (!confirm('Are you sure you want to delete this timeline? This action cannot be undone.')) {
    return
  }

  try {
    await timelineStore.deleteTimeline(id)
  } catch (error) {
    console.error('Failed to delete timeline:', error)
  }
}

async function exportTimeline(id: string): Promise<void> {
  try {
    const blob = await timelineStore.exportTimeline(id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timeline-${id}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export timeline:', error)
  }
}

async function exportCurrentTimeline(): Promise<void> {
  if (!timelineStore.currentTimeline) return
  await exportTimeline(timelineStore.currentTimeline.id)
}

async function saveCurrentTimeline(): Promise<void> {
  try {
    await timelineStore.saveCurrentTimeline()
  } catch (error) {
    console.error('Failed to save timeline:', error)
  }
}

function closeCreateForm(): void {
  showCreateForm.value = false
  newTimelineName.value = ''
}

function closeImportDialog(): void {
  showImportDialog.value = false
  importFile.value = null
}

function handleFileSelect(event: Event): void {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    importFile.value = target.files[0]
  }
}

function handleFileDrop(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    importFile.value = event.dataTransfer.files[0]
  }
}

async function importTimeline(): Promise<void> {
  if (!importFile.value) return

  try {
    await timelineStore.importTimeline(importFile.value)
    closeImportDialog()
    await refreshTimelines()
  } catch (error) {
    console.error('Failed to import timeline:', error)
  }
}

function getTimelineName(id: string): string {
  // This would ideally load metadata without loading the full timeline
  return `Timeline ${id.slice(0, 8)}...`
}

function getTimelineStats(_id: string): string {
  // This would show event/highlight counts from cached metadata
  return 'Loading...'
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getStorageType(): string {
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    return 'IndexedDB (Browser)'
  }
  return 'LocalStorage (Fallback)'
}

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
.timeline-manager {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  background: var(--background);
  color: var(--foreground);
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.manager-header h2 {
  margin: 0;
  color: var(--foreground);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--muted);
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  flex-direction: column;
  gap: 12px;
  color: var(--destructive);
}

.timeline-list {
  margin-bottom: 30px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.list-header h3 {
  margin: 0;
  color: var(--foreground);
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--muted-foreground);
}

.timeline-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.timeline-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  transition: all 0.2s ease;
}

.timeline-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.timeline-card.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.card-header h4 {
  margin: 0;
  color: var(--card-foreground);
}

.card-actions {
  display: flex;
  gap: 8px;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--muted-foreground);
}

.current-timeline {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 30px;
}

.current-timeline h3 {
  margin: 0 0 16px 0;
  color: var(--card-foreground);
}

.timeline-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-item label {
  font-weight: 500;
  color: var(--muted-foreground);
}

.timeline-actions {
  display: flex;
  gap: 12px;
}

.storage-info {
  background: var(--muted);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.storage-info h3 {
  margin: 0 0 16px 0;
  color: var(--foreground);
}

.storage-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-item label {
  font-weight: 500;
  color: var(--muted-foreground);
}

.modal-overlay {
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
}

.modal-content {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h3 {
  margin: 0;
  color: var(--card-foreground);
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--muted-foreground);
  cursor: pointer;
  padding: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}

.close-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--foreground);
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--input);
  border-radius: var(--radius-sm);
  background: var(--background);
  color: var(--foreground);
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--ring);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.file-drop-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  padding: 40px;
  text-align: center;
  margin-bottom: 16px;
  transition: border-color 0.2s ease;
}

.file-drop-zone:hover {
  border-color: var(--primary);
}

.drop-zone-content p {
  margin: 0 0 12px 0;
  color: var(--muted-foreground);
}

.selected-file {
  text-align: center;
  padding: 16px;
  background: var(--muted);
  border-radius: var(--radius-sm);
}

.selected-file p {
  margin: 0 0 12px 0;
  color: var(--foreground);
}

.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
  border: 1px solid var(--primary);
}

.btn-secondary {
  background: var(--secondary);
  color: var(--secondary-foreground);
  border: 1px solid var(--border);
}

.btn-ghost {
  background: transparent;
  color: var(--foreground);
  border: 1px solid var(--border);
}

.btn-danger {
  color: var(--destructive);
  border-color: var(--destructive);
}

.btn-danger:hover {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

Button {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

Button:hover {
  opacity: 0.9;
}

Button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

Button[size="sm"] {
  padding: 4px 8px;
  font-size: 12px;
}
</style>
