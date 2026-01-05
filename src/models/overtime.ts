export interface OvertimePayload {
  registration: number | null
  name: string | null
  date_: string | null
  hrs303: string | null
  hrs304: string | null
  hrs505: string | null
  hrs506: string | null
  hrs511: string | null
  hrs512: string | null
  company?: number | null
  type_registration: string
  user_registration: string | null
  date_registration: string
}

export interface OvertimeResult {
  ok: boolean
  inserted: number
  error?: string
}

export interface OvertimeDateCheck {
  ok: boolean
  exists: boolean
  error?: string
}

export interface OvertimeDatesCheck {
  ok: boolean
  exists: boolean
  dates?: string[]
  error?: string
}

export interface OvertimeDeleteResult {
  ok: boolean
  deleted: number
  error?: string
}

export interface OvertimeSummaryRow {
  company: number | null
  date_: string
  registration: number
  name: string
  sector: string | null
  salary?: number | null
  hrs303: string | null
  hrs304: string | null
  hrs505: string | null
  hrs506: string | null
  hrs511: string | null
  hrs512: string | null
}
