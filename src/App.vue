<script setup lang="ts">
import {RouterView, useRoute, useRouter } from 'vue-router'
import { computed, watch, onMounted, onUnmounted } from 'vue'
import ColorDropdown from '@/components/ColorDropdown.vue'
import { useAuthStore } from '@/stores/authStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isTimelineRoute = computed(() => route.path === '/timeline')
const isAuthRoute = computed(() => route.path === '/auth')

async function handleLogout() {
  await authStore.logout()
  router.push('/auth')
}

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
    <!-- User info and logout button (only show when authenticated and not on auth page) -->
    <div v-if="authStore.isAuthenticated && !isAuthRoute" class="user-info">
      <span class="user-welcome">Welcome, {{ authStore.currentUser?.username }}!</span>
      <button @click="handleLogout" class="logout-btn">Logout</button>
    </div>

    <ColorDropdown v-if="!isAuthRoute" />
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

.user-info {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.user-welcome {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
}

.logout-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-btn:hover {
  background: #dc2626;
}
</style>
