import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDown01, ArrowDown10, ArrowDownAZ, ArrowDownZA, Eye, EyeOff, Filter, RefreshCcw, Search, Settings } from 'lucide-react'
import { fetchOvertimeSummary } from '../../services/overtimeService'
import { abbreviateSector } from '../../utils/abbreviateSector'
import type { OvertimeSummaryRow } from '../../models/overtime'

interface OperationsConfigPanelProps {
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

const formatInterval = (value?: string | null) => {
  if (!value) return ''
  const match = value.match(/^(-?\d+):(\d{2})(?::(\d{2}))?/)
  if (match) {
    const [, hours, minutes] = match
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
  }
  const numeric = Number(value)
  if (!Number.isNaN(numeric)) {
    const totalMinutes = Math.round(numeric * 60)
    const sign = totalMinutes < 0 ? '-' : ''
    const abs = Math.abs(totalMinutes)
    const h = Math.floor(abs / 60)
    const m = abs % 60
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value)

const OperationsConfigPanel: React.FC<OperationsConfigPanelProps> = ({ supabaseUrl, supabaseKey }) => {
  const resolvedSupabaseUrl = supabaseUrl ?? (import.meta as any).env?.VITE_SUPABASE_URL
  const resolvedSupabaseKey = supabaseKey ?? (import.meta as any).env?.VITE_SUPABASE_KEY
  const [sort, setSort] = useState<{ key: 'date' | 'registration' | 'name' | 'sector' | 'hrs303' | 'hrs304' | 'hrs505' | 'hrs506' | 'hrs511' | 'hrs512' | 'hrs60' | 'hrs100'; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
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
            company: filterCompany || undefined,
            sector: filterSector || undefined,
            year: filterYear || undefined,
            month: filterMonth || undefined,
            day: filterDay || undefined,
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
  }, [filterCompany, filterSector, filterYear, filterMonth, filterDay, resolvedSupabaseKey, resolvedSupabaseUrl])

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
    if (!term) return rows
    return rows.filter((r) => {
      const reg = String(r.registration ?? '').toLowerCase()
      const name = String(r.name ?? '').toLowerCase()
      return reg.includes(term) || name.includes(term)
    })
  }, [filterText, rows])
  const visibleRows = useMemo(() => {
    if (!filterDay) return filteredRows
    const day = filterDay.padStart(2, '0')
    return filteredRows.filter((r) => r.date_?.split('-')[2] === day)
  }, [filteredRows, filterDay])
  const totalRows = visibleRows.length

  const sortedRows = useMemo(() => {
    const arr = [...visibleRows]
    const { key, direction } = sort
    const dir = direction === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const valA = (() => {
        if (key === 'date') return a.date_ || ''
        if (key === 'registration') return Number(a.registration) || 0
        if (key === 'name') return a.name || ''
        if (key === 'sector') return a.sector || ''
        const hrs60Row = parseIntervalMinutes(a.hrs505) + parseIntervalMinutes(a.hrs506) - parseIntervalMinutes(a.hrs511) - parseIntervalMinutes(a.hrs512)
        const hrs100Row = parseIntervalMinutes(a.hrs303) + parseIntervalMinutes(a.hrs304)
        if (key === 'hrs303') return parseIntervalMinutes(a.hrs303)
        if (key === 'hrs304') return parseIntervalMinutes(a.hrs304)
        if (key === 'hrs505') return parseIntervalMinutes(a.hrs505)
        if (key === 'hrs506') return parseIntervalMinutes(a.hrs506)
        if (key === 'hrs511') return parseIntervalMinutes(a.hrs511)
        if (key === 'hrs512') return parseIntervalMinutes(a.hrs512)
        if (key === 'hrs60') return hrs60Row
        if (key === 'hrs100') return hrs100Row
        return ''
      })()
      const valB = (() => {
        const hrs60Row = parseIntervalMinutes(b.hrs505) + parseIntervalMinutes(b.hrs506) - parseIntervalMinutes(b.hrs511) - parseIntervalMinutes(b.hrs512)
        const hrs100Row = parseIntervalMinutes(b.hrs303) + parseIntervalMinutes(b.hrs304)
        if (key === 'date') return b.date_ || ''
        if (key === 'registration') return Number(b.registration) || 0
        if (key === 'name') return b.name || ''
        if (key === 'sector') return b.sector || ''
        if (key === 'hrs303') return parseIntervalMinutes(b.hrs303)
        if (key === 'hrs304') return parseIntervalMinutes(b.hrs304)
        if (key === 'hrs505') return parseIntervalMinutes(b.hrs505)
        if (key === 'hrs506') return parseIntervalMinutes(b.hrs506)
        if (key === 'hrs511') return parseIntervalMinutes(b.hrs511)
        if (key === 'hrs512') return parseIntervalMinutes(b.hrs512)
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
  }, [visibleRows, sort])

  // Totais base para colunas individuais: usam apenas linhas visíveis (após filtro de dia, se houver)
  const total303 = visibleRows.reduce((acc, r) => acc + parseIntervalMinutes(r.hrs303), 0)
  const total304 = visibleRows.reduce((acc, r) => acc + parseIntervalMinutes(r.hrs304), 0)
  const total505 = visibleRows.reduce((acc, r) => acc + parseIntervalMinutes(r.hrs505), 0)
  const total506 = visibleRows.reduce((acc, r) => acc + parseIntervalMinutes(r.hrs506), 0)
  const total511 = visibleRows.reduce((acc, r) => acc + parseIntervalMinutes(r.hrs511), 0)
  const total512 = visibleRows.reduce((acc, r) => acc + parseIntervalMinutes(r.hrs512), 0)

  // Para Hr 60% / Hr 100%: se um dia específico foi selecionado, usamos todas as linhas carregadas (cumulativo do dia 1 até o dia escolhido).
  // Caso contrário, usamos apenas as linhas visíveis.
  const rowsForTotals = filterDay ? filteredRows : visibleRows

  // Hrs 60%: (505 + 506) - (511 + 512) — total ignora valores negativos
  const totalHrs60 = rowsForTotals.reduce((acc, r) => {
    const m505 = parseIntervalMinutes(r.hrs505)
    const m506 = parseIntervalMinutes(r.hrs506)
    const m511 = parseIntervalMinutes(r.hrs511)
    const m512 = parseIntervalMinutes(r.hrs512)
    const val = m505 + m506 - m511 - m512
    // Quando o filtro de texto estiver aplicado, somamos com negativos (solicitação do usuário).
    if (filterText.trim()) {
      return acc + val
    }
    return acc + (val > 0 ? val : 0)
  }, 0)
  // Hrs 100%: (303 + 304)
  const totalHrs100 = rowsForTotals.reduce((acc, r) => acc + parseIntervalMinutes(r.hrs303) + parseIntervalMinutes(r.hrs304), 0)

  const { totalValue60, totalValue100 } = useMemo(() => {
    let value60 = 0
    let value100 = 0
    rowsForTotals.forEach((r) => {
      const salary = Number((r as any).salary ?? 0)
      if (!salary) return
      const hourly = salary / 220 // suposição: salário mensal / 220 horas
      const mins60Raw = parseIntervalMinutes(r.hrs505) + parseIntervalMinutes(r.hrs506) - parseIntervalMinutes(r.hrs511) - parseIntervalMinutes(r.hrs512)
      const mins60 = filterText.trim() ? mins60Raw : Math.max(mins60Raw, 0)
      const mins100 = parseIntervalMinutes(r.hrs303) + parseIntervalMinutes(r.hrs304)
      value60 += (mins60 / 60) * hourly * 1.6
      value100 += (mins100 / 60) * hourly * 2
    })
    return { totalValue60: value60, totalValue100: value100 }
  }, [rowsForTotals, filterText])

  const cumulativeByRegistration = useMemo(() => {
    if (!filterDay) return null
    const acc = new Map<string, { hrs60: number; hrs100: number }>()
    filteredRows.forEach((r) => {
      const reg = r.registration ? String(r.registration) : ''
      if (!reg) return
      const val60 = parseIntervalMinutes(r.hrs505) + parseIntervalMinutes(r.hrs506) - parseIntervalMinutes(r.hrs511) - parseIntervalMinutes(r.hrs512)
      const val100 = parseIntervalMinutes(r.hrs303) + parseIntervalMinutes(r.hrs304)
      const prev = acc.get(reg) || { hrs60: 0, hrs100: 0 }
      acc.set(reg, { hrs60: prev.hrs60 + val60, hrs100: prev.hrs100 + val100 })
    })
    return acc
  }, [filterDay, filteredRows])

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
      const hrs60Raw = parseIntervalMinutes(row.hrs505) + parseIntervalMinutes(row.hrs506) - parseIntervalMinutes(row.hrs511) - parseIntervalMinutes(row.hrs512)
      const hrs100Raw = parseIntervalMinutes(row.hrs303) + parseIntervalMinutes(row.hrs304)
      const regKey = row.registration ? String(row.registration) : ''
      const cumulative = filterDay && cumulativeByRegistration ? cumulativeByRegistration.get(regKey) : null
      const hrs60 = cumulative ? cumulative.hrs60 : hrs60Raw
      const hrs100 = cumulative ? cumulative.hrs100 : hrs100Raw
      return (
        <tr key={`${row.company}-${row.registration}-${row.date_}`} className="odd:bg-white/5">
          <td className="px-1 py-2 text-center">{formatDateDayMonth(row.date_)}</td>
          <td className="px-1 py-2 text-center">{row.registration}</td>
          <td className="px-1 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
            <span className="block truncate">{row.name}</span>
          </td>
          <td className="px-1 py-2">{row.sector ? abbreviateSector(row.sector) : '-'}</td>
          <td className="px-1 py-2 text-center">{formatInterval(row.hrs303)}</td>
          <td className="px-1 py-2 text-center">{formatInterval(row.hrs304)}</td>
          <td className="px-1 py-2 text-center">{formatInterval(row.hrs505)}</td>
          <td className="px-1 py-2 text-center">{formatInterval(row.hrs506)}</td>
          <td className="px-1 py-2 text-center">{formatInterval(row.hrs511)}</td>
          <td className="px-1 py-2 text-center">{formatInterval(row.hrs512)}</td>
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
            <Settings className="w-6 h-6 text-amber-300" />
            Configuração de Apuração de Horas Extras
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
                  <div className="text-orange-400 font-semibold">{formatCurrency(totalValue60)}</div>
                </div>
                <div className="px-2 py-2 bg-white/5 text-center border border-white/10 rounded-md shadow-inner shadow-black/20 min-w-[110px]">
                  <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">R$ 100%</div>
                  <div className="text-rose-400 font-semibold">{formatCurrency(totalValue100)}</div>
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
                <col className="w-[5%]" />
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
                <col className="w-[5%]" />
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
    </div>
  )
}

export default OperationsConfigPanel
