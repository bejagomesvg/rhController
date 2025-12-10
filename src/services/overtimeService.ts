import { formatDate } from '../utils/employeeParser'
import type {
  OvertimePayload,
  OvertimeResult,
  OvertimeDateCheck,
  OvertimeDatesCheck,
  OvertimeDeleteResult,
} from '../models/overtime'

const parseNumber = (val: any): number | null => {
  const num = Number(String(val ?? '').replace(/\D/g, ''))
  return Number.isNaN(num) ? null : num
}

const parseTimeToSeconds = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null

  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return null
    return Math.round(val * 24 * 60 * 60)
  }

  const raw = String(val).trim()
  if (!raw) return null

  const colonMatch = raw.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/)
  if (colonMatch) {
    const [, h, m, s] = colonMatch
    const hours = Number(h)
    const minutes = Number(m)
    const seconds = s ? Number(s) : 0
    if ([hours, minutes, seconds].some((n) => Number.isNaN(n))) return null
    return hours * 3600 + minutes * 60 + seconds
  }

  const decimal = Number(raw.replace(',', '.'))
  if (!Number.isNaN(decimal)) {
    return Math.round(decimal * 3600)
  }

  return null
}

const formatTimeFromSeconds = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${hours}:${pad2(minutes)}:${pad2(secs)}`
}

const parseDateIso = (val: any): string | null => {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10)
  }

  const formatted = formatDate(val)
  if (formatted) return formatted

  if (typeof val === 'string') {
    const trimmed = val.trim()
    const matchBr = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (matchBr) {
      return `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}`
    }
    const matchIso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (matchIso) return trimmed
  }

  return null
}

export const checkOvertimeDateExists = async (
  dateValue: any,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<OvertimeDateCheck> => {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, exists: false, error: 'Missing Supabase credentials' }
  }

  const iso = parseDateIso(dateValue)
  if (!iso) return { ok: false, exists: false, error: 'Data invalida' }

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/overtime`)
    url.searchParams.set('select', 'date_')
    url.searchParams.append('date_', `eq.${iso}`)
    url.searchParams.set('limit', '1')

    const res = await fetch(url.toString(), {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    })

    if (!res.ok) {
      return { ok: false, exists: false, error: await res.text() }
    }

    const rows = (await res.json()) as Array<{ date_: string }>
    return { ok: true, exists: rows.length > 0 }
  } catch (error) {
    return { ok: false, exists: false, error: (error as Error).message }
  }
}

export const checkOvertimeDatesExist = async (
  isoDates: Set<string>,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<OvertimeDatesCheck> => {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, exists: false, error: 'Missing Supabase credentials' }
  }
  if (isoDates.size === 0) return { ok: true, exists: false }

  const values = Array.from(isoDates)
  const inParam = values.map((d) => `"${d}"`).join(',')

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/overtime`)
    url.searchParams.set('select', 'date_')
    url.searchParams.append('date_', `in.(${inParam})`)
    url.searchParams.set('limit', '1')

    const res = await fetch(url.toString(), {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    })

    if (!res.ok) {
      return { ok: false, exists: false, error: await res.text() }
    }

    const rows = (await res.json()) as Array<{ date_: string }>
    return { ok: true, exists: rows.length > 0, dates: rows.map((r) => r.date_) }
  } catch (error) {
    return { ok: false, exists: false, error: (error as Error).message }
  }
}

export const deleteOvertimeByDate = async (
  dateIso: string,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<OvertimeDeleteResult> => {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, deleted: 0, error: 'Missing Supabase credentials' }
  }
  try {
    // date_ é DATE, então podemos usar igualdade direta (yyyy-mm-dd)
    const iso = dateIso.trim().split('T')[0]
    if (!iso || !iso.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return { ok: false, deleted: 0, error: 'Data invalida' }
    }

    const url = new URL(`${supabaseUrl}/rest/v1/overtime`)
    url.searchParams.append('date_', `eq.${iso}`)

    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'count=exact',
      },
    })

    if (!res.ok) {
      return { ok: false, deleted: 0, error: await res.text() }
    }

    const deletedHeader = res.headers.get('content-range')
    const deleted = deletedHeader ? Number(deletedHeader.split('/')[1] || 0) : 0
    return { ok: true, deleted: Number.isNaN(deleted) ? 0 : deleted }
  } catch (error) {
    return { ok: false, deleted: 0, error: (error as Error).message }
  }
}

export const insertOvertime = async (
  data: Record<string, any>[],
  userName: string | undefined,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<OvertimeResult> => {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, inserted: 0, error: 'Missing Supabase credentials' }
  }

  const payload: OvertimePayload[] = data.map((row) => {
    const cadastroKey = Object.keys(row).find((k) => k.toLowerCase() === 'cadastro') || 'Cadastro'
    const dateKey = Object.keys(row).find((k) => k.toLowerCase() === 'data') || 'Data'
    const nameKey = Object.keys(row).find((k) => k.toLowerCase() === 'nome') || 'Nome'

    const total100Seconds = ['303', '304', '511', '512'].reduce((acc, code) => {
      const key = Object.keys(row).find((k) => k.toLowerCase() === code.toLowerCase()) || code
      const seconds = parseTimeToSeconds(row[key])
      return acc + (seconds ?? 0)
    }, 0)

    const total60Seconds = ['505', '506'].reduce((acc, code) => {
      const key = Object.keys(row).find((k) => k.toLowerCase() === code.toLowerCase()) || code
      const seconds = parseTimeToSeconds(row[key])
      return acc + (seconds ?? 0)
    }, 0)

    return {
      registration: parseNumber(row[cadastroKey]),
      name: row[nameKey] ? String(row[nameKey]).trim() : row['name'] ? String(row['name']).trim() : null,
      date_: parseDateIso(row[dateKey]),
      hours100: total100Seconds > 0 ? formatTimeFromSeconds(total100Seconds) : null,
      hours60: total60Seconds > 0 ? formatTimeFromSeconds(total60Seconds) : null,
      type_registration: 'Importado',
      user_registration: userName || null,
      date_registration: new Date().toISOString(),
    }
  })

  // Valida obrigatórios
  const invalidRowIndex = payload.findIndex(
    (row) => row.registration === null || !row.name || !row.date_
  )
  if (invalidRowIndex !== -1) {
    return { ok: false, inserted: 0, error: `Linha ${invalidRowIndex + 2}: campos obrigatórios ausentes ou inválidos.` }
  }

  try {
    const insertUrl = new URL(`${supabaseUrl}/rest/v1/overtime`)
    const resInsert = await fetch(insertUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    })
    if (!resInsert.ok) {
      const errTxt = await resInsert.text()
      console.error('Erro ao inserir overtime', errTxt)
      return { ok: false, inserted: 0, error: errTxt }
    }

    return { ok: true, inserted: payload.length }
  } catch (error) {
    console.error('Erro ao salvar overtime', error)
    return { ok: false, inserted: 0, error: (error as Error).message }
  }
}
