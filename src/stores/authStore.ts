import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Cookies from 'js-cookie'

export interface User {
  id: string
  username: string
  email: string
  createdAt: Date
}

export interface UserCredentials {
  username: string
  password: string
}

export interface RegisterData extends UserCredentials {
  email: string
}

const TOKEN_COOKIE_NAME = 'timeline-auth-token'

export const useAuthStore = defineStore('auth', () => {
  // State
  const currentUser = ref<User | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isAuthenticated = computed(() => !!currentUser.value)

  // Actions
    async function register(data: RegisterData): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Call backend API
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Registration failed')
      }

      const { user } = await response.json()

      // Set current user
      currentUser.value = {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: new Date(user.created_at)
      }

      // Generate and store simple auth token
      const token = generateAuthToken(user.id)
      Cookies.set(TOKEN_COOKIE_NAME, token, { expires: 7 })

      // Initialize timeline store for the new user
      const { useTimelineStore } = await import('./timelineStore')
      const timelineStore = useTimelineStore()
      await timelineStore.initialize()

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Registration failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function login(credentials: UserCredentials): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Call backend API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Login failed')
      }

      const { user } = await response.json()

      // Set current user
      currentUser.value = {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: new Date(user.created_at)
      }

      // Generate and store simple auth token
      const token = generateAuthToken(user.id)
      Cookies.set(TOKEN_COOKIE_NAME, token, { expires: 7 })

      // Initialize timeline store for the user
      const { useTimelineStore } = await import('./timelineStore')
      const timelineStore = useTimelineStore()
      await timelineStore.initialize()

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function logout(): Promise<void> {
    currentUser.value = null
    Cookies.remove(TOKEN_COOKIE_NAME)
    error.value = null

    // Reset timeline store
    const { useTimelineStore } = await import('./timelineStore')
    const timelineStore = useTimelineStore()
    timelineStore.reset()
  }

  async function checkAuthStatus(): Promise<void> {
    const token = Cookies.get(TOKEN_COOKIE_NAME)

    if (!token) {
      currentUser.value = null
      return
    }

    try {
      const userId = verifyAuthToken(token)
      if (!userId) {
        throw new Error('Invalid token')
      }

      if (userId) {
        // Get user from backend
        const userResponse = await fetch(`/api/auth/user/${userId}`)
        if (userResponse.ok) {
          const { user } = await userResponse.json()
          currentUser.value = {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: new Date(user.created_at)
          }

          // Initialize timeline store for authenticated user
          const { useTimelineStore } = await import('./timelineStore')
          const timelineStore = useTimelineStore()
          if (!timelineStore.isInitialized) {
            await timelineStore.initialize()
          }
        } else {
          // User not found, remove invalid token
          Cookies.remove(TOKEN_COOKIE_NAME)
          currentUser.value = null
        }
      } else {
        // Invalid token, remove it
        Cookies.remove(TOKEN_COOKIE_NAME)
        currentUser.value = null
      }
    } catch {
      // Invalid token, remove it
      Cookies.remove(TOKEN_COOKIE_NAME)
      currentUser.value = null
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // State
    currentUser,
    isLoading,
    error,
    isAuthenticated,

    // Actions
    register,
    login,
    logout,
    checkAuthStatus,
    clearError
  }
})

// Utility functions
function generateAuthToken(userId: string): string {
  const timestamp = Date.now()
  const randomPart = Math.random().toString(36).substr(2, 9)
  const tokenData = `${userId}:${timestamp}:${randomPart}`
  return btoa(tokenData) // Base64 encode
}

function verifyAuthToken(token: string): string | null {
  try {
    const decoded = atob(token) // Base64 decode
    const parts = decoded.split(':')
    if (parts.length !== 3) return null

    const [userId, timestamp] = parts
    const tokenAge = Date.now() - parseInt(timestamp)
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

    if (tokenAge > maxAge) return null // Token expired

    return userId
  } catch {
    return null
  }
}
