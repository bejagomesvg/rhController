import { formatDate } from '../utils/employeeParser'

export type ProductionRowPayload = {
  id?: number
  company: number
  date_: string
  slaughtered?: number | null
  compratraseiro?: number | null
  compradianteiro?: number | null
  comprapa?: number | null
  vendatraseiro?: number | null
  vendadianteiro?: number | null
  vendapa?: number | null
  desossatraseiro?: number | null
  desossadianteiro?: number | null
  desossapa?: number | null
  type_registration?: string
  user_registration?: string
  user_update?: string | null
  date_registration?: string | null
  date_update?: string | null
}

export async function fetchProductionRows(
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<{ ok: boolean; rows: any[]; error?: string }> {
  const apiKey = (supabaseKey || '').trim()
  if (!supabaseUrl || !apiKey) {
    return { ok: false, rows: [], error: 'Missing Supabase credentials' }
  }

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/production`)
    url.searchParams.set(
      'select',
      'id,company,date_,slaughtered,compratraseiro,compradianteiro,comprapa,vendatraseiro,vendadianteiro,vendapa,desossatraseiro,desossadianteiro,desossapa'
    )
    url.searchParams.set('order', 'date_.desc')
    url.searchParams.set('apikey', apiKey)

    const res = await fetch(url.toString(), {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!res.ok) {
      return { ok: false, rows: [], error: await res.text() }
    }

    const data = (await res.json()) as any[]
    return { ok: true, rows: data }
  } catch (error) {
    return { ok: false, rows: [], error: (error as Error).message }
  }
}

const toNumberOrNull = (val: any) => {
  if (val === '' || val === null || val === undefined) return null
  const num = Number(val)
  return Number.isNaN(num) ? null : num
}

const toIsoDate = (val: any): string | null => {
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val.toISOString().slice(0, 10)
  const formatted = formatDate(val)
  if (formatted) return formatted
  if (typeof val === 'string') {
    const trimmed = val.trim()
    const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (br) return `${br[3]}-${br[2]}-${br[1]}`
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (iso) return trimmed
  }
  return null
}

export async function upsertProductionRow(
  row: Partial<ProductionRowPayload> & { id?: number; isNew?: boolean },
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<{ ok: boolean; error?: string; rows?: any[] }> {
  const apiKey = (supabaseKey || '').trim()
  if (!supabaseUrl || !apiKey) {
    return { ok: false, error: 'Missing Supabase credentials' }
  }

  const isoDate = toIsoDate(row.date_)
  if (!isoDate) return { ok: false, error: 'Data inválida' }

  const basePayload: ProductionRowPayload = {
    company: Number(row.company),
    date_: isoDate,
    slaughtered: toNumberOrNull((row as any).slaughtered),
    compratraseiro: toNumberOrNull((row as any).compratraseiro),
    compradianteiro: toNumberOrNull((row as any).compradianteiro),
    comprapa: toNumberOrNull((row as any).comprapa),
    vendatraseiro: toNumberOrNull((row as any).vendatraseiro),
    vendadianteiro: toNumberOrNull((row as any).vendadianteiro),
    vendapa: toNumberOrNull((row as any).vendapa),
    desossatraseiro: toNumberOrNull((row as any).desossatraseiro),
    desossadianteiro: toNumberOrNull((row as any).desossadianteiro),
    desossapa: toNumberOrNull((row as any).desossapa),
  }

  try {
    // Se tiver ID, faz update com PATCH; caso contrário, insert com POST sem enviar ID (para não violar identity ALWAYS).
    const updating = !row.isNew && (row as any).id !== undefined && (row as any).id !== null
    const payload: ProductionRowPayload = updating
      ? {
          ...basePayload,
          user_update: row.user_update ?? row.user_registration ?? null,
          date_update: new Date().toISOString(),
        }
      : {
          ...basePayload,
          type_registration: 'SYSTEM',
          user_registration: row.user_registration || 'system',
          date_registration: new Date().toISOString(),
        }
    console.log('[production] payload', {
      mode: updating ? 'update' : 'insert',
      data: { ...payload, id: (row as any).id },
      url: supabaseUrl ? `${supabaseUrl}/rest/v1/production` : 'missing-url',
    })

    if (updating) {
      const id = (row as any).id as number
      const url = new URL(`${supabaseUrl}/rest/v1/production`)
      url.searchParams.append('id', `eq.${id}`)
      url.searchParams.set('apikey', apiKey)

      const res = await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text()
        return { ok: false, error: text || res.statusText }
      }

      const data = (await res.json()) as any[]
      return { ok: true, rows: data }
    }

    const postUrl = new URL(`${supabaseUrl}/rest/v1/production`)
    postUrl.searchParams.set('apikey', apiKey)

    const res = await fetch(postUrl.toString(), {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: text || res.statusText }
    }

    const data = (await res.json()) as any[]
    return { ok: true, rows: data }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

export async function deleteProductionRow(
  id: number,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<{ ok: boolean; deleted: number; error?: string }> {
  const apiKey = (supabaseKey || '').trim()
  if (!supabaseUrl || !apiKey) {
    return { ok: false, deleted: 0, error: 'Missing Supabase credentials' }
  }
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/production`)
    url.searchParams.append('id', `eq.${id}`)
    url.searchParams.set('apikey', apiKey)

    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        Prefer: 'count=exact',
      },
    })

    if (!res.ok) {
      return { ok: false, deleted: 0, error: await res.text() }
    }

    const range = res.headers.get('content-range')
    const deleted = range ? Number(range.split('/')[1] || 0) : 0
    return { ok: true, deleted: Number.isNaN(deleted) ? 0 : deleted }
  } catch (error) {
    return { ok: false, deleted: 0, error: (error as Error).message }
  }
}
