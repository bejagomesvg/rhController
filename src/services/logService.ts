import type { HistoryEntry } from '../models/history'

export const fetchHistory = async (
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<HistoryEntry[]> => {
  if (!supabaseUrl || !supabaseKey) return []
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/log_table_load`)
    url.searchParams.set('select', 'id,table_registration,actions,date_registration,file_,user_registration,type_registration')
    url.searchParams.set('order', 'date_registration.desc')
    const res = await fetch(url.toString(), {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })
    if (!res.ok) {
      const errTxt = await res.text()
      console.error('Erro ao buscar historico', errTxt)
      throw new Error(errTxt || 'Erro ao buscar historico')
    }
    const data = (await res.json()) as Array<{
      id: number
      table_registration?: string
      actions: string
      date_registration: string
      file_: string
      user_registration: string
      type_registration?: string
    }>
    return data.map((item) => ({
      id: item.id,
      banco: item.table_registration || '-',
      acao: item.actions,
      date: item.date_registration,
      arquivo: item.file_,
      usuario: item.user_registration,
    }))
  } catch (error) {
    console.error('Erro ao buscar historico', error)
    throw error
  }
}

export const insertHistory = async (
  entry: { table: string; actions: string; file: string; user: string; type?: string; id?: number },
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<boolean> => {
  if (!supabaseUrl || !supabaseKey) {
    return false
  }
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/log_table_load`)
    const payload = {
      table_registration: entry.table,
      actions: entry.actions,
      date_registration: new Date().toISOString(),
      file_: entry.file,
      user_registration: entry.user,
      type_registration: entry.type ?? 'Importado',
    }
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errTxt = await res.text()
      console.error('Erro ao gravar historico', errTxt)
      return false
    }
    return true
  } catch (error) {
    console.error('Erro ao gravar historico', error)
    return false
  }
}
