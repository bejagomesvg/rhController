import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Users,
  DollarSign,
  Settings,
  Bell,
  FileText,
  ArrowUp,
  ArrowDown,
  Edit,
  Trash2,
  Check,
  X,
  CalendarDays,
  RotateCw,
  CalendarX,
  Factory,
  AlertTriangle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
  Legend,
} from 'recharts'
import StatCardSkeleton from '../components/StatCardSkeleton'
import { Toaster, toast } from 'react-hot-toast'
import { loadSession } from '../services/sessionService'
import { verifyPassword } from '../services/authService'

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
  { key: 'config', label: 'Configuração', icon: Settings },
]

type PayrollStats = {
  totalEmployees: number
  totalRecords: number
  totalValue: number
  avgValue: number
}

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
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
  const currentDate = new Date()
  const [active, setActive] = useState<'folha' | 'custos' | 'afastamentos' | 'alertas' | 'config'>(() => {
    if (typeof window === 'undefined') return 'folha'
    const saved = window.localStorage.getItem(ACTIVE_TAB_KEY)
    return saved === 'folha' || saved === 'custos' || saved === 'afastamentos' || saved === 'alertas' || saved === 'config' ? saved : 'folha'
  })
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear().toString())
  const [filterMonth, setFilterMonth] = useState(String(currentDate.getMonth() + 1))
  const [filterCompany, setFilterCompany] = useState('')
  const [filterSector, setFilterSector] = useState('')
  // Filtros exclusivos da aba "config" para não afetar os demais filtros
  const [configCompany, setConfigCompany] = useState('')
  const [configYear, setConfigYear] = useState(currentDate.getFullYear().toString())
  const [configMonth, setConfigMonth] = useState(String(currentDate.getMonth() + 1))
  const [isConfigPeriodClosed, setIsConfigPeriodClosed] = useState(false)
  const [closingHistory, setClosingHistory] = useState<Array<{
    company: number
    registration?: number
    competence: string
    date_registration: string
    type_registration: string
    user_registration: string
  }>>([])
  const [isLoadingClosingHistory, setIsLoadingClosingHistory] = useState(false)
  const [closingToDelete, setClosingToDelete] = useState<{ company: number; competence: string } | null>(null)
  const [isDeletingClosing, setIsDeletingClosing] = useState(false)
  const [closingDeletePassword, setClosingDeletePassword] = useState('')
  const [closingDeleteAttempts, setClosingDeleteAttempts] = useState(0)
  const [closingDeleteError, setClosingDeleteError] = useState<'required' | 'invalid' | null>(null)
  const [closingAuthPassword, setClosingAuthPassword] = useState('')
  const [closingAuthError, setClosingAuthError] = useState<'required' | 'invalid' | null>(null)
  const [isClosingAuthModalOpen, setIsClosingAuthModalOpen] = useState(false)
  const [closingAuthAttempts, setClosingAuthAttempts] = useState(0)
  const [years, setYears] = useState<string[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [sectors, setSectors] = useState<string[]>([])
  const [activeEmployees, setActiveEmployees] = useState(0)
  const [activeEmployeesList, setActiveEmployeesList] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStatusValue, setEditStatusValue] = useState<string>('')
  const [editDateValue, setEditDateValue] = useState<string>('')
  const [admissionsCount, setAdmissionsCount] = useState(0)
  const [dismissalsCount, setDismissalsCount] = useState(0)
  const [stats, setStats] = useState<PayrollStats>({
    totalEmployees: 0,
    totalRecords: 0,
    totalValue: 0,
    avgValue: 0,
  })
  const [sectorByRegistration, setSectorByRegistration] = useState<Record<string, string>>({})
  const [employeeIndex, setEmployeeIndex] = useState<Record<string, { sector: string; company: string }>>({})
  const [sectorSummary, setSectorSummary] = useState<Array<{ label: string; totalValue: number }>>([])
  const [sectorEmployeeSummary, setSectorEmployeeSummary] = useState<Array<{ label: string; count: number }>>([])
  const [sectorTurnoverCounts, setSectorTurnoverCounts] = useState<
    Array<{ sector: string; admissions: number; dismissals: number }>
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const [activeSort, setActiveSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [statusDescriptions, setStatusDescriptions] = useState<Record<string, string>>({})
  const [isClosingPayroll, setIsClosingPayroll] = useState(false)
  const sessionUser = useMemo(() => loadSession(), [])
  const [payrollCompetences, setPayrollCompetences] = useState<Record<string, string>>({})

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACTIVE_TAB_KEY, active)
    }
  }, [active])

  useEffect(() => {
    if (closingToDelete) {
      setClosingDeletePassword('')
      setClosingDeleteAttempts(0)
      setClosingDeleteError(null)
    }
  }, [closingToDelete])

  const normalize = (val: string | number | null | undefined) => String(val ?? '').trim().toLowerCase()
  const formatSector = (val: string | null | undefined) => {
    const clean = String(val ?? '').trim()
    return clean ? clean.toUpperCase() : 'NAO INFORMADO'
  }
  const SectorTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => {
    if (x === undefined || y === undefined || !payload) return null
    return (
      <g transform={`translate(${x},${y}) rotate(-90)`}>
        <text     
          textAnchor="end"
          dominantBaseline='central'
          fill="#9aa4b3ff"
          fontSize={10}
          fontWeight={600}
        >
          {payload.value}
        </text>
      </g>
    )
  }
  const CHART_COLORS = ['#22c55e', '#0ea5e9', '#a855f7', '#f97316', '#e11d48', '#f59e0b']

  const formatCurrency = (val: number) => {
    const safe = Number.isFinite(val) ? val : 0
    return safe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
  }
  const formatPercent = (val: number) => {
    const safe = Number.isFinite(val) ? val : 0
    return `${safe.toFixed(1)}%`
  }
  const getStatusLabel = (code: string) => statusDescriptions[code] || `Status ${code}`

  const renderChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    const data = payload[0]?.payload || {}
    const primaryValue = payload[0]?.value ?? data.value60 ?? data.hours60 ?? 0
    const dataKey = payload[0]?.dataKey ?? ''
    const isCurrency = typeof dataKey === 'string' && dataKey.toLowerCase().includes('value')
    const valueLabel = isCurrency
      ? formatCurrency(Number(primaryValue))
      : Number(primaryValue ?? 0).toLocaleString('pt-BR')
    return (
      <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg text-center">
        <div className="font-semibold">{label}</div>
        <div className="mt-1 text-[11px] text-purple-300">{valueLabel}</div>
      </div>
    )
  }

  const renderTurnoverTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    const base = payload[0]?.payload || {}
    const admissionsVal = Number(base.admissions ?? 0)
    const dismissalsVal = Number(base.dismissals ?? 0)
    const rows = [
      { label: 'Admissão:', value: admissionsVal, color: 'text-emerald-200' },
      { label: 'Demissão:', value: dismissalsVal, color: 'text-rose-200' },
    ].filter((row) => row.value > 0)
    const hasRows = rows.length > 0
    return (
      <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg min-w-[160px]">
        <div className="font-semibold text-center mb-1">{label}</div>
        {hasRows ? (
          <div className="space-y-1 text-[11px]">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className={`${row.color} font-semibold`}>{row.label}</span>
                <span className="text-white font-semibold">{row.value.toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-white/70 text-center font-semibold">Sem movimentos</div>
        )}
      </div>
    )
  }

  const formatDateShort = (val?: string | null) => {
    if (!val) return '-'
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) return String(val)
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
  }
  const formatCompetenceLabel = (val?: string | null) => {
    if (!val) return '-'
    const match = val.match(/^(\d{4})-(\d{2})/)
    if (!match) return val
    return `${match[2]}/${match[1]}`
  }
  const effectiveCompany = active === 'config' ? configCompany : filterCompany
  const effectiveYear = active === 'config' ? configYear : filterYear
  const effectiveMonth = active === 'config' ? configMonth : filterMonth
  const formatCompanyLabel = (val: string) => {
    if (val === '4') return 'Frigosul'
    if (val === '5') return 'Pantaneira'
    return val
  }
  const folhaRefLabel = `${filterMonth.padStart(2, '0')}/${filterYear}`
  const closingCompanyLabel = effectiveCompany ? formatCompanyLabel(effectiveCompany) : 'todas as empresas'
  const closingCompetenceLabel = `${effectiveMonth.padStart(2, '0')}/${effectiveYear}`
  const defaultCompetenceIso = `${effectiveYear}-${effectiveMonth.padStart(2, '0')}-01`

  const toIsoFromBr = (val: string): string | null => {
    const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!match) return null
    const [, dd, mm, yyyy] = match
    return `${yyyy}-${mm}-${dd}`
  }

  const maskDateInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    const parts = []
    if (digits.length > 0) parts.push(digits.slice(0, 2))
    if (digits.length > 2) parts.push(digits.slice(2, 4))
    if (digits.length > 4) parts.push(digits.slice(4, 8))
    return parts.join('/')
  }

  useEffect(() => {
    if (active !== 'config') {
      setIsConfigPeriodClosed(false)
      return
    }
    if (!supabaseUrl || !supabaseKey || !configCompany || !configYear || !configMonth) {
      setIsConfigPeriodClosed(false)
      return
    }
    const controller = new AbortController()
    const checkClosed = async () => {
      try {
        const comp = `${configYear}-${configMonth.padStart(2, '0')}-01`
        const url = new URL(`${supabaseUrl}/rest/v1/closing_payroll`)
        url.searchParams.set('select', 'id')
        url.searchParams.append('company', `eq.${configCompany}`)
        url.searchParams.append('competence', `eq.${comp}`)
        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Range: '0-0',
            Prefer: 'count=exact',
          },
          signal: controller.signal,
        })
        if (!res.ok) {
          setIsConfigPeriodClosed(false)
          return
        }
        const contentRange = res.headers.get('content-range')
        const total = contentRange ? Number(contentRange.split('/')[1]) : null
        setIsConfigPeriodClosed((total ?? 0) > 0)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Erro ao verificar fechamento de folha', err)
        }
        setIsConfigPeriodClosed(false)
      }
    }
    checkClosed()
    return () => controller.abort()
  }, [active, supabaseUrl, supabaseKey, configCompany, configYear, configMonth])

  const closingHistoryGrouped = useMemo(() => {
    const map = new Map<string, typeof closingHistory[number]>()
    closingHistory.forEach((item) => {
      const compKey = item.competence ? new Date(item.competence).toISOString().slice(0, 10) : ''
      const key = `${String(item.company ?? '')}|${compKey}`
      if (!map.has(key)) {
        map.set(key, item)
      }
    })
    return Array.from(map.values()).sort((a, b) => {
      const compA = a.competence ? new Date(a.competence).toISOString().slice(0, 10) : ''
      const compB = b.competence ? new Date(b.competence).toISOString().slice(0, 10) : ''
      const compCmp = compB.localeCompare(compA)
      if (compCmp !== 0) return compCmp
      return String(a.company ?? '').localeCompare(String(b.company ?? ''))
    })
  }, [closingHistory])

  useEffect(() => {
    if (active !== 'config') return
    if (!supabaseUrl || !supabaseKey) return
    const controller = new AbortController()
    const fetchHistory = async () => {
      try {
        setIsLoadingClosingHistory(true)
        const url = new URL(`${supabaseUrl}/rest/v1/closing_payroll`)
        url.searchParams.set('select', 'company,registration,competence,date_registration,type_registration,user_registration')
        url.searchParams.set('order', 'company.asc,competence.desc,date_registration.desc')
        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Range: '0-499',
            Prefer: 'count=exact',
          },
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = await res.json()
        setClosingHistory(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Erro ao carregar historico de fechamentos', err)
        }
      } finally {
        setIsLoadingClosingHistory(false)
      }
    }
    fetchHistory()
    return () => controller.abort()
  }, [active, supabaseUrl, supabaseKey, configCompany, configYear, configMonth])

  useEffect(() => {
    if (active === 'config' && !configCompany && companies.length > 0) {
      setConfigCompany(companies[0])
    }
  }, [active, companies, configCompany])

  const performClosePayroll = async () => {
    if (!supabaseUrl || !supabaseKey) {
      return
    }
    if (sortedActiveList.length === 0) {
      return
    }
    const compMonth = effectiveMonth.padStart(2, '0')
    const competence = `${effectiveYear}-${compMonth}-01`
    const nowIso = new Date().toISOString()

    setIsClosingPayroll(true)
    try {
      const closingPayload = sortedActiveList.map((row) => ({
        company: row.company ? Number(row.company) : 0,
        registration: row.registration ? Number(row.registration) : 0,
        competence,
        name: row.name || '',
        status_: row.status !== undefined && row.status !== null ? Number(row.status) : 0,
        status_date:
          row.status !== undefined && row.status !== null && Number(row.status) === 1
            ? null
            : row.date_status
            ? row.date_status
            : competence,
        type_registration: 'SYSTEM',
        user_registration: sessionUser?.username || 'SYSTEM',
        date_registration: nowIso,
      }))

      const insertUrl = new URL(`${supabaseUrl}/rest/v1/closing_payroll`)
      const res = await fetch(insertUrl.toString(), {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(closingPayload),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Erro ao fechar folha: ${res.status} ${txt}`)
      }

      const logUrl = new URL(`${supabaseUrl}/rest/v1/log_table_load`)
      const logActionText = `Fechamento Folha Ref. ${effectiveMonth.padStart(2, '0')}/${effectiveYear}`
      const logPayload = {
        table_registration: `closing_payroll Ref. ${effectiveMonth.padStart(2, '0')}/${effectiveYear}`,
        actions: 'Inclusao',
        file_: logActionText,
        type_registration: 'SYSTEM',
        user_registration: sessionUser?.username || 'SYSTEM',
        date_registration: nowIso,
      }
      const logRes = await fetch(logUrl.toString(), {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(logPayload),
      })
      if (!logRes.ok) {
        const txt = await logRes.text()
        throw new Error(`Erro ao registrar log: ${logRes.status} ${txt}`)
      }

      toast.success('Fechamento concluido com Sucesso')
      if (active === 'config') {
        setIsConfigPeriodClosed(true)
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Falha ao fechar folha.')
    } finally {
      setIsClosingPayroll(false)
    }
  }

  const handleRequestClosePayroll = () => {
    if (sortedActiveList.length === 0) {
      return
    }
    if (!sessionUser?.password) {
      toast.error('Usuário sem credenciais válidas para fechamento.')
      return
    }
    setClosingAuthPassword('')
    setClosingAuthError(null)
    setClosingAuthAttempts(0)
    setIsClosingAuthModalOpen(true)
  }

  const handleCancelClosePayrollModal = () => {
    setIsClosingAuthModalOpen(false)
    setClosingAuthPassword('')
    setClosingAuthError(null)
    setClosingAuthAttempts(0)
  }

  const handleConfirmClosePayroll = async () => {
    if (!sessionUser?.password) {
      toast.error('Usuário sem credenciais válidas para fechamento.')
      setIsClosingAuthModalOpen(false)
      return
    }
    const passwordInput = closingAuthPassword.trim()
    if (!passwordInput) {
      setClosingAuthError('required')
      return
    }

    try {
      const isValidPassword = await verifyPassword(passwordInput, sessionUser.password)
      if (!isValidPassword) {
        const nextAttempts = closingAuthAttempts + 1
        if (nextAttempts >= 3) {
          toast.error('Limite de tentativas atingido.')
          handleCancelClosePayrollModal()
          return
        }
        setClosingAuthAttempts(nextAttempts)
        setClosingAuthError('invalid')
        return
      }

      setClosingAuthError(null)
      setClosingAuthAttempts(0)
      setIsClosingAuthModalOpen(false)
      await performClosePayroll()
      setClosingAuthPassword('')
    } catch (err) {
      console.error(err)
      toast.error('Falha ao fechar folha.')
    }
  }

  const filteredActiveList = useMemo(() => {
    const q = nameFilter.trim().toLowerCase()
    if (!q) return activeEmployeesList
    return activeEmployeesList.filter((row) => {
      const nameVal = String(row.name || '').toLowerCase()
      const regVal = String(row.registration || '').toLowerCase()
      return nameVal.includes(q) || regVal.includes(q)
    })
  }, [activeEmployeesList, nameFilter])

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    activeEmployeesList.forEach((row) => {
      const key = row.status === null || row.status === undefined ? '-' : String(row.status)
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => {
        const na = Number(a.status)
        const nb = Number(b.status)
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
        return a.status.localeCompare(b.status)
      })
  }, [activeEmployeesList])
  const statusRows = useMemo(() => {
    const rows = statusCounts.map((item) => ({
      key: `status-${item.status}`,
      code: String(item.status),
      desc: getStatusLabel(item.status),
      count: item.count,
    }))
    rows.push({ key: 'adm', code: 'Admissao', desc: '', count: admissionsCount })
    rows.push({ key: 'dem', code: 'Demissao', desc: '', count: dismissalsCount })
    return rows
  }, [statusCounts, admissionsCount, dismissalsCount, getStatusLabel])
  const statusColumns = useMemo(() => {
    const firstCol = statusRows.slice(0, 4)
    const secondCol = statusRows.slice(4)
    return [firstCol, secondCol]
  }, [statusRows])
  const absenceStatusCounts = useMemo(() => {
    const normalized = (value: string) => value.trim().toLowerCase()
    const findCount = (term: string) => {
      const matcher = term.toLowerCase()
      const found = statusRows.find((row) => normalized(row.desc || '').includes(matcher))
      if (found) return found.count
      return 0
    }
    const faltas = findCount('falta')
    const atestado = findCount('atestado')
    return { faltas, atestado }
  }, [statusRows])

  const sortedActiveList = useMemo(() => {
    if (!activeSort) return filteredActiveList
    const { key, direction } = activeSort
    const parseVal = (v: any) => {
      if (v === null || v === undefined) return ''
      const num = Number(v)
      if (!Number.isNaN(num)) return num
      // tenta data
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) return d.getTime()
      return String(v).toLowerCase()
    }
    return [...filteredActiveList].sort((a, b) => {
      const va = parseVal(a[key])
      const vb = parseVal(b[key])
      if (va < vb) return direction === 'asc' ? -1 : 1
      if (va > vb) return direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredActiveList, activeSort])

  const handleActiveSort = (key: string) => {
    setActiveSort((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const handleStartEdit = (row: any) => {
    const id = String(row.registration ?? row.name ?? '')
    setEditingId(id)
    setEditStatusValue(row.status !== undefined && row.status !== null ? String(row.status) : '')
    const dateDisplay = row.date_status ? formatDateShort(row.date_status) : ''
    setEditDateValue(dateDisplay !== '-' ? dateDisplay : '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditStatusValue('')
    setEditDateValue('')
  }

  const handleSaveEdit = async (row: any) => {
    const statusVal = editStatusValue.trim()
    const statusNum = statusVal === '' ? null : Number(statusVal)
    const isoDate = editDateValue.trim().length === 10 ? toIsoFromBr(editDateValue.trim()) : null
    const reg = row.registration ?? null
    let updatedRow = row

    // Persist to backend when credenciais estiverem presentes e houver registro valido
    if (reg !== null && supabaseUrl && supabaseKey) {
      try {
        const url = new URL(`${supabaseUrl}/rest/v1/employee`)
        url.searchParams.set('registration', `eq.${reg}`)
        const payload: Record<string, any> = {
          status: statusNum,
          date_status: isoDate,
          user_update: userName || null,
          date_update: new Date().toISOString(),
        }
        const res = await fetch(url.toString(), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            updatedRow = { ...row, ...data[0] }
          }
        } else {
          console.error('Falha ao salvar edicao:', await res.text())
        }
      } catch (err) {
        console.error('Erro ao salvar edicao', err)
      }
    }

    setActiveEmployeesList((prev) =>
      prev.map((item) => {
        const matchId = String(item.registration ?? item.name ?? '')
        if (matchId !== String(row.registration ?? row.name ?? '')) return item
        return {
          ...item,
          status: updatedRow.status ?? statusNum,
          date_status: updatedRow.date_status ?? isoDate,
        }
      })
    )
    handleCancelEdit()
  }

  const handleClearFilters = () => {
    const now = new Date()
    const defaultYear = years[0] ?? now.getFullYear().toString()
    const defaultMonth = months[months.length - 1] ?? String(now.getMonth() + 1)
    setFilterCompany('')
    setFilterSector('')
    setFilterYear(defaultYear)
    setFilterMonth(defaultMonth)
  }

  const handleClearConfigFilters = () => {
    const now = new Date()
    const defaultYear = years[0] ?? now.getFullYear().toString()
    const defaultMonth = months[months.length - 1] ?? String(now.getMonth() + 1)
    setConfigCompany('')
    setConfigYear(defaultYear)
    setConfigMonth(defaultMonth)
  }

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    const controller = new AbortController()
    const loadSectors = async () => {
      try {
        const pageSize = 1000
        let from = 0
        let hasMore = true
        const sectorMap: Record<string, string> = {}
        const employeeMap: Record<string, { sector: string; company: string }> = {}
        const companySet = new Set<string>()
        const sectorSet = new Set<string>()
        while (hasMore) {
          const url = new URL(`${supabaseUrl}/rest/v1/employee`)
          url.searchParams.set('select', 'registration,sector,company')
          const rangeHeader = `${from}-${from + pageSize - 1}`
          const res = await fetch(url.toString(), {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Range: rangeHeader,
              Prefer: 'count=exact',
            },
            signal: controller.signal,
          })
          if (!res.ok) break
          const batch = await res.json()
          batch.forEach((row: any) => {
            if (row.registration !== null && row.registration !== undefined) {
              const regKey = String(row.registration).trim()
              const sector = formatSector(row.sector)
              const companyRaw = row.company ? String(row.company) : ''
              const company = companyRaw.trim()
              sectorMap[regKey] = sector
              employeeMap[regKey] = { sector, company }
              if (company) companySet.add(company)
              sectorSet.add(sector)
            }
          })
          const contentRange = res.headers.get('content-range')
          const total = contentRange ? Number(contentRange.split('/')[1]) : null
          const received = batch.length
          if (!total || received < pageSize || from + received >= total) {
            hasMore = false
          } else {
            from += pageSize
          }
        }
        setSectorByRegistration(sectorMap)
        setEmployeeIndex(employeeMap)
        setCompanies(Array.from(companySet).sort())
        setSectors(Array.from(sectorSet).sort())
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Erro ao carregar setores', err)
        }
      }
    }
    loadSectors()
    return () => controller.abort()
  }, [supabaseUrl, supabaseKey])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey || !filterYear || !filterMonth) return
    const controller = new AbortController()
    const fetchActiveBySector = async () => {
      try {
        const monthIndex = Number(filterMonth) - 1
        const nextMonthIso = new Date(Date.UTC(Number(filterYear), monthIndex + 1, 1)).toISOString().slice(0, 10) // first day of next month (usa para <= fim do mes)
        const endDate = new Date(Date.UTC(Number(filterYear), monthIndex + 1, 0))
        const endOfMonthIso = endDate.toISOString().slice(0, 10)
        const baseUrl = new URL(`${supabaseUrl}/rest/v1/employee`)
        baseUrl.searchParams.set('select', 'registration,name,sector,status,date_hiring,date_status,company')
        baseUrl.searchParams.append('date_hiring', `lt.${nextMonthIso}`)
        // Mantem ativo ate o fim do mes: status != 7 ou (status = 7 e data de desligamento depois do fim do mes)
        baseUrl.searchParams.append('or', `(status.neq.7,and(status.eq.7,date_status.gte.${endOfMonthIso}))`)
        if (effectiveCompany) {
          baseUrl.searchParams.append('company', `eq.${effectiveCompany}`)
        }
        if (filterSector) {
          baseUrl.searchParams.append('sector', `eq.${filterSector}`)
        }

        const pageSize = 2000
        let from = 0
        const sectorCounts = new Map<string, number>()
        let total = 0
        const activeRows: any[] = []

        while (true) {
          const rangeHeader = `${from}-${from + pageSize - 1}`
          const res = await fetch(baseUrl.toString(), {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Range: rangeHeader,
              Prefer: 'count=exact',
            },
            signal: controller.signal,
          })
          if (!res.ok) break
          const batch = await res.json()
          batch.forEach((row: any) => {
            const sectorName = formatSector(row.sector)
            sectorCounts.set(sectorName, (sectorCounts.get(sectorName) || 0) + 1)
            total += 1
            activeRows.push(row)
          })
          if (batch.length < pageSize) {
            break
          }
          from += pageSize
        }
        setActiveEmployees(total)
        setActiveEmployeesList(activeRows)
        setSectorEmployeeSummary(Array.from(sectorCounts.entries()).map(([label, count]) => ({ label, count })))
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Erro ao contar colaboradores por setor', err)
        }
      }
    }
    fetchActiveBySector()
    return () => controller.abort()
  }, [supabaseUrl, supabaseKey, filterYear, filterMonth, effectiveCompany, filterSector])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey || !filterYear || !filterMonth) return
    const controller = new AbortController()
    const fetchAdmissions = async () => {
      try {
        const month = filterMonth.padStart(2, '0')
        const start = `${filterYear}-${month}-01`
        const lastDay = new Date(Number(filterYear), Number(filterMonth), 0).getDate()
        const end = `${filterYear}-${month}-${String(lastDay).padStart(2, '0')}`
        const url = new URL(`${supabaseUrl}/rest/v1/employee`)
        url.searchParams.set('select', 'registration')
        url.searchParams.set('date_hiring', `gte.${start}`)
        url.searchParams.append('date_hiring', `lte.${end}`)
        if (effectiveCompany) url.searchParams.append('company', `eq.${effectiveCompany}`)
        if (filterSector) url.searchParams.append('sector', `eq.${filterSector}`)
        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Range: '0-0',
            Prefer: 'count=exact',
          },
          signal: controller.signal,
        })
        if (!res.ok) return
        const contentRange = res.headers.get('content-range')
        const total = contentRange ? Number(contentRange.split('/')[1]) : null
        setAdmissionsCount(Number.isFinite(total) ? Number(total) : 0)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Erro ao contar admissões', err)
        }
      }
    }
    fetchAdmissions()
    return () => controller.abort()
  }, [supabaseUrl, supabaseKey, filterYear, filterMonth, effectiveCompany, filterSector])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey || !filterYear || !filterMonth) return
    const controller = new AbortController()
    const fetchDismissals = async () => {
      try {
        const month = filterMonth.padStart(2, '0')
        const start = `${filterYear}-${month}-01`
        const lastDay = new Date(Number(filterYear), Number(filterMonth), 0).getDate()
        const end = `${filterYear}-${month}-${String(lastDay).padStart(2, '0')}`
        const url = new URL(`${supabaseUrl}/rest/v1/employee`)
        url.searchParams.set('select', 'registration')
        url.searchParams.set('status', 'eq.7')
        url.searchParams.append('date_status', `gte.${start}`)
        url.searchParams.append('date_status', `lte.${end}`)
        if (effectiveCompany) url.searchParams.append('company', `eq.${effectiveCompany}`)
        if (filterSector) url.searchParams.append('sector', `eq.${filterSector}`)
        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Range: '0-0',
            Prefer: 'count=exact',
          },
          signal: controller.signal,
        })
        if (!res.ok) return
        const contentRange = res.headers.get('content-range')
        const total = contentRange ? Number(contentRange.split('/')[1]) : null
        setDismissalsCount(Number.isFinite(total) ? Number(total) : 0)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Erro ao contar demissoes', err)
        }
      }
    }
    fetchDismissals()
    return () => controller.abort()
  }, [supabaseUrl, supabaseKey, filterYear, filterMonth, effectiveCompany, filterSector])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey || !filterYear || !filterMonth) return
    const controller = new AbortController()
    const month = filterMonth.padStart(2, '0')
    const lastDay = new Date(Number(filterYear), Number(filterMonth), 0).getDate()
    const start = `${filterYear}-${month}-01`
    const end = `${filterYear}-${month}-${String(lastDay).padStart(2, '0')}`

    const fetchSectorCounts = async (options: {
      dateField: 'date_hiring' | 'date_status'
      statusFilter?: string
    }) => {
      const counts = new Map<string, number>()
      const pageSize = 1000
      let from = 0
      while (true) {
        const url = new URL(`${supabaseUrl}/rest/v1/employee`)
        url.searchParams.set('select', 'sector')
        url.searchParams.set(options.dateField, `gte.${start}`)
        url.searchParams.append(options.dateField, `lte.${end}`)
        if (options.statusFilter) {
          url.searchParams.append('status', options.statusFilter)
        }
        if (effectiveCompany) {
          url.searchParams.append('company', `eq.${effectiveCompany}`)
        }
        if (filterSector) {
          url.searchParams.append('sector', `eq.${filterSector}`)
        }
        const rangeHeader = `${from}-${from + pageSize - 1}`
        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Range: rangeHeader,
            Prefer: 'count=exact',
          },
          signal: controller.signal,
        })
        if (!res.ok) break
        const batch = await res.json()
        batch.forEach((row: any) => {
          const sectorName = formatSector(row.sector)
          counts.set(sectorName, (counts.get(sectorName) || 0) + 1)
        })
        if (batch.length < pageSize) break
        from += pageSize
      }
      return counts
    }

    const loadSectorTurnover = async () => {
      try {
        const [admissionMap, dismissalMap] = await Promise.all([
          fetchSectorCounts({ dateField: 'date_hiring' }),
          fetchSectorCounts({ dateField: 'date_status', statusFilter: 'eq.7' }),
        ])
        const sectors = new Set<string>([...admissionMap.keys(), ...dismissalMap.keys()])
        const list = Array.from(sectors)
          .map((sector) => ({
            sector,
            admissions: admissionMap.get(sector) || 0,
            dismissals: dismissalMap.get(sector) || 0,
          }))
          .sort((a, b) => b.admissions + b.dismissals - (a.admissions + a.dismissals))
        setSectorTurnoverCounts(list)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Erro ao contar turnover por setor', err)
        }
      }
    }

    loadSectorTurnover()
    return () => controller.abort()
  }, [supabaseUrl, supabaseKey, filterYear, filterMonth, effectiveCompany, filterSector])

  useEffect(() => {
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
        const data = await res.json()
        const map: Record<string, string> = {}
        data.forEach((row: any) => {
          if (row.status !== null && row.status !== undefined && row.description) {
            map[String(row.status)] = String(row.description)
          }
        })
        setStatusDescriptions(map)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Erro ao carregar status', err)
        }
      }
    }
    fetchStatusDescriptions()
    return () => controller.abort()
  }, [supabaseUrl, supabaseKey])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    const loadYears = async () => {
      try {
        const url = new URL(`${supabaseUrl}/rest/v1/payroll`)
        url.searchParams.set('select', 'competence')
        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        })
        if (!res.ok) return
        const data = await res.json()
        const uniqueYears = [...new Set(data.map((r: any) => {
          const match = r.competence?.match(/^(\d{4})/)
          return match ? match[1] : null
        }))].filter(Boolean).sort((a, b) => Number(b) - Number(a))
        const sortedYears = uniqueYears as string[]
        setYears(sortedYears)
        if (sortedYears.length > 0) {
          setFilterYear((prev) => (prev && sortedYears.includes(prev) ? prev : sortedYears[0] as string))
        }
      } catch {
      }
    }
    loadYears()
  }, [supabaseUrl, supabaseKey])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey || !filterYear) return
    const loadMonths = async () => {
      try {
        const url = new URL(`${supabaseUrl}/rest/v1/payroll`)
        url.searchParams.set('select', 'competence')
        url.searchParams.set('competence', `gte.${filterYear}-01-01`)
        url.searchParams.append('competence', `lte.${filterYear}-12-31`)
        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        })
        if (!res.ok) return
        const data = await res.json()
        const uniqueMonths = [...new Set(data.map((r: any) => {
          const match = r.competence?.match(/^\d{4}-(\d{2})/)
          return match ? String(Number(match[1])) : null
        }))].filter(Boolean).sort((a, b) => Number(a) - Number(b))
        setMonths(uniqueMonths as string[])
        if (uniqueMonths.length > 0 && !uniqueMonths.includes(filterMonth)) {
          setFilterMonth(uniqueMonths[uniqueMonths.length - 1] as string)
        }
      } catch {
      }
    }
    loadMonths()
  }, [supabaseUrl, supabaseKey, filterYear])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey || !filterYear || !filterMonth) return
    const controller = new AbortController()
    const fetchPayroll = async () => {
      setIsLoading(true)
      try {
        const month = filterMonth.padStart(2, '0')
        const lastDay = new Date(Date.UTC(Number(filterYear), Number(filterMonth), 0)).getUTCDate()
        let allowedRegistrations: string[] | null = null
        if (filterCompany || filterSector) {
          allowedRegistrations = Object.entries(employeeIndex)
            .filter(([, data]) => {
              const matchesCompany = filterCompany ? normalize(data.company) === normalize(filterCompany) : true
              const matchesSector = filterSector ? data.sector === filterSector : true
              return matchesCompany && matchesSector
            })
            .map(([reg]) => reg)
          if (allowedRegistrations.length === 0) {
            setStats({ totalEmployees: activeEmployees, totalRecords: 0, totalValue: 0, avgValue: 0 })
            setSectorSummary([])
            setIsLoading(false)
            return
          }
        }
        const fetchPayrollChunk = async (registrations?: string[]) => {
          const chunkRows: any[] = []
          const url = new URL(`${supabaseUrl}/rest/v1/payroll`)
        url.searchParams.set('select', 'registration,name,events,references_,volue,competence')
        url.searchParams.set('competence', `gte.${filterYear}-${month}-01`)
        url.searchParams.append('competence', `lte.${filterYear}-${month}-${String(lastDay).padStart(2, '0')}`)
          if (registrations && registrations.length > 0) {
            url.searchParams.set('registration', `in.(${registrations.join(',')})`)
          }
        url.searchParams.set('order', 'competence.asc')

          const pageSize = 1000
          let from = 0
          let hasMore = true

          while (hasMore) {
            const rangeHeader = `${from}-${from + pageSize - 1}`
            const res = await fetch(url.toString(), {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                Range: rangeHeader,
                Prefer: 'count=exact',
              },
              signal: controller.signal,
            })
            if (!res.ok) {
              hasMore = false
              break
            }
            const batch = await res.json()
            chunkRows.push(...batch)

            const contentRange = res.headers.get('content-range')
            const total = contentRange ? Number(contentRange.split('/')[1]) : null
            const received = batch.length
            if (!total || received < pageSize || from + received >= total) {
              hasMore = false
            } else {
              from += pageSize
            }
          }

          return chunkRows
        }

        const allRows: any[] = []
        if (allowedRegistrations && allowedRegistrations.length > 0) {
          const chunkSize = 150
          for (let i = 0; i < allowedRegistrations.length; i += chunkSize) {
            const regsChunk = allowedRegistrations.slice(i, i + chunkSize)
            const rowsChunk = await fetchPayrollChunk(regsChunk)
            allRows.push(...rowsChunk)
          }
        } else {
          const rowsChunk = await fetchPayrollChunk()
          allRows.push(...rowsChunk)
        }

        let totalValue = 0
        const sectorMap = new Map<string, number>()

        const competenceMap: Record<string, string> = {}
        allRows.forEach((row) => {
          const value = Number(row.volue) || 0
          totalValue += value
          const eventNumber = Number(row.events)
          if (row.registration !== null && row.registration !== undefined && row.competence) {
            competenceMap[String(row.registration).trim()] = row.competence
          }
          if (eventNumber === 3 || eventNumber === 5) {
            const regKey = row.registration !== null && row.registration !== undefined ? String(row.registration).trim() : ''
            const sectorName = (regKey && sectorByRegistration[regKey]) || 'Sem setor'
            sectorMap.set(sectorName, (sectorMap.get(sectorName) || 0) + value)
          }
        })

        setStats({
          totalEmployees: activeEmployees,
          totalRecords: allRows.length,
          totalValue,
          avgValue: activeEmployees > 0 ? totalValue / activeEmployees : 0,
        })
        setPayrollCompetences(competenceMap)
        setSectorSummary(Array.from(sectorMap.entries()).map(([label, totalValue]) => ({ label, totalValue })))
      } catch (err) {
      } finally {
        setIsLoading(false)
      }
    }
    fetchPayroll()
    return () => controller.abort()
  }, [supabaseUrl, supabaseKey, filterYear, filterMonth, filterCompany, filterSector, sectorByRegistration, employeeIndex, activeEmployees])

  const eventsTotalValue = useMemo(
    () => sectorSummary.reduce((sum, item) => sum + item.totalValue, 0),
    [sectorSummary],
  )

  const chartData = useMemo(
    () => {
      const total = eventsTotalValue || 1
      const palette = ['#22c55e', '#0ea5e9', '#a855f7', '#f97316', '#e11d48', '#f59e0b']
      const sorted = sectorSummary.slice().sort((a, b) => b.totalValue - a.totalValue)
      const top = sorted.slice(0, 23)
      const tail = sorted.slice(23)
      const tailTotal = tail.reduce((sum, item) => sum + item.totalValue, 0)
      const finalList = tailTotal > 0 ? [...top, { label: 'Outros', totalValue: tailTotal }] : top
      return finalList.map((item, idx) => ({
        label: item.label,
        valor: item.totalValue,
        percent: (item.totalValue / total) * 100,
        color: palette[idx % palette.length],
      }))
    },
    [sectorSummary, eventsTotalValue],
  )

  const collaboratorBarData = useMemo(() => {
    const sorted = sectorEmployeeSummary.slice().sort((a, b) => b.count - a.count)
    const max = sorted[0]?.count || 1
    return sorted.map((item, idx) => ({
      ...item,
      empty: Math.max(max - item.count, 0),
      height: (item.count / max) * 100,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [sectorEmployeeSummary])

  const valueBarData = useMemo(
    () => sectorSummary.map((item, idx) => ({
      name: item.label,
      valor: item.totalValue,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    })),
    [sectorSummary],
  )
  const turnoverPercent = useMemo(() => {
    if (activeEmployees <= 0) return 0
    const totalMovements = admissionsCount + dismissalsCount
    const averageMovement = totalMovements / 2
    return (averageMovement / activeEmployees) * 100
  }, [activeEmployees, admissionsCount, dismissalsCount])
  const dashboardData = useMemo(
    () => collaboratorBarData.map((item) => {
      const value = valueBarData.find((v) => v.name === item.label)?.valor ?? 0
      return {
        name: formatSector(item.label),
        hours60: item.count,
        hours100: 0,
        value60: value,
        value100: 0,
        color: item.color,
      }
    }),
    [collaboratorBarData, valueBarData],
  )
  const filteredSectorTurnoverCounts = useMemo(
    () => sectorTurnoverCounts.filter((entry) => entry.admissions + entry.dismissals > 0),
    [sectorTurnoverCounts],
  )
  const turnoverSectorChartData = useMemo(() => {
    if (filteredSectorTurnoverCounts.length === 0) return []
    return filteredSectorTurnoverCounts.slice(0, 12).map((entry) => ({
      ...entry,
      sectorLabel: formatSector(entry.sector),
    }))
  }, [filteredSectorTurnoverCounts])
  const totalSectorAdmissions = useMemo(
    () => filteredSectorTurnoverCounts.reduce((sum, entry) => sum + entry.admissions, 0),
    [filteredSectorTurnoverCounts],
  )
  const totalSectorDismissals = useMemo(
    () => filteredSectorTurnoverCounts.reduce((sum, entry) => sum + entry.dismissals, 0),
    [filteredSectorTurnoverCounts],
  )
  const renderValueLabel = (formatter: (v: number) => string) => (props: any) => {
    const { x, y, width, value } = props
    if (x === undefined || y === undefined || width === undefined) return null
    if (!Number.isFinite(value) || Number(value) <= 0) return null
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        fill="#fcfff7ff"
        fontSize={11}
        fontWeight={700}
        textAnchor="middle"
      >
        {formatter(Number(value))}
      </text>
    )
  }

  const resetClosingDeleteState = () => {
    setClosingToDelete(null)
    setClosingDeletePassword('')
    setClosingDeleteAttempts(0)
    setClosingDeleteError(null)
  }

  const handleDeleteClosing = async () => {
    if (!closingToDelete || !supabaseUrl || !supabaseKey) return
    const pwd = closingDeletePassword.trim()
    if (!pwd) {
      setClosingDeleteError('required')
      return
    }
    if (!sessionUser) {
      toast.error('Sessao invalida. Faca login novamente.')
      return
    }
    const isValidPassword = await verifyPassword(pwd, sessionUser.password)
    if (!isValidPassword) {
      setClosingDeleteError('invalid')
      setClosingDeleteAttempts((prev) => {
        const next = prev + 1
        if (next >= 3) {
          toast.error('Parece que voce nao tem acesso a exclusao.')
          resetClosingDeleteState()
          return 0
        }
        return next
      })
      return
    }
    try {
      setIsDeletingClosing(true)
      const compIso = new Date(closingToDelete.competence).toISOString().slice(0, 10)
      const url = new URL(`${supabaseUrl}/rest/v1/closing_payroll`)
      url.searchParams.append('company', `eq.${closingToDelete.company}`)
      url.searchParams.append('competence', `eq.${compIso}`)
      const res = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      })
      if (!res.ok) throw new Error(`Erro ao deletar fechamento: ${res.status}`)
      toast.success('Fechamento removido com sucesso.')
      setClosingHistory((prev) =>
        prev.filter(
          (item) =>
            !(String(item.company) === String(closingToDelete.company) &&
              new Date(item.competence).toISOString().slice(0, 10) === compIso),
        ),
      )
    } catch (err) {
      console.error(err)
      toast.error('Falha ao remover fechamento.')
    } finally {
      setIsDeletingClosing(false)
      resetClosingDeleteState()
    }
  }

  const activeSidebarItem = sidebarItems.find((item) => item.key === active)
  const ActiveSidebarIcon = activeSidebarItem?.icon

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
            {description || 'Gestao de folha com indicadores e valores por evento.'}
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
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`relative flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors h-11 ${
                    !isLast ? 'border-b border-white/5' : ''
                  } ${active === item.key ? 'bg-emerald-500/15 text-emerald-100' : ''}`}
                  title={item.label}
                  onClick={() => setActive(item.key as typeof active)}
                  aria-pressed={active === item.key}
                  aria-current={active === item.key ? 'page' : undefined}
                >
                  {Icon && (
                    <Icon
                      className={`w-5 h-5 shrink-0 ${active === item.key ? 'text-emerald-300' : 'text-white/80'}`}
                    />
                  )}
                  <span className="font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 bg-white/5 border border-white/10 rounded-r-xl rounded-bl-xl rounded-tl-none p-3 shadow-inner shadow-black/10 min-h-[540px]">
          {active === 'folha' && (
            <div className="space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 shadow-inner shadow-black/10">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-emerald-200 font-semibold">
                    {ActiveSidebarIcon && <ActiveSidebarIcon className="w-4 h-4" />}
                    Folha Mensal
                  </div>
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <select
                      value={filterCompany}
                      onChange={(e) => setFilterCompany(e.target.value)}
                      className="bg-white/5 text-white text-xs border border-emerald-500/60 rounded-md px-2 py-1.5 outline-none focus:border-emerald-300"
                    >
                      <option value="" className="bg-slate-800 text-white">Empresa</option>
                      {companies.map((c) => (
                        <option key={c} value={c} className="bg-slate-800 text-white">{formatCompanyLabel(c)}</option>
                      ))}
                    </select>
                    <select
                      value={filterSector}
                      onChange={(e) => setFilterSector(e.target.value)}
                      className="bg-white/5 text-white text-xs border border-emerald-500/60 rounded-md px-2 py-1.5 outline-none focus:border-emerald-300 max-w-36 truncate"
                    >
                      <option value="" className="bg-slate-800 text-white">Setor</option>
                      {sectors.map((s) => (
                        <option key={s} value={s} className="bg-slate-800 text-white">{s}</option>
                      ))}
                    </select>
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="bg-white/5 text-white text-xs border border-emerald-500/60 rounded-md px-2 py-1.5 outline-none focus:border-emerald-300"
                    >
                      {years.map((y) => (
                        <option key={y} value={y} className="bg-slate-800 text-white">{y}</option>
                      ))}
                    </select>
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="bg-white/5 text-white text-xs border border-emerald-500/60 rounded-md px-2 py-1.5 outline-none focus:border-emerald-300"
                    >
                      {months.map((m) => (
                        <option key={m} value={m} className="bg-slate-800 text-white">{monthNames[Number(m) - 1]}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="px-2 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10 transition-colors"
                      title="Limpar filtros"
                      aria-label="Limpar filtros"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-white">
                    <div className="group relative bg-slate-800/50 border border-white/10 rounded-lg p-3 shadow-lg backdrop-blur-sm overflow-hidden h-28 flex flex-col justify-between">
                      <div className="absolute -top-1/2 -right-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">TOTAIS COLABORADORES</h3>
                    <Users className="w-5 h-5 text-emerald-400/80" />
                  </div>
                  <div className="flex items-center justify-center text-center">
                    <span className="text-4xl font-extrabold tracking-tight">{stats.totalEmployees}</span>
                  </div>
                </div>

                    <div className="group relative bg-slate-800/50 border border-white/10 rounded-lg p-3 shadow-lg backdrop-blur-sm overflow-hidden h-28 flex flex-col justify-between">
                  <div className="absolute -top-1/2 -right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">TURNOVER</h3>
                    <RotateCw className="w-5 h-5 text-blue-400/80" />
                  </div>
                    <div className="flex items-center justify-between text-[11px] text-white/70 font-semibold px-1">
                      <span>ADMISSAO: <span className="text-white">{admissionsCount}</span></span>
                      <span>DEMISSAO: <span className="text-white">{dismissalsCount}</span></span>
                    </div>
                    <div className="flex items-center justify-center text-center">
                      <span className="text-4xl font-extrabold tracking-tight">{formatPercent(turnoverPercent)}</span>
                    </div>
                </div>

                <div className="group relative bg-slate-800/50 border border-white/10 rounded-lg p-3 shadow-lg backdrop-blur-sm overflow-hidden h-28 flex flex-col justify-between">
                  <div className="absolute -top-1/2 -right-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">ABSENTEISMO</h3>
                    <CalendarX className="w-5 h-5 text-amber-400/80" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/70 font-semibold px-1">
                    <span>FALTAS: <span className="text-white">{absenceStatusCounts.faltas.toLocaleString('pt-BR')}</span></span>
                    <span>ATESTADO: <span className="text-white">{absenceStatusCounts.atestado.toLocaleString('pt-BR')}</span></span>
                  </div>
                  <div className="flex items-center justify-center text-center">
                    <span className="text-2xl font-extrabold tracking-tight">{formatCurrency(stats.totalValue)}</span>
                  </div>
                </div>

                <div className="group relative bg-slate-800/50 border border-white/10 rounded-lg p-3 shadow-lg backdrop-blur-sm overflow-hidden h-28 flex flex-col justify-between">
                  <div className="absolute -top-1/2 -right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">TOTAL ABATE</h3>
                    <Factory className="w-5 h-5 text-purple-400/80" />
                  </div>
                  <div className="flex items-center justify-center text-center">
                    <span className="text-2xl font-extrabold tracking-tight">{formatCurrency(stats.avgValue)}</span>
                  </div>
                </div>
                  </div>  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg backdrop-blur-sm">
                      <div className="flex items-center justify-between text-white mb-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-white/70">Distribuicao por setor</p>
                          <h5 className="text-sm font-semibold text-white">Eventos: 3 - Salario e 5 - Salario Noturno</h5>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="font-semibold">{formatCurrency(eventsTotalValue)}</span>
                        </div>
                      </div>
                      {chartData.length === 0 ? (
                        <div className="text-white/70 text-sm">Sem dados por setor.</div>
                      ) : (
                        <div className="relative">
                          <div className="hidden md:block absolute inset-y-2 w-px bg-white/10 pointer-events-none" style={{ left: '33.333%' }} />
                          <div className="hidden md:block absolute inset-y-2 w-px bg-white/10 pointer-events-none" style={{ left: '66.666%' }} />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 relative">
                            {[
                              chartData.slice(0, Math.ceil(chartData.length / 3)),
                              chartData.slice(Math.ceil(chartData.length / 3), Math.ceil(chartData.length / 3) * 2),
                              chartData.slice(Math.ceil(chartData.length / 3) * 2),
                            ].map((col, colIdx) => (
                              <div key={colIdx} className="space-y-3 md:px-2">
                                {col.map((item) => (
                                  <div key={item.label} className="relative group space-y-1">
                                    <div className="grid grid-cols-[minmax(0,1fr)_80px_auto] items-center text-white text-xs gap-2">
                                      <span className="font-semibold truncate pr-2 transition-colors duration-150 group-hover:text-emerald-100">{item.label}</span>
                                      <span className="text-white/70 text-center font-semibold transition-colors duration-150 group-hover:text-emerald-200">{item.percent.toFixed(1)}%</span>
                                      <span className="text-white font-semibold text-right transition-colors duration-150 group-hover:text-emerald-100">{formatCurrency(item.valor)}</span>
                                    </div>
                                    <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full shadow-[0_0_12px_rgba(34,197,94,0.35)] transition-all duration-150 ease-out group-hover:shadow-[0_0_20px_rgba(34,197,94,0.55)] group-hover:scale-[1.02]"
                                        style={{
                                          width: `${Math.max(item.percent, 3)}%`,
                                          background: `linear-gradient(90deg, ${item.color} 0%, ${item.color}CC 50%, #22c55eAA 100%)`,
                                        }}
                                      />
                                    </div>
                                    <div className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                      <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-[11px] text-white shadow-lg text-center whitespace-nowrap">
                                        <div className="font-semibold text-xs">{item.label}</div>
                                        <div className="mt-1 text-purple-300">
                                          {item.percent.toFixed(1)}%  {formatCurrency(item.valor)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between text-white mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/70">Colaboradores por setor</p>
                  <h5 className="text-sm font-semibold text-white">Totais por setor</h5>
                </div>
                <div className="flex items-center gap-2 text-sm text-white">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold">{activeEmployees.toLocaleString('pt-BR')}</span>
                </div>
              </div>
                      {dashboardData.length === 0 ? (
                        <div className="text-white/70 text-sm">Sem dados para exibir.</div>
                      ) : (
                        <div className="h-96 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData} margin={{ top: 24, right: 20, left: 0, bottom: 10 }}>
                              <defs>
                                <linearGradient id="gradColabMain" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.8} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                              <XAxis
                                dataKey="name"
                                interval={0}
                                height={110}
                                tickMargin={8}
                                tick={<SectorTick />}
                                axisLine={{ stroke: '#475569' }}
                              />
                              <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 11 }} axisLine={{ stroke: '#475569' }} />
                              <RechartsTooltip
                                content={renderChartTooltip}
                                cursor={{ fill: 'transparent' }}
                              />
                              <Bar dataKey="empty" stackId="maincolab" fill="#e5e7eb" radius={[12, 12, 0, 0]} legendType="none" />
                              <Bar
                                dataKey="hours60"
                                name="Colaboradores"
                                stackId="maincolab"
                                isAnimationActive={false}
                                activeBar={{ fill: 'url(#gradColabMain)', stroke: '#22c55e', strokeWidth: 3, opacity: 1 }}
                              >
                                {dashboardData.map((entry) => (
                                  <Cell key={entry.name} fill={entry.color} />
                                ))}
                                <LabelList
                                  content={renderValueLabel((v) => String(v))}
                                  position="top"
                                  offset={10}
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                    <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg backdrop-blur-sm">
                      <div className="flex items-center justify-between text-white mb-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-white/70">Turnover por setor</p>
                          <h5 className="text-sm font-semibold text-white">Admissões + demissões no mês</h5>
                        </div>
                      <div className="flex items-center gap-3 text-sm text-white">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="font-semibold">{totalSectorAdmissions.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="font-semibold">{totalSectorDismissals.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                      </div>
                      {turnoverSectorChartData.length === 0 ? (
                        <div className="text-white/70 text-sm">Sem dados por setor.</div>
                      ) : (
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={turnoverSectorChartData} margin={{ top: 24, right: 10, left: 0, bottom: 20 }}>
                            <defs>
                              <linearGradient id="gradTurnoverAdmissions" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.85} />
                              </linearGradient>
                              <linearGradient id="gradTurnoverDismissals" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
                                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.85} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                              <XAxis
                                dataKey="sectorLabel"
                                interval={0}
                                height={90}
                                tickMargin={8}
                                tick={<SectorTick />}
                                axisLine={{ stroke: '#475569' }}
                              />
                              <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 11 }} axisLine={{ stroke: '#475569' }} />
                              <RechartsTooltip content={renderTurnoverTooltip} cursor={{ fill: 'transparent' }} />
                              <Legend wrapperStyle={{ color: '#cbd5f5', fontSize: 12 }} verticalAlign="top" align="right" />
                              <Bar
                                dataKey="admissions"
                                name="Admissões"
                                fill="url(#gradTurnoverAdmissions)"
                                activeBar={{ fill: 'url(#gradTurnoverAdmissions)', stroke: '#22c55e', strokeWidth: 3, opacity: 1 }}
                                radius={0}
                                barSize={32}
                                isAnimationActive={false}
                              >
                                <LabelList
                                  position="top"
                                  offset={10}
                                  content={renderValueLabel((v) => Number(v).toLocaleString('pt-BR'))}
                                />
                              </Bar>
                              <Bar
                                dataKey="dismissals"
                                name="Demissões"
                                fill="url(#gradTurnoverDismissals)"
                                activeBar={{ fill: 'url(#gradTurnoverDismissals)', stroke: '#f43f5e', strokeWidth: 3, opacity: 1 }}
                                radius={0}
                                barSize={32}
                                isAnimationActive={false}
                              >
                                <LabelList
                                  position="top"
                                  offset={10}
                                  content={renderValueLabel((v) => Number(v).toLocaleString('pt-BR'))}
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-3 text-white">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-white/70">Evolucao</p>
                        <h5 className="text-sm font-semibold text-white">Linha de tendencia por setor</h5>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="font-semibold">{formatCurrency(eventsTotalValue)}</span>
                        </div>
                      </div>
                      {dashboardData.length === 0 ? (
                        <div className="text-white/70 text-sm">Sem dados para exibir.</div>
                      ) : (
                        <div className="h-96 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dashboardData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                              <XAxis
                                dataKey="name"
                                interval={0}
                                height={110}
                                tickMargin={8}
                                tick={<SectorTick />}
                                axisLine={{ stroke: '#475569' }}
                              />
                              <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 11 }} axisLine={{ stroke: '#475569' }} />
                              <RechartsTooltip
                                content={renderChartTooltip}
                                cursor={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="value60"
                                name="Valor"
                                stroke="#a855f7"
                                strokeWidth={3}
                                dot={{ r: 3 }}
                                activeDot={{ r: 6, stroke: '#c084fc', strokeWidth: 0 }}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>

                </>
              )}

            </div>
          )}

          {active === 'custos' && (
            <div className="flex flex-col items-center justify-center text-white/80 h-full gap-3">
              <DollarSign className="w-12 h-12 text-emerald-300" />
              <p className="text-lg font-semibold">Visao de custos</p>
              <p className="text-sm text-white/60 text-center max-w-md">
                Em breve um painel consolidado de custos por centro, evento e periodo.
              </p>
            </div>
          )}

          {active === 'afastamentos' && (
            <div className="flex flex-col items-center justify-center text-white/80 h-full gap-3">
              <CalendarDays className="w-12 h-12 text-blue-300" />
              <p className="text-lg font-semibold">Afastamentos</p>
              <p className="text-sm text-white/60 text-center max-w-md">
                Espaco reservado para indicadores de afastamentos vinculados a folha.
              </p>
            </div>
          )}

          {active === 'alertas' && (
            <div className="flex flex-col items-center justify-center text-white/80 h-full gap-3">
              <Bell className="w-12 h-12 text-amber-300" />
              <p className="text-lg font-semibold">Alertas</p>
              <p className="text-sm text-white/60 text-center max-w-md">
                Canal para avisos operacionais e pendencias relacionadas a folha.
              </p>
            </div>
          )}

          {active === 'config' && (
            <div className="space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 shadow-inner shadow-black/10">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-emerald-200 font-semibold">
                    <Settings className="w-4 h-4" />
                    Configuração
                  </div>
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <select
                      value={configCompany}
                      onChange={(e) => setConfigCompany(e.target.value)}
                      className="bg-white/5 text-white text-xs border border-emerald-500/60 rounded-md px-2 py-1.5 outline-none focus:border-emerald-300"
                    >
                      {companies.map((c) => (
                        <option key={c} value={c} className="bg-slate-800 text-white">{formatCompanyLabel(c)}</option>
                      ))}
                    </select>

                    <select
                      value={configYear}
                      onChange={(e) => setConfigYear(e.target.value)}
                      className="bg-white/5 text-white text-xs border border-emerald-500/60 rounded-md px-2 py-1.5 outline-none focus:border-emerald-300"
                    >
                      {years.map((y) => (
                        <option key={y} value={y} className="bg-slate-800 text-white">{y}</option>
                      ))}
                    </select>
                    <select
                      value={configMonth}
                      onChange={(e) => setConfigMonth(e.target.value)}
                      className="bg-white/5 text-white text-xs border border-emerald-500/60 rounded-md px-2 py-1.5 outline-none focus:border-emerald-300"
                    >
                      {months.map((m) => (
                        <option key={m} value={m} className="bg-slate-800 text-white">{monthNames[Number(m) - 1]}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleClearConfigFilters}
                      className="px-2 py-1.5 rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10 transition-colors"
                      title="Limpar filtros"
                      aria-label="Limpar filtros"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {isConfigPeriodClosed ? (
                <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg backdrop-blur-sm overflow-hidden w-full min-h-[320px] flex items-center justify-center">
                  <p className="text-white text-sm font-semibold">
                    A empresa já tem essa folha fechada Ref. {configMonth.padStart(2, '0')}/{configYear}
                  </p>
                </div>
              ) : (
              <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg backdrop-blur-sm overflow-hidden w-full">
                <div className="px-3 pt-3 pb-2 border-b border-white/10">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <div className="lg:col-span-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Fechamento Folha de PGTO</p>
                      <h5 className="text-lg font-semibold text-white mt-1">Referencia: {folhaRefLabel}</h5>
                      <div className="mt-2">
                        <input
                          value={nameFilter}
                          onChange={(e) => setNameFilter(e.target.value)}
                          placeholder="Localizar por Nome ou Registro"
                          className="w-full bg-white/5 text-white text-xs border border-white/15 rounded-md px-3 py-2 outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                    <div className="lg:col-span-5 text-white/80 flex justify-center">
                      {statusCounts.length === 0 ? (
                        <div className="text-white/60 text-sm">Nenhum status encontrado.</div>
                      ) : (
                        (() => {
                          const extraRows = 2
                          const totalWithExtra = statusCounts.length + extraRows
                          const hasSecondColumn = totalWithExtra > 4
                          return (
                            <div className={`grid grid-cols-1 ${hasSecondColumn ? 'md:grid-cols-2' : ''} gap-3 place-items-center justify-center w-full`}>
                              {statusColumns.filter((col) => col.length > 0).map((col, idx) => (
                                <div key={idx} className="overflow-hidden rounded-lg border border-white/10 bg-white/5 min-h-0 w-full max-w-md">
                                  <table className="w-full text-[11px] text-white/80">
                                    <tbody>
                                      {col.map((item) => (
                                        <tr
                                          key={item.key}
                                          className="border-t border-white/10 hover:bg-white/10 transition-colors"
                                        >
                                          <td className="px-3 py-0.5 text-white truncate" title={`${item.code} ${item.desc}`.trim()}>
                                            <span className="font-semibold text-emerald-200">{item.code}</span>
                                            {item.desc ? <span className="text-white/70">{` ${item.desc}`}</span> : null}
                                          </td>
                                          <td className="px-3 py-0.5 text-right font-semibold text-emerald-200 w-16">
                                            {item.count.toLocaleString('pt-BR')}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          )
                        })()
                      )}
                    </div>
                    <div className="lg:col-span-3 flex flex-col items-center justify-center gap-2 text-center">
                      <div className="text-xs text-white/80 font-semibold px-3 py-2 rounded-md bg-white/5 border border-white/10">
                        Totais de Colaborador:{' '}
                        <span className="text-emerald-200 text-sm font-bold">{sortedActiveList.length}</span>
                      </div>
                      <button
                        type="button"
                        className="px-4 py-2 text-sm font-semibold rounded-md border border-amber-400 text-amber-100 bg-amber-500/10 hover:bg-amber-500/20 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Fechar Folha"
                        onClick={handleRequestClosePayroll}
                        disabled={isClosingPayroll || isLoading}
                      >
                        {(isClosingPayroll || isLoading) && (
                          <span className="inline-block w-4 h-4 border-2 border-amber-200 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                        )}
                        {isClosingPayroll ? 'Fechando...' : isLoading ? 'Carregando...' : 'Fechar Folha'}
                      </button>
                    </div>
                  </div>
                </div>
                <div
                  className="overflow-x-auto overflow-y-auto max-h-96 min-h-[220px] custom-scroll preview-scroll"
                  style={{ scrollbarGutter: 'stable' }}
                >
                  <table className="w-full min-w-[720px] text-[10px] sm:text-[11px] text-white/80 border-collapse">
                    <thead className="bg-blue-900 border-b border-blue-700 sticky top-0 z-10 text-white shadow-sm shadow-black/30 text-[11px]">
                      <tr>
                        {[
                          { key: 'company', label: 'Empresa' },
                          { key: 'competence', label: 'Competência' },
                          { key: 'registration', label: 'Registro' },
                          { key: 'name', label: 'Nome' },
                          { key: 'sector', label: 'Setor' },
                          { key: 'date_hiring', label: 'Admissão' },
                          { key: 'status', label: 'Status' },
                          { key: 'date_status', label: 'Data Afastamento' },
                          { key: 'acoes', label: 'Acoes' },
                          ].map((col) => {
                          const isSorted = activeSort?.key === col.key
                          const direction = activeSort?.direction
                          const isSortable = col.key !== 'acoes'
                          return (
                            <th
                              key={col.key}
                              className={`px-2 sm:px-3 py-2 font-semibold text-white/90 uppercase tracking-wide ${
                                col.key === 'name' || col.key === 'sector' ? 'text-left' : 'text-center'
                              }`}
                            >
                              {isSortable ? (
                                <button
                                  type="button"
                                  onClick={() => handleActiveSort(col.key)}
                                  className={`w-full flex items-center gap-1 hover:text-emerald-200 transition-colors ${
                                    col.key === 'name' || col.key === 'sector' ? 'justify-start' : 'justify-center'
                                  }`}
                                >
                                  <span>{col.label}</span>
                                  {isSorted && (direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                </button>
                              ) : (
                                <span className={`${col.key === 'name' || col.key === 'sector' ? 'flex justify-start' : 'flex justify-center'}`}>
                                  {col.label}
                                </span>
                              )}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedActiveList.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-8 text-center text-white/60">
                            Nenhum colaborador encontrado com este filtro.
                          </td>
                        </tr>
                      ) : (
                        sortedActiveList.map((row, idx) => {
                              const rowBg = idx % 2 === 0 ? 'bg-white/5' : 'bg-transparent'
                              const isEditing = editingId === String(row.registration ?? row.name ?? '')
                               const registrationKey =
                                 row.registration !== null && row.registration !== undefined ? String(row.registration).trim() : ''
                               const competenceValue =
                                 (registrationKey && payrollCompetences[registrationKey]) ||
                                 row.competence ||
                                 defaultCompetenceIso
                              return (
                                <tr key={`${row.registration}-${row.name}`} className={`${rowBg} border-t border-white/5 hover:bg-emerald-500/10 transition-colors`}>
                               <td className="px-2 sm:px-3 py-0.5 whitespace-nowrap text-white/70 text-center">{row.company ?? '-'}</td>
                               <td className="px-2 sm:px-3 py-0.5 whitespace-nowrap text-white/80 text-center">
                                 {formatCompetenceLabel(competenceValue)}
                               </td>
                               <td className="px-2 sm:px-3 py-0.5 whitespace-nowrap text-white/80 text-center">{row.registration ?? '-'}</td>
                              <td className="px-2 sm:px-3 py-0.5 whitespace-nowrap text-white text-left">{row.name ?? '-'}</td>
                              <td className="px-2 sm:px-3 py-0.5 whitespace-nowrap text-white/70 text-left">{formatSector(row.sector)}</td>
                              <td className="px-2 sm:px-3 py-0.5 whitespace-nowrap text-white/70 text-center">{formatDateShort(row.date_hiring)}</td>
                              <td className="px-2 sm:px-3 py-0.5 whitespace-nowrap text-white font-semibold text-center">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editStatusValue}
                                    onChange={(e) => setEditStatusValue(e.target.value)}
                                    className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs outline-none focus:border-emerald-400"
                                  />
                                ) : (
                                  row.status ?? '-'
                                )}
                              </td>
                              <td className="px-2 sm:px-3 py-0.5 whitespace-nowrap text-white/70 text-center">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editDateValue}
                                    onChange={(e) => setEditDateValue(maskDateInput(e.target.value))}
                                    placeholder="dd/mm/aaaa"
                                    className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs outline-none focus:border-emerald-400"
                                  />
                                ) : (
                                  formatDateShort(row.date_status)
                                )}
                              </td>
                              <td className="px-2 sm:px-3 py-0.5 whitespace-nowrap text-white/80 text-center">
                                <div className="flex items-center gap-1 justify-center">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        className="p-1 rounded hover:bg-white/10 transition-colors"
                                        title="Salvar"
                                        onClick={() => handleSaveEdit(row)}
                                      >
                                        <Check className="w-4 h-4 text-emerald-300" />
                                      </button>
                                      <button
                                        type="button"
                                        className="p-1 rounded hover:bg-white/10 transition-colors"
                                        title="Cancelar"
                                        onClick={handleCancelEdit}
                                      >
                                        <X className="w-4 h-4 text-rose-300" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="p-1 rounded hover:bg-white/10 hover:text-emerald-200 transition-colors"
                                        title="Editar"
                                        onClick={() => handleStartEdit(row)}
                                      >
                                        <Edit className="w-4 h-4 text-blue-400 group-hover:text-emerald-200" />
                                      </button>
                                      <button
                                        type="button"
                                        className="p-1 rounded hover:bg-white/10 hover:text-rose-200 transition-colors"
                                        title="Excluir"
                                      >
                                        <Trash2 className="w-4 h-4 text-red-400 group-hover:text-rose-200" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              )}

              <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg backdrop-blur-sm overflow-hidden w-full">
                <div className="flex items-center justify-between mb-2 text-white">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-white/70">Fechamentos realizados</p>
                    <h5 className="text-sm font-semibold text-white">Histórico de fechamento</h5>
                  </div>
                </div>
                {isLoadingClosingHistory ? (
                  <div className="text-white/70 text-sm">Carregando...</div>
                ) : closingHistory.length === 0 ? (
                  <div className="text-white/70 text-sm">Nenhum fechamento encontrado.</div>
                ) : (
                  <div className="overflow-x-auto max-h-64 overflow-y-auto custom-scroll">
                    <table className="w-full min-w-[520px] text-[11px] text-white/80 border-collapse">
                      <thead className="sticky top-0 z-10 bg-emerald-900/80 text-white backdrop-blur-md border-b border-emerald-500/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Empresa</th>
                          <th className="px-3 py-2 text-center font-semibold">Competência</th>
                          <th className="px-3 py-2 text-center font-semibold">Data Registro</th>
                          <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                          <th className="px-3 py-2 text-left font-semibold">Usuário</th>
                          <th className="px-3 py-2 text-center font-semibold">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closingHistoryGrouped.slice(0, 12).map((item) => {
                          const compDate = item.competence ? new Date(item.competence) : null
                          const compDisplay = compDate && !Number.isNaN(compDate.getTime())
                            ? `${String(compDate.getUTCMonth() + 1).padStart(2, '0')}/${compDate.getUTCFullYear()}`
                            : '-'
                          return (
                            <tr key={`${item.company}-${item.competence}-${item.date_registration}`} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                              <td className="px-3 py-2 text-white/80">{formatCompanyLabel(String(item.company))}</td>
                              <td className="px-3 py-2 text-white/80 text-center">{compDisplay}</td>
                              <td className="px-3 py-2 text-white/80 text-center">{item.date_registration ? formatDateShort(item.date_registration) : '-'}</td>
                              <td className="px-3 py-2 text-white/80">{item.type_registration || '-'}</td>
                              <td className="px-3 py-2 text-white/80">{item.user_registration || '-'}</td>
                              <td className="px-3 py-2 text-white/80 text-center">
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Excluir fechamento"
                                  onClick={() => setClosingToDelete({ company: item.company, competence: item.competence })}
                                  disabled={isDeletingClosing}
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                 </div>
               )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
      {closingToDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-400/60 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white text-lg font-semibold">Confirmar exclusão</h3>
                <p className="text-white/70 text-sm mt-1 leading-relaxed">
                  Remover todos os registros de fechamento da empresa{' '}
                  <span className="font-semibold text-white">{formatCompanyLabel(String(closingToDelete.company))}</span> para a competência{' '}
                  <span className="font-semibold text-white">
                    {String(new Date(closingToDelete.competence).getUTCMonth() + 1).padStart(2, '0')}/
                    {new Date(closingToDelete.competence).getUTCFullYear()}
                  </span>
                  ?
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-white/70 text-xs">
                <span>Senha de confirmacao</span>
                <span className="text-rose-400">{Math.min(closingDeleteAttempts, 3)}/3</span>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-none w-[220px]">
                  <input
                    type="password"
                    value={closingDeletePassword}
                    onChange={(e) => {
                      setClosingDeletePassword(e.target.value)
                      if (closingDeleteError) setClosingDeleteError(null)
                    }}
                    className={`w-full bg-white/5 text-white text-sm border rounded-lg px-3 py-2.5 outline-none focus:border-emerald-400 ${closingDeleteError ? 'border-rose-400' : 'border-white/10'}`}
                    placeholder="Digite sua senha"
                    disabled={closingDeleteAttempts >= 3 || isDeletingClosing}
                  />
                  {closingDeleteError === 'required' && <p className="text-amber-300 text-xs mt-1">Obrigatorio</p>}
                  {closingDeleteError === 'invalid' && <p className="text-rose-300 text-xs mt-1">Senha incorreta</p>}
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-md bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors"
                    onClick={resetClosingDeleteState}
                    disabled={isDeletingClosing}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-md bg-rose-500 text-white font-semibold hover:bg-rose-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={handleDeleteClosing}
                    disabled={isDeletingClosing || closingDeleteAttempts >= 3}
                  >
                    {isDeletingClosing ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {isClosingAuthModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-400/60 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-amber-400 text-lg font-semibold">Confirmar fechamento</h3>
                <p className="text-white text-sm mt-1">
                  Voce esta fechando a Folha Mensal de Pagamento da Empresa: <span className="text-amber-300">{closingCompanyLabel}</span> para a competência: <span className="text-amber-300">{closingCompetenceLabel}</span>.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-white/70 text-xs">
                <span>Senha de confirmação</span>
                <span className="text-amber-400">{Math.min(closingAuthAttempts, 3)}/3</span>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-none w-[220px]">
                  <input
                    type="password"
                    value={closingAuthPassword}
                    onChange={(e) => {
                      setClosingAuthPassword(e.target.value)
                      if (closingAuthError) setClosingAuthError(null)
                    }}
                    placeholder="Digite sua senha"
                    className={`w-full bg-white/5 text-white text-sm border rounded-lg px-3 py-2.5 outline-none focus:border-amber-400 ${
                      closingAuthError ? 'border-amber-400' : 'border-white/10'
                    }`}
                    disabled={closingAuthAttempts >= 3 || isClosingPayroll}
                  />
                  {closingAuthError === 'required' && <p className="text-amber-300 text-xs mt-1">Obrigatório</p>}
                  {closingAuthError === 'invalid' && <p className="text-rose-300 text-xs mt-1">Senha incorreta</p>}
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={handleCancelClosePayrollModal}
                    disabled={isClosingPayroll}
                    className="px-4 py-2.5 rounded-md bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClosePayroll}
                    disabled={isClosingPayroll || closingAuthAttempts >= 3}
                    className="px-4 py-2.5 rounded-md bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isClosingPayroll ? 'Confirmando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Payroll
