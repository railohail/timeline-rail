<template>
  <div v-if="showDebug" class="debug-panel">
    <div class="debug-header">
      <h4>🐛 Debug Panel</h4>
      <button @click="showDebug = false" class="close-btn">×</button>
    </div>

    <div class="debug-content">
      <div class="debug-section">
        <h5>Timeline Store State</h5>
        <div class="debug-item">
          <label>Current Timeline:</label>
          <span>{{ timelineStore.currentTimeline?.name || 'None' }}</span>
        </div>
        <div class="debug-item">
          <label>Events Count:</label>
          <span>{{ timelineStore.events.length }}</span>
        </div>
        <div class="debug-item">
          <label>Highlights Count:</label>
          <span>{{ timelineStore.highlights.length }}</span>
        </div>
        <div class="debug-item">
          <label>Available Timelines:</label>
          <span>{{ timelineStore.availableTimelines.length }}</span>
        </div>
        <div class="debug-item">
          <label>Loading:</label>
          <span>{{ timelineStore.isLoading }}</span>
        </div>
        <div class="debug-item">
          <label>Error:</label>
          <span>{{ timelineStore.error || 'None' }}</span>
        </div>
      </div>

      <div class="debug-section">
        <h5>Storage Test</h5>
        <div class="debug-actions">
          <button @click="testSave" class="debug-btn">Test Save</button>
          <button @click="testLoad" class="debug-btn">Test Load</button>
          <button @click="clearStorage" class="debug-btn danger">Clear All</button>
        </div>
        <div v-if="testResult" class="test-result">
          {{ testResult }}
        </div>
      </div>

      <div class="debug-section">
        <h5>Raw Data</h5>
        <details>
          <summary>Current Timeline JSON</summary>
          <pre>{{ JSON.stringify(timelineStore.currentTimeline, null, 2) }}</pre>
        </details>
      </div>
    </div>
  </div>

  <!-- Debug Toggle Button -->
  <button v-if="!showDebug" @click="showDebug = true" class="debug-toggle">
    🐛
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTimelineStore } from '@/stores/timelineStore'

const timelineStore = useTimelineStore()
const showDebug = ref(false)
const testResult = ref('')

async function testSave() {
  try {
    await timelineStore.saveCurrentTimeline()
    testResult.value = '✅ Save successful'
    setTimeout(() => testResult.value = '', 3000)
  } catch (error) {
    testResult.value = `❌ Save failed: ${error}`
  }
}

async function testLoad() {
  try {
    await timelineStore.loadAvailableTimelines()
    testResult.value = '✅ Load successful'
    setTimeout(() => testResult.value = '', 3000)
  } catch (error) {
    testResult.value = `❌ Load failed: ${error}`
  }
}

async function clearStorage() {
  if (!confirm('This will delete ALL timeline data. Are you sure?')) return

  try {
    // Clear IndexedDB
    if ('indexedDB' in window) {
      const deleteReq = indexedDB.deleteDatabase('TimelineStorage')
      deleteReq.onsuccess = () => {
        testResult.value = '✅ Storage cleared'
      }
    }

    // Clear localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('timeline-') || key.startsWith('image-')) {
        localStorage.removeItem(key)
      }
    })

    // Reinitialize
    await timelineStore.initialize()
    testResult.value = '✅ Storage cleared and reinitialized'
    setTimeout(() => testResult.value = '', 3000)
  } catch (error) {
    testResult.value = `❌ Clear failed: ${error}`
  }
}
</script>

<style scoped>
.debug-panel {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 350px;
  max-height: 80vh;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  overflow-y: auto;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--muted);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.debug-header h4 {
  margin: 0;
  color: var(--foreground);
  font-size: 14px;
}

.close-btn {
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

.close-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

.debug-content {
  padding: 16px;
}

.debug-section {
  margin-bottom: 16px;
}

.debug-section h5 {
  margin: 0 0 8px 0;
  color: var(--foreground);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.debug-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
}

.debug-item label {
  color: var(--muted-foreground);
  font-weight: 500;
}

.debug-item span {
  color: var(--foreground);
  font-family: monospace;
}

.debug-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.debug-btn {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--background);
  color: var(--foreground);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s ease;
}

.debug-btn:hover {
  background: var(--accent);
}

.debug-btn.danger {
  color: var(--destructive);
  border-color: var(--destructive);
}

.debug-btn.danger:hover {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

.test-result {
  margin-top: 8px;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: var(--muted);
  font-size: 11px;
  font-family: monospace;
}

.debug-toggle {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-foreground);
  border: none;
  cursor: pointer;
  font-size: 16px;
  z-index: 9998;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.debug-toggle:hover {
  transform: scale(1.1);
}

details {
  margin-top: 8px;
}

summary {
  cursor: pointer;
  font-size: 11px;
  color: var(--muted-foreground);
  margin-bottom: 8px;
}

pre {
  font-size: 10px;
  background: var(--muted);
  padding: 8px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}
</style>
