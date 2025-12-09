export interface EmployeePayload {
  company: number | null
  registration: number | null
  name: string
  cpf: string
  date_birth: string | null
  date_hiring: string | null
  status: number | null
  description_status?: string | null
  date_status?: string | null
  salary: number | null
  role: string | null
  sector: string | null
  nationality: string | null
  education: string | null
  sex: string | null
  marital: string | null
  ethnicity: string | null
  user_registration: string | null
  type_registration: string
  date_registration: string
  user_update?: string | null
  date_update?: string | null
}

export interface EmployeeResult {
  ok: boolean
  newCount: number
  updatedCount: number
  error?: string
}

export interface EmployeeRegistryList {
  ok: boolean
  registrations: Set<number>
}
