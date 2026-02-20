import { create } from 'zustand'
import { getToken, logout as logoutService } from '../lib/authService'

type AuthState = {
  token: string | null
  isAuthenticated: boolean
  setToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getToken(),
  isAuthenticated: Boolean(getToken()),
  setToken: (token) => set({ token, isAuthenticated: true }),
  logout: () => {
    logoutService()
    set({ token: null, isAuthenticated: false })
  },
}))
