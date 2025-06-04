import { createRouter, createWebHistory } from 'vue-router'
import TimelineDemo from '../views/TimelineDemo.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'timeline',
      component: TimelineDemo,
    },
    {
      path: '/timeline',
      redirect: '/',
    },
  ],
})

export default router
