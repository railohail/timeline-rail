<script setup lang="ts">
import {RouterView, useRoute } from 'vue-router'
import { computed, watch, onMounted, onUnmounted } from 'vue'
import ColorDropdown from '@/components/ColorDropdown.vue'

const route = useRoute()
const isTimelineRoute = computed(() => route.path === '/timeline')

// Add/remove class on body for timeline route
watch(
  isTimelineRoute,
  (newValue) => {
    if (newValue) {
      document.body.classList.add('timeline-active')
    } else {
      document.body.classList.remove('timeline-active')
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (isTimelineRoute.value) {
    document.body.classList.add('timeline-active')
  }
})

onUnmounted(() => {
  document.body.classList.remove('timeline-active')
})
</script>

<template>
  <div :class="{ 'timeline-layout': isTimelineRoute }">
    <ColorDropdown />
    <RouterView />
  </div>
</template>

<style>
/* Global styles to override #app when on timeline route */
body.timeline-active {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

body.timeline-active #app {
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  grid-template-columns: none !important;
  width: 100vw !important;
  height: 100vh !important;
}
</style>

<style scoped>
.timeline-layout {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
}

.top-nav {
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  font-size: 1.5rem;
  font-weight: bold;
  color: #2c3e50;
}

.nav-links a {
  color: #2c3e50;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.nav-links a:hover {
  background-color: #f8f8f8;
}
</style>
