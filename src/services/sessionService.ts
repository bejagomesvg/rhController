import type { UserRegistration } from '../models/user'

const SESSION_KEY = 'rhDashboardSession'

export function loadSession(): UserRegistration | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return null
    return JSON.parse(stored) as UserRegistration
  } catch (error) {
    console.error('Erro ao ler sessão local:', error)
    return null
  }
}

export function saveSession(user: UserRegistration) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user }))
  } catch (error) {
    console.error('Erro ao salvar sessão local:', error)
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch (error) {
    console.error('Erro ao limpar sessão local:', error)
  }
}
