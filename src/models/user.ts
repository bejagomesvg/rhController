export type ModuleKey =
  | 'recruitment'
  | 'payroll'
  | 'training'
  | 'shift_schedule_and_vacation'
  | 'evaluation'
  | 'communication'
  | 'health_and_safety'
  | 'benefits'
  | 'development'
  | 'infrastructure'
  | 'security'
  | 'database'
  | 'table_load'

export type UserRegistration = {
  id: number
  username: string
  password: string
  is_authorized: boolean
  type_user?: string
  name?: string
  // Flags ou valores para liberar módulos; qualquer valor truthy libera.
  recruitment?: string | boolean
  payroll?: string | boolean
  training?: string | boolean
  shift_schedule_and_vacation?: string | boolean
  evaluation?: string | boolean
  communication?: string | boolean
  health_and_safety?: string | boolean
  benefits?: string | boolean
  development?: string | boolean
  infrastructure?: string | boolean
  security?: string | boolean
  database?: string | boolean
  table_load?: string | boolean
}
