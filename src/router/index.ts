import { createRouter, createWebHistory } from 'vue-router'
import TimelineDemo from '../views/TimelineDemo.vue'
import AuthView from '../views/AuthView.vue'
import { useAuthStore } from '@/stores/authStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'timeline',
      component: TimelineDemo,
      meta: { requiresAuth: true }
    },
    {
      path: '/timeline',
      redirect: '/',
    },
    {
      path: '/auth',
      name: 'auth',
      component: AuthView,
      meta: { requiresGuest: true }
    },
  ],
})

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Check authentication status
  await authStore.checkAuthStatus()

  const isAuthenticated = authStore.isAuthenticated
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest)

  if (requiresAuth && !isAuthenticated) {
    // Redirect to auth page if not authenticated
    next('/auth')
  } else if (requiresGuest && isAuthenticated) {
    // Redirect to timeline if already authenticated
    next('/')
  } else {
    next()
  }
})

export default router
