import type { UserRegistration } from '../models/user'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
const defaultPassword = import.meta.env.VITE_SENHA_PADRAO

export function normalizeUsername(username: string): string {
  return username.trim().toUpperCase()
}

export function ensureEnv() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Configuração do banco ausente. Verifique o arquivo .env.')
  }
}

export async function hashPasswordPBKDF2(raw: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(raw), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )
  const derivedBytes = new Uint8Array(derived)
  const combined = new Uint8Array(salt.length + derivedBytes.length)
  combined.set(salt, 0)
  combined.set(derivedBytes, salt.length)
  const base64 = btoa(String.fromCharCode(...combined))
  return `pbkdf2:${base64}`
}

export async function verifyPassword(candidate: string, stored: string): Promise<boolean> {
  if (stored.startsWith('pbkdf2:')) {
    const base64 = stored.replace('pbkdf2:', '')
    const combined = new Uint8Array(
      atob(base64)
        .split('')
        .map((c) => c.charCodeAt(0)),
    )
    const salt = combined.slice(0, 16)
    const storedHash = combined.slice(16)

    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(candidate), 'PBKDF2', false, ['deriveBits'])
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      256,
    )
    const derivedHash = new Uint8Array(derived)
    return derivedHash.length === storedHash.length && derivedHash.every((b, i) => b === storedHash[i])
  }

  return stored === candidate
}

export async function fetchUserByUsername(username: string): Promise<UserRegistration | null> {
  ensureEnv()
  const query = new URL(`${supabaseUrl}/rest/v1/user_registration`)
  query.searchParams.set('username', `eq.${username}`)
  // Seleciona todos os campos para permitir flags de módulos
  query.searchParams.set('select', '*')
  query.searchParams.set('limit', '1')

  const response = await fetch(query.toString(), {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Supabase response ${response.status}`)
  }

  const [user] = (await response.json()) as UserRegistration[]
  return user || null
}

export async function updatePassword(userId: number, hashedPassword: string) {
  ensureEnv()
  const updateUrl = new URL(`${supabaseUrl}/rest/v1/user_registration`)
  updateUrl.searchParams.set('id', `eq.${userId}`)

  const response = await fetch(updateUrl.toString(), {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ password: hashedPassword }),
  })

  if (!response.ok) {
    throw new Error(`Supabase update ${response.status}`)
  }
}

export async function updateLastAccess(userId: number) {
  if (!supabaseUrl || !supabaseKey) return
  try {
    const updateUrl = new URL(`${supabaseUrl}/rest/v1/user_registration`)
    updateUrl.searchParams.set('id', `eq.${userId}`)

    await fetch(updateUrl.toString(), {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_data: new Date().toISOString() }),
    })
  } catch (error) {
    console.error('Erro ao registrar último acesso:', error)
  }
}

export function isDefaultPassword(stored: string | undefined): boolean {
  return !!defaultPassword && !!stored && stored === defaultPassword
}
