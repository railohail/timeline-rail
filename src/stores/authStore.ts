import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import bcrypt from 'bcryptjs'
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
      // Check if user already exists
      const existingUsers = getStoredUsers()
      const userExists = existingUsers.some(
        user => user.username === data.username || user.email === data.email
      )

      if (userExists) {
        throw new Error('Username or email already exists')
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10)

      // Create new user
      const newUser: User & { password: string } = {
        id: generateUserId(),
        username: data.username,
        email: data.email,
        password: hashedPassword,
        createdAt: new Date()
      }

      // Save user to localStorage
      const users = [...existingUsers, newUser]
      localStorage.setItem('timeline-users', JSON.stringify(users))

            // Set current user (without password)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = newUser
      currentUser.value = userWithoutPassword

      // Generate and store simple auth token
      const token = generateAuthToken(newUser.id)
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
      const users = getStoredUsers()
      const user = users.find(u => u.username === credentials.username)

      if (!user) {
        throw new Error('Invalid username or password')
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(credentials.password, user.password)
      if (!isValidPassword) {
        throw new Error('Invalid username or password')
      }

      // Set current user (without password)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _pwd, ...userWithoutPassword } = user
      currentUser.value = userWithoutPassword

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

      const users = getStoredUsers()
      const user = users.find(u => u.id === userId)

      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pwd2, ...userWithoutPassword } = user
        currentUser.value = userWithoutPassword

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
function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

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

function getStoredUsers(): (User & { password: string })[] {
  const stored = localStorage.getItem('timeline-users')
  if (!stored) return []

  try {
    return JSON.parse(stored).map((user: User & { password: string; createdAt: string }) => ({
      ...user,
      createdAt: new Date(user.createdAt)
    }))
  } catch {
    return []
  }
}
