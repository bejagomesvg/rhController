import { useEffect, useMemo, useState } from 'react'

const BASE_MONTHLY_HOURS = 220

const buildSupabaseQuery = (
  basePath: string,
  {
    filterText,
    allowedRegistrations,
  }: {
    filterText?: string
    filterCompany?: string
    filterSector?: string
    allowedRegistrations?: number[] | null
  },
) => {
  const url = new URL(basePath)

  if (allowedRegistrations && allowedRegistrations.length > 0) {
    url.searchParams.set('registration', `in.(${allowedRegistrations.join(',')})`)
  }

  if (filterText?.trim()) {
    const needle = filterText.trim()
    if (/^\d+$/.test(needle)) {
      url.searchParams.set('or', `(registration.ilike.${needle}*,name.ilike.*${needle}*)`)
    } else {
      url.searchParams.set('name', `ilike.*${needle}*`)
    }
  }
  return url
}

const intervalToMinutes = (val: string | null | undefined) => {
  if (!val) return 0
  const parts = val.split(':')
  if (parts.length >= 2) {
    const [h, m] = parts
    const hours = Number(h)
    const minutes = Number(m)
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return hours * 60 + minutes
    }
  }
  return 0
}

const minutesToInterval = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export const useOvertimeData = ({
  active,
  supabaseUrl,
  supabaseKey,
  filterText,
  filterYear,
  filterMonth,
  filterStartDay,
  filterCompany,
  filterSector,
}: {
  active: string
  supabaseUrl?: string
  supabaseKey?: string
  filterText: string
  filterYear: string
  filterMonth: string
  filterStartDay: string
  filterCompany: string
  filterSector: string
}) => {
  const [overtimeRows, setOvertimeRows] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthlyRows, setMonthlyRows] = useState<any[]>([])
  const [chartRows, setChartRows] = useState<any[]>([])
  const [salaryByRegistration, setSalaryByRegistration] = useState<Record<string, number>>({})
  const [sectorByRegistration, setSectorByRegistration] = useState<Record<string, string>>({})
  const [totalEmployeesCount, setTotalEmployeesCount] = useState<number>(0)

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return

    const fetchEmployeesCount = async () => {
      try {
        const url = new URL(`${supabaseUrl}/rest/v1/employee`)
        url.searchParams.set('select', 'id')
        url.searchParams.set('status', 'neq.7')

        if (filterCompany) {
          url.searchParams.set('company', `eq.${filterCompany}`)
        }
        if (filterSector) {
          url.searchParams.set('sector', `eq.${filterSector}`)
        }

        const year = filterYear || new Date().getFullYear().toString()
        const month = filterMonth ? filterMonth.padStart(2, '0') : null
        let endDate: string | null = null
        if (month) {
          const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
          endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
        } else if (filterYear) {
          endDate = `${year}-12-31`
        }

        if (endDate) {
          url.searchParams.append('date_hiring', `lte.${endDate}`)
        }

        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: 'count=exact',
            Range: '0-0',
          },
        })

        if (!res.ok) {
          setTotalEmployeesCount(0)
          return
        }

        const contentRange = res.headers.get('content-range')
        const total = contentRange ? Number(contentRange.split('/')[1]) : null
        const safeTotal = typeof total === 'number' && Number.isFinite(total) ? total : 0
        setTotalEmployeesCount(safeTotal)
      } catch {
        setTotalEmployeesCount(0)
      }
    }

    fetchEmployeesCount()
  }, [supabaseUrl, supabaseKey, filterCompany, filterSector, filterYear, filterMonth])

  useEffect(() => {
    if (active !== 'overtime' || !supabaseUrl || !supabaseKey) {
      return
    }

    const fetchOvertime = async () => {
      try {
        setIsLoading(true)
        setError(null)

        let allowedRegistrations: number[] | null = null

        if (filterCompany || filterSector) {
          const empUrl = new URL(`${supabaseUrl}/rest/v1/employee`)
          empUrl.searchParams.set('select', 'registration')
          if (filterCompany) empUrl.searchParams.set('company', `eq.${filterCompany}`)
          if (filterSector) empUrl.searchParams.set('sector', `eq.${filterSector}`)

          const empRes = await fetch(empUrl.toString(), { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } })
          if (empRes.ok) {
            const empData = await empRes.json()
            allowedRegistrations = empData.map((e: any) => e.registration)
            if (allowedRegistrations?.length === 0) {
              setOvertimeRows([])
              setIsLoading(false)
              return
            }
          }
        }

        const url = buildSupabaseQuery(`${supabaseUrl}/rest/v1/overtime`, { filterText, filterCompany, filterSector, allowedRegistrations })
        url.searchParams.set('select', 'id,registration,name,date_,hrs303,hrs304,hrs505,hrs506,hrs511,hrs512')
        url.searchParams.set('order', 'name.asc,date_.desc')

        if (filterYear || filterMonth) {
          const year = filterYear || new Date().getFullYear().toString()
          const month = filterMonth ? filterMonth.padStart(2, '0') : null
          if (month && filterStartDay) {
            const day = filterStartDay.padStart(2, '0')
            url.searchParams.set('date_', `eq.${year}-${month}-${day}`)
          } else if (month) {
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
            url.searchParams.set('date_', `gte.${year}-${month}-01`)
            url.searchParams.append('date_', `lte.${year}-${month}-${String(lastDay).padStart(2, '0')}`)
          } else {
            url.searchParams.set('date_', `gte.${year}-01-01`)
            url.searchParams.append('date_', `lte.${year}-12-31`)
          }
        }

        const res = await fetch(url.toString(), { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } })
        if (!res.ok) throw new Error((await res.text()) || 'Erro ao buscar horas extras')
        const data = (await res.json()) as any[]
        setOvertimeRows(data)

        if (filterYear && filterMonth) {
          const monthUrl = buildSupabaseQuery(`${supabaseUrl}/rest/v1/overtime`, { filterText, filterCompany, filterSector, allowedRegistrations })
          monthUrl.searchParams.set('select', 'id,registration,name,date_,hrs303,hrs304,hrs505,hrs506,hrs511,hrs512')
          monthUrl.searchParams.set('order', 'name.asc,date_.desc')
          const year = filterYear
          const month = filterMonth.padStart(2, '0')
          const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
          monthUrl.searchParams.set('date_', `gte.${year}-${month}-01`)
          monthUrl.searchParams.append('date_', `lte.${year}-${month}-${String(lastDay).padStart(2, '0')}`)
          const monthRes = await fetch(monthUrl.toString(), { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } })
          setMonthlyRows(monthRes.ok ? ((await monthRes.json()) as any[]) : data)

          const base = new Date(parseInt(filterYear), parseInt(filterMonth) - 1, 1)
          const startChart = new Date(base); startChart.setMonth(startChart.getMonth() - 2); startChart.setDate(1)
          const endChart = new Date(base); endChart.setMonth(endChart.getMonth() + 1); endChart.setDate(0)
          const chartUrl = buildSupabaseQuery(`${supabaseUrl}/rest/v1/overtime`, { filterText, filterCompany, filterSector, allowedRegistrations })
          chartUrl.searchParams.set('select', 'id,registration,name,date_,hrs303,hrs304,hrs505,hrs506,hrs511,hrs512')
          chartUrl.searchParams.set('order', 'date_.asc')
          chartUrl.searchParams.set('date_', `gte.${startChart.toISOString().slice(0, 10)}`)
          chartUrl.searchParams.append('date_', `lte.${endChart.toISOString().slice(0, 10)}`)
          const chartRes = await fetch(chartUrl.toString(), { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } })
          setChartRows(chartRes.ok ? ((await chartRes.json()) as any[]) : [])
        } else {
          setMonthlyRows(data)
          setChartRows([])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao buscar horas extras')
      } finally {
        setIsLoading(false)
      }
    }
    fetchOvertime()
  }, [active, supabaseKey, supabaseUrl, filterText, filterYear, filterMonth, filterStartDay, filterCompany, filterSector])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    const registrations = Array.from(new Set(monthlyRows.map((row) => String(row.registration)).filter(Boolean)))
    if (registrations.length === 0) {
      setSalaryByRegistration({})
      return
    }
    const fetchSalaries = async () => {
      try {
        const url = new URL(`${supabaseUrl}/rest/v1/employee`)
        url.searchParams.set('select', 'registration,salary,sector')
        url.searchParams.set('registration', `in.(${registrations.join(',')})`)
        const res = await fetch(url.toString(), { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } })
        if (!res.ok) { setSalaryByRegistration({}); return }
        const data = await res.json()
        const salaryMap: Record<string, number> = {}
        const sectorMap: Record<string, string> = {}
        data.forEach((row: any) => {
          const key = String(row.registration)
          const salary = Number(row.salary)
          if (key) {
            salaryMap[key] = Number.isFinite(salary) ? salary : 0
            if (row.sector) sectorMap[key] = String(row.sector)
          }
        })
        setSalaryByRegistration(salaryMap)
        setSectorByRegistration(sectorMap)
      } catch {
        setSalaryByRegistration({})
        setSectorByRegistration({})
      }
    }
    fetchSalaries()
  }, [monthlyRows, supabaseKey, supabaseUrl])

  const monthlyAccumulated = useMemo(() => {
    const grouped = new Map<string, { registration: string; name: string; total60: number; comp60: number; total100: number }>()
    monthlyRows.forEach((row) => {
      const key = String(row.registration)
      const current = grouped.get(key) ?? { registration: key, name: row.name ?? '-', total60: 0, comp60: 0, total100: 0 }
      current.total60 += intervalToMinutes(row.hrs505) + intervalToMinutes(row.hrs506)
      current.comp60 += intervalToMinutes(row.hrs511) + intervalToMinutes(row.hrs512)
      current.total100 += intervalToMinutes(row.hrs303) + intervalToMinutes(row.hrs304)
      if (row.name) current.name = row.name
      grouped.set(key, current)
    })
    return grouped
  }, [monthlyRows])

  const stats = useMemo(() => {
    let employeesWithHours = 0, sumPayable60 = 0, sum100 = 0
    monthlyAccumulated.forEach((item) => {
      const payable60 = Math.max(item.total60 - item.comp60, 0)
      if (payable60 + item.total100 > 0) employeesWithHours += 1
      sumPayable60 += payable60
      sum100 += item.total100
    })
    return { totalEmployees: totalEmployeesCount, employeesWithHours, sum60: sumPayable60, sum100, totalAll: sumPayable60 + sum100 }
  }, [monthlyAccumulated, totalEmployeesCount])

  const moneyStats = useMemo(() => {
    let totalValue60 = 0, totalValue100 = 0
    monthlyAccumulated.forEach((item) => {
      const salary = salaryByRegistration[item.registration] ?? 0
      const hourlyRate = salary > 0 ? salary / BASE_MONTHLY_HOURS : 0
      totalValue60 += hourlyRate * 1.6 * (Math.max(item.total60 - item.comp60, 0) / 60)
      totalValue100 += hourlyRate * 2 * (Math.max(item.total100, 0) / 60)
    })
    return { totalValue60, totalValue100, totalValueAll: totalValue60 + totalValue100 }
  }, [monthlyAccumulated, salaryByRegistration])

  const sectorData = useMemo(() => {
    const hoursMap = new Map<string, { sector: string; total60: number; total100: number }>()
    const valuesMap = new Map<string, { sector: string; value60: number; value100: number }>()
    monthlyAccumulated.forEach((item) => {
      const sector = sectorByRegistration[item.registration] || 'Sem setor'
      const salary = salaryByRegistration[item.registration] ?? 0
      const hourlyRate = salary > 0 ? salary / BASE_MONTHLY_HOURS : 0
      const payable60 = Math.max(item.total60 - item.comp60, 0)
      const payable100 = Math.max(item.total100, 0)
      
      const currentHours = hoursMap.get(sector) ?? { sector, total60: 0, total100: 0 }
      currentHours.total60 += payable60
      currentHours.total100 += payable100
      hoursMap.set(sector, currentHours)

      const currentValues = valuesMap.get(sector) ?? { sector, value60: 0, value100: 0 }
      currentValues.value60 += hourlyRate * 1.6 * (payable60 / 60)
      currentValues.value100 += hourlyRate * 2 * (payable100 / 60)
      valuesMap.set(sector, currentValues)
    })
    const sectorHours = Array.from(hoursMap.values()).sort((a, b) => a.sector.localeCompare(b.sector))
    const sectorValues = Array.from(valuesMap.values()).sort((a, b) => a.sector.localeCompare(b.sector))
    return {
      sectorHoursChartData: sectorHours.map(s => ({ label: s.sector, total60: s.total60, total100: s.total100 })),
      sectorValuesChartData: sectorValues.map(s => ({ label: s.sector, value60: s.value60, value100: s.value100 })),
    }
  }, [monthlyAccumulated, sectorByRegistration, salaryByRegistration])

  const chartSeries = useMemo(() => {
    const agg = new Map<string, { label: string; total60: number; total100: number }>()
    chartRows.forEach((row) => {
      const match = row.date_?.match(/^(\d{4})-(\d{2})/)
      if (!match) return
      const [, y, m] = match
      const key = `${y}-${m}`
      const existing = agg.get(key) ?? { label: `${m}/${y}`, total60: 0, total100: 0 }
      existing.total60 += intervalToMinutes(row.hrs505) + intervalToMinutes(row.hrs506) - (intervalToMinutes(row.hrs511) + intervalToMinutes(row.hrs512))
      existing.total100 += intervalToMinutes(row.hrs303) + intervalToMinutes(row.hrs304)
      agg.set(key, existing)
    })
    return Array.from(agg.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-3).map(([, val]) => val)
  }, [chartRows])

  const previewRows = useMemo(() => {
    const hasTextFilter = filterText.trim().length > 0

    const buildRow = (row: any) => {
      const key = String(row.registration ?? '')
      const total60 = intervalToMinutes(row.hrs505) + intervalToMinutes(row.hrs506)
      const comp60 = intervalToMinutes(row.hrs511) + intervalToMinutes(row.hrs512)
      const total100 = intervalToMinutes(row.hrs303) + intervalToMinutes(row.hrs304)
      const monthly = monthlyAccumulated.get(key)
      const accum60 = monthly ? monthly.total60 - monthly.comp60 : total60 - comp60
      const accum100 = monthly ? monthly.total100 : total100
      return {
        registration: key,
        name: row.name ?? '-',
        total60,
        comp60,
        total100,
        firstDate: row.date_ ?? null,
        lastDate: row.date_ ?? null,
        accum60,
        accum100,
      }
    }

    if (hasTextFilter) {
      // When filtering by text, return every launch (no agrupamento).
      return overtimeRows.map(buildRow)
    }

    const grouped = new Map<string, { registration: string; name: string; total60: number; comp60: number; total100: number; firstDate: string | null; lastDate: string | null }>()
    overtimeRows.forEach((row) => {
      const key = String(row.registration)
      const current = grouped.get(key) ?? { registration: key, name: row.name ?? '-', total60: 0, comp60: 0, total100: 0, firstDate: row.date_ ?? null, lastDate: row.date_ ?? null }
      current.total60 += intervalToMinutes(row.hrs505) + intervalToMinutes(row.hrs506)
      current.comp60 += intervalToMinutes(row.hrs511) + intervalToMinutes(row.hrs512)
      current.total100 += intervalToMinutes(row.hrs303) + intervalToMinutes(row.hrs304)
      if (row.date_) {
        if (!current.firstDate || row.date_ < current.firstDate) current.firstDate = row.date_
        if (!current.lastDate || row.date_ > current.lastDate) current.lastDate = row.date_
      }
      if (row.name) current.name = row.name
      grouped.set(key, current)
    })

    return Array.from(grouped.values()).map((item) => {
      const monthly = monthlyAccumulated.get(item.registration)
      const accum60 = monthly ? monthly.total60 - monthly.comp60 : item.total60 - item.comp60
      const accum100 = monthly ? monthly.total100 : item.total100
      return { ...item, accum60, accum100 }
    })
  }, [overtimeRows, monthlyAccumulated, filterText])

  return {
    isLoading,
    error,
    stats,
    moneyStats,
    ...sectorData,
    chartSeries,
    previewRows,
    minutesToInterval,
  }
}
