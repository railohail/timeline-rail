import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Cookies from 'js-cookie'
import { apiStorageManager } from '@/lib/apiStorage'

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
const API_BASE_URL = '/api'

export const useAuthStore = defineStore('auth', () => {
  // State
  const currentUser = ref<User | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isAuthenticated = computed(() => !!currentUser.value)

  // Helper function to make API requests
  async function makeAuthRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${API_BASE_URL}${endpoint}`

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    return response
  }

  // Actions
  async function register(data: RegisterData): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await makeAuthRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      })

      const result = await response.json()

      // Set current user
      currentUser.value = {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        createdAt: new Date(result.user.createdAt)
      }

      // Store token
      Cookies.set(TOKEN_COOKIE_NAME, result.token, { expires: 7 })

      // Set token for API storage
      apiStorageManager.setAuthToken(result.token)

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
      const response = await makeAuthRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      })

      const result = await response.json()

      // Set current user
      currentUser.value = {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        createdAt: new Date(result.user.createdAt)
      }

      // Store token
      Cookies.set(TOKEN_COOKIE_NAME, result.token, { expires: 7 })

      // Set token for API storage
      apiStorageManager.setAuthToken(result.token)

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

    // Clear token from API storage
    apiStorageManager.setAuthToken(null)

    // Reset timeline store
    const { useTimelineStore } = await import('./timelineStore')
    const timelineStore = useTimelineStore()
    timelineStore.reset()
  }

  async function checkAuthStatus(): Promise<void> {
    const token = Cookies.get(TOKEN_COOKIE_NAME)

    if (!token) {
      currentUser.value = null
      apiStorageManager.setAuthToken(null)
      return
    }

    try {
      // Set token for API requests
      apiStorageManager.setAuthToken(token)

      // Verify token with server
      const response = await makeAuthRequest('/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const userData = await response.json()

      currentUser.value = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        createdAt: new Date(userData.createdAt)
      }

      // Initialize timeline store for authenticated user
      const { useTimelineStore } = await import('./timelineStore')
      const timelineStore = useTimelineStore()
      if (!timelineStore.isInitialized) {
        await timelineStore.initialize()
      }
    } catch {
      // Invalid token, remove it
      Cookies.remove(TOKEN_COOKIE_NAME)
      currentUser.value = null
      apiStorageManager.setAuthToken(null)
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


