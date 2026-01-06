import React, { useEffect, useMemo, useState } from 'react'
import { DollarSign, Factory, Filter, PiggyBank, ReceiptText, RotateCw, Users } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { ACTIVE_BAR_HOVER, ChartTooltip } from '../../components/ChartTooltip'
import { abbreviateSector } from '../../utils/abbreviateSector'
import { createRotatedLabelRenderer } from '../../components/RotatedValueLabel'

type PayrollCostsPanelProps = {
  supabaseUrl?: string
  supabaseKey?: string
}

type ClosingRow = {
  company: number | null
  competence: string | null
  registration: number | null
}

type EmployeeSectorRow = {
  registration: number | string | null
  sector: string | null
  company: number | null
  status: number | null
  date_hiring: string | null
  date_status: string | null
  name?: string | null
}

type PayrollEventRow = {
  registration: number | string | null
  events: number | null
  volue: number | null
  references_: number | null
  competence: string | null
}

const CHART_COLORS = ['#8b5cf6', '#f97316', '#ef4444', '#f59e0b', '#22c55e', '#0ea5e9']

// Hypothetical Cost Event IDs
const COST_EVENT_IDS = {
  HORAS_EXTRAS: [36, 40],
  DSR_EXTRAS: [65],
  ATESTADOS: [56, 57],
}

const PayrollCostsPanel: React.FC<PayrollCostsPanelProps> = ({ supabaseKey, supabaseUrl }) => {
  const [closingRows, setClosingRows] = useState<ClosingRow[]>([])
  const [employeeInfo, setEmployeeInfo] = useState<
    Map<
      string,
      {
        sector: string | null
        company: number | null
        status: number | null
        date_hiring: string | null
        date_status: string | null
        name: string | null
      }
    >
  >(new Map())
  const [costEventRows, setCostEventRows] = useState<PayrollEventRow[]>([])
  const [isLoadingCosts, setIsLoadingCosts] = useState(false)
  const [companyFilter, setCompanyFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [hasInitializedMonth, setHasInitializedMonth] = useState(false)

  const parseYearMonth = (value?: string | null) => {
    if (!value) return null
    const parts = value.split('-')
    if (parts.length < 2) return null
    const year = Number(parts[0])
    const month = Number(parts[1])
    if (Number.isNaN(year) || Number.isNaN(month)) return null
    return { year, month }
  }

  const normalizeDateOnly = (value?: string | null) => {
    if (!value) return null
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
    return match ? match[1] : value
  }

  const formatCurrencyNoSymbol = (value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeValue)
  }

  const normalizeRegistration = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null
    return String(value).trim()
  }

  const countTooltip = ({ active, payload }: TooltipContentProps<any, any>) => {
    if (!active || !payload || payload.length === 0) return null
    const data = payload[0]?.payload as { label?: string; totalValue?: number; color: string } | undefined
    if (!data?.totalValue) return null
    return (
      <ChartTooltip
        title={data?.label}
        items={[
          {
            value: Number(data?.totalValue ?? 0).toLocaleString('pt-BR'),
            color: data.color,
          },
        ]}
      />
    )
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value)

  const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)

  const SectorTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => {
    if (x === undefined || y === undefined || !payload) return null
    return (
      <g transform={`translate(${x},${y}) rotate(-90)`}>
        <text
          textAnchor="end"
          dominantBaseline="central"
          fill="#9aa4b3ff"
          fontSize={10}
          fontWeight={600}
        >
          {payload.value}
        </text>
      </g>
    )
  }

  const formatCompanyLabel = (value: number) => {
    if (value === 4) return 'Frigosul'
    if (value === 5) return 'Pantaneira'
    return String(value)
  }

  const formatMonthLabel = (month: number) => {
    const date = new Date(2000, month - 1, 1)
    return date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase()
  }

  const formatRefLabel = () => {
    if (!monthFilter || !yearFilter) return ''
    return `${String(monthFilter).padStart(2, '0')}/${yearFilter}`
  }

  const titleSuffix = monthFilter === '' ? ' - ANUAL' : ''
  const refLabel = monthFilter !== '' ? ` - Ref. ${formatRefLabel()}` : ''

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) {
      return
    }
    const controller = new AbortController()
    const fetchBase = async () => {
      try {
        const closingData: ClosingRow[] = []
        const closingUrl = new URL(`${supabaseUrl}/rest/v1/closing_payroll`)
        closingUrl.searchParams.set('select', 'company,competence,registration')
        const closingPageSize = 1000
        let closingStart = 0
        let closingHasMore = true
        while (closingHasMore) {
          const closingRes = await fetch(closingUrl.toString(), {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Range: `${closingStart}-${closingStart + closingPageSize - 1}`,
            },
            signal: controller.signal,
          })
          if (!closingRes.ok) {
            throw new Error(await closingRes.text())
          }
          const closingChunk = (await closingRes.json()) as ClosingRow[]
          closingData.push(...closingChunk)
          if (closingChunk.length < closingPageSize) {
            closingHasMore = false
          } else {
            closingStart += closingPageSize
          }
        }
        setClosingRows(closingData)

        const employeeData: EmployeeSectorRow[] = []
        const employeeUrl = new URL(`${supabaseUrl}/rest/v1/employee`)
        employeeUrl.searchParams.set('select', 'registration,sector,company,status,date_hiring,date_status,name')
        const employeePageSize = 1000
        let employeeStart = 0
        let employeeHasMore = true
        while (employeeHasMore) {
          const employeeRes = await fetch(employeeUrl.toString(), {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Range: `${employeeStart}-${employeeStart + employeePageSize - 1}`,
            },
            signal: controller.signal,
          })
          if (!employeeRes.ok) {
            throw new Error(await employeeRes.text())
          }
          const employeeChunk = (await employeeRes.json()) as EmployeeSectorRow[]
          employeeData.push(...employeeChunk)
          if (employeeChunk.length < employeePageSize) {
            employeeHasMore = false
          } else {
            employeeStart += employeePageSize
          }
        }
        const sectorMap = new Map<
          string,
          { sector: string | null; company: number | null; status: number | null; date_hiring: string | null; date_status: string | null; name: string | null }
        >()
        employeeData.forEach((row) => {
          const regKey = normalizeRegistration(row.registration)
          if (!regKey) return
          sectorMap.set(regKey, {
            sector: row.sector ?? null,
            company: row.company ?? null,
            status: row.status ?? null,
            date_hiring: row.date_hiring ?? null,
            date_status: row.date_status ?? null,
            name: row.name ?? null,
          })
        })
        setEmployeeInfo(sectorMap)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          // No UI surface yet for filter errors.
        }
      } finally {
      }
    }
    fetchBase()
    return () => controller.abort()
  }, [supabaseKey, supabaseUrl])

  const companyOptions = useMemo(() => {
    const companies = new Set<number>()
    closingRows.forEach((row) => {
      const regKey = normalizeRegistration(row.registration)
      if (!regKey) return
      const company = employeeInfo.get(regKey)?.company
      if (company !== null && company !== undefined) companies.add(company)
    })
    if (companies.size === 0) {
      employeeInfo.forEach((info) => {
        if (info.company !== null && info.company !== undefined) companies.add(info.company)
      })
    }
    return Array.from(companies).sort((a, b) => a - b)
  }, [closingRows, employeeInfo])

  const competenceOptions = useMemo(() => {
    const values = closingRows
      .map((row) => normalizeDateOnly(row.competence))
      .filter((value): value is string => Boolean(value))
    return Array.from(new Set(values))
  }, [closingRows])

  const yearOptions = useMemo(() => {
    const years = competenceOptions
      .map((value) => parseYearMonth(value)?.year)
      .filter((value): value is number => value !== null && value !== undefined)
    return Array.from(new Set(years)).sort((a, b) => b - a)
  }, [competenceOptions])

  const monthOptions = useMemo(() => {
    const months = competenceOptions
      .map((value) => parseYearMonth(value))
      .filter((value): value is { year: number; month: number } => Boolean(value))
      .filter((value) => (!yearFilter ? true : value.year === Number(yearFilter)))
      .map((value) => value.month)
    return Array.from(new Set(months)).sort((a, b) => b - a)
  }, [competenceOptions, yearFilter])

  const sectorOptions = useMemo(() => {
    const sectors: string[] = []
    const targetYear = Number(yearFilter)
    const targetMonth = Number(monthFilter)
    const hasMonthFilter = monthFilter !== ''
    closingRows.forEach((row) => {
      const regKey = normalizeRegistration(row.registration)
      if (!regKey) return
      const company = employeeInfo.get(regKey)?.company
      if (companyFilter && String(company ?? '') !== companyFilter) return
      const parsed = parseYearMonth(row.competence)
      if (yearFilter && (!parsed || parsed.year !== targetYear)) return
      if (hasMonthFilter && (!parsed || parsed.month !== targetMonth)) return
      const sector = employeeInfo.get(regKey)?.sector
      if (sector) sectors.push(sector)
    })
    return Array.from(new Set(sectors)).sort((a, b) => a.localeCompare(b))
  }, [closingRows, companyFilter, employeeInfo, monthFilter, yearFilter])

  useEffect(() => {
    if (companyOptions.length > 0 && (!companyFilter || !companyOptions.includes(Number(companyFilter)))) {
      const pantaneira = companyOptions.find((company) => company === 5)
      setCompanyFilter(String(pantaneira ?? companyOptions[0]))
    }
  }, [companyOptions, companyFilter])

  useEffect(() => {
    if (yearOptions.length > 0 && (!yearFilter || !yearOptions.includes(Number(yearFilter)))) {
      setYearFilter(String(yearOptions[0]))
    }
  }, [yearOptions, yearFilter])

  useEffect(() => {
    if (!hasInitializedMonth && monthOptions.length > 0 && !monthFilter) {
      setMonthFilter(String(monthOptions[0]))
      setHasInitializedMonth(true)
      return
    }
    if (monthFilter && monthFilter !== '' && monthOptions.length > 0 && !monthOptions.includes(Number(monthFilter))) {
      setMonthFilter(String(monthOptions[0]))
    }
  }, [hasInitializedMonth, monthFilter, monthOptions])

  useEffect(() => {
    if (sectorFilter && sectorOptions.length > 0 && !sectorOptions.includes(sectorFilter)) {
      setSectorFilter('')
    }
  }, [sectorFilter, sectorOptions])

  const filteredRegistrations = useMemo(() => {
    const regs = new Set<string>()
    employeeInfo.forEach((info, regKey) => {
      if (companyFilter && String(info.company ?? '') !== companyFilter) return
      if (sectorFilter && info.sector !== sectorFilter) return
      regs.add(regKey)
    })
    return regs
  }, [companyFilter, employeeInfo, sectorFilter])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    if (!yearFilter) return
    const controller = new AbortController()
    const fetchCosts = async () => {
      setIsLoadingCosts(true)
      try {
        const targetCompetences =
          monthFilter === ''
            ? competenceOptions
                .filter((value) => {
                  const parsed = parseYearMonth(value)
                  return parsed && parsed.year === Number(yearFilter)
                })
                .map((value) => `${value}`)
            : [`${yearFilter}-${String(monthFilter).padStart(2, '0')}-01`]

        if (targetCompetences.length === 0) {
          setCostEventRows([])
          return
        }

        const url = new URL(`${supabaseUrl}/rest/v1/payroll`)
        url.searchParams.set('select', 'registration,events,volue,references_,competence')
        if (targetCompetences.length === 1) {
          url.searchParams.set('competence', `eq.${targetCompetences[0]}`)
        } else {
          url.searchParams.set('competence', `in.(${targetCompetences.join(',')})`)
        }

        const allCostEventIds = Object.values(COST_EVENT_IDS).flat()
        if (allCostEventIds.length > 0) {
          url.searchParams.set('events', `in.(${allCostEventIds.join(',')})`)
        }

        const registrations = Array.from(filteredRegistrations)
        if (registrations.length > 0 && registrations.length <= 500) {
          url.searchParams.set('registration', `in.(${registrations.join(',')})`)
        }

        const payrollData: PayrollEventRow[] = []
        const pageSize = 1000
        let start = 0
        let hasMore = true
        while (hasMore) {
          const res = await fetch(url.toString(), {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Range: `${start}-${start + pageSize - 1}`,
            },
            signal: controller.signal,
          })
          if (!res.ok) {
            throw new Error(await res.text())
          }
          const chunk = (await res.json()) as PayrollEventRow[]
          payrollData.push(...chunk)
          if (chunk.length < pageSize) {
            hasMore = false
          } else {
            start += pageSize
          }
        }
        setCostEventRows(payrollData)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setCostEventRows([])
        }
      } finally {
        setIsLoadingCosts(false)
      }
    }
    fetchCosts()
    return () => controller.abort()
  }, [competenceOptions, filteredRegistrations, supabaseKey, supabaseUrl, yearFilter, monthFilter])

  const costIndicators = useMemo(() => {
    const totals = {
      horasExtrasCost: 0,
      horasExtras60: 0,
      horasExtras100: 0,
      dsrExtrasCost: 0,
      atestadosCost: 0,
      atestadosNormal: 0,
      atestadosNoturno: 0,
    }

    costEventRows.forEach((row) => {
      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !filteredRegistrations.has(regKey)) return
      const value = row.volue ?? 0
      const event = row.events ?? undefined

      if (event && COST_EVENT_IDS.HORAS_EXTRAS.includes(event)) {
        totals.horasExtrasCost += value
        if (event === 40) totals.horasExtras60 += value
        if (event === 36) totals.horasExtras100 += value
      }
      if (event && COST_EVENT_IDS.DSR_EXTRAS?.includes?.(event)) totals.dsrExtrasCost += value
      if (event && COST_EVENT_IDS.ATESTADOS?.includes?.(event)) {
        totals.atestadosCost += value
        if (event === 56) totals.atestadosNormal += value
        if (event === 57) totals.atestadosNoturno += value
      }
    })

    return {
      ...totals,
    }
  }, [costEventRows, filteredRegistrations])

  const extraChartData = useMemo(() => {
    const isAllMonths = monthFilter === ''
    const map = new Map<string, number>()

    costEventRows.forEach((row) => {
      if (!row.events || !COST_EVENT_IDS.HORAS_EXTRAS.includes(row.events)) return
      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !filteredRegistrations.has(regKey)) return
      const parsed = parseYearMonth(row.competence)
      if (!parsed) return
      if (Number(yearFilter || parsed.year) !== parsed.year) return

      const key = isAllMonths ? formatMonthLabel(parsed.month) : abbreviateSector(employeeInfo.get(regKey)?.sector ?? null)
      map.set(key, (map.get(key) || 0) + (row.volue ?? 0))
    })

    const entries = Array.from(map.entries())
    const sorted = isAllMonths
      ? entries.sort((a, b) => a[0].localeCompare(b[0]))
      : entries.sort((a, b) => b[1] - a[1])

    return sorted.map(([label, totalValue], idx) => ({
      label,
      totalValue,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [costEventRows, employeeInfo, filteredRegistrations, monthFilter, yearFilter])

  const dsrChartData = useMemo(() => {
    const isAllMonths = monthFilter === ''
    const map = new Map<string, number>()

    costEventRows.forEach((row) => {
      if (!row.events || !COST_EVENT_IDS.DSR_EXTRAS.includes(row.events)) return
      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !filteredRegistrations.has(regKey)) return
      const parsed = parseYearMonth(row.competence)
      if (!parsed) return
      if (Number(yearFilter || parsed.year) !== parsed.year) return

      const key = isAllMonths ? formatMonthLabel(parsed.month) : abbreviateSector(employeeInfo.get(regKey)?.sector ?? null)
      map.set(key, (map.get(key) || 0) + (row.volue ?? 0))
    })

    const entries = Array.from(map.entries())
    const sorted = isAllMonths
      ? entries.sort((a, b) => a[0].localeCompare(b[0]))
      : entries.sort((a, b) => b[1] - a[1])

    return sorted.map(([label, totalValue], idx) => ({
      label,
      totalValue,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [costEventRows, employeeInfo, filteredRegistrations, monthFilter, yearFilter])

  const atestadosChartData = useMemo(() => {
    const isAllMonths = monthFilter === ''
    const map = new Map<string, number>()

    costEventRows.forEach((row) => {
      if (!row.events || !COST_EVENT_IDS.ATESTADOS.includes(row.events)) return
      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !filteredRegistrations.has(regKey)) return
      const parsed = parseYearMonth(row.competence)
      if (!parsed) return
      if (Number(yearFilter || parsed.year) !== parsed.year) return

      const key = isAllMonths ? formatMonthLabel(parsed.month) : abbreviateSector(employeeInfo.get(regKey)?.sector ?? null)
      map.set(key, (map.get(key) || 0) + (row.volue ?? 0))
    })

    const entries = Array.from(map.entries())
    const sorted = isAllMonths
      ? entries.sort((a, b) => a[0].localeCompare(b[0]))
      : entries.sort((a, b) => b[1] - a[1])

    return sorted.map(([label, totalValue], idx) => ({
      label,
      totalValue,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [costEventRows, employeeInfo, filteredRegistrations, monthFilter, yearFilter])

  const extraReferenceChartData = useMemo(() => {
    const isAllMonths = monthFilter === ''
    const map = new Map<string, number>()

    costEventRows.forEach((row) => {
      if (!row.events || !COST_EVENT_IDS.HORAS_EXTRAS.includes(row.events)) return
      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !filteredRegistrations.has(regKey)) return
      const parsed = parseYearMonth(row.competence)
      if (!parsed) return
      if (Number(yearFilter || parsed.year) !== parsed.year) return

      const key = isAllMonths ? formatMonthLabel(parsed.month) : abbreviateSector(employeeInfo.get(regKey)?.sector ?? null)
      map.set(key, (map.get(key) || 0) + (row.references_ ?? 0))
    })

    const entries = Array.from(map.entries())
    const sorted = isAllMonths
      ? entries.sort((a, b) => a[0].localeCompare(b[0]))
      : entries.sort((a, b) => b[1] - a[1])

    return sorted.map(([label, totalValue], idx) => ({
      label,
      totalValue,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [costEventRows, employeeInfo, filteredRegistrations, monthFilter, yearFilter])

  const extraSpeedChartData = useMemo(() => {
    const isAllMonths = monthFilter === ''
    const map = new Map<
      string,
      {
        total60: number
        total100: number
      }
    >()

    costEventRows.forEach((row) => {
      if (!row.events || !COST_EVENT_IDS.HORAS_EXTRAS.includes(row.events)) return
      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !filteredRegistrations.has(regKey)) return
      const parsed = parseYearMonth(row.competence)
      if (!parsed) return
      if (Number(yearFilter || parsed.year) !== parsed.year) return

      const key = isAllMonths ? formatMonthLabel(parsed.month) : abbreviateSector(employeeInfo.get(regKey)?.sector ?? null)
      if (!map.has(key)) {
        map.set(key, { total60: 0, total100: 0 })
      }
      if (row.events === 40) {
        map.get(key)!.total60 += row.volue ?? 0
      }
      if (row.events === 36) {
        map.get(key)!.total100 += row.volue ?? 0
      }
    })

    const entries = Array.from(map.entries())
    const sorted = isAllMonths
      ? entries.sort((a, b) => a[0].localeCompare(b[0]))
      : entries.sort((a, b) => (b[1].total60 + b[1].total100) - (a[1].total60 + a[1].total100))

    return sorted.map(([label, totals]) => ({
      label,
      total60: totals.total60,
      total100: totals.total100,
    }))
  }, [costEventRows, employeeInfo, filteredRegistrations, monthFilter, yearFilter])

  const extraReferenceSplitChartData = useMemo(() => {
    const isAllMonths = monthFilter === ''
    const map = new Map<
      string,
      {
        ref60: number
        ref100: number
      }
    >()

    costEventRows.forEach((row) => {
      if (!row.events || !COST_EVENT_IDS.HORAS_EXTRAS.includes(row.events)) return
      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !filteredRegistrations.has(regKey)) return
      const parsed = parseYearMonth(row.competence)
      if (!parsed) return
      if (Number(yearFilter || parsed.year) !== parsed.year) return

      const key = isAllMonths ? formatMonthLabel(parsed.month) : abbreviateSector(employeeInfo.get(regKey)?.sector ?? null)
      if (!map.has(key)) {
        map.set(key, { ref60: 0, ref100: 0 })
      }
      if (row.events === 40) {
        map.get(key)!.ref60 += row.references_ ?? 0
      }
      if (row.events === 36) {
        map.get(key)!.ref100 += row.references_ ?? 0
      }
    })

    const entries = Array.from(map.entries())
    const sorted = isAllMonths
      ? entries.sort((a, b) => a[0].localeCompare(b[0]))
      : entries.sort((a, b) => (b[1].ref60 + b[1].ref100) - (a[1].ref60 + a[1].ref100))

    return sorted.map(([label, totals]) => ({
      label,
      ref60: totals.ref60,
      ref100: totals.ref100,
    }))
  }, [costEventRows, employeeInfo, filteredRegistrations, monthFilter, yearFilter])

  const topValueChartData = useMemo(() => {
    const map = new Map<string, { name: string; totalValue: number; totalRef: number; sector: string | null }>()
    costEventRows.forEach((row) => {
      if (!row.events || !COST_EVENT_IDS.HORAS_EXTRAS.includes(row.events)) return
      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !filteredRegistrations.has(regKey)) return
      const info = employeeInfo.get(regKey)
      const name = info?.name || regKey
      const sector = abbreviateSector(info?.sector ?? null)
      if (!map.has(regKey)) {
        map.set(regKey, { name, totalValue: 0, totalRef: 0, sector })
      }
      map.get(regKey)!.totalValue += row.volue ?? 0
      map.get(regKey)!.totalRef += row.references_ ?? 0
    })
    const entries = Array.from(map.entries()).sort((a, b) => b[1].totalValue - a[1].totalValue).slice(0, 10)
    return entries.map(([reg, data], idx) => ({
      key: reg,
      label: data.name,
      totalValue: data.totalValue,
      totalRef: data.totalRef,
      sector: data.sector,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [costEventRows, employeeInfo, filteredRegistrations])

  const topReferenceChartData = useMemo(() => {
    const map = new Map<string, { name: string; totalRef: number; sector: string | null }>()
    costEventRows.forEach((row) => {
      if (!row.events || !COST_EVENT_IDS.HORAS_EXTRAS.includes(row.events)) return
      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !filteredRegistrations.has(regKey)) return
      const info = employeeInfo.get(regKey)
      const name = info?.name || regKey
      const sector = abbreviateSector(info?.sector ?? null)
      if (!map.has(regKey)) {
        map.set(regKey, { name, totalRef: 0, sector })
      }
      map.get(regKey)!.totalRef += row.references_ ?? 0
    })
    const entries = Array.from(map.entries())
      .sort((a, b) => b[1].totalRef - a[1].totalRef)
      .slice(0, 10)

    return entries.map(([reg, data], idx) => ({
      key: reg,
      label: data.name,
      totalValue: data.totalRef,
      totalRef: data.totalRef,
      sector: data.sector,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [costEventRows, employeeInfo, filteredRegistrations])

  const handleClearFilters = () => {
    const pantaneira = companyOptions.find((company) => company === 5)
    setCompanyFilter(companyOptions.length ? String(pantaneira ?? companyOptions[0]) : '')
    setYearFilter(yearOptions.length ? String(yearOptions[0]) : '')
    setMonthFilter(monthOptions.length ? String(monthOptions[0]) : '')
    setSectorFilter('')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 shadow-inner shadow-black/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-emerald-200 font-semibold">
            <DollarSign className="w-6 h-6 text-amber-300" />
            CUSTOS DA FOLHA
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-[0.2em]">
              <Filter className="w-4 h-4 text-emerald-300" />
              Filtros
            </div>
            <select
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              className="bg-white/5 text-emerald-300 text-[11px] border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
            >
              {companyOptions.map((company) => (
                <option key={company} value={String(company)} className="bg-[#1f2c4d] text-emerald-300">
                  {formatCompanyLabel(company)}
                </option>
              ))}
            </select>
            <select
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="bg-white/5 text-emerald-300 text-[11px] border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
            >
              {yearOptions.map((year) => (
                <option key={year} value={String(year)} className="bg-[#1f2c4d] text-emerald-300">
                  {year}
                </option>
              ))}
            </select>
            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="bg-white/5 text-emerald-300 text-[11px] border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
            >
              <option value="" className="bg-[#1f2c4d] text-emerald-300">
                --
              </option>
              {monthOptions.map((month) => (
                <option key={month} value={String(month)} className="bg-[#1f2c4d] text-emerald-300">
                  {String(month).padStart(2, '0')}
                </option>
              ))}
            </select>
            <select
              value={sectorFilter}
              onChange={(event) => setSectorFilter(event.target.value)}
              className="bg-white/5 text-emerald-300 text-[11px] border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
            >
              <option value="" className="bg-[#1f2c4d] text-emerald-300">
                Setor
              </option>
              {sectorOptions.map((sector) => (
                <option key={sector} value={sector} className="bg-[#1f2c4d] text-emerald-300">
                  {sector}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center text-emerald-100 rounded-full border border-transparent px-2 py-1.5 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-colors"
              title="Limpar filtros"
            >
              <RotateCw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-gradient-to-br from-indigo-300/25 via-indigo-500/20 to-slate-900/45 border border-indigo-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                {`Horas Extras${titleSuffix}${refLabel}`}
              </p>
              <div className="-mt-1">
                <PiggyBank className="w-5 h-5 text-indigo-300" />
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <p className="text-2xl font-semibold text-indigo-200">
                {isLoadingCosts ? '...' : formatCurrency(costIndicators.horasExtrasCost)}
              </p>

              <div className="flex items-center justify-between gap-6 flex-wrap text-[11px] text-white/70 font-semibold mt-1 w-full max-w-[280px]">
                <span>
                  60% <span className="text-white">{isLoadingCosts ? '...' : formatCurrency(costIndicators.horasExtras60)}</span>
                </span>
                <span>
                  100% <span className="text-white">{isLoadingCosts ? '...' : formatCurrency(costIndicators.horasExtras100)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-300/25 via-green-500/20 to-slate-900/45 border border-green-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                {`DSR s/ Horas Extras${titleSuffix}${refLabel}`}
              </p>
              <div className="-mt-1">
                <Users className="w-5 h-5 text-green-300" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-2xl font-semibold text-green-200">
                {isLoadingCosts ? '...' : formatCurrency(costIndicators.dsrExtrasCost)}
              </p>
            </div>
            
          </div>
        </div>
        <div className="bg-gradient-to-br from-yellow-300/25 via-yellow-500/20 to-slate-900/45 border border-yellow-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                {`Custos c/ Atestados${titleSuffix}${refLabel}`}
              </p>
              <div className="-mt-1">
                <ReceiptText className="w-5 h-5 text-yellow-300" />
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <p className="text-2xl font-semibold text-yellow-200">
                {isLoadingCosts ? '...' : formatCurrency(costIndicators.atestadosCost)}
              </p>
              <div className="flex items-center justify-between gap-6 flex-wrap text-[11px] text-white/70 font-semibold mt-1 w-full max-w-[280px]">
                <span>
                  N: <span className="text-white">{isLoadingCosts ? '...' : formatCurrency(costIndicators.atestadosNormal)}</span>
                </span>
                <span>
                  NT: <span className="text-white">{isLoadingCosts ? '...' : formatCurrency(costIndicators.atestadosNoturno)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-300/25 via-red-500/20 to-slate-900/45 border border-red-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                {`Aux. Alimentacao${titleSuffix}${refLabel}`}
              </p>
              <div className="-mt-1">
                <Factory className="w-5 h-5 text-red-300" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-2xl font-semibold text-red-200">
                ...
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              {`Valores das Horas Extras por ${monthFilter === '' ? 'Mês' : 'Setor'}${titleSuffix}${refLabel}`}
            </p>
            <span className="text-emerald-300 text-xs font-semibold">
              {formatCurrency(extraChartData.reduce((sum, item) => sum + item.totalValue, 0))}
            </span>
          </div>
          <div className="mt-3 h-80 rounded-lg border border-white/10 bg-white/5 chart-container">
            {isLoadingCosts ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Carregando...</div>
            ) : extraChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={extraChartData} margin={{ top: 48, right: 5, left: 5, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    height={monthFilter === '' ? 30 : 80}
                    tick={monthFilter === '' ? { fill: '#9aa4b3ff', fontSize: 11 } : <SectorTick />}
                    axisLine={{ stroke: '#475569' }}
                  />
                  <YAxis
                    tickFormatter={(tick) => formatCurrencyNoSymbol(Number(tick))}
                    tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                    axisLine={{ stroke: '#475569' }}
                    tickCount={8}
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]}
                  />
                  <RechartsTooltip content={countTooltip} cursor={{ fill: 'transparent' }} />
                  <Bar
                    dataKey="totalValue"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                    animationDuration={0}
                    activeBar={ACTIVE_BAR_HOVER}
                  >
                    {extraChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="totalValue"
                      content={createRotatedLabelRenderer(formatCurrencyNoSymbol, { color: '#FFFFFF', fontSize: 12 })}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>


        <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              {`Referências de Horas Extras por ${monthFilter === '' ? 'Mês' : 'Setor'}${titleSuffix}${refLabel}`}
            </p>
            <span className="text-emerald-300 text-xs font-semibold">
              {formatNumber(extraReferenceChartData.reduce((sum, item) => sum + item.totalValue, 0))}
            </span>
          </div>
          <div className="mt-3 h-80 rounded-lg border border-white/10 bg-white/5 chart-container">
            {isLoadingCosts ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Carregando...</div>
            ) : extraReferenceChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={extraReferenceChartData} margin={{ top: 48, right: 5, left: 5, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    height={monthFilter === '' ? 30 : 80}
                    tick={monthFilter === '' ? { fill: '#9aa4b3ff', fontSize: 11 } : <SectorTick />}
                    axisLine={{ stroke: '#475569' }}
                  />
                  <YAxis
                    tickFormatter={(tick) => formatNumber(Number(tick))}
                    tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                    axisLine={{ stroke: '#475569' }}
                    tickCount={8}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null
                      const data = payload[0]?.payload as { label?: string; totalValue?: number; color?: string }
                      if (!data) return null
                      return (
                        <ChartTooltip
                          title={data?.label}
                          items={[
                            {
                              value: formatNumber(Number(data?.totalValue ?? 0)),
                              color: data.color,
                            },
                          ]}
                        />
                      )
                    }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar
                    dataKey="totalValue"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                    animationDuration={0}
                    activeBar={ACTIVE_BAR_HOVER}
                  >
                    {extraReferenceChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="totalValue"
                      content={createRotatedLabelRenderer(formatCurrencyNoSymbol, { color: '#FFFFFF', fontSize: 12 })}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              {`Valores das Horas Extras 60% x 100% por ${monthFilter === '' ? 'Mês' : 'Setor'}${titleSuffix}${refLabel}`}
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1 text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                60%: {formatCurrency(extraSpeedChartData.reduce((sum, item) => sum + item.total60, 0))}
              </span>
              <span className="flex items-center gap-1 text-purple-300">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                100%: {formatCurrency(extraSpeedChartData.reduce((sum, item) => sum + item.total100, 0))}
              </span>
            </div>
          </div>
          <div className="mt-3 h-80 rounded-lg border border-white/10 bg-white/5 chart-container">
            {isLoadingCosts ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Carregando...</div>
            ) : extraSpeedChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={extraSpeedChartData} margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    height={monthFilter === '' ? 30 : 80}
                    tick={monthFilter === '' ? { fill: '#9aa4b3ff', fontSize: 11 } : <SectorTick />}
                    axisLine={{ stroke: '#475569' }}
                  />
                  <YAxis
                    tickFormatter={(tick) => formatCurrencyNoSymbol(Number(tick))}
                    tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                    axisLine={{ stroke: '#475569' }}
                    tickCount={8}
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null
                      const data = payload[0]?.payload as { label?: string; total60?: number; total100?: number }
                      if (!data) return null
                      return (
                        <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg text-center">
                          <div className="font-semibold">{data.label}</div>
                          <div className="mt-1 flex flex-col gap-1 text-left">
                            <span className="flex items-center gap-2 text-emerald-300">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              60%: {formatCurrency(Number(data.total60 ?? 0))}
                            </span>
                            <span className="flex items-center gap-2 text-purple-300">
                              <span className="h-2 w-2 rounded-full bg-purple-500" />
                              100%: {formatCurrency(Number(data.total100 ?? 0))}
                            </span>
                          </div>
                        </div>
                      )
                    }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total60"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="total100"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              {`Referências 60% x 100% por ${monthFilter === '' ? 'Mês' : 'Setor'}${titleSuffix}${refLabel}`}
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1 text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                60%: {formatNumber(extraReferenceSplitChartData.reduce((sum, item) => sum + item.ref60, 0))}
              </span>
              <span className="flex items-center gap-1 text-purple-300">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                100%: {formatNumber(extraReferenceSplitChartData.reduce((sum, item) => sum + item.ref100, 0))}
              </span>
            </div>
          </div>
          <div className="mt-3 h-80 rounded-lg border border-white/10 bg-white/5 chart-container">
            {isLoadingCosts ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Carregando...</div>
            ) : extraReferenceSplitChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={extraReferenceSplitChartData} margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    height={monthFilter === '' ? 30 : 80}
                    tick={monthFilter === '' ? { fill: '#9aa4b3ff', fontSize: 11 } : <SectorTick />}
                    axisLine={{ stroke: '#475569' }}
                  />
                  <YAxis
                    tickFormatter={(tick) => formatNumber(Number(tick))}
                    tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                    axisLine={{ stroke: '#475569' }}
                    tickCount={8}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null
                      const data = payload[0]?.payload as { label?: string; ref60?: number; ref100?: number }
                      if (!data) return null
                      return (
                        <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg text-center">
                          <div className="font-semibold">{data.label}</div>
                          <div className="mt-1 flex flex-col gap-1 text-left">
                            <span className="flex items-center gap-2 text-emerald-300">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              60%: {formatNumber(Number(data.ref60 ?? 0))}
                            </span>
                            <span className="flex items-center gap-2 text-purple-300">
                              <span className="h-2 w-2 rounded-full bg-purple-500" />
                              100%: {formatNumber(Number(data.ref100 ?? 0))}
                            </span>
                          </div>
                        </div>
                      )
                    }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ref60"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ref100"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                {`Top 10 Colaborador Valor${titleSuffix}${refLabel}`}
              </p>
              <span className="text-emerald-300 text-xs font-semibold">
                {formatCurrency(topValueChartData.reduce((sum, item) => sum + item.totalValue, 0))}
              </span>
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
              {isLoadingCosts ? (
                <div className="h-full flex items-center justify-center text-white/50 text-sm">Carregando...</div>
              ) : topValueChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
              ) : (
                topValueChartData.map((item) => {
                  const totalSum = topValueChartData.reduce((sum, row) => sum + row.totalRef, 0)
                  const percent = totalSum > 0 ? (item.totalRef / totalSum) * 100 : 0
                  const sectorLabel = abbreviateSector(item.sector ?? null)
                  return (
                    <div
                      key={item.key}
                      className="rounded-md hover:bg-white/10 transition"
                      title={`Setor: ${sectorLabel}`}
                      aria-label={`Setor: ${sectorLabel}`}
                    >
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <div className="flex flex-col">
                          <span className="font-semibold" title={`Setor: ${sectorLabel}`}>
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{percent.toFixed(1)}%</span>
                          <span className="text-emerald-300 font-semibold">{formatCurrency(item.totalValue)}</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${percent}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                {`Top 10 Colaborador Referência${titleSuffix}${refLabel}`}
              </p>
              <span className="text-emerald-300 text-xs font-semibold">
                {formatNumber(topReferenceChartData.reduce((sum, item) => sum + item.totalRef, 0))}
              </span>
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
              {isLoadingCosts ? (
                <div className="h-full flex items-center justify-center text-white/50 text-sm">Carregando...</div>
              ) : topReferenceChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
              ) : (
                topReferenceChartData.map((item) => {
                  const totalSum = topReferenceChartData.reduce((sum, row) => sum + row.totalRef, 0)
                  const percent = totalSum > 0 ? (item.totalRef / totalSum) * 100 : 0
                  const sectorLabel = abbreviateSector(item.sector ?? null)
                  return (
                    <div
                      key={item.key}
                      className="rounded-md hover:bg-white/10 transition"
                      title={`Setor: ${sectorLabel}`}
                      aria-label={`Setor: ${sectorLabel}`}
                    >
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold" title={`Setor: ${sectorLabel}`}>
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{percent.toFixed(1)}%</span>
                          <span className="text-emerald-300 font-semibold">{formatNumber(item.totalRef)}</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${percent}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>


        <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              {`DSR s/ Horas Extras por ${monthFilter === '' ? 'Mês' : 'Setor'}${titleSuffix}${refLabel}`}
            </p>
            <span className="text-emerald-300 text-xs font-semibold">
              {formatCurrency(dsrChartData.reduce((sum, item) => sum + item.totalValue, 0))}
            </span>
          </div>
          <div className="mt-3 h-80 rounded-lg border border-white/10 bg-white/5 chart-container">
            {isLoadingCosts ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Carregando...</div>
            ) : dsrChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dsrChartData} margin={{ top: 55, right: 5, left: 5, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    height={monthFilter === '' ? 30 : 80}
                    tick={monthFilter === '' ? { fill: '#9aa4b3ff', fontSize: 11 } : <SectorTick />}
                    axisLine={{ stroke: '#475569' }}
                  />
                  <YAxis
                    tickFormatter={(tick) => formatCurrencyNoSymbol(Number(tick))}
                    tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                    axisLine={{ stroke: '#475569' }}
                    tickCount={8}
                  />
                  <RechartsTooltip content={countTooltip} cursor={{ fill: 'transparent' }} />
                  <Bar
                    dataKey="totalValue"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                    animationDuration={0}
                    activeBar={ACTIVE_BAR_HOVER}
                  >
                    {dsrChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="totalValue"
                      content={createRotatedLabelRenderer(formatCurrencyNoSymbol, { color: '#FFFFFF', fontSize: 12 })}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              {`Custos com Atestados por ${monthFilter === '' ? 'Mês' : 'Setor'}${titleSuffix}${refLabel}`}
            </p>
            <span className="text-emerald-300 text-xs font-semibold">
              {formatCurrency(atestadosChartData.reduce((sum, item) => sum + item.totalValue, 0))}
            </span>
          </div>
          <div className="mt-3 h-80 rounded-lg border border-white/10 bg-white/5 chart-container">
            {isLoadingCosts ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Carregando...</div>
            ) : atestadosChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={atestadosChartData} margin={{ top: 59, right: 5, left: 5, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    height={monthFilter === '' ? 30 : 80}
                    tick={monthFilter === '' ? { fill: '#9aa4b3ff', fontSize: 11 } : <SectorTick />}
                    axisLine={{ stroke: '#475569' }}
                  />
                  <YAxis
                    tickFormatter={(tick) => formatCurrencyNoSymbol(Number(tick))}
                    tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                    axisLine={{ stroke: '#475569' }}
                    tickCount={8}
                  />
                  <RechartsTooltip content={countTooltip} cursor={{ fill: 'transparent' }} />
                  <Bar
                    dataKey="totalValue"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                    animationDuration={0}
                    activeBar={ACTIVE_BAR_HOVER}
                  >
                    {atestadosChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="totalValue"
                      content={createRotatedLabelRenderer(formatCurrencyNoSymbol, { color: '#FFFFFF', fontSize: 12 })}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PayrollCostsPanel
