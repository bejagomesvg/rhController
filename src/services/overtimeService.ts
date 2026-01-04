import { formatDate } from '../utils/employeeParser'
import type {
  OvertimePayload,
  OvertimeResult,
  OvertimeDateCheck,
  OvertimeDatesCheck,
  OvertimeDeleteResult,
  OvertimeSummaryRow,
} from '../models/overtime'

const parseNumber = (val: any): number | null => {
  const num = Number(String(val ?? '').replace(/\D/g, ''))
  return Number.isNaN(num) ? null : num
}

const parseTimeToInterval = (val: any): string | null => {
  if (val === null || val === undefined || val === '') return null

  const toSeconds = (): number | null => {
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

  const seconds = toSeconds()
  if (seconds === null) return null

  const total = Math.max(0, seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
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
    const matchMonthYear = trimmed.match(/^(\d{2})\/(\d{4})$/)
    if (matchMonthYear) {
      return `${matchMonthYear[2]}-${matchMonthYear[1]}-01`
    }
    const matchIso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (matchIso) return trimmed
  }

  return null
}

export const fetchOvertimeSummary = async (
  filters: { company?: string | number; sector?: string; year?: string; month?: string; day?: string },
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<{ ok: boolean; rows: OvertimeSummaryRow[]; error?: string }> => {
  const apiKey = (supabaseKey || '').trim()
  if (!supabaseUrl || !apiKey) {
    return { ok: false, rows: [], error: 'Missing Supabase credentials' }
  }

  const { company, sector, year, month, day } = filters
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/overtime_summary`)
    url.searchParams.set(
      'select',
      'company,date_,registration,name,sector,hrs303,hrs304,hrs505,hrs506,hrs511,hrs512'
    )
    url.searchParams.set('order', 'date_.desc,name.asc')

    if (company) url.searchParams.append('company', `eq.${company}`)
    if (sector) url.searchParams.append('sector', `eq.${sector}`)
    const yearSafe = year || String(new Date().getFullYear())
    const monthSafe = month ? String(month).padStart(2, '0') : null
    const daySafe = day ? String(day).padStart(2, '0') : null
    if (daySafe && monthSafe) {
      // Busca do dia 1 até o dia selecionado (inclusive) para permitir soma cumulativa
      url.searchParams.append('date_', `gte.${yearSafe}-${monthSafe}-01`)
      url.searchParams.append('date_', `lte.${yearSafe}-${monthSafe}-${daySafe}`)
    } else if (monthSafe) {
      const lastDay = new Date(Number(yearSafe), Number(monthSafe), 0).getDate()
      url.searchParams.append('date_', `gte.${yearSafe}-${monthSafe}-01`)
      url.searchParams.append('date_', `lte.${yearSafe}-${monthSafe}-${String(lastDay).padStart(2, '0')}`)
    } else if (year || daySafe) {
      url.searchParams.append('date_', `gte.${yearSafe}-01-01`)
      url.searchParams.append('date_', `lte.${yearSafe}-12-31`)
    }

    const pageSize = 1000
    let offset = 0
    const allRows: OvertimeSummaryRow[] = []

    while (true) {
      const rangeHeader = `${offset}-${offset + pageSize - 1}`
      const res = await fetch(url.toString(), {
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          Range: rangeHeader,
        },
      })

      if (!res.ok) {
        return { ok: false, rows: [], error: await res.text() }
      }

      const data = (await res.json()) as OvertimeSummaryRow[]
      allRows.push(...data)

      if (data.length < pageSize) break
      offset += pageSize
      // safety cap to avoid runaway loops
      if (offset > 50000) break
    }

    return { ok: true, rows: allRows }
  } catch (error) {
    return { ok: false, rows: [], error: (error as Error).message }
  }
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
  company?: number | null,
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
    if (company !== null && company !== undefined) {
      url.searchParams.append('company', `eq.${company}`)
    }
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
  company?: number | null,
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
    if (company !== null && company !== undefined) {
      url.searchParams.append('company', `eq.${company}`)
    }

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

    return {
      registration: parseNumber(row[cadastroKey]),
      name: row[nameKey] ? String(row[nameKey]).trim() : row['name'] ? String(row['name']).trim() : null,
      date_: parseDateIso(row[dateKey]),
      hrs303: parseTimeToInterval(row['303']),
      hrs304: parseTimeToInterval(row['304']),
      hrs505: parseTimeToInterval(row['505']),
      hrs506: parseTimeToInterval(row['506']),
      hrs511: parseTimeToInterval(row['511']),
      hrs512: parseTimeToInterval(row['512']),
      company: parseNumber(row['company'] ?? row['Empresa']),
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
