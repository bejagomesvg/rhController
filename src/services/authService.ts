import CryptoJS from 'crypto-js'
import type { UserRegistration } from '../models/user'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
const defaultPassword = import.meta.env.VITE_SENHA_PADRAO
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_KEY_LENGTH = 32 // bytes

export function normalizeUsername(username: string): string {
  return username.trim().toUpperCase()
}

export function ensureEnv() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Configuração do banco ausente. Verifique o arquivo .env.')
  }
}

function randomBytes(size: number): Uint8Array {
  const cryptoObj = globalThis.crypto
  if (cryptoObj?.getRandomValues) {
    return cryptoObj.getRandomValues(new Uint8Array(size))
  }

  // Fallback for contexts sem Web Crypto seguro
  const arr = new Uint8Array(size)
  for (let i = 0; i < size; i += 1) {
    arr[i] = Math.floor(Math.random() * 256)
  }
  return arr
}

function wordArrayToUint8Array(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const { words, sigBytes } = wordArray
  const result = new Uint8Array(sigBytes)
  for (let i = 0; i < sigBytes; i += 1) {
    result[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
  }
  return result
}

function uint8ArrayToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = []
  for (let i = 0; i < bytes.length; i += 1) {
    words[i >>> 2] = (words[i >>> 2] || 0) | (bytes[i] << (24 - (i % 4) * 8))
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length)
}

async function derivePBKDF2(rawBytes: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle

  if (subtle?.importKey && subtle?.deriveBits) {
    const safeRaw = new Uint8Array(rawBytes)
    const safeSalt = new Uint8Array(salt)
    const keyMaterial = await subtle.importKey('raw', safeRaw, 'PBKDF2', false, ['deriveBits'])
    const derived = await subtle.deriveBits(
      { name: 'PBKDF2', salt: safeSalt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      PBKDF2_KEY_LENGTH * 8,
    )
    return new Uint8Array(derived)
  }

  // Fallback para contextos inseguros (HTTP) sem crypto.subtle
  const passwordWA = uint8ArrayToWordArray(rawBytes)
  const saltWA = uint8ArrayToWordArray(salt)
  const derivedWA = CryptoJS.PBKDF2(passwordWA, saltWA, {
    keySize: PBKDF2_KEY_LENGTH / 4,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  })
  return wordArrayToUint8Array(derivedWA)
}

export async function hashPasswordPBKDF2(raw: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = randomBytes(16)
  const derivedBytes = await derivePBKDF2(encoder.encode(raw), salt)
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
    const derivedHash = await derivePBKDF2(encoder.encode(candidate), salt)
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

export async function isDefaultPassword(stored: string | undefined): Promise<boolean> {
  if (!defaultPassword || !stored) return false

  // Se a senha padrÃ£o estÃ¡ em hash, conferimos igualdade direta; caso contrÃ¡rio, validamos a senha em texto.
  if (defaultPassword.startsWith('pbkdf2:')) {
    return stored === defaultPassword
  }

  return verifyPassword(defaultPassword, stored)
}
