export interface OvertimePayload {
  registration: number | null
  name: string | null
  date_: string | null
  hours60: string | null
  hours100: string | null
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
