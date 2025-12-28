import { formatCPF, formatDate } from '../utils/employeeParser'
import type { EmployeePayload, EmployeeRegistryList, EmployeeResult } from '../models/employee'

const parseNumber = (val: any): number | null => {
  const num = Number(String(val ?? '').replace(/\D/g, ''))
  return Number.isNaN(num) ? null : num
}

const parseDateIso = (val: any): string | null => {
  const formatted = formatDate(val)
  return formatted || null
}

const todayLocalDateIso = () => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const parseSalary = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null

  const raw = String(val).trim()
  if (!raw) return null

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')

  let normalized = raw
  if (hasComma && hasDot) {
    // Ex.: 4.740,12 -> remover milhar (.) e usar , como decimal
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && !hasDot) {
    // Ex.: 4740,12
    normalized = raw.replace(',', '.')
  } else {
    // Sem vírgula; se houver mais de um ponto, remover milhares
    const dotCount = (raw.match(/\./g) || []).length
    normalized = dotCount > 1 ? raw.replace(/\./g, '') : raw
  }

  const parsed = Number(normalized)
  return Number.isNaN(parsed) ? null : parsed
}

export const mapRowToEmployee = (row: Record<string, any>, userName?: string | null): EmployeePayload => {
  return {
    company: parseNumber(row['Empresa']),
    registration: parseNumber(row['Cadastro']),
    name: String(row['Nome'] || '').trim(),
    cpf: formatCPF(row['CPF']),
    date_birth: parseDateIso(row['Nascimento']),
    date_hiring: parseDateIso(row['Admissao']),
    status: parseNumber(row['Situacao']),
    date_status: parseDateIso(row['Data Afastamento']),
    role: row['Titulo Reduzido (Cargo)'] ? String(row['Titulo Reduzido (Cargo)']).trim() : null,
    sector: row['Descricao do Local'] ? String(row['Descricao do Local']).trim() : null,
    nationality: row['Descricao (Nacionalidade)'] ? String(row['Descricao (Nacionalidade)']).trim() : null,
    education: row['Descricao (Instrucao)'] ? String(row['Descricao (Instrucao)']).trim() : null,
    sex: row['Sexo'] ? String(row['Sexo']).trim() : null,
    marital: row['Descricao (Estado Civil)'] ? String(row['Descricao (Estado Civil)']).trim() : null,
    ethnicity: row['Descricao (Raca/Etnia)'] ? String(row['Descricao (Raca/Etnia)']).trim() : null,
    salary: parseSalary(row['Valor Salario']),
    type_registration: 'Importado',
    user_registration: userName || null,
    date_registration: todayLocalDateIso(), // apenas data local (sem fuso)
  }
}

export const insertEmployees = async (
  data: Record<string, any>[],
  userName: string | undefined,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<EmployeeResult> => {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, newCount: 0, updatedCount: 0, error: 'Missing Supabase credentials' }
  }

  try {
    const payload: EmployeePayload[] = data.map((row) => mapRowToEmployee(row, userName))
    const existingResult = await fetchEmployeeRegistrations(supabaseUrl, supabaseKey)
    if (!existingResult.ok) {
      const message = 'Erro ao buscar registros existentes'
      console.error(message)
      return { ok: false, newCount: 0, updatedCount: 0, error: message }
    }
    const existingSet = existingResult.registrations

    const filtered = payload.filter((p) => p.registration !== null)
    const toUpdate = filtered.filter((p) => p.registration !== null && existingSet.has(p.registration))
    const toInsert = filtered.filter((p) => p.registration !== null && !existingSet.has(p.registration))

    if (filtered.length === 0) {
      const message = 'Nenhuma linha com registro valido para employee'
      console.error(message)
      return { ok: false, newCount: 0, updatedCount: 0, error: message }
    }

    const updatePayload = toUpdate.map((entry) => ({
      ...entry,
      user_update: userName || null,
      date_update: new Date().toISOString(),
    }))

    const upsertPayload = [...toInsert, ...updatePayload].map((entry) => ({
      ...entry,
      user_update: entry.user_update ?? null,
      date_update: entry.date_update ?? null,
    }))
    const upsertUrl = new URL(`${supabaseUrl}/rest/v1/employee`)
    upsertUrl.searchParams.set('on_conflict', 'registration')
    const resUpsert = await fetch(upsertUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(upsertPayload),
    })
    if (!resUpsert.ok) {
      const errTxt = await resUpsert.text()
      console.error('Erro ao inserir/atualizar employee', errTxt)
      return { ok: false, newCount: 0, updatedCount: 0, error: errTxt }
    }

    return { ok: true, newCount: toInsert.length, updatedCount: toUpdate.length }
  } catch (error) {
    console.error('Erro ao salvar employee', error)
    return { ok: false, newCount: 0, updatedCount: 0, error: (error as Error).message }
  }
}

export const fetchEmployeeRegistrations = async (
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<EmployeeRegistryList> => {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, registrations: new Set() }
  }
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/employee`)
    url.searchParams.set('select', 'registration')

    // Busca paginada para garantir que todos os registros venham, independente do limite do PostgREST.
    const pageSize = 1000
    let start = 0
    const registrations = new Set<number>()

    while (true) {
      const rangeHeader = `${start}-${start + pageSize - 1}`
      const res = await fetch(url.toString(), {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Range: rangeHeader,
        },
      })
      if (!res.ok) {
        console.error('Erro ao buscar registros existentes', await res.text())
        return { ok: false, registrations: new Set() }
      }
      const rows = (await res.json()) as Array<{ registration: number }>
      rows.forEach((r) => registrations.add(r.registration))

      if (rows.length < pageSize) {
        break // Última página
      }
      start += pageSize
    }

    return { ok: true, registrations }
  } catch (err) {
    console.error('Erro ao buscar registros existentes', err)
    return { ok: false, registrations: new Set() }
  }
}

export const fetchEmployeeCompanies = async (
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<{ ok: boolean; companies: number[]; error?: string }> => {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, companies: [], error: 'Missing Supabase credentials' }
  }
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/employee`)
    url.searchParams.set('select', 'company')
    url.searchParams.set('order', 'company')

    const pageSize = 1000
    let start = 0
    const companiesSet = new Set<number>()

    while (true) {
      const rangeHeader = `${start}-${start + pageSize - 1}`
      const res = await fetch(url.toString(), {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Range: rangeHeader,
        },
      })
      if (!res.ok) {
        return { ok: false, companies: [], error: await res.text() }
      }
      const rows = (await res.json()) as Array<{ company: number | null }>
      rows.forEach((r) => {
        if (r.company !== null && r.company !== undefined) {
          companiesSet.add(Number(r.company))
        }
      })
      const contentRange = res.headers.get('content-range')
      const total = contentRange ? Number(contentRange.split('/')[1] || 0) : rows.length
      if (start + pageSize >= total || rows.length < pageSize) break
      start += pageSize
    }

    return { ok: true, companies: Array.from(companiesSet).sort((a, b) => a - b) }
  } catch (error) {
    return { ok: false, companies: [], error: (error as Error).message }
  }
}
