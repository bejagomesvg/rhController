import { formatDate } from '../utils/employeeParser'
import type { PayrollPayload, PayrollResult, PayrollMonthCheck, PayrollDeleteResult } from '../models/payroll'

const parseNumber = (val: any): number | null => {
  const num = Number(String(val ?? '').replace(/\D/g, ''))
  return Number.isNaN(num) ? null : num
}

const parseMoney = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null

  const raw = String(val).trim()
  if (!raw) return null

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')

  let normalized = raw
  if (hasComma && hasDot) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && !hasDot) {
    normalized = raw.replace(',', '.')
  } else {
    const dotCount = (raw.match(/\./g) || []).length
    normalized = dotCount > 1 ? raw.replace(/\./g, '') : raw
  }

  const parsed = Number(normalized)
  return Number.isNaN(parsed) ? null : parsed
}

const parseDecimal = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null

  const raw = String(val).trim()
  if (!raw) return null

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')
  let normalized = raw

  if (hasComma && hasDot) {
    // Assume dot as thousand and comma as decimal: 1.234,56 -> 1234.56
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && !hasDot) {
    // Only comma, treat as decimal separator
    normalized = raw.replace(',', '.')
  } else {
    // Only dot or none; if multiple dots, remove thousand separators
    const dotCount = (raw.match(/\./g) || []).length
    normalized = dotCount > 1 ? raw.replace(/\./g, '') : raw
  }

  const num = Number(normalized)
  return Number.isNaN(num) ? null : num
}

const parseDateIso = (val: any): string | null => {
  // Date object
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10)
  }

  // Numbers / formatted strings handled by shared formatter
  const formatted = formatDate(val)
  if (formatted) return formatted

  // Accept "MM/YYYY" or "MM-YYYY" (with optional time suffix)
  if (typeof val === 'string') {
    const trimmed = val.trim().split(/\s+/)[0] // drop any time suffix
    const match = trimmed.match(/^(\d{1,2})[\/-](\d{4})$/)
    if (match) {
      const month = match[1].padStart(2, '0')
      const year = match[2]
      return `${year}-${month}-01`
    }
  }

  return null
}

export const insertPayroll = async (
  data: Record<string, any>[],
  userName: string | undefined,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<PayrollResult> => {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, inserted: 0, error: 'Missing Supabase credentials' }
  }
  try {
  const payload: PayrollPayload[] = data.map((row) => ({
    registration: parseNumber(row['cadastro']),
    name: row['Colaborador'] ? String(row['Colaborador']).trim() : null,
    events: parseNumber(row['Evento']),
    references_: parseDecimal(row['Referencia']),
    volue: parseMoney(row['_valorRaw'] ?? row['valor'] ?? row['Valor'] ?? row['VALOR']),
    competence: parseDateIso(row['Competencia']),
    type_registration: 'Importado',
    user_registration: userName || null,
    date_registration: new Date().toISOString(),
    }))

    const insertUrl = new URL(`${supabaseUrl}/rest/v1/payroll`)
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
      console.error('Erro ao inserir payroll', errTxt)
      return { ok: false, inserted: 0, error: errTxt }
    }

    return { ok: true, inserted: payload.length }
  } catch (error) {
    console.error('Erro ao salvar payroll', error)
    return { ok: false, inserted: 0, error: (error as Error).message }
  }
}

export const checkPayrollMonthExists = async (
  paymentDate: any,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<PayrollMonthCheck> => {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, exists: false, error: 'Missing Supabase credentials' }
  }

  const iso = parseDateIso(paymentDate)
  if (!iso) {
    return { ok: false, exists: false, error: 'Data de pagamento invalida' }
  }

  // Usa yyyy-mm-01 como chave de referência do mês
  const start = new Date(iso)
  if (Number.isNaN(start.getTime())) {
    return { ok: false, exists: false, error: 'Data de pagamento invalida' }
  }
  const monthStart = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-01`
  const nextMonthDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 0, 0, 0))
  const nextMonth = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0')}-01`

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/payroll`)
    url.searchParams.append('select', 'competence')
    url.searchParams.append('competence', `gte.${monthStart}`)
    url.searchParams.append('competence', `lt.${nextMonth}`)
    url.searchParams.append('limit', '1')

    const res = await fetch(url.toString(), {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    })
    if (!res.ok) {
      return { ok: false, exists: false, error: await res.text() }
    }
    const rows = (await res.json()) as Array<{ competence: string }>
    return { ok: true, exists: rows.length > 0 }
  } catch (error) {
    return { ok: false, exists: false, error: (error as Error).message }
  }
}

export const deletePayrollByMonth = async (
  paymentDate: any,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<PayrollDeleteResult> => {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, deleted: 0, error: 'Missing Supabase credentials' }
  }

  const iso = parseDateIso(paymentDate)
  if (!iso) return { ok: false, deleted: 0, error: 'Data de pagamento invalida' }

  const base = new Date(iso)
  if (Number.isNaN(base.getTime())) return { ok: false, deleted: 0, error: 'Data de pagamento invalida' }

  const monthStart = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-01`
  const nextMonthDate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, 0, 0, 0))
  const nextMonth = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0')}-01`

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/payroll`)
    url.searchParams.append('competence', `gte.${monthStart}`)
    url.searchParams.append('competence', `lt.${nextMonth}`)

    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'count=exact' },
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
