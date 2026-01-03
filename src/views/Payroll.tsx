import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, Toaster } from 'react-hot-toast'
import {
  ArrowDown10,
  ArrowDown01,
  ArrowDownAZ,
  ArrowDownZA,
  ArrowLeft,
  Bell,
  CalendarDays,
  DollarSign,
  FileText,
  Settings,
} from 'lucide-react'
import ConfirmAdicionarModal from '../components/ConfirmAdicionarModal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import { loadSession } from '../services/sessionService'
import { verifyPassword } from '../services/authService'
import { insertHistory } from '../services/logService'
import PayrollConfigPanel from './payroll/PayrollConfigPanel'
import PayrollMonthlyPanel from './payroll/PayrollMonthlyPanel'
import PayrollCostsPanel from './payroll/PayrollCostsPanel'
import PayrollAbsencesPanel from './payroll/PayrollAbsencesPanel'
import PayrollAlertsPanel from './payroll/PayrollAlertsPanel'

interface PayrollProps {
  onBack: () => void
  userName?: string
  userRole?: string
  title?: string
  description?: string
  supabaseUrl?: string
  supabaseKey?: string
}

const sidebarItems = [
  { key: 'folha', label: 'Folha Mensal', icon: FileText },
  { key: 'custos', label: 'Custos', icon: DollarSign },
  { key: 'afastamentos', label: 'Afastamentos', icon: CalendarDays },
  { key: 'alertas', label: 'Alertas', icon: Bell },
  { key: 'config', label: 'Configuracao', icon: Settings },
]

type ActiveTab = 'folha' | 'custos' | 'afastamentos' | 'alertas' | 'config'
type EmployeeSortKey = 'company' | 'registration' | 'name' | 'date_hiring' | 'sector' | 'status' | 'date_status'
type ClosingSortKey = 'company' | 'competence' | 'type_registration' | 'user_registration' | 'date_registration'

type EmployeeRow = {
  company: number | null
  registration: number | null
  name: string | null
  date_hiring: string | null
  sector: string | null
  status: number | null
  date_status: string | null
}

type ClosingPayrollRow = {
  id: number
  company: number | null
  registration: number | null
  competence: string | null
  name: string | null
  status_: number | null
  status_date: string | null
  type_registration: string | null
  user_registration: string | null
  date_registration: string | null
}

const ACTIVE_TAB_KEY = 'payroll-active-tab'

const Payroll: React.FC<PayrollProps> = ({
  onBack,
  userName,
  userRole,
  title,
  description,
  supabaseUrl,
  supabaseKey,
}) => {
  const [active, setActive] = useState<ActiveTab>(() => {
    if (typeof window === 'undefined') return 'config'
    const saved = window.localStorage.getItem(ACTIVE_TAB_KEY)
    return saved === 'folha' || saved === 'custos' || saved === 'afastamentos' || saved === 'alertas' || saved === 'config'
      ? saved
      : 'config'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACTIVE_TAB_KEY, active)
    }
  }, [active])

  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>([])
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [statusDescriptions, setStatusDescriptions] = useState<Record<number, string>>({})
  const [closingRows, setClosingRows] = useState<ClosingPayrollRow[]>([])
  const [isLoadingClosing, setIsLoadingClosing] = useState(false)
  const [closingError, setClosingError] = useState<string | null>(null)
  const [payrollCompetences, setPayrollCompetences] = useState<string[]>([])
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closePassword, setClosePassword] = useState('')
  const [closePasswordError, setClosePasswordError] = useState<'required' | 'invalid' | null>(null)
  const [closePasswordAttempts, setClosePasswordAttempts] = useState(0)
  const [showDeleteClosingModal, setShowDeleteClosingModal] = useState(false)
  const [deleteClosingPassword, setDeleteClosingPassword] = useState('')
  const [deleteClosingError, setDeleteClosingError] = useState<'required' | 'invalid' | null>(null)
  const [deleteClosingAttempts, setDeleteClosingAttempts] = useState(0)
  const [deleteClosingTarget, setDeleteClosingTarget] = useState<{ company: number; competence: string } | null>(null)
  const [employeeSort, setEmployeeSort] = useState<{ key: EmployeeSortKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  })
  const [closingSort, setClosingSort] = useState<{ key: ClosingSortKey; direction: 'asc' | 'desc' }>({
    key: 'competence',
    direction: 'desc',
  })
  const [employeeCompanyFilter, setEmployeeCompanyFilter] = useState('')
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState('')
  const [closingYearFilter, setClosingYearFilter] = useState('')
  const [closingMonthFilter, setClosingMonthFilter] = useState('')
  const [editingRegistration, setEditingRegistration] = useState<number | null>(null)
  const [editStatusValue, setEditStatusValue] = useState('')
  const [editDateStatusValue, setEditDateStatusValue] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  useEffect(() => {
    if (active !== 'config') return
    if (!supabaseUrl || !supabaseKey) return
    const controller = new AbortController()

    const fetchEmployees = async () => {
      setIsLoadingEmployees(true)
      setEmployeeError(null)
      try {
        const rows: EmployeeRow[] = []
        const url = new URL(`${supabaseUrl}/rest/v1/employee`)
        url.searchParams.set('select', 'company,registration,name,date_hiring,sector,status,date_status')
        url.searchParams.set('order', 'name.asc')

        const pageSize = 500
        let start = 0
        let hasMore = true

        while (hasMore) {
          const rangeHeader = `${start}-${start + pageSize - 1}`
          const res = await fetch(url.toString(), {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Range: rangeHeader,
            },
            signal: controller.signal,
          })
          if (!res.ok) {
            const errText = await res.text()
            throw new Error(errText || 'Erro ao carregar colaboradores.')
          }
          const batch = (await res.json()) as EmployeeRow[]
          rows.push(...batch)
          if (batch.length < pageSize) {
            hasMore = false
          } else {
            start += pageSize
          }
        }

        setEmployeeRows(rows)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          const message = err instanceof Error ? err.message : 'Erro ao carregar colaboradores.'
          setEmployeeError(message)
        }
      } finally {
        setIsLoadingEmployees(false)
      }
    }

    fetchEmployees()
    return () => controller.abort()
  }, [active, supabaseUrl, supabaseKey])

  const loadClosingPayroll = useCallback(async (signal?: AbortSignal) => {
    if (!supabaseUrl || !supabaseKey) return
    setIsLoadingClosing(true)
    setClosingError(null)
    try {
      const rows: ClosingPayrollRow[] = []
      const url = new URL(`${supabaseUrl}/rest/v1/closing_payroll`)
      url.searchParams.set(
        'select',
        'id,company,registration,competence,name,status_,status_date,type_registration,user_registration,date_registration',
      )
      url.searchParams.set('order', 'competence.desc,name.asc')

      const pageSize = 500
      let start = 0
      let hasMore = true

      while (hasMore) {
        const rangeHeader = `${start}-${start + pageSize - 1}`
        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Range: rangeHeader,
          },
          signal,
        })
        if (!res.ok) {
          const errText = await res.text()
          throw new Error(errText || 'Erro ao carregar fechamentos.')
        }
        const batch = (await res.json()) as ClosingPayrollRow[]
        rows.push(...batch)
        if (batch.length < pageSize) {
          hasMore = false
        } else {
          start += pageSize
        }
      }

      setClosingRows(rows)
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar fechamentos.'
        setClosingError(message)
      }
    } finally {
      setIsLoadingClosing(false)
    }
  }, [supabaseUrl, supabaseKey])

  useEffect(() => {
    if (active !== 'config') return
    const controller = new AbortController()
    loadClosingPayroll(controller.signal)
    return () => controller.abort()
  }, [active, loadClosingPayroll])

  useEffect(() => {
    if (active !== 'config') return
    if (!supabaseUrl || !supabaseKey) return
    const controller = new AbortController()

    const fetchPayrollCompetences = async () => {
      try {
        const values: string[] = []
        const url = new URL(`${supabaseUrl}/rest/v1/payroll`)
        url.searchParams.set('select', 'competence')
        url.searchParams.set('order', 'competence.desc')

        const pageSize = 1000
        let start = 0
        let hasMore = true

        while (hasMore) {
          const rangeHeader = `${start}-${start + pageSize - 1}`
          const res = await fetch(url.toString(), {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Range: rangeHeader,
            },
            signal: controller.signal,
          })
          if (!res.ok) break
          const batch = (await res.json()) as Array<{ competence: string | null }>
          batch.forEach((row) => {
            if (row.competence) values.push(row.competence)
          })
          if (batch.length < pageSize) {
            hasMore = false
          } else {
            start += pageSize
          }
        }

        const uniqueValues = Array.from(new Set(values))
        setPayrollCompetences(uniqueValues)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setPayrollCompetences([])
        }
      }
    }

    fetchPayrollCompetences()
    return () => controller.abort()
  }, [active, supabaseUrl, supabaseKey])

  useEffect(() => {
    if (active !== 'config') return
    if (!supabaseUrl || !supabaseKey) return
    const controller = new AbortController()

    const fetchStatusDescriptions = async () => {
      try {
        const url = new URL(`${supabaseUrl}/rest/v1/status`)
        url.searchParams.set('select', 'status,description')
        url.searchParams.set('order', 'status.asc')
        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = (await res.json()) as Array<{ status: number; description: string }>
        const map: Record<number, string> = {}
        data.forEach((row) => {
          if (row.status !== null && row.status !== undefined && row.description) {
            map[Number(row.status)] = row.description
          }
        })
        setStatusDescriptions(map)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setStatusDescriptions({})
        }
      }
    }

    fetchStatusDescriptions()
    return () => controller.abort()
  }, [active, supabaseUrl, supabaseKey])

  const parseYearMonth = (val?: string | null) => {
    if (!val) return null
    const match = String(val).trim().match(/^(\d{4})-(\d{2})-\d{2}$/)
    if (!match) return null
    return { year: Number(match[1]), month: Number(match[2]) }
  }

  const normalizeDateOnly = (val?: string | null) => {
    if (!val) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
    const parsed = new Date(val)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toISOString().slice(0, 10)
  }

  const filteredEmployees = useMemo(() => {
    const query = employeeFilter.trim().toLowerCase()
    return employeeRows.filter((row) => {
      if (employeeCompanyFilter && String(row.company ?? '') !== employeeCompanyFilter) return false
      if (employeeStatusFilter) {
        if (String(row.status ?? '') !== employeeStatusFilter) return false
      } else if (row.status === 7) {
        return false
      }
      if (closingYearFilter && closingMonthFilter) {
        const hiring = parseYearMonth(row.date_hiring)
        if (hiring) {
          const selYear = Number(closingYearFilter)
          const selMonth = Number(closingMonthFilter)
          if (
            !Number.isNaN(selYear) &&
            !Number.isNaN(selMonth) &&
            (hiring.year > selYear || (hiring.year === selYear && hiring.month > selMonth))
          ) {
            return false
          }
        }
      }
      if (!query) return true
      const combined = `${row.registration ?? ''} ${row.name ?? ''} ${row.sector ?? ''}`.toLowerCase()
      return combined.includes(query)
    })
  }, [employeeFilter, employeeRows, employeeCompanyFilter, employeeStatusFilter, closingYearFilter, closingMonthFilter])

  const statusCounts = useMemo(() => {
    const counts = new Map<number, number>()
    filteredEmployees.forEach((row) => {
      if (row.status === null || row.status === undefined) return
      counts.set(row.status, (counts.get(row.status) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([status, count]) => {
        const description = statusDescriptions[status]
        const label = description ? `${status} - ${description}` : String(status)
        return { status, count, label }
      })
      .sort((a, b) => a.status - b.status)
  }, [filteredEmployees, statusDescriptions])

  const sortedEmployees = useMemo(() => {
    const dir = employeeSort.direction === 'asc' ? 1 : -1
    const getSortValue = (row: EmployeeRow) => {
      switch (employeeSort.key) {
        case 'company':
          return row.company ?? null
        case 'registration':
          return row.registration ?? null
        case 'name':
          return row.name?.toLowerCase() ?? null
        case 'date_hiring':
          return row.date_hiring ? new Date(row.date_hiring).getTime() : null
        case 'sector':
          return row.sector?.toLowerCase() ?? null
        case 'status':
          return row.status ?? null
        case 'date_status':
          return row.date_status ? new Date(row.date_status).getTime() : null
        default:
          return null
      }
    }

    return [...filteredEmployees].sort((a, b) => {
      const valA = getSortValue(a)
      const valB = getSortValue(b)
      if (valA === null && valB === null) return 0
      if (valA === null) return 1
      if (valB === null) return -1
      if (valA < valB) return -1 * dir
      if (valA > valB) return 1 * dir
      return 0
    })
  }, [employeeSort, filteredEmployees])

  const toggleEmployeeSort = (key: EmployeeSortKey) => {
    setEmployeeSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const renderSortIndicator = (isActive: boolean, direction: 'asc' | 'desc', variant: 'text' | 'number') => {
    if (!isActive) return null
    if (variant === 'text') {
      return direction === 'asc' ? (
        <ArrowDownAZ className="ml-1 h-4 w-4 text-amber-200" />
      ) : (
        <ArrowDownZA className="ml-1 h-4 w-4 text-amber-200" />
      )
    }
    return direction === 'asc' ? (
      <ArrowDown01 className="ml-1 h-4 w-4 text-amber-200" />
    ) : (
      <ArrowDown10 className="ml-1 h-4 w-4 text-amber-200" />
    )
  }

  const formatDateShort = (val?: string | null) => {
    if (!val) return '-'
    const str = String(val).trim()

    // Parse local date/time to avoid timezone shifting (e.g., midnight UTC showing as previous day)
    const match = str.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?/,
    )
    if (match) {
      const [, y, m, d, hh, mi] = match
      const year = Number(y)
      const month = Number(m) - 1
      const day = Number(d)
      const hours = hh !== undefined ? Number(hh) : 0
      const minutes = mi !== undefined ? Number(mi) : 0
      const local = new Date(year, month, day, hours, minutes)
      const dd = String(local.getDate()).padStart(2, '0')
      const mm = String(local.getMonth() + 1).padStart(2, '0')
      const yyyy = local.getFullYear()
      if (hh !== undefined && mi !== undefined) {
        const hhStr = String(hours).padStart(2, '0')
        const miStr = String(minutes).padStart(2, '0')
        return `${dd}/${mm}/${yyyy} ${hhStr}:${miStr}`
      }
      return `${dd}/${mm}/${yyyy}`
    }

    const parsed = new Date(str)
    if (Number.isNaN(parsed.getTime())) return str
    const dd = String(parsed.getDate()).padStart(2, '0')
    const mm = String(parsed.getMonth() + 1).padStart(2, '0')
    const yyyy = parsed.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  const formatCompetenceMonth = (val?: string | null) => {
    if (!val) return '-'
    const match = String(val).trim().match(/^(\d{4})-(\d{2})-\d{2}$/)
    if (!match) return formatDateShort(val)
    return `${match[2]}/${match[1]}`
  }

  const formatCompanyLabel = (company: number) => {
    if (company === 4) return 'Frigosul'
    if (company === 5) return 'Pantaneira'
    return String(company)
  }

  const employeeCompanies = useMemo(() => {
    const items = employeeRows
      .map((row) => row.company)
      .filter((val): val is number => val !== null && val !== undefined)
    return Array.from(new Set(items)).sort((a, b) => a - b)
  }, [employeeRows])

  useEffect(() => {
    if (employeeCompanies.length === 0) return
    if (employeeCompanyFilter) return
    setEmployeeCompanyFilter(String(employeeCompanies[0]))
  }, [employeeCompanies, employeeCompanyFilter])

  const employeeStatuses = useMemo(() => {
    const statuses = employeeRows
      .map((row) => row.status)
      .filter((val): val is number => val !== null && val !== undefined)
    return Array.from(new Set(statuses)).sort((a, b) => a - b)
  }, [employeeRows])

  const closingYears = useMemo(() => {
    const years = payrollCompetences
      .map((competence) => new Date(competence).getUTCFullYear())
      .filter((val): val is number => val !== null && !Number.isNaN(val))
    return Array.from(new Set(years)).sort((a, b) => b - a)
  }, [payrollCompetences])

  const closingMonths = useMemo(() => {
    const months = payrollCompetences
      .map((competence) => new Date(competence).getUTCMonth() + 1)
      .filter((val): val is number => val !== null && !Number.isNaN(val))
    return Array.from(new Set(months)).sort((a, b) => a - b)
  }, [payrollCompetences])

  useEffect(() => {
    if (closingYears.length > 0 && !closingYearFilter) {
      setClosingYearFilter(String(closingYears[0]))
    }
  }, [closingYears, closingYearFilter])

  useEffect(() => {
    if (closingMonths.length > 0 && !closingMonthFilter) {
      setClosingMonthFilter(String(closingMonths[0]))
    }
  }, [closingMonths, closingMonthFilter])

  // Tabela de fechamentos passa a exibir todos os registros, independente do filtro de competência
  const filteredClosingRows = useMemo(() => closingRows, [closingRows])

  const admissionDemissionCounts = useMemo(() => {
    if (!closingYearFilter || !closingMonthFilter) {
      return { admissions: 0, demissions: 0 }
    }

    const year = Number(closingYearFilter)
    const month = Number(closingMonthFilter)
    if (Number.isNaN(year) || Number.isNaN(month)) {
      return { admissions: 0, demissions: 0 }
    }

    const byCompany = employeeCompanyFilter
      ? employeeRows.filter((row) => String(row.company ?? '') === employeeCompanyFilter)
      : employeeRows

    let admissions = 0
    let demissions = 0

    byCompany.forEach((row) => {
      const hiring = parseYearMonth(row.date_hiring)
      if (hiring && hiring.year === year && hiring.month === month) {
        admissions += 1
      }

      if (row.status === 7) {
        const demission = parseYearMonth(row.date_status)
        if (demission && demission.year === year && demission.month === month) {
          demissions += 1
        }
      }
    })

    return { admissions, demissions }
  }, [employeeRows, employeeCompanyFilter, closingYearFilter, closingMonthFilter])

  const hasPayrollPeriod = payrollCompetences.length > 0
  const hasClosingForFilters = useMemo(() => {
    if (!employeeCompanyFilter || !closingYearFilter || !closingMonthFilter) return false
    const competence = `${closingYearFilter}-${String(closingMonthFilter).padStart(2, '0')}-01`
    return closingRows.some(
      (row) =>
        String(row.company ?? '') === employeeCompanyFilter &&
        normalizeDateOnly(row.competence) === competence
    )
  }, [closingRows, employeeCompanyFilter, closingYearFilter, closingMonthFilter])
  const hasOpenPayroll = hasPayrollPeriod && !hasClosingForFilters

  const handleClearFilters = () => {
    if (employeeCompanies.length > 0) {
      setEmployeeCompanyFilter(String(employeeCompanies[0]))
    } else {
      setEmployeeCompanyFilter('')
    }
    setEmployeeStatusFilter('')
    setClosingYearFilter('')
    setClosingMonthFilter('')
  }

  const handleOpenCloseModal = () => {
    setShowCloseModal(true)
    setClosePassword('')
    setClosePasswordError(null)
    setClosePasswordAttempts(0)
  }

  const handleStartDeleteClosing = (row: ClosingPayrollRow) => {
    if (!row.company || !row.competence) return
    setDeleteClosingTarget({ company: row.company, competence: row.competence })
    setDeleteClosingPassword('')
    setDeleteClosingError(null)
    setDeleteClosingAttempts(0)
    setShowDeleteClosingModal(true)
  }

  const startEditRow = (row: EmployeeRow) => {
    if (!row.registration) return
    setEditingRegistration(row.registration)
    setEditStatusValue(row.status !== null && row.status !== undefined ? String(row.status) : '')
    setEditDateStatusValue(normalizeDateOnly(row.date_status) || '')
  }

  const cancelEditRow = () => {
    setEditingRegistration(null)
    setEditStatusValue('')
    setEditDateStatusValue('')
  }

  const saveEditRow = async () => {
    if (!supabaseUrl || !supabaseKey) {
      toast.error('Credenciais do Supabase ausentes.')
      return
    }
    if (!editingRegistration) return
    if (!editStatusValue) {
      toast.error('Informe o status.')
      return
    }
    const normalizedStatus = Number(editStatusValue)
    const shouldClearDate = normalizedStatus === 1
    if (!shouldClearDate && !editDateStatusValue) {
      toast.error('Informe a data do status.')
      return
    }
    setIsSavingEdit(true)
    try {
      const url = new URL(`${supabaseUrl}/rest/v1/employee`)
      url.searchParams.set('registration', `eq.${editingRegistration}`)
      const res = await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: normalizedStatus,
          date_status: shouldClearDate ? null : editDateStatusValue,
        }),
      })
      if (!res.ok) {
        const errTxt = await res.text()
        const message = errTxt || 'Erro ao atualizar colaborador.'
        toast.error(message, { duration: 4000 })
        return
      }
      setEmployeeRows((prev) =>
        prev.map((row) =>
          row.registration === editingRegistration
            ? {
                ...row,
                status: normalizedStatus,
                date_status: shouldClearDate ? null : editDateStatusValue,
              }
            : row
        )
      )
      toast.success('Status atualizado com sucesso!')
      cancelEditRow()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar colaborador.'
      toast.error(message, { duration: 4000 })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const insertClosingPayroll = async () => {
    if (!supabaseUrl || !supabaseKey) {
      setClosingError('Credenciais do Supabase ausentes.')
      return false
    }
    setClosingError(null)
    if (!closingYearFilter || !closingMonthFilter) {
      setClosingError('Periodo de fechamento invalido.')
      return false
    }
    const year = Number(closingYearFilter)
    const month = Number(closingMonthFilter)
    if (Number.isNaN(year) || Number.isNaN(month)) {
      setClosingError('Periodo de fechamento invalido.')
      return false
    }
    const competence = `${year}-${String(month).padStart(2, '0')}-01`
    const sessionUser = loadSession()
    const userLogin = sessionUser?.username || userName || 'Sistema'

    const payload = filteredEmployees
      .filter((row) => row.company !== null && row.registration !== null && row.status !== null && row.name)
      .map((row) => {
        const statusDate = normalizeDateOnly(row.date_status) || null
        return {
          company: row.company,
          registration: row.registration,
          competence,
          name: row.name || '',
          status_: row.status,
          status_date: statusDate,
          type_registration: 'Fechamento',
          user_registration: userLogin,
          user_update: null,
          date_update: null,
        }
      })

    if (payload.length === 0) {
      setClosingError('Nenhum colaborador valido para fechamento.')
      return false
    }

    try {
      const url = new URL(`${supabaseUrl}/rest/v1/closing_payroll`)
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
        const message = errTxt || 'Erro ao gravar fechamento.'
        setClosingError(message)
        toast.error(message, { duration: 4000 })
        return false
      }

      const refLabel = `${String(month).padStart(2, '0')}/${year}`
      const companyLabel = employeeCompanyFilter
        ? formatCompanyLabel(Number(employeeCompanyFilter))
        : '-'
      await insertHistory(
        {
          table: `closing_payroll Ref. ${refLabel}`,
          actions: 'Inclusao',
          file: `Folha Fechada: ${companyLabel} ref. ${refLabel}`,
          user: userLogin,
          type: 'Fechamento',
        },
        supabaseUrl,
        supabaseKey
      )

      await loadClosingPayroll()
      toast.success('Fechamento registrado com sucesso!')
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gravar fechamento.'
      setClosingError(message)
      toast.error(message, { duration: 4000 })
      return false
    }
  }

  const deleteClosingPayroll = async () => {
    if (!supabaseUrl || !supabaseKey) {
      setClosingError('Credenciais do Supabase ausentes.')
      return false
    }
    if (!deleteClosingTarget) return false
    const { company, competence } = deleteClosingTarget
    try {
      const url = new URL(`${supabaseUrl}/rest/v1/closing_payroll`)
      url.searchParams.set('company', `eq.${company}`)
      url.searchParams.set('competence', `eq.${competence}`)
      const res = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'count=exact',
        },
      })
      if (!res.ok) {
        const errTxt = await res.text()
        const message = errTxt || 'Erro ao excluir fechamento.'
        setClosingError(message)
        toast.error(message, { duration: 4000 })
        return false
      }

      const refLabel = formatCompetenceMonth(competence)
      const companyLabel = formatCompanyLabel(company)
      const sessionUser = loadSession()
      const userLogin = sessionUser?.username || userName || '-'
      await insertHistory(
        {
          table: `closing_payroll Ref. ${refLabel}`,
          actions: 'Delete',
          file: `Folha Fechada: ${companyLabel} ref. ${refLabel}`,
          user: userLogin,
          type: 'Fechamento',
        },
        supabaseUrl,
        supabaseKey
      )

      await loadClosingPayroll()
      toast.success('Fechamento excluido com sucesso!')
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir fechamento.'
      setClosingError(message)
      toast.error(message, { duration: 4000 })
      return false
    }
  }

  const toggleClosingSort = (key: ClosingSortKey) => {
    setClosingSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const sortedClosingRows = useMemo(() => {
    const dir = closingSort.direction === 'asc' ? 1 : -1
    const getSortValue = (row: ClosingPayrollRow) => {
      switch (closingSort.key) {
        case 'company':
          return row.company ?? null
        case 'competence':
          return row.competence ? new Date(row.competence).getTime() : null
        case 'type_registration':
          return row.type_registration?.toLowerCase() ?? null
        case 'user_registration':
          return row.user_registration?.toLowerCase() ?? null
        case 'date_registration':
          return row.date_registration ? new Date(row.date_registration).getTime() : null
        default:
          return null
      }
    }

    return [...filteredClosingRows].sort((a, b) => {
      const valA = getSortValue(a)
      const valB = getSortValue(b)
      if (valA === null && valB === null) return 0
      if (valA === null) return 1
      if (valB === null) return -1
      if (valA < valB) return -1 * dir
      if (valA > valB) return 1 * dir
      return 0
    })
  }, [filteredClosingRows, closingSort])

  const groupedClosingRows = useMemo(() => {
    const byKey = new Map<string, ClosingPayrollRow>()
    sortedClosingRows.forEach((row) => {
      const key = `${row.company ?? 'na'}-${row.competence ?? 'na'}`
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, row)
        return
      }
      const existingDate = existing.date_registration ? new Date(existing.date_registration).getTime() : 0
      const nextDate = row.date_registration ? new Date(row.date_registration).getTime() : 0
      if (nextDate > existingDate) {
        byKey.set(key, row)
      }
    })
    return Array.from(byKey.values())
  }, [sortedClosingRows])

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-slate-800 text-white border border-white/10 shadow-lg',
          success: { iconTheme: { primary: '#22c55e', secondary: 'white' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: 'white' } },
        }}
      />
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">{title || 'Folha de Pagamento'}</p>
          <h3 className="text-white text-xl font-semibold mt-1">
            {description || 'Fechamento e indicadores da folha'}
          </h3>
        </div>
        <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-3 rounded-xl shadow-inner shadow-black/20">
          <div>
            <p className="text-emerald-300 font-semibold leading-tight">{userName}</p>
            <p className="text-white/60 text-[11px] uppercase tracking-[0.25em]">{userRole}</p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-emerald-100 bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 rounded-lg hover:bg-emerald-500/25 hover:border-emerald-400/70 transition-colors text-xs font-semibold uppercase tracking-wide"
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>

      <div className="flex gap-0">
        <div className="group relative self-start">
          <div className="flex flex-col bg-white/5 border border-white/10 border-r-0 rounded-l-xl overflow-hidden w-12 group-hover:w-40 transition-all duration-300 shadow-inner shadow-black/20">
            {sidebarItems.map((item, idx) => {
              const Icon = item.icon
              const isLast = idx === sidebarItems.length - 1
              const isActive = item.key === active
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`relative flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors h-11 ${
                    !isLast ? 'border-b border-white/5' : ''
                  } ${isActive ? 'bg-emerald-500/15 text-emerald-100' : ''}`}
                  title={item.label}
                  onClick={() => setActive(item.key as ActiveTab)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-300' : 'text-white/80'}`} />
                  <span className="font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 bg-white/5 border border-white/10 rounded-r-xl rounded-bl-xl rounded-tl-none p-6 shadow-inner shadow-black/10 min-h-[540px]">
          {active === 'folha' && <PayrollMonthlyPanel supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />}

          {active === 'custos' && <PayrollCostsPanel supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />}

          {active === 'afastamentos' && <PayrollAbsencesPanel supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />}

          {active === 'alertas' && <PayrollAlertsPanel />}

          {active === 'config' && (
            <PayrollConfigPanel
              employeeCompanyFilter={employeeCompanyFilter}
              setEmployeeCompanyFilter={setEmployeeCompanyFilter}
              employeeCompanies={employeeCompanies}
              employeeStatusFilter={employeeStatusFilter}
              setEmployeeStatusFilter={setEmployeeStatusFilter}
              employeeStatuses={employeeStatuses}
              statusDescriptions={statusDescriptions}
              closingYearFilter={closingYearFilter}
              setClosingYearFilter={setClosingYearFilter}
              closingYears={closingYears}
              closingMonthFilter={closingMonthFilter}
              setClosingMonthFilter={setClosingMonthFilter}
              closingMonths={closingMonths}
              onClearFilters={handleClearFilters}
              employeeFilter={employeeFilter}
              setEmployeeFilter={setEmployeeFilter}
              hasOpenPayroll={hasOpenPayroll}
              hasPayrollPeriod={hasPayrollPeriod}
              hasClosingForFilters={hasClosingForFilters}
              statusCounts={statusCounts}
              admissionDemissionCounts={admissionDemissionCounts}
              filteredEmployeesCount={filteredEmployees.length}
              onOpenCloseModal={handleOpenCloseModal}
              employeeSort={employeeSort}
              toggleEmployeeSort={toggleEmployeeSort}
              renderSortIndicator={renderSortIndicator}
              isLoadingEmployees={isLoadingEmployees}
              employeeError={employeeError}
              filteredEmployeesLength={filteredEmployees.length}
              sortedEmployees={sortedEmployees}
              formatDateShort={formatDateShort}
              editingRegistration={editingRegistration}
              editStatusValue={editStatusValue}
              setEditStatusValue={setEditStatusValue}
              editDateStatusValue={editDateStatusValue}
              setEditDateStatusValue={setEditDateStatusValue}
              isSavingEdit={isSavingEdit}
              startEditRow={startEditRow}
              cancelEditRow={cancelEditRow}
              saveEditRow={saveEditRow}
              closingSort={closingSort}
              toggleClosingSort={toggleClosingSort}
              isLoadingClosing={isLoadingClosing}
              closingError={closingError}
              closingRowsLength={closingRows.length}
              groupedClosingRows={groupedClosingRows}
              onStartDeleteClosing={handleStartDeleteClosing}
              formatCompetenceMonth={formatCompetenceMonth}
              formatCompanyLabel={formatCompanyLabel}
            />
          )}
        </div>
      </div>
      </div>
      <ConfirmAdicionarModal
        open={showCloseModal}
        title="Confirmar fechamento"
        description={
          <p>
            Voce esta prestes a fechar a folha. Confirme para registrar o fechamento atual.
          </p>
        }
        confirmLabel="Fechar folha"
        passwordValue={closePassword}
        passwordError={closePasswordError}
        attempts={closePasswordAttempts}
        onPasswordChange={(value) => {
          setClosePassword(value)
          setClosePasswordError(null)
        }}
        onCancel={() => {
          setShowCloseModal(false)
          setClosePassword('')
          setClosePasswordError(null)
          setClosePasswordAttempts(0)
        }}
        onConfirm={() => {
          const pwd = closePassword.trim()
          if (!pwd) {
            setClosePasswordError('required')
            return
          }
          const sessionUser = loadSession()
          if (!sessionUser) {
            setClosePasswordError('invalid')
            return
          }
          verifyPassword(pwd, sessionUser.password).then(async (valid) => {
            if (!valid) {
              setClosePasswordAttempts((prev) => prev + 1)
              setClosePasswordError('invalid')
              return
            }
            const saved = await insertClosingPayroll()
            if (!saved) return
            setShowCloseModal(false)
            setClosePassword('')
            setClosePasswordError(null)
            setClosePasswordAttempts(0)
          })
        }}
      />
      <ConfirmDeleteModal
        open={showDeleteClosingModal}
        title="Excluir fechamento"
        description={
          <p>
            Este fechamento sera removido definitivamente. Deseja continuar?
          </p>
        }
        passwordValue={deleteClosingPassword}
        passwordError={deleteClosingError}
        attempts={deleteClosingAttempts}
        onPasswordChange={(value) => {
          setDeleteClosingPassword(value)
          setDeleteClosingError(null)
        }}
        onCancel={() => {
          setShowDeleteClosingModal(false)
          setDeleteClosingPassword('')
          setDeleteClosingError(null)
          setDeleteClosingAttempts(0)
          setDeleteClosingTarget(null)
        }}
        onConfirm={() => {
          const pwd = deleteClosingPassword.trim()
          if (!pwd) {
            setDeleteClosingError('required')
            return
          }
          const sessionUser = loadSession()
          if (!sessionUser) {
            setDeleteClosingError('invalid')
            return
          }
          verifyPassword(pwd, sessionUser.password).then(async (valid) => {
            if (!valid) {
              setDeleteClosingAttempts((prev) => prev + 1)
              setDeleteClosingError('invalid')
              return
            }
            const deleted = await deleteClosingPayroll()
            if (!deleted) return
            setShowDeleteClosingModal(false)
            setDeleteClosingPassword('')
            setDeleteClosingError(null)
            setDeleteClosingAttempts(0)
            setDeleteClosingTarget(null)
          })
        }}
      />
    </>
  )
}

export default Payroll
