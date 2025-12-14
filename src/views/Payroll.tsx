import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Users,
  DollarSign,
  FileText,
  CalendarDays,
  RotateCw,
  CalendarX,
  Factory,
  TrendingUp,
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
  Legend,
  LabelList,
  Cell,
} from 'recharts'
import StatCardSkeleton from '../components/StatCardSkeleton'

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
]

type PayrollStats = {
  totalEmployees: number
  totalRecords: number
  totalValue: number
  avgValue: number
}

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

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
  const [active, setActive] = useState<'folha' | 'custos' | 'afastamentos'>('folha')
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear().toString())
  const [filterMonth, setFilterMonth] = useState(String(currentDate.getMonth() + 1))
  const [filterCompany, setFilterCompany] = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [years, setYears] = useState<string[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [sectors, setSectors] = useState<string[]>([])
  const [activeEmployees, setActiveEmployees] = useState(0)
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
  const [isLoading, setIsLoading] = useState(false)

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
          dy={-4}
          textAnchor="end"
          fill="#cbd5e1"
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

  const handleClearFilters = () => {
    const now = new Date()
    const defaultYear = years[0] ?? now.getFullYear().toString()
    const defaultMonth = months[months.length - 1] ?? String(now.getMonth() + 1)
    setFilterCompany('')
    setFilterSector('')
    setFilterYear(defaultYear)
    setFilterMonth(defaultMonth)
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
        const nextMonthIso = new Date(Date.UTC(Number(filterYear), monthIndex + 1, 1)).toISOString().slice(0, 10)
        const endDate = new Date(Date.UTC(Number(filterYear), monthIndex + 1, 0))
        const endDateFmt = `${String(endDate.getUTCDate()).padStart(2, '0')}/${String(endDate.getUTCMonth() + 1).padStart(2, '0')}/${endDate.getUTCFullYear()}`
        console.log('[Payroll] Filtro colaboradores ativos (snapshot ate fim do mes)', {
          filterYear,
          filterMonth,
          endIso: nextMonthIso,
          endDate: endDateFmt,
        })
        const baseUrl = new URL(`${supabaseUrl}/rest/v1/employee`)
        baseUrl.searchParams.set('select', 'sector')
        baseUrl.searchParams.set('status', 'neq.7')
        baseUrl.searchParams.append('date_hiring', `lt.${nextMonthIso}`)
        if (filterCompany) {
          baseUrl.searchParams.append('company', `eq.${filterCompany}`)
        }
        if (filterSector) {
          baseUrl.searchParams.append('sector', `eq.${filterSector}`)
        }

        const pageSize = 2000
        let from = 0
        const sectorCounts = new Map<string, number>()
        let total = 0

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
          })
          if (batch.length < pageSize) {
            break
          }
          from += pageSize
        }
        setActiveEmployees(total)
        setSectorEmployeeSummary(Array.from(sectorCounts.entries()).map(([label, count]) => ({ label, count })))
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Erro ao contar colaboradores por setor', err)
        }
      }
    }
    fetchActiveBySector()
    return () => controller.abort()
  }, [supabaseUrl, supabaseKey, filterYear, filterMonth, filterCompany, filterSector])

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
        if (filterCompany) url.searchParams.append('company', `eq.${filterCompany}`)
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
  }, [supabaseUrl, supabaseKey, filterYear, filterMonth, filterCompany, filterSector])

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
        if (filterCompany) url.searchParams.append('company', `eq.${filterCompany}`)
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
  }, [supabaseUrl, supabaseKey, filterYear, filterMonth, filterCompany, filterSector])

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

        allRows.forEach((row) => {
          const value = Number(row.volue) || 0
          totalValue += value
          const eventNumber = Number(row.events)
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
      const top = sorted.slice(0, 21)
      const tail = sorted.slice(21)
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

  const renderValueLabel = (formatter: (v: number) => string) => (props: any) => {
    const { x, y, width, value } = props
    if (x === undefined || y === undefined || width === undefined) return null
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        fill="#e5e7eb"
        fontSize={11}
        fontWeight={700}
        textAnchor="middle"
      >
        {formatter(Number(value))}
      </text>
    )
  }

  const activeSidebarItem = sidebarItems.find((item) => item.key === active)
  const ActiveSidebarIcon = activeSidebarItem?.icon

  return (
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
                      className="bg-white/5 text-white text-xs border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
                    >
                      <option value="" className="bg-slate-800 text-white">Empresa</option>
                      {companies.map((c) => (
                        <option key={c} value={c} className="bg-slate-800 text-white">{c}</option>
                      ))}
                    </select>
                    <select
                      value={filterSector}
                      onChange={(e) => setFilterSector(e.target.value)}
                      className="bg-white/5 text-white text-xs border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400 max-w-36 truncate"
                    >
                      <option value="" className="bg-slate-800 text-white">Setor</option>
                      {sectors.map((s) => (
                        <option key={s} value={s} className="bg-slate-800 text-white">{s}</option>
                      ))}
                    </select>
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="bg-white/5 text-white text-xs border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
                    >
                      {years.map((y) => (
                        <option key={y} value={y} className="bg-slate-800 text-white">{y}</option>
                      ))}
                    </select>
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="bg-white/5 text-white text-xs border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
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
                    <span className="text-4xl font-extrabold tracking-tight">{stats.totalRecords}</span>
                  </div>
                </div>

                <div className="group relative bg-slate-800/50 border border-white/10 rounded-lg p-3 shadow-lg backdrop-blur-sm overflow-hidden h-28 flex flex-col justify-between">
                  <div className="absolute -top-1/2 -right-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">ABSENTEISMO</h3>
                    <CalendarX className="w-5 h-5 text-amber-400/80" />
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
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/80 border border-white/10 rounded-xl p-4 shadow-inner shadow-black/20">
                      <div className="flex items-center justify-between text-white mb-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-white/50">Distribuicao por setor</p>
                          <h5 className="text-sm font-semibold">Eventos: 3 - Salario e 5 - Salario Noturno</h5>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/70">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <h5 className="text-sm font-semibold">{formatCurrency(eventsTotalValue)}</h5>
                        </div>
                      </div>
                      {chartData.length === 0 ? (
                        <div className="text-white/60 text-sm">Sem dados por setor.</div>
                      ) : (
                        <div className="relative">
                          <div className="hidden md:block absolute inset-y-2 left-1/2 w-px bg-white/10 pointer-events-none" />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            {[chartData.slice(0, Math.ceil(chartData.length / 2)), chartData.slice(Math.ceil(chartData.length / 2))].map((col, colIdx) => (
                              <div
                                key={colIdx}
                                className={`space-y-3 ${colIdx === 0 ? 'md:pr-6' : 'md:pl-6'}`}
                              >
                                {col.map((item) => (
                                  <div key={item.label} className="space-y-1">
                                    <div className="grid grid-cols-[minmax(0,1fr)_80px_auto] items-center text-white/80 text-xs gap-2">
                                      <span className="font-semibold truncate pr-2">{item.label}</span>
                                      <span className="text-white/60 text-center font-semibold">{item.percent.toFixed(1)}%</span>
                                      <span className="text-white font-semibold text-right">{formatCurrency(item.valor)}</span>
                                    </div>
                                    <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full shadow-[0_0_12px_rgba(34,197,94,0.35)]"
                                        style={{
                                          width: `${Math.max(item.percent, 3)}%`,
                                          background: `linear-gradient(90deg, ${item.color} 0%, ${item.color}CC 50%, #22c55eAA 100%)`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/80 border border-white/10 rounded-xl p-4 shadow-inner shadow-black/20">
                      <div className="flex items-center justify-between text-white mb-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-white/50">Colaboradores por setor</p>
                          <h5 className="text-sm font-semibold">Totais por setor</h5>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/70">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <h5 className="text-sm font-semibold">{activeEmployees}</h5>
                        </div>
                      </div>
                      {dashboardData.length === 0 ? (
                        <div className="text-white/60 text-sm">Sem dados para exibir.</div>
                      ) : (
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData}>
                              <defs>
                                <linearGradient id="gradColabMain" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.8} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                              <XAxis dataKey="name" interval={0} height={110} tickMargin={8} tick={<SectorTick />} />
                              <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                              <RechartsTooltip
                                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                                labelStyle={{ color: '#e2e8f0' }}
                                cursor={{ fill: 'transparent' }}
                              />
                              <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 11 }} />
                              <Bar dataKey="empty" stackId="maincolab" fill="#1f2937" radius={[12, 12, 0, 0]} legendType="none" />
                              <Bar
                                dataKey="hours60"
                                name="Colaboradores"
                                stackId="maincolab"
                                stroke="#22c55e"
                                isAnimationActive
                                animationDuration={800}
                                activeBar={{ fill: 'url(#gradColabMain)', stroke: '#22c55e', strokeWidth: 3, opacity: 1 }}
                              >
                                {dashboardData.map((entry) => (
                                  <Cell key={entry.name} fill={entry.color} />
                                ))}
                                <LabelList content={renderValueLabel((v) => String(v))} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/80 border border-white/10 rounded-xl p-4 shadow-inner shadow-black/20">
                      <div className="flex items-center justify-between mb-2 text-white/80">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-white/50">Evolucao</p>
                          <h5 className="text-sm font-semibold text-white">Linha de tendencia por setor</h5>
                        </div>
                        <TrendingUp className="w-4 h-4 text-emerald-300" />
                      </div>
                      {dashboardData.length === 0 ? (
                        <div className="text-white/60 text-sm">Sem dados para exibir.</div>
                      ) : (
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dashboardData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                              <XAxis dataKey="name" interval={0} height={110} tickMargin={8} tick={<SectorTick />} />
                              <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                              <RechartsTooltip
                                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                                labelStyle={{ color: '#e2e8f0' }}
                                formatter={(v: any) => formatCurrency(Number(v))}
                                cursor={false}
                              />
                              <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 11 }} />
                              <Line
                                type="monotone"
                                dataKey="value60"
                                name="Valor"
                                stroke="#a855f7"
                                strokeWidth={3}
                                dot={{ r: 3 }}
                                activeDot={{ r: 6, stroke: '#c084fc', strokeWidth: 0 }}
                                isAnimationActive
                                animationDuration={800}
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
                Espaço reservado para indicadores de afastamentos vinculados à folha.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Payroll
