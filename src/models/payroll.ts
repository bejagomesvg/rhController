export interface PayrollPayload {
  registration: number | null
  name: string | null
  events_payroll: number | null
  references_payroll: number | null
  volue_payroll: number | null
  date_payroll: string | null
  type_registration: string
  user_registration: string | null
  date_registration: string
}

export interface PayrollResult {
  ok: boolean
  inserted: number
  error?: string
}

export interface PayrollMonthCheck {
  ok: boolean
  exists: boolean
  error?: string
}

export interface PayrollDeleteResult {
  ok: boolean
  deleted: number
  error?: string
}
