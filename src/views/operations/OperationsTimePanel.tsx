import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDown01, ArrowDown10, ArrowDownAZ, ArrowDownZA, ChartLine, Clock10, Eye, EyeOff, Filter, Receipt, RefreshCcw, Search } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { fetchOvertimeSummary } from '../../services/overtimeService'
import { abbreviateSector } from '../../utils/abbreviateSector'
import SectorTick from '../../components/SectorTick'
import { createRotatedLabelRenderer } from '../../components/RotatedValueLabel'
import type { OvertimeSummaryRow } from '../../models/overtime'

interface OperationsTimePanelProps {
  supabaseUrl?: string
  supabaseKey?: string
}

const formatDateDayMonth = (value?: string | null) => {
  if (!value) return '-'
  const parts = value.split('-')
  if (parts.length === 3) {
    const [, month, day] = parts
    return `${day}/${month}`
  }
  return value
}

const formatCompanyLabel = (value: number | string | null) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (num === 4) return '4 - Frigosul'
  if (num === 5) return '5 - Pantaneira'
  return String(value)
}

const parseIntervalMinutes = (value?: string | null) => {
  if (!value) return 0
  const parts = value.split(':')
  const hours = Number(parts[0])
  const minutes = Number(parts[1] ?? 0)
  const seconds = Number(parts[2] ?? 0)
  if ([hours, minutes, seconds].some((n) => Number.isNaN(n))) return 0
  return hours * 60 + minutes + Math.round(seconds / 60)
}

const formatMinutes = (value: number) => {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const formatDateRangeForRow = (start?: string, end?: string) => {
  if (!start && !end) return '-'
  const parse = (v: string) => v.split('-')
  const [, sm, sd] = start ? parse(start) : ['', '', '']
  const [, em, ed] = end ? parse(end) : ['', '', '']
  if (start === end && sd && sm) return `${sd}/${sm}`
  const dayStart = sd || '--'
  const dayEnd = ed || dayStart || '--'
  const month = sm || em || ''
  return `${dayStart}-${dayEnd}/${month}`
}
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value)

type DisplayRow = OvertimeSummaryRow &
  Partial<AggregatedRow> & { isAggregated?: boolean; isCumulativeOnly?: boolean; hours60Minutes?: number; hours100Minutes?: number }

type AggregatedRow = {
  key: string
  company: number | null
  date_: string
  startDate?: string
  endDate?: string
  registration: number
  name: string
  sector: string | null
  salary: number | null
  mins303: number
  mins304: number
  mins505: number
  mins506: number
  mins511: number
  mins512: number
}

const aggregateRows = (rows: OvertimeSummaryRow[], grouping: 'day' | 'month'): AggregatedRow[] => {
  const map = new Map<string, AggregatedRow>()
  rows.forEach((r) => {
    const [year, month] = (r.date_ || '').split('-')
    const monthKey = year && month ? `${year}-${month}` : 'no-month'
    const key =
      grouping === 'month'
        ? `${r.company ?? 'no-company'}|${r.registration ?? 'no-reg'}|${monthKey}`
        : `${r.company ?? 'no-company'}|${r.registration ?? 'no-reg'}|${r.date_ ?? 'no-date'}`
    const current = map.get(key)
    const mins303 = parseIntervalMinutes(r.hrs303)
    const mins304 = parseIntervalMinutes(r.hrs304)
    const mins505 = parseIntervalMinutes(r.hrs505)
    const mins506 = parseIntervalMinutes(r.hrs506)
    const mins511 = parseIntervalMinutes(r.hrs511)
    const mins512 = parseIntervalMinutes(r.hrs512)
    if (current) {
      current.mins303 += mins303
      current.mins304 += mins304
      current.mins505 += mins505
      current.mins506 += mins506
      current.mins511 += mins511
      current.mins512 += mins512
      if (!current.salary && r.salary) current.salary = Number(r.salary)
      if (!current.sector && r.sector) current.sector = r.sector
      // controla range de datas dentro do mês
      const curStart = current.startDate || r.date_
      const curEnd = current.endDate || r.date_
      current.startDate = [curStart, r.date_].filter(Boolean).sort()[0]
      current.endDate = [curEnd, r.date_].filter(Boolean).sort().slice(-1)[0]
    } else {
      map.set(key, {
        key,
        company: r.company ?? null,
        date_: grouping === 'month' ? monthKey : r.date_ ?? '',
        startDate: r.date_ ?? undefined,
        endDate: r.date_ ?? undefined,
        registration: Number(r.registration ?? 0),
        name: r.name,
        sector: r.sector ?? null,
        salary: Number(r.salary ?? 0) || 0,
        mins303,
        mins304,
        mins505,
        mins506,
        mins511,
        mins512,
      })
    }
  })
  return Array.from(map.values())
}

const CHART_COLORS = ['#8b5cf6', '#f97316', '#ef4444', '#f59e0b', '#22c55e', '#0ea5e9']
const BAR_TOOLTIP_STYLE = { backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, color: '#fff' }

type SectorChartDatum = {
  sector: string
  hours60Hours: number
  hours100Hours: number
  hoursTotal: number
  value60: number
  value100: number
  valueTotal: number
  color?: string
  }

const makeBarTooltipHours =
  () =>
  ({ active, payload, label }: TooltipContentProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null
    const entry = payload[0]
    const minutes = Math.round(Number(entry.value ?? 0) * 60)
    const dotColor =
      (entry.payload && (entry.payload as any).color) ||
      (entry.color as string | undefined) ||
      CHART_COLORS[0]
    return (
      <div className="rounded-lg border border-blue-500/60 px-3 py-2 text-xs text-white shadow-lg" style={BAR_TOOLTIP_STYLE}>
        <div className="font-semibold mb-1 text-center">{label ?? ''}</div>
        <div className="flex items-center gap-2 justify-center text-center">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
          <span className="text-sky-200">{minutes > 0 ? formatMinutes(minutes) : '-'}</span>
        </div>
      </div>
    )
  }

const makeBarTooltipValues =
  () =>
  ({ active, payload, label }: TooltipContentProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null
    const entry = payload[0]
    const dotColor =
      (entry.payload && (entry.payload as any).color) ||
      (entry.color as string | undefined) ||
      CHART_COLORS[0]
    const value = Number(entry.value ?? 0)
    return (
      <div className="rounded-lg border border-emerald-400/60 px-3 py-2 text-xs text-white shadow-lg" style={BAR_TOOLTIP_STYLE}>
        <div className="font-semibold mb-1 text-center">{label ?? ''}</div>
        <div className="flex items-center gap-2 justify-center text-center">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
          <span className="text-emerald-200">{value > 0 ? formatCurrency(value) : '-'}</span>
        </div>
      </div>
    )
  }

const OperationsTimePanel: React.FC<OperationsTimePanelProps> = ({ supabaseUrl, supabaseKey }) => {
  const resolvedSupabaseUrl = supabaseUrl ?? (import.meta as any).env?.VITE_SUPABASE_URL
  const resolvedSupabaseKey = supabaseKey ?? (import.meta as any).env?.VITE_SUPABASE_KEY
  const [sort, setSort] = useState<{ key: 'date' | 'registration' | 'name' | 'sector' | 'hrs303' | 'hrs304' | 'hrs505' | 'hrs506' | 'hrs511' | 'hrs512' | 'hrs60' | 'hrs100'; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  })
  const [filterCompany, setFilterCompany] = useState<string>('')
  const [filterSector, setFilterSector] = useState<string>('')
  const [filterYear, setFilterYear] = useState<string>('')
  const [filterMonth, setFilterMonth] = useState<string>('')
  const [filterDay, setFilterDay] = useState<string>('')
  const [filterText, setFilterText] = useState<string>('')
  const [pendingFilterText, setPendingFilterText] = useState<string>('') // usado para digitação sem aplicar imediatamente
  const [rows, setRows] = useState<OvertimeSummaryRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sectorOptions, setSectorOptions] = useState<string[]>([])
  const [dayOptions, setDayOptions] = useState<string[]>([])
  const [dayTouched, setDayTouched] = useState(false)
  const [isTableVisible, setIsTableVisible] = useState(false)
  const [hoverHours60, setHoverHours60] = useState<number | null>(null)
  const [hoverHours100, setHoverHours100] = useState<number | null>(null)
  const [hoverValue60, setHoverValue60] = useState<number | null>(null)
  const [hoverValue100, setHoverValue100] = useState<number | null>(null)
  const hasTextFilter = useMemo(() => pendingFilterText.trim().length > 0 || filterText.trim().length > 0, [pendingFilterText, filterText])

  useEffect(() => {
    let active = true
    const loadData = async () => {
      if (!resolvedSupabaseUrl || !resolvedSupabaseKey) {
        setError('Configure VITE_SUPABASE_URL e VITE_SUPABASE_KEY para carregar as horas extras.')
        setRows([])
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchOvertimeSummary(
          {
            // carregamos tudo e filtramos no cliente para manter as opções sempre populadas
          },
          resolvedSupabaseUrl,
          resolvedSupabaseKey
        )
        if (!active) return
        if (result.ok) {
          setRows(result.rows)
        } else {
          setRows([])
          setError(result.error || 'Erro ao carregar horas extras.')
        }
      } catch (err) {
        if (active) {
          setRows([])
          setError(err instanceof Error ? err.message : 'Erro ao carregar horas extras.')
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }
    loadData()
    return () => {
      active = false
    }
  }, [resolvedSupabaseKey, resolvedSupabaseUrl])

  const companyOptions = useMemo(() => {
    const values = new Set<string>()
    rows.forEach((r) => {
      if (r.company !== null && r.company !== undefined) values.add(String(r.company))
    })
    return Array.from(values).sort((a, b) => Number(a) - Number(b))
  }, [rows])

  const yearOptions = useMemo(() => {
    const values = new Set<string>()
    rows.forEach((r) => {
      const year = r.date_?.split('-')[0]
      if (year) values.add(year)
    })
    return Array.from(values).sort()
  }, [rows])

  const monthOptions = useMemo(() => {
    const values = new Set<string>()
    rows.forEach((r) => {
      const parts = r.date_?.split('-') || []
      const year = parts[0]
      const month = parts.length === 3 ? parts[1] : ''
      if (month && (!filterYear || year === filterYear)) values.add(month)
    })
    return Array.from(values).sort()
  }, [rows, filterYear])

  useEffect(() => {
    if (rows.length === 0) {
      if (dayOptions.length) setDayOptions([])
      return
    }
    const days = new Set<string>()
    rows.forEach((r) => {
      const parts = r.date_?.split('-') || []
      if (parts.length === 3) {
        const [year, month, day] = parts
        if (filterYear && year !== filterYear) return
        if (filterMonth && month !== filterMonth) return
        days.add(day)
      }
    })
    const merged = Array.from(days).sort()
    if (merged.length !== dayOptions.length || merged.some((d, i) => d !== dayOptions[i])) {
      setDayOptions(merged)
    }
  }, [rows, dayOptions, filterYear, filterMonth])

  useEffect(() => {
    if (rows.length === 0) {
      if (sectorOptions.length) setSectorOptions([])
      return
    }
    const sectors = new Set<string>()
    rows.forEach((r) => {
      if (r.sector) sectors.add(r.sector)
    })
    const merged = Array.from(sectors).sort()
    if (merged.length !== sectorOptions.length) {
      setSectorOptions(merged)
    }
  }, [rows, sectorOptions])

  useEffect(() => {
    if (filterDay && !dayOptions.includes(filterDay)) {
      setFilterDay('')
    }
  }, [filterDay, dayOptions])

  useEffect(() => {
    if (!filterYear && yearOptions.length > 0) {
      setFilterYear(yearOptions[yearOptions.length - 1])
    }
  }, [filterYear, yearOptions])

  useEffect(() => {
    if (!filterYear) return
    const monthsForYear = rows
      .filter((r) => r.date_?.startsWith(`${filterYear}-`))
      .map((r) => r.date_!.split('-')[1])
    if (monthsForYear.length === 0) return
    const uniqueMonths = Array.from(new Set(monthsForYear)).sort()
    const lastMonth = uniqueMonths[uniqueMonths.length - 1]
    if (!filterMonth || !uniqueMonths.includes(filterMonth)) {
      setFilterMonth(lastMonth)
    }
  }, [filterYear, filterMonth, rows])

  useEffect(() => {
    // ao trocar ano ou mês, deixamos o dia ser recalculado
    setDayTouched(false)
    setFilterDay('')
  }, [filterYear, filterMonth])

  useEffect(() => {
    if (dayTouched) return
    if (!filterDay && dayOptions.length > 0) {
      setFilterDay(dayOptions[dayOptions.length - 1])
    }
  }, [filterDay, dayOptions, dayTouched])

  const filteredRows = useMemo(() => {
    const term = filterText.trim().toLowerCase()
    const sector = filterSector.trim()
    const company = filterCompany.trim()
    const year = filterYear.trim()
    const month = filterMonth.trim()
    return rows.filter((r) => {
      if (company && String(r.company ?? '') !== company) return false
      if (year && !r.date_?.startsWith(`${year}-`)) return false
      if (month && !r.date_?.startsWith(`${year || r.date_?.split('-')[0]}-${month}`)) return false
      if (sector && r.sector !== sector) return false
      if (!term) return true
      const reg = String(r.registration ?? '').toLowerCase()
      const name = String(r.name ?? '').toLowerCase()
      return reg.includes(term) || name.includes(term)
    })
  }, [filterText, rows, filterSector, filterCompany, filterYear, filterMonth])
  const visibleRows = useMemo(() => {
    if (!filterDay) return filteredRows
    const dayNumber = Number(filterDay)
    return filteredRows.filter((r) => {
      const parts = r.date_?.split('-') || []
      const d = parts.length === 3 ? Number(parts[2]) : NaN
      if (Number.isNaN(d)) return false
      return d === dayNumber
    })
  }, [filteredRows, filterDay])
  // Conjunto para totais/agrupamentos de Hr 60% e Hr 100%
  // - Sem dia: usa todos filtrados (agrupamento mensal)
  // - Com dia: usa 1..dia selecionado apenas para as matrículas visíveis no dia (cumulativo por matrícula)
  const rowsForTotalsSource = useMemo(() => {
    if (!filterDay) return filteredRows
    const dayNumber = Number(filterDay)
    return filteredRows.filter((r) => {
      const parts = r.date_?.split('-') || []
      const d = parts.length === 3 ? Number(parts[2]) : NaN
      if (Number.isNaN(d)) return false
      return d <= dayNumber
    })
  }, [filteredRows, filterDay])

  const rowsForTotals = rowsForTotalsSource
  const allowNegative60 = filterText.trim().length > 0
  // Para Hr 60%/100% sempre agregamos por mês (por matrícula/empresa) e somamos apenas as datas <= dia selecionado.
  const aggregationModeTotals: 'month' = 'month'
  const aggregatedRowsForTotals = useMemo(() => aggregateRows(rowsForTotals, aggregationModeTotals), [rowsForTotals, aggregationModeTotals])

  const cumulativeByRegistration = useMemo(() => {
    if (!filterDay) return null
    const acc = new Map<string, { hrs60: number; hrs100: number }>()
    aggregatedRowsForTotals.forEach((r) => {
      const reg = r.registration ? String(r.registration) : ''
      if (!reg) return
      const val60 = Math.max(r.mins505 + r.mins506 - r.mins511 - r.mins512, 0)
      const val100 = Math.max(r.mins303 + r.mins304, 0)
      acc.set(reg, { hrs60: val60, hrs100: val100 })
    })
    return acc
  }, [filterDay, aggregatedRowsForTotals])

  // Hrs 60%: (505 + 506) - (511 + 512) — total ignora valores negativos
  const totalHrs60 = aggregatedRowsForTotals.reduce((acc, r) => {
    const val = r.mins505 + r.mins506 - r.mins511 - r.mins512
    return acc + (allowNegative60 ? val : Math.max(val, 0))
  }, 0)
  // Hrs 100%: (303 + 304) — agora sobre linhas únicas (similar ao UNIQUE do Excel)
  const totalHrs100 = aggregatedRowsForTotals.reduce((acc, r) => acc + r.mins303 + r.mins304, 0)

  const { totalValue60, totalValue100 } = useMemo(() => {
    let value60 = 0
    let value100 = 0
    aggregatedRowsForTotals.forEach((r) => {
      const salary = Number(r.salary ?? 0)
      if (!salary) return
      const hourly = Math.round(((salary + 303.60) / 220) * 100) / 100 // hora-base arredondada em 2 casas - ADICIONEI 303.60 NO SALARY POIS TODOS FUNCIONARIOS TEM ESSE VALOR ADICIONADO
      const mins60Raw = r.mins505 + r.mins506 - r.mins511 - r.mins512
      const mins60 = allowNegative60 ? mins60Raw : Math.max(mins60Raw, 0)
      const mins100 = r.mins303 + r.mins304
      value60 += Math.round(((mins60 / 60) * hourly * 1.6) * 100) / 100
      value100 += Math.round(((mins100 / 60) * hourly * 2) * 100) / 100
    })
    return { totalValue60: value60, totalValue100: value100 }
  }, [aggregatedRowsForTotals, allowNegative60])

  const displayTotalValue60 = hasTextFilter && totalHrs60 <= 0 ? '-' : formatCurrency(totalValue60)
  const displayTotalValue100 = hasTextFilter && totalHrs100 <= 0 ? '-' : formatCurrency(totalValue100)

  const aggregationMode: 'month' = 'month'
  const aggregatedVisibleRows = useMemo(() => aggregateRows(visibleRows, aggregationMode), [visibleRows, aggregationMode])
  const aggregatedVisibleDisplayRows = useMemo<DisplayRow[]>(
    () =>
      aggregatedVisibleRows.map((r) => ({
        company: r.company,
        date_: r.date_,
        registration: r.registration,
        name: r.name,
        sector: r.sector,
        salary: r.salary,
        startDate: r.startDate,
        endDate: r.endDate,
        hrs303: formatMinutes(r.mins303),
        hrs304: formatMinutes(r.mins304),
        hrs505: formatMinutes(r.mins505),
        hrs506: formatMinutes(r.mins506),
        hrs511: formatMinutes(r.mins511),
        hrs512: formatMinutes(r.mins512),
        mins303: r.mins303,
        mins304: r.mins304,
        mins505: r.mins505,
        mins506: r.mins506,
        mins511: r.mins511,
        mins512: r.mins512,
        key: r.key,
        isAggregated: true,
      })),
    [aggregatedVisibleRows]
  )

  const latestRowByRegUpToDay = useMemo(() => {
    if (!filterDay) return null
    const dayNumber = Number(filterDay)
    const map = new Map<string, OvertimeSummaryRow>()
    filteredRows.forEach((r) => {
      const parts = r.date_?.split('-') || []
      if (parts.length !== 3) return
      const [year, month, day] = parts
      if (filterYear && year !== filterYear) return
      if (filterMonth && month !== filterMonth) return
      const d = Number(day)
      if (Number.isNaN(d) || d > dayNumber) return
      const reg = r.registration !== null && r.registration !== undefined ? String(r.registration) : ''
      if (!reg) return
      const existing = map.get(reg)
      if (!existing || (r.date_ && existing.date_ && r.date_ > existing.date_)) {
        map.set(reg, r)
      }
    })
    return map
  }, [filterDay, filterMonth, filterYear, filteredRows])

  const displayRows: DisplayRow[] = useMemo(() => {
    // Com filtro de texto ativo (cadastro/nome), exibir sempre as linhas diárias (sem agrupamento extra).
    const hasTextFilter = filterText.trim().length > 0
    if (!filterDay && !hasTextFilter) return aggregatedVisibleDisplayRows
    const baseRows = visibleRows.map((r) => ({
      ...r,
      salary: r.salary ?? null,
      isAggregated: false,
    }))
    if (!filterDay || !cumulativeByRegistration || !latestRowByRegUpToDay) {
      return baseRows
    }
    const extraRows: DisplayRow[] = []
    const existingRegs = new Set(baseRows.map((r) => String(r.registration ?? '')))
    cumulativeByRegistration.forEach((totals, reg) => {
      if (existingRegs.has(reg)) return
      const hours60Minutes = Math.max(totals.hrs60, 0)
      const hours100Minutes = Math.max(totals.hrs100, 0)
      if (hours60Minutes <= 0 && hours100Minutes <= 0) return
      const base = latestRowByRegUpToDay.get(reg)
      const company = base?.company ?? null
      const sector = base?.sector ?? null
      const name = base?.name ?? '-'
      const salary = base?.salary ?? null
      extraRows.push({
        company: company ?? null,
        date_: '-',
        registration: Number(reg),
        name,
        sector: sector ?? '-',
        salary: salary ?? null,
        hrs303: '',
        hrs304: '',
        hrs505: '',
        hrs506: '',
        hrs511: '',
        hrs512: '',
        mins303: 0,
        mins304: 0,
        mins505: 0,
        mins506: 0,
        mins511: 0,
        mins512: 0,
        key: `extra-${reg}-${filterDay}`,
        isAggregated: false,
        isCumulativeOnly: true,
        hours60Minutes,
        hours100Minutes,
      })
    })
    return [...baseRows, ...extraRows]
  }, [filterDay, visibleRows, aggregatedVisibleDisplayRows, cumulativeByRegistration, latestRowByRegUpToDay, filterText])

  const getMinutesFromRow = (row: DisplayRow, field: '303' | '304' | '505' | '506' | '511' | '512') => {
    if (row.isAggregated) {
      if (field === '303') return row.mins303 ?? 0
      if (field === '304') return row.mins304 ?? 0
      if (field === '505') return row.mins505 ?? 0
      if (field === '506') return row.mins506 ?? 0
      if (field === '511') return row.mins511 ?? 0
      if (field === '512') return row.mins512 ?? 0
    }
    const map: Record<typeof field, string | null | undefined> = {
      '303': row.hrs303,
      '304': row.hrs304,
      '505': row.hrs505,
      '506': row.hrs506,
      '511': row.hrs511,
      '512': row.hrs512,
    }
    return parseIntervalMinutes(map[field])
  }

  const displayInterval = (row: DisplayRow, field: '303' | '304' | '505' | '506' | '511' | '512') => {
    const minutes = getMinutesFromRow(row, field)
    if (minutes === 0) return ''
    return formatMinutes(minutes)
  }

  const totalRows = displayRows.length

  const sortedRows = useMemo(() => {
    const arr = [...displayRows]
    const { key, direction } = sort
    const dir = direction === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const valA = (() => {
        if (key === 'date') return a.date_ || ''
        if (key === 'registration') return Number(a.registration) || 0
        if (key === 'name') return a.name || ''
        if (key === 'sector') return a.sector || ''
        const hrs60Row = getMinutesFromRow(a, '505') + getMinutesFromRow(a, '506') - getMinutesFromRow(a, '511') - getMinutesFromRow(a, '512')
        const hrs100Row = getMinutesFromRow(a, '303') + getMinutesFromRow(a, '304')
        if (key === 'hrs303') return getMinutesFromRow(a, '303')
        if (key === 'hrs304') return getMinutesFromRow(a, '304')
        if (key === 'hrs505') return getMinutesFromRow(a, '505')
        if (key === 'hrs506') return getMinutesFromRow(a, '506')
        if (key === 'hrs511') return getMinutesFromRow(a, '511')
        if (key === 'hrs512') return getMinutesFromRow(a, '512')
        if (key === 'hrs60') return hrs60Row
        if (key === 'hrs100') return hrs100Row
        return ''
      })()
      const valB = (() => {
        const hrs60Row = getMinutesFromRow(b, '505') + getMinutesFromRow(b, '506') - getMinutesFromRow(b, '511') - getMinutesFromRow(b, '512')
        const hrs100Row = getMinutesFromRow(b, '303') + getMinutesFromRow(b, '304')
        if (key === 'date') return b.date_ || ''
        if (key === 'registration') return Number(b.registration) || 0
        if (key === 'name') return b.name || ''
        if (key === 'sector') return b.sector || ''
        if (key === 'hrs303') return getMinutesFromRow(b, '303')
        if (key === 'hrs304') return getMinutesFromRow(b, '304')
        if (key === 'hrs505') return getMinutesFromRow(b, '505')
        if (key === 'hrs506') return getMinutesFromRow(b, '506')
        if (key === 'hrs511') return getMinutesFromRow(b, '511')
        if (key === 'hrs512') return getMinutesFromRow(b, '512')
        if (key === 'hrs60') return hrs60Row
        if (key === 'hrs100') return hrs100Row
        return ''
      })()

      // Comparação numérica quando aplicável
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir
      }

      // Comparação de datas em YYYY-MM-DD
      if (key === 'date') {
        return String(valA).localeCompare(String(valB)) * dir
      }

      return String(valA).localeCompare(String(valB), 'pt-BR', { sensitivity: 'base' }) * dir
    })
    return arr
  }, [displayRows, sort])

  // Totais base para colunas individuais: usam apenas linhas visíveis (após filtro de dia, se houver)
  const total303 = displayRows.reduce((acc, r) => acc + getMinutesFromRow(r, '303'), 0)
  const total304 = displayRows.reduce((acc, r) => acc + getMinutesFromRow(r, '304'), 0)
  const total505 = displayRows.reduce((acc, r) => acc + getMinutesFromRow(r, '505'), 0)
  const total506 = displayRows.reduce((acc, r) => acc + getMinutesFromRow(r, '506'), 0)
  const total511 = displayRows.reduce((acc, r) => acc + getMinutesFromRow(r, '511'), 0)
  const total512 = displayRows.reduce((acc, r) => acc + getMinutesFromRow(r, '512'), 0)

  // Para Hr 60% / Hr 100%: usamos conjunto do dia selecionado (quando há dia); sem dia, usa todo o mês.
  // Para gráficos usamos o mesmo conjunto dos totais (cumulativo 1..dia quando há dia).
  const rowsForCharts = hasTextFilter && totalHrs60 <= 0 && totalHrs100 <= 0 ? [] : rowsForTotals
  const aggregatedRowsForCharts = useMemo(() => aggregateRows(rowsForCharts, aggregationModeTotals), [rowsForCharts, aggregationModeTotals])

  const sectorChartData: SectorChartDatum[] = useMemo(() => {
    const bySector = new Map<
      string,
      {
        hours60Minutes: number
        hours100Minutes: number
        value60: number
        value100: number
      }
    >()
    aggregatedRowsForCharts.forEach((r) => {
      const sector = r.sector || 'Sem Setor'
      const salary = Number(r.salary ?? 0)
      const hourly = salary ? salary / 220 : 0
      const mins60Raw = r.mins505 + r.mins506 - r.mins511 - r.mins512
      const mins60 = allowNegative60 ? mins60Raw : Math.max(mins60Raw, 0)
      const mins100Raw = r.mins303 + r.mins304
      const mins100 = allowNegative60 ? mins100Raw : Math.max(mins100Raw, 0)
      const value60 = hourly ? (mins60 / 60) * hourly * 1.6 : 0
      const value100 = hourly ? (mins100 / 60) * hourly * 2 : 0
      const prev = bySector.get(sector) || { hours60Minutes: 0, hours100Minutes: 0, value60: 0, value100: 0 }
      bySector.set(sector, {
        hours60Minutes: prev.hours60Minutes + mins60,
        hours100Minutes: prev.hours100Minutes + mins100,
        value60: prev.value60 + value60,
        value100: prev.value100 + value100,
      })
    })
    const arr = Array.from(bySector.entries()).map(([sector, data]) => ({
      sector,
      hours60Hours: data.hours60Minutes / 60,
      hours100Hours: data.hours100Minutes / 60,
      hoursTotal: (data.hours60Minutes + data.hours100Minutes) / 60,
      value60: data.value60,
      value100: data.value100,
      valueTotal: data.value60 + data.value100,
    }))
    return arr.sort((a, b) => b.hoursTotal - a.hoursTotal)
  }, [aggregatedRowsForCharts, allowNegative60])

  const sectorChartHours60 = useMemo(
    () =>
      sectorChartData
        .filter((d) => d.hours60Hours !== 0)
        .sort((a, b) => b.hours60Hours - a.hours60Hours)
        .map((item, idx) => ({ ...item, color: item.color ?? CHART_COLORS[idx % CHART_COLORS.length] })),
    [sectorChartData]
  )
  const sectorChartHours100 = useMemo(
    () =>
      sectorChartData
        .filter((d) => d.hours100Hours !== 0)
        .sort((a, b) => b.hours100Hours - a.hours100Hours)
        .map((item, idx) => ({ ...item, color: item.color ?? CHART_COLORS[idx % CHART_COLORS.length] })),
    [sectorChartData]
  )
  const sectorChartValue60 = useMemo(
    () =>
      sectorChartData
        .filter((d) => d.value60 !== 0)
        .sort((a, b) => b.value60 - a.value60)
        .map((item, idx) => ({ ...item, color: item.color ?? CHART_COLORS[idx % CHART_COLORS.length] })),
    [sectorChartData]
  )
  const sectorChartValue100 = useMemo(
    () =>
      sectorChartData
        .filter((d) => d.value100 !== 0)
        .sort((a, b) => b.value100 - a.value100)
        .map((item, idx) => ({ ...item, color: item.color ?? CHART_COLORS[idx % CHART_COLORS.length] })),
    [sectorChartData]
  )

  const hasHours60Data = sectorChartHours60.length > 0
  const hasHours100Data = sectorChartHours100.length > 0
  const hasValue60Data = sectorChartValue60.length > 0
  const hasValue100Data = sectorChartValue100.length > 0
  const hasAnyHoursChart = hasHours60Data || hasHours100Data
  const hasAnyValueChart = hasValue60Data || hasValue100Data

  const rotatedLabelHours60 = useMemo(
    () =>
      createRotatedLabelRenderer(
        (val) => formatMinutes(Math.round(Number(val || 0) * 60)),
        { color: '#e2e8f0', rotateDeg: -90, offsetY: -8, fontSize: 11, textAnchor: 'start' }
      ),
    []
  )
  const rotatedLabelValue = useMemo(
    () =>
      createRotatedLabelRenderer(
        (val) => formatCurrency(Number(val || 0)),
        { color: '#e2e8f0', rotateDeg: -90, offsetY: -8, fontSize: 11, textAnchor: 'start' }
      ),
    []
  )

  const monthlyChartData = useMemo(() => {
    const byMonth = new Map<
      string,
      {
        hours60: number
        hours100: number
        value60: number
        value100: number
      }
    >()
    aggregatedRowsForCharts.forEach((r) => {
      const [year, month] = (r.date_ || '').split('-')
      if (!year || !month) return
      const key = `${year}-${month}`
      const salary = Number((r as any).salary ?? 0)
      const hourly = salary ? salary / 220 : 0
      const mins60Raw = r.mins505 + r.mins506 - r.mins511 - r.mins512
      const mins60 = allowNegative60 ? mins60Raw : Math.max(mins60Raw, 0)
      const mins100Raw = r.mins303 + r.mins304
      const mins100 = allowNegative60 ? mins100Raw : Math.max(mins100Raw, 0)
      const value60 = hourly ? (mins60 / 60) * hourly * 1.6 : 0
      const value100 = hourly ? (mins100 / 60) * hourly * 2 : 0
      const prev = byMonth.get(key) || { hours60: 0, hours100: 0, value60: 0, value100: 0 }
      byMonth.set(key, {
        hours60: prev.hours60 + mins60,
        hours100: prev.hours100 + mins100,
        value60: prev.value60 + value60,
        value100: prev.value100 + value100,
      })
    })
    const arr = Array.from(byMonth.entries()).map(([key, data]) => {
      const [year, month] = key.split('-')
      return {
        key,
        label: `${month}/${year}`,
        hours60: data.hours60 / 60,
        hours100: data.hours100 / 60,
        value60: data.value60,
        value100: data.value100,
      }
    })
    return arr.sort((a, b) => a.key.localeCompare(b.key))
  }, [aggregatedRowsForCharts, allowNegative60])
  const barTooltipHours = useMemo(() => makeBarTooltipHours(), [])
  const barTooltipValues = useMemo(() => makeBarTooltipValues(), [])

  const companyHeaderLabel = useMemo(() => {
    if (filterCompany) return formatCompanyLabel(filterCompany)
    if (rows.length > 0) return formatCompanyLabel(rows[0].company ?? null)
    return '-'
  }, [filterCompany, rows])

  const rowElements = useMemo(() => {
    if (isLoading) {
      return Array.from({ length: 8 }).map((_, idx) => (
        <tr key={`skeleton-${idx}`} className="animate-pulse">
          {Array.from({ length: 12 }).map((__, jdx) => (
            <td key={jdx} className="px-1 py-2">
              <div className="h-3 bg-white/10 rounded" />
            </td>
          ))}
        </tr>
      ))
    }
    if (sortedRows.length === 0) {
      return (
        <tr>
          <td colSpan={12} className="px-3 py-4 text-center text-white/60">
            Nenhum registro encontrado.
          </td>
        </tr>
      )
    }
    return sortedRows.map((row) => {
      const hrs60Raw = getMinutesFromRow(row, '505') + getMinutesFromRow(row, '506') - getMinutesFromRow(row, '511') - getMinutesFromRow(row, '512')
      const hrs100Raw = getMinutesFromRow(row, '303') + getMinutesFromRow(row, '304')
      const regKey = row.registration ? String(row.registration) : ''
      const cumulative = filterDay && cumulativeByRegistration ? cumulativeByRegistration.get(regKey) : null
      const hrs60 = cumulative ? cumulative.hrs60 : hrs60Raw
      const hrs100 = cumulative ? cumulative.hrs100 : hrs100Raw
      const displayDate = (() => {
        if (row.isAggregated) {
          if (filterDay) {
            const month = row.endDate?.split('-')[1] || row.startDate?.split('-')[1] || row.date_?.split('-')[1] || ''
            return filterDay && month ? `${filterDay.padStart(2, '0')}/${month}` : '-'
          }
          return formatDateRangeForRow(row.startDate, row.endDate)
        }
        return row.isCumulativeOnly ? '-' : formatDateDayMonth(row.date_)
      })()
      return (
        <tr
          key={`${row.company}-${row.registration}-${row.date_}-${(row as any).key ?? ''}`}
          className={`odd:bg-white/5 ${row.isCumulativeOnly ? 'opacity-50' : ''}`}
        >
          <td className="px-1 py-2 text-center">{displayDate}</td>
          <td className="px-1 py-2 text-center">{row.registration}</td>
          <td className="px-1 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
            <span className="block truncate">{row.name}</span>
          </td>
          <td className="px-1 py-2">{row.sector ? abbreviateSector(row.sector) : '-'}</td>
          <td className="px-1 py-2 text-center">{displayInterval(row, '303')}</td>
          <td className="px-1 py-2 text-center">{displayInterval(row, '304')}</td>
          <td className="px-1 py-2 text-center">{displayInterval(row, '505')}</td>
          <td className="px-1 py-2 text-center">{displayInterval(row, '506')}</td>
          <td className="px-1 py-2 text-center">{displayInterval(row, '511')}</td>
          <td className="px-1 py-2 text-center">{displayInterval(row, '512')}</td>
          <td className={`px-1 py-2 text-orange-500 text-xs text-center ${hrs60 <= 0 ? 'text-white/30' : ''}`}>{hrs60 !== 0 ? formatMinutes(hrs60) : '-'}</td>
          <td className={`px-1 py-2 text-rose-500 text-xs text-center ${hrs100 <= 0 ? 'text-white/30' : ''}`}>{hrs100 !== 0 ? formatMinutes(hrs100) : '-'}</td>
        </tr>
      )
    })
  }, [sortedRows, isLoading, rows.length, filterDay, cumulativeByRegistration])

  const handleSort = (key: typeof sort.key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const renderSortIcon = (key: typeof sort.key) => {
    if (sort.key !== key) return null
    const dir = sort.direction
    const isNumeric = key === 'registration' || key === 'date' || key === 'hrs60' || key === 'hrs100'
    const cls = 'inline w-4 h-4 ml-1 text-amber-200'
    if (isNumeric) {
      return dir === 'asc' ? <ArrowDown01 className={cls} /> : <ArrowDown10 className={cls} />
    }
    return dir === 'asc' ? <ArrowDownAZ className={cls} /> : <ArrowDownZA className={cls} />
  }

  const clearTextFilter = () => {
    setFilterText('')
    setPendingFilterText('')
  }

  const applyTextFilter = () => {
    setFilterCompany('')
    setFilterSector('')
    setDayTouched(true)
    setFilterDay('')
    setFilterText(pendingFilterText)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 shadow-inner shadow-black/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-emerald-200 font-semibold">
            <Clock10 className="w-6 h-6 text-amber-300" />
            TIME
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-[0.2em]">
              <Filter className="w-4 h-4 text-emerald-300" />
              Filtros
            </div>
            <select
              className="w-28 bg-white/5 text-emerald-200 text-sm border border-white/15 rounded-md px-3 py-2 outline-none focus:border-emerald-400/70 focus:ring-1 focus:ring-emerald-400/40 transition"
              value={filterCompany}
              onChange={(e) => {
                clearTextFilter()
                setFilterCompany(e.target.value)
              }}
            >
              <option value="">Empresa</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>
                  {formatCompanyLabel(company)}
                </option>
              ))}
            </select>
            <select
              className="w-40 bg-white/5 text-emerald-200 text-sm border border-white/15 rounded-md px-3 py-2 outline-none focus:border-emerald-400/70 focus:ring-1 focus:ring-emerald-400/40 transition"
              value={filterSector}
              onChange={(e) => {
                clearTextFilter()
                setFilterSector(e.target.value)
              }}
            >
              <option value="">Setor</option>
              {sectorOptions.map((sector) => (
                <option key={sector} value={sector}>
                  {abbreviateSector(sector)}
                </option>
              ))}
            </select>
            <select
              className="w-20 bg-white/5 text-emerald-200 text-sm border border-white/15 rounded-md px-3 py-2 outline-none focus:border-emerald-400/70 focus:ring-1 focus:ring-emerald-400/40 transition"
              value={filterYear}
              onChange={(e) => {
                clearTextFilter()
                setFilterYear(e.target.value)
              }}
            >
              <option value="">Ano</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              className="w-16 bg-white/5 text-emerald-200 text-sm border border-white/15 rounded-md px-3 py-2 outline-none focus:border-emerald-400/70 focus:ring-1 focus:ring-emerald-400/40 transition"
              value={filterMonth}
              onChange={(e) => {
                clearTextFilter()
                setFilterMonth(e.target.value)
              }}
            >
              <option value="">Mês</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
            <select
              className="w-16 bg-white/5 text-emerald-200 text-sm border border-white/15 rounded-md px-3 py-2 outline-none focus:border-emerald-400/70 focus:ring-1 focus:ring-emerald-400/40 transition"
              value={filterDay}
              onChange={(e) => {
                clearTextFilter()
                setDayTouched(true)
                setFilterDay(e.target.value)
              }}
            >
              <option value="">Dia</option>
              {dayOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-4 shadow-inner shadow-black/10">
        <div className="flex flex-col gap-2 mb-3">

          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-emerald-100 text-base font-semibold">
                Empresa: <span className="text-emerald-400">{companyHeaderLabel}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-2 py-2 bg-white/5 text-center border border-white/10 rounded-md shadow-inner shadow-black/20 min-w-[90px]">
                  <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">Hr 60%</div>
                  <div className="text-orange-500">{formatMinutes(totalHrs60)}</div>
                </div>
                <div className="px-2 py-2 bg-white/5 text-center border border-white/10 rounded-md shadow-inner shadow-black/20 min-w-[90px]">
                  <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">Hr 100%</div>
                  <div className="text-rose-500">{formatMinutes(totalHrs100)}</div>
                </div>
                <div className="px-2 py-2 bg-white/5 text-center border border-white/10 rounded-md shadow-inner shadow-black/20 min-w-[110px]">
                  <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">R$ 60%</div>
                  <div className="text-orange-500">{displayTotalValue60}</div>
                </div>
                <div className="px-2 py-2 bg-white/5 text-center border border-white/10 rounded-md shadow-inner shadow-black/20 min-w-[110px]">
                  <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">R$ 100%</div>
                  <div className="text-rose-500">{displayTotalValue100}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-50">
                <input
                  type="text"
                  placeholder="Cadastro ou Nome"
                  className="w-full bg-slate-900/70 text-emerald-100 text-sm border border-emerald-400/40 rounded-md pl-3 pr-9 py-2 outline-none focus:border-emerald-300/80 focus:ring-1 focus:ring-emerald-300/60 transition shadow-inner shadow-emerald-500/10"
                  value={pendingFilterText}
                  onChange={(e) => setPendingFilterText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      applyTextFilter()
                    }
                  }}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-200 hover:text-emerald-100"
                  title="Pesquisar Cadastro ou Nome"
                  aria-label="Aplicar filtro"
                  onClick={applyTextFilter}
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
              <button
                type="button"
                className="p-2 rounded-md border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-emerald-400/60 transition"
                disabled={!hasTextFilter}
                title="Limpar filtro de texto"
                onClick={() => {
                  clearTextFilter()
                  setDayTouched(true)
                  setFilterDay('')
                }}
              >
                <RefreshCcw className={`text-amber-300 w-5 h-5 ${!hasTextFilter ? 'opacity-30 cursor-not-allowed' : ''}`} />
              </button>
              <button
                type="button"
                className="p-2 rounded-md border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-emerald-400/60 transition"
                title="Ocultar/mostrar tabela"
                onClick={() => setIsTableVisible((prev) => !prev)}
              >
                {isTableVisible ? <EyeOff className="w-5 h-5 text-rose-400" /> : <Eye className="w-5 h-5 text-emerald-400" />}
              </button>
            </div>
          </div>
        </div>
        {error && (
          <div className="mb-3 rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-amber-200 text-sm">
            {error}
          </div>
        )}
        {isTableVisible ? (
          <div className="border border-emerald-400/40 rounded-lg bg-slate-900/60 shadow-lg shadow-emerald-500/10 h-[520px] overflow-hidden relative flex flex-col">
            <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable both-edges' }}>
              <table className={`w-full text-[11px] text-white/80 border-collapse table-fixed ${rows.length > 0 ? 'min-h-full' : ''}`}>
                <colgroup>
                  <col className="w-[9%]" />
                  <col className="w-[5%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="bg-green-800 text-[11px] uppercase tracking-[0.2em] text-white/70 sticky top-0 z-10 backdrop-blur">
                  <tr>
                    <th className="py-2 text-center">
                      <button type="button" className="w-full text-left flex items-center justify-center" onClick={() => handleSort('date')}>
                        DT {renderSortIcon('date')}
                      </button>
                    </th>
                    <th className="py-2 text-center">
                      <button type="button" className="w-full text-left flex items-center justify-center" onClick={() => handleSort('registration')}>
                        Cad {renderSortIcon('registration')}
                      </button>
                    </th>
                    <th className="py-2 text-left">
                      <button type="button" className="w-full text-left flex items-center" onClick={() => handleSort('name')}>
                        Nome {renderSortIcon('name')}
                      </button>
                    </th>
                    <th className="py-2 text-left">
                      <button type="button" className="w-full text-left flex items-center" onClick={() => handleSort('sector')}>
                        Setor {renderSortIcon('sector')}
                      </button>
                    </th>
                    <th className="py-2 text-center">
                      <button type="button" className="w-full text-center flex items-center justify-center" onClick={() => handleSort('hrs303')}>
                        303 {renderSortIcon('hrs303')}
                      </button>
                    </th>
                    <th className="py-2 text-center">
                      <button type="button" className="w-full text-center flex items-center justify-center" onClick={() => handleSort('hrs304')}>
                        304 {renderSortIcon('hrs304')}
                      </button>
                    </th>
                    <th className="py-2 text-center">
                      <button type="button" className="w-full text-center flex items-center justify-center" onClick={() => handleSort('hrs505')}>
                        505 {renderSortIcon('hrs505')}
                      </button>
                    </th>
                    <th className="py-2 text-center">
                      <button type="button" className="w-full text-center flex items-center justify-center" onClick={() => handleSort('hrs506')}>
                        506 {renderSortIcon('hrs506')}
                      </button>
                    </th>
                    <th className="py-2 text-center">
                      <button type="button" className="w-full text-center flex items-center justify-center" onClick={() => handleSort('hrs511')}>
                        511 {renderSortIcon('hrs511')}
                      </button>
                    </th>
                    <th className="py-2 text-center">
                      <button type="button" className="w-full text-center flex items-center justify-center" onClick={() => handleSort('hrs512')}>
                        512 {renderSortIcon('hrs512')}
                      </button>
                    </th>
                    <th className="py-2 text-xs text-center">
                      <button type="button" className="w-full text-orange-500 text-center flex items-center justify-center" onClick={() => handleSort('hrs60')}>
                        Hr 60% {renderSortIcon('hrs60')}
                      </button>
                    </th>
                    <th className="py-2 text-xs text-center">
                      <button type="button" className="w-full text-rose-500 text-center flex items-center justify-center" onClick={() => handleSort('hrs100')}>
                        Hr 100% {renderSortIcon('hrs100')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>{rowElements}</tbody>
              </table>
            </div>
            <div className="bg-green-800 text-[11px] uppercase tracking-[0.2em] text-white/70 backdrop-blur">
              <table className="w-full text-[11px] text-white/80 border-collapse table-fixed">
                <colgroup>
                  <col className="w-[9%]" />
                  <col className="w-[5%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <tbody>
                  <tr>
                    <td className="py-2 text-center">-</td>
                    <td className="py-2 text-center">-</td>
                    <td className="py-2 text-left">Registros:<span className="text-emerald-200 font-semibold">{totalRows}</span></td>
                    <td className="py-2 text-center">-</td>
                    <td className="py-2 text-center text-emerald-200 font-semibold">{formatMinutes(total303)}</td>
                    <td className="py-2 text-center text-emerald-200 font-semibold">{formatMinutes(total304)}</td>
                    <td className="py-2 text-center text-emerald-200 font-semibold">{formatMinutes(total505)}</td>
                    <td className="py-2 text-center text-emerald-200 font-semibold">{formatMinutes(total506)}</td>
                    <td className="py-2 text-center text-emerald-200 font-semibold">{formatMinutes(total511)}</td>
                    <td className="py-2 text-center text-emerald-200 font-semibold">{formatMinutes(total512)}</td>
                    <td className="py-2 text-xs text-center text-orange-500 font-semibold">{formatMinutes(totalHrs60)}</td>
                    <td className="py-2 text-xs text-center text-rose-500 font-semibold">{formatMinutes(totalHrs100)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center text-white/70">
            <EyeOff className="w-10 h-10 mx-auto mb-3 text-rose-400/40" />
            Tabela oculta. Clique no ícone de olho para mostrar.
          </div>
        )}
      </div>

      {/* GRAFICO HORAS POR SETOR */}
      {hasAnyHoursChart && (
        <div className="bg-white-to-b from-slate-900/80 to-slate-900/60 border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/15">
          <div className="flex items-center justify-between text-white/80 text-sm mb-3">
            <div className="flex items-center gap-2">
              <Clock10 className="w-5 h-5 text-emerald-300" />
              Distribuição das Horas por Setor
            </div>
            <div className="flex items-center gap-2 text-base">
              <span className="px-2 py-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 text-orange-500 shadow-inner shadow-emerald-500/20">
                60% Hrs: {formatMinutes(Math.round(sectorChartData.reduce((acc, s) => acc + s.hours60Hours * 60, 0)))}
              </span>
              <span className="px-2 py-1 rounded-md border border-rose-400/40 bg-rose-500/10 text-rose-500 shadow-inner shadow-rose-500/20">
                100% Hrs: {formatMinutes(Math.round(sectorChartData.reduce((acc, s) => acc + s.hours100Hours * 60, 0)))}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            {hasHours60Data && (
              <div className="mt-2 h-[420px] rounded-lg border border-white/10 bg-white/5">
                <p className="text-[11px] text-white/70 px-3 pt-2 font-semibold uppercase tracking-[0.15em]">Horas 60%</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorChartHours60} margin={{ top: 30, right: 15, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis dataKey="sector" tick={<SectorTick />} axisLine={{ stroke: '#475569' }} interval={0} height={100} />
                    <YAxis tick={{ fill: '#cbd5e1', fontSize: 9 }} axisLine={{ stroke: '#475569' }} tickCount={10} />
                    <Tooltip cursor={{ fill: 'transparent' }} content={barTooltipHours} />
                    <Bar dataKey="hours60Hours" fill="#34d5ff" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {sectorChartHours60.map((item, idx) => (
                        <Cell
                          key={`cell-hours60-${idx}`}
                          fill={item.color ?? CHART_COLORS[idx % CHART_COLORS.length]}
                          style={{
                            transform: hoverHours60 === idx ? 'translateY(-6px)' : 'translateY(0)',
                            transition: 'transform 50ms ease',
                          }}
                          onMouseEnter={() => setHoverHours60(idx)}
                          onMouseLeave={() => setHoverHours60(null)}
                        />
                      ))}
                      <LabelList dataKey="hours60Hours" position="top" content={rotatedLabelHours60 as any} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {hasHours100Data && (
              <div className="mt-2 h-[360px] rounded-lg border border-white/10 bg-white/5">
                <p className="text-[11px] text-white/70 px-3 pt-2 font-semibold uppercase tracking-[0.15em]">Horas 100%</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorChartHours100} margin={{ top: 12, right: 16, left: 8, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis dataKey="sector" tick={<SectorTick />} axisLine={{ stroke: '#475569' }} interval={0} height={90} />
                    <YAxis tick={{ fill: '#cbd5e1', fontSize: 9 }} axisLine={{ stroke: '#475569' }} tickCount={10} />
                    <Tooltip cursor={{ fill: 'transparent' }} content={barTooltipHours} />
                    <Bar dataKey="hours100Hours" fill="#f43f5e" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {sectorChartHours100.map((item, idx) => (
                        <Cell
                          key={`cell-hours100-${idx}`}
                          fill={item.color ?? CHART_COLORS[idx % CHART_COLORS.length]}
                          style={{
                            transform: hoverHours100 === idx ? 'translateY(-6px)' : 'translateY(0)',
                            transition: 'transform 150ms ease',
                          }}
                          onMouseEnter={() => setHoverHours100(idx)}
                          onMouseLeave={() => setHoverHours100(null)}
                        />
                      ))}
                      <LabelList dataKey="hours100Hours" position="top" formatter={(v: unknown) => formatMinutes(Math.round(Number(v ?? 0) * 60))} fill="#e2e8f0" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {hasAnyValueChart && (
        <div className="bg-white-to-b from-slate-900/80 to-slate-900/60 border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/15">
          <div className="flex items-center justify-between text-white/80 text-sm mb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-300" />
              Distribuição dos Valores por Setor
            </div>
            <div className="flex items-center gap-2 text-base">
              <span className="px-2 py-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 text-orange-500 shadow-inner shadow-emerald-500/20">
                60% R$: {displayTotalValue60}
              </span>
              <span className="px-2 py-1 rounded-md border border-rose-400/40 bg-rose-500/10 text-rose-500 shadow-inner shadow-rose-500/20">
                100% R$: {displayTotalValue100}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            {hasValue60Data && (
              <div className="mt-2 h-[420px] rounded-lg border border-white/10 bg-white/5">
                <p className="text-[11px] text-white/70 px-3 pt-2 font-semibold uppercase tracking-[0.15em]">Valores 60%</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorChartValue60} margin={{ top: 32, right: 16, left: 8, bottom: 36 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                    <XAxis dataKey="sector" tick={<SectorTick />} axisLine={{ stroke: '#475569' }} interval={0} height={100} />
                    <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                    <Tooltip cursor={{ fill: 'transparent' }} content={barTooltipValues} />
                    <Bar dataKey="value60" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {sectorChartValue60.map((item, idx) => (
                        <Cell
                          key={`cell-val60-${idx}`}
                          fill={item.color ?? CHART_COLORS[idx % CHART_COLORS.length]}
                          style={{
                            transform: hoverValue60 === idx ? 'translateY(-6px)' : 'translateY(0)',
                            transition: 'transform 150ms ease',
                          }}
                          onMouseEnter={() => setHoverValue60(idx)}
                          onMouseLeave={() => setHoverValue60(null)}
                        />
                      ))}
                      <LabelList dataKey="value60" content={rotatedLabelValue as any} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {hasValue100Data && (
              <div className="mt-2 h-[360px] rounded-lg border border-white/10 bg-white/5">
                <p className="text-[11px] text-white/70 px-3 pt-2 font-semibold uppercase tracking-[0.15em]">Valores 100%</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorChartValue100} margin={{ top: 32, right: 16, left: 8, bottom: 36 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                    <XAxis dataKey="sector" tick={<SectorTick />} axisLine={{ stroke: '#475569' }} interval={0} height={100} />
                    <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                    <Tooltip cursor={{ fill: 'transparent' }} content={barTooltipValues} />
                    <Bar dataKey="value100" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {sectorChartValue100.map((item, idx) => (
                        <Cell
                          key={`cell-val100-${idx}`}
                          fill={item.color ?? CHART_COLORS[idx % CHART_COLORS.length]}
                          style={{
                            transform: hoverValue100 === idx ? 'translateY(-6px)' : 'translateY(0)',
                            transition: 'transform 150ms ease',
                          }}
                          onMouseEnter={() => setHoverValue100(idx)}
                          onMouseLeave={() => setHoverValue100(null)}
                        />
                      ))}
                      <LabelList dataKey="value100" position="top" formatter={(v: any) => formatCurrency(Number(v ?? 0))} fill="#e2e8f0" fontSize={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GRAFICO DISTRIBUIÇÃO MENSAL - HORAS E VALORES */}
      {monthlyChartData.length > 0 && (
        <div className="bg-white-to-b border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/10">
          <div className="flex items-center justify-between text-white/70 text-sm mb-2">
            <div className="flex items-center gap-2">
              <ChartLine className="w-5 h-5 text-emerald-300" />
              Distribuição mensal (Horas e Valores)
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-white/60 mb-2">Horas 60% e 100%</p>
              <div className="h-72 rounded-lg border border-white/10 bg-white/5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyChartData} margin={{ top: 20, right: 16, left: 0, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                    <XAxis dataKey="label" tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} interval={0} height={80} />
                    <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                    <Tooltip formatter={(val: any) => formatMinutes(Math.round(Number(val || 0) * 60))} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }} />
                    <Line type="monotone" dataKey="hours60" name="Horas 60%" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false}>
                      <LabelList dataKey="hours60" position="top" formatter={(v: any) => formatMinutes(Math.round(Number(v || 0) * 60))} fill="#e2e8f0" fontSize={10} />
                    </Line>
                    <Line type="monotone" dataKey="hours100" name="Horas 100%" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false}>
                      <LabelList dataKey="hours100" position="top" formatter={(v: any) => formatMinutes(Math.round(Number(v || 0) * 60))} fill="#e2e8f0" fontSize={10} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-white/60 mb-2">Valores 60% e 100%</p>
              <div className="h-72 rounded-lg border border-white/10 bg-white/5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyChartData} margin={{ top: 20, right: 16, left: 0, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                    <XAxis dataKey="label" tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} />
                    <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                    <Tooltip formatter={(val: any) => formatCurrency(Number(val || 0))} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }} />
                    <Line type="monotone" dataKey="value60" name="Valor 60%" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false}>
                      <LabelList dataKey="value60" position="top" formatter={(v: any) => formatCurrency(Number(v || 0))} fill="#e2e8f0" fontSize={10} />
                    </Line>
                    <Line type="monotone" dataKey="value100" name="Valor 100%" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false}>
                      <LabelList dataKey="value100" position="top" formatter={(v: any) => formatCurrency(Number(v || 0))} fill="#e2e8f0" fontSize={10} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default OperationsTimePanel
