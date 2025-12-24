import React, { useEffect, useMemo, useState } from 'react'
import { CalendarX, Factory, FileText, Filter, RefreshCcw, RotateCw, Users } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'

type PayrollMonthlyPanelProps = {
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
}

type PayrollEventRow = {
  registration: number | string | null
  events: number | null
  volue: number | null
  references_: number | null
  competence: string | null
}

const PayrollMonthlyPanel: React.FC<PayrollMonthlyPanelProps> = ({ supabaseKey, supabaseUrl }) => {
  const [closingRows, setClosingRows] = useState<ClosingRow[]>([])
  const [employeeInfo, setEmployeeInfo] = useState<
    Map<string, { sector: string | null; company: number | null; status: number | null; date_hiring: string | null; date_status: string | null }>
  >(new Map())
  const [payrollRows, setPayrollRows] = useState<PayrollEventRow[]>([])
  const [isLoadingPayroll, setIsLoadingPayroll] = useState(false)
  const [companyFilter, setCompanyFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const CHART_COLORS = ['#8b5cf6', '#f97316', '#ef4444', '#f59e0b', '#22c55e', '#0ea5e9']

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

  const normalizeRegistration = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null
    return String(value).trim()
  }

  const abbreviateSector = (sector: string | null): string => {
    if (!sector) return 'Sem setor';
    let abbreviated = sector.toUpperCase();
    abbreviated = abbreviated.replace('ADMINISTRATIVO', 'ADM.');
    abbreviated = abbreviated.replace('ADMINISTRAÇÃO', 'ADM.');
    abbreviated = abbreviated.replace('HIGIENIZAÇÃO', 'HIG.');
    abbreviated = abbreviated.replace('INDUSTRIAL', 'IND.');
    abbreviated = abbreviated.replace('SECUNDÁRIA', 'SEC.');
    abbreviated = abbreviated.replace('ALMOXARIFADO', 'ALMOX.');
    abbreviated = abbreviated.replace('EMBARQUE', 'EMB.');
    abbreviated = abbreviated.replace('BUCHARIA', 'BUCH.');
    abbreviated = abbreviated.replace('TÉCNICO', 'TÉC.');
    abbreviated = abbreviated.replace('INFORMÁTICA', 'INFOR.');
    abbreviated = abbreviated.replace('CONTROLE DE', 'C.');
    abbreviated = abbreviated.replace('SERVIÇOS', 'SERV.');
    abbreviated = abbreviated.replace('GERAIS', 'G.');
    abbreviated = abbreviated.replace('DEP.PESSOAL', 'D. P.');
    abbreviated = abbreviated.replace('PANTANEIRA', '');
    abbreviated = abbreviated.replace('SALA DE', 'S.');
    return abbreviated;
  };

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
        employeeUrl.searchParams.set('select', 'registration,sector,company,status,date_hiring,date_status')
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
        const sectorMap = new Map<string, { sector: string | null; company: number | null; status: number | null; date_hiring: string | null; date_status: string | null }>()
        employeeData.forEach((row) => {
          const regKey = normalizeRegistration(row.registration)
          if (!regKey) return
          sectorMap.set(regKey, {
            sector: row.sector ?? null,
            company: row.company ?? null,
            status: row.status ?? null,
            date_hiring: row.date_hiring ?? null,
            date_status: row.date_status ?? null,
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
    const values = closingRows
      .map((row) => row.company)
      .filter((value): value is number => value !== null && value !== undefined)
    return Array.from(new Set(values)).sort((a, b) => a - b)
  }, [closingRows])

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
    return Array.from(new Set(months)).sort((a, b) => a - b)
  }, [competenceOptions, yearFilter])

  const sectorOptions = useMemo(() => {
    const sectors: string[] = []
    const targetYear = Number(yearFilter)
    const targetMonth = Number(monthFilter)
    closingRows.forEach((row) => {
      if (companyFilter && String(row.company ?? '') !== companyFilter) return
      const parsed = parseYearMonth(row.competence)
      if (yearFilter && (!parsed || parsed.year !== targetYear)) return
      if (monthFilter && (!parsed || parsed.month !== targetMonth)) return
      const regKey = normalizeRegistration(row.registration)
      if (!regKey) return
      const sector = employeeInfo.get(regKey)?.sector
      if (sector) sectors.push(sector)
    })
    return Array.from(new Set(sectors)).sort((a, b) => a.localeCompare(b))
  }, [closingRows, companyFilter, employeeInfo, monthFilter, yearFilter])

  useEffect(() => {
    if (!companyFilter && companyOptions.length > 0) {
      setCompanyFilter(String(companyOptions[0]))
    }
  }, [companyOptions, companyFilter])

  useEffect(() => {
    if (!yearFilter && yearOptions.length > 0) {
      setYearFilter(String(yearOptions[0]))
    }
  }, [yearOptions, yearFilter])

  useEffect(() => {
    if (!monthFilter && monthOptions.length > 0) {
      setMonthFilter(String(monthOptions[0]))
    } else if (monthFilter && monthOptions.length > 0 && !monthOptions.includes(Number(monthFilter))) {
      setMonthFilter(String(monthOptions[0]))
    }
  }, [monthFilter, monthOptions])

  useEffect(() => {
    if (sectorFilter && sectorOptions.length > 0 && !sectorOptions.includes(sectorFilter)) {
      setSectorFilter('')
    }
  }, [sectorFilter, sectorOptions])

  const closingRegistrations = useMemo(() => {
    const regs = new Set<string>()
    const targetYear = Number(yearFilter)
    const targetMonth = Number(monthFilter)
    closingRows.forEach((row) => {
      if (companyFilter && String(row.company ?? '') !== companyFilter) return
      const parsed = parseYearMonth(row.competence)
      if (yearFilter && (!parsed || parsed.year !== targetYear)) return
      if (monthFilter && (!parsed || parsed.month !== targetMonth)) return
      if (sectorFilter) {
        const regKey = normalizeRegistration(row.registration)
        const sector = regKey ? employeeInfo.get(regKey)?.sector ?? null : null
        if (!sector || sector !== sectorFilter) return
      }
      const regKey = normalizeRegistration(row.registration)
      if (!regKey) return
      regs.add(regKey)
    })
    return regs
  }, [closingRows, companyFilter, employeeInfo, monthFilter, sectorFilter, yearFilter])

  const indicatorRegistrations = useMemo(() => {
    const regs = new Set<string>()
    employeeInfo.forEach((info, registration) => {
      if (companyFilter && String(info.company ?? '') !== companyFilter) return
      if (sectorFilter && info.sector !== sectorFilter) return
      regs.add(registration)
    })
    return regs
  }, [companyFilter, employeeInfo, sectorFilter])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    if (!yearFilter || !monthFilter) return
    if (indicatorRegistrations.size === 0) {
      setPayrollRows([])
      return
    }
    const controller = new AbortController()
    const fetchPayroll = async () => {
      setIsLoadingPayroll(true)
      try {
        const competence = `${yearFilter}-${String(monthFilter).padStart(2, '0')}-01`
        const url = new URL(`${supabaseUrl}/rest/v1/payroll`)
        url.searchParams.set('select', 'registration,events,volue,references_,competence')
        url.searchParams.set('competence', `eq.${competence}`)
        const registrations = Array.from(indicatorRegistrations)
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
        setPayrollRows(payrollData)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setPayrollRows([])
        }
      } finally {
        setIsLoadingPayroll(false)
      }
    }
    fetchPayroll()
    return () => controller.abort()
  }, [indicatorRegistrations, supabaseKey, supabaseUrl, yearFilter, monthFilter])

  const filteredPayrollRows = useMemo(() => {
    if (indicatorRegistrations.size === 0) return []
    return payrollRows.filter((row) => {
      const regKey = normalizeRegistration(row.registration)
      return regKey !== null && indicatorRegistrations.has(regKey)
    })
  }, [indicatorRegistrations, payrollRows])

  const payrollIndicators = useMemo(() => {
    const eventGroups: Record<string, number[]> = {
      extras: [36, 40],
      dsr: [65],
      atestadosVolue: [56, 57],
      ajuda: [805],
      faltasRef: [502, 651, 652],
      atestadosRef: [56, 57],
      baseAbsenteismoRef: [3, 5],
    }
    const totals = {
      extras: 0,
      dsr: 0,
      atestadosVolue: 0,
      ajuda: 0,
      faltasRef: 0,
      atestadosRef: 0,
      baseAbsenteismoRef: 0,
    }

    filteredPayrollRows.forEach((row) => {
      if (!row.registration) return
      if (row.events === null || row.events === undefined) return
      const value = row.volue ?? 0
      const reference = row.references_ ?? 0

      if (eventGroups.extras.includes(row.events)) totals.extras += value
      if (eventGroups.dsr.includes(row.events)) totals.dsr += value
      if (eventGroups.atestadosVolue.includes(row.events)) totals.atestadosVolue += value
      if (eventGroups.ajuda.includes(row.events)) totals.ajuda += value

      if (eventGroups.faltasRef.includes(row.events)) totals.faltasRef += reference
      if (eventGroups.atestadosRef.includes(row.events)) totals.atestadosRef += reference
      if (eventGroups.baseAbsenteismoRef.includes(row.events)) totals.baseAbsenteismoRef += reference
    })

    const absenteismoTotalRef = totals.faltasRef + totals.atestadosRef
    const absenteismoPercent =
      totals.baseAbsenteismoRef > 0 ? (absenteismoTotalRef / totals.baseAbsenteismoRef) * 100 : 0

    return { ...totals, absenteismoPercent }
  }, [filteredPayrollRows])

  const formatIndicator = (value: number) => {
    if (value === 0) return '--'
    return value.toLocaleString('pt-BR')
  }

  const formatNumberTwoDecimals = (value: number | string | null | undefined) => {
    const numeric = Number(value ?? 0)
    if (!Number.isFinite(numeric)) return '0,00'
    return numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatPercent = (value: number) => {
    const safe = Number.isFinite(value) ? value : 0
    return `${safe.toFixed(1)}%`
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value)

  const turnoverCounts = useMemo(() => {
    if (!yearFilter || !monthFilter) return { admissions: 0, dismissals: 0 }
    const targetYear = Number(yearFilter)
    const targetMonth = Number(monthFilter)
    let admissions = 0
    let dismissals = 0
    employeeInfo.forEach((info) => {
      if (!info) return
      if (companyFilter && String(info.company ?? '') !== companyFilter) return
      if (sectorFilter && info.sector !== sectorFilter) return
      const hiring = parseYearMonth(info.date_hiring)
      if (hiring && hiring.year === targetYear && hiring.month === targetMonth) {
        admissions += 1
      }
      if (Number(info.status) === 7) {
        const demission = parseYearMonth(info.date_status)
        if (demission && demission.year === targetYear && demission.month === targetMonth) {
          dismissals += 1
        }
      }
    })
    return { admissions, dismissals }
  }, [companyFilter, employeeInfo, monthFilter, sectorFilter, yearFilter])

  const turnoverPercent = useMemo(() => {
    const totalEmployees = closingRegistrations.size
    if (totalEmployees <= 0) return 0
    const totalMovements = turnoverCounts.admissions + turnoverCounts.dismissals
    const averageMovement = totalMovements / 2
    return (averageMovement / totalEmployees) * 100
  }, [closingRegistrations, turnoverCounts])

  const turnoverSectorChartData = useMemo(() => {
    if (!yearFilter || !monthFilter) return []
    const targetYear = Number(yearFilter)
    const targetMonth = Number(monthFilter)
    const sectorMap = new Map<string, { admissions: number; dismissals: number }>()
    employeeInfo.forEach((info) => {
      if (!info) return
      if (companyFilter && String(info.company ?? '') !== companyFilter) return
      if (sectorFilter && info.sector !== sectorFilter) return
      const sector = abbreviateSector(info.sector)
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, { admissions: 0, dismissals: 0 })
      }
      const hiring = parseYearMonth(info.date_hiring)
      if (hiring && hiring.year === targetYear && hiring.month === targetMonth) {
        sectorMap.get(sector)!.admissions += 1
      }
      if (Number(info.status) === 7) {
        const demission = parseYearMonth(info.date_status)
        if (demission && demission.year === targetYear && demission.month === targetMonth) {
          sectorMap.get(sector)!.dismissals += 1
        }
      }
    })
    return Array.from(sectorMap.entries())
      .map(([label, values]) => ({
        label,
        admissions: values.admissions,
        dismissals: values.dismissals,
      }))
      .filter((item) => (item.admissions ?? 0) > 0 || (item.dismissals ?? 0) > 0)
      .sort((a, b) => (b.admissions + b.dismissals) - (a.admissions + a.dismissals))
  }, [companyFilter, employeeInfo, monthFilter, sectorFilter, yearFilter])

  const turnoverSectorPercentChartData = useMemo(() => {
    const sectorEmployeeCounts = new Map<string, number>()
    closingRegistrations.forEach((registration) => {
      const sector = abbreviateSector(employeeInfo.get(registration)?.sector ?? null)
      sectorEmployeeCounts.set(sector, (sectorEmployeeCounts.get(sector) || 0) + 1)
    })

    return turnoverSectorChartData
      .map((item, index) => {
        const employees = sectorEmployeeCounts.get(item.label) ?? 0
        const avgMovement = (item.admissions + item.dismissals) / 2
        const percent = employees > 0 ? (avgMovement / employees) * 100 : 0
        return {
          label: item.label,
          value: percent,
          admissions: item.admissions,
          dismissals: item.dismissals,
          employees,
          color: CHART_COLORS[index % CHART_COLORS.length],
        }
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [closingRegistrations, employeeInfo, turnoverSectorChartData])

  const collaboratorSectorChartData = useMemo(() => {
    const sectorMap = new Map<string, number>()
    closingRegistrations.forEach((registration) => {
      const sector = abbreviateSector(employeeInfo.get(registration)?.sector ?? null)
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + 1)
    })
    return Array.from(sectorMap.entries())
      .map(([label, totalValue], idx) => ({ label, totalValue, color: CHART_COLORS[idx % CHART_COLORS.length] }))
      .sort((a, b) => b.totalValue - a.totalValue)
  }, [closingRegistrations, employeeInfo])

  const salarySectorSummary = useMemo(() => {
    const sectorMap = new Map<string, number>()
    payrollRows.forEach((row) => {
      if (row.events !== 3 && row.events !== 5) return
      const regKey = normalizeRegistration(row.registration)
      if (!regKey) return
      if (!closingRegistrations.has(regKey)) return
      const sector = abbreviateSector(employeeInfo.get(regKey)?.sector ?? null)
      const value = row.volue ?? 0
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + value)
    })
    return Array.from(sectorMap.entries()).map(([label, totalValue]) => ({ label, totalValue }))
  }, [closingRegistrations, employeeInfo, payrollRows])

  const eventsTotalValue = useMemo(
    () => salarySectorSummary.reduce((sum, item) => sum + item.totalValue, 0),
    [salarySectorSummary]
  )

  const salaryChartData = useMemo(() => {
    const total = eventsTotalValue || 1
    const sorted = salarySectorSummary.slice().sort((a, b) => b.totalValue - a.totalValue)
    const top = sorted.slice(0, 11)
    const tail = sorted.slice(11)
    const tailTotal = tail.reduce((sum, item) => sum + item.totalValue, 0)
    const finalList = tailTotal > 0 ? [...top, { label: 'Outros', totalValue: tailTotal }] : top
    return finalList.map((item, idx) => ({
      label: item.label,
      valor: item.totalValue,
      percent: (item.totalValue / total) * 100,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [eventsTotalValue, salarySectorSummary])

  const absenteeismSectorChartData = useMemo(() => {
    const eventGroups = {
      faltasRef: [502, 651, 652],
      atestadosRef: [56, 57],
      baseAbsenteismoRef: [3, 5],
    }

    const sectorMap = new Map<string, { faltasRef: number; atestadosRef: number; baseAbsenteismoRef: number }>()

    payrollRows.forEach((row) => {
      if (row.events === null || row.events === undefined) return

      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !closingRegistrations.has(regKey)) return

      const sector = abbreviateSector(employeeInfo.get(regKey)?.sector ?? null)
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, { faltasRef: 0, atestadosRef: 0, baseAbsenteismoRef: 0 })
      }

      const sectorData = sectorMap.get(sector)!
      const reference = row.references_ ?? 0

      if (eventGroups.faltasRef.includes(row.events)) {
        sectorData.faltasRef += reference
      }
      if (eventGroups.atestadosRef.includes(row.events)) {
        sectorData.atestadosRef += reference
      }
      if (eventGroups.baseAbsenteismoRef.includes(row.events)) {
        sectorData.baseAbsenteismoRef += reference
      }
    })

    return Array.from(sectorMap.entries())
      .map(([label, values]) => {
        const absenteismoTotalRef = values.faltasRef + values.atestadosRef
        const value = values.baseAbsenteismoRef > 0 ? (absenteismoTotalRef / values.baseAbsenteismoRef) * 100 : 0
        return {
          label,
          value,
          faltas: values.faltasRef,
          atestados: values.atestadosRef,
          base: values.baseAbsenteismoRef,
        }
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
  }, [payrollRows, employeeInfo, closingRegistrations])

  const countTooltip = ({ active, payload }: TooltipContentProps<any, any>) => {
    if (!active || !payload || payload.length === 0) return null
    const data = payload[0]?.payload as { label?: string; totalValue?: number; color: string } | undefined
    if (!data?.totalValue) return null
    return (
      <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg text-center">
        <div className="font-semibold flex items-center justify-center gap-2">{data?.label}</div>
        <div className="mt-1 text-purple-300 flex items-center justify-center gap-2">
          <span style={{ backgroundColor: data.color }} className="h-2 w-2 rounded-full" />
          <span>{Number(data?.totalValue ?? 0).toLocaleString('pt-BR')}</span>
        </div>
      </div>
    )
  }

  const turnoverTooltip = ({ active, payload, label }: TooltipContentProps<any, any>) => {
    if (active && payload && payload.length) {
      const filteredPayload = payload.filter((pld) => pld.value && (pld.value as number) > 0)
      if (filteredPayload.length === 0) {
        return null
      }
      return (
        <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg">
          <p className="font-semibold text-center mb-2">{label}</p>
          <div className="space-y-1">
            {filteredPayload.map((pld) => (
              <div key={pld.dataKey as string} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span style={{ backgroundColor: pld.color }} className="h-2 w-2 rounded-full" />
                  <span className="text-white/80">{pld.name}:</span>
                </div>
                <span className="font-semibold" style={{ color: pld.color }}>
                  {pld.value as number}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  const percentTooltip = ({ active, payload, label }: TooltipContentProps<any, any>) => {
    if (active && payload && payload.length) {
      const value = payload[0].value as number
      if (!value) return null
      const color = (payload[0].payload as { color?: string } | undefined)?.color || (payload[0].color as string | undefined)
      return (
        <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg text-center">
          <div className="font-semibold">{label}</div>
          <div className="mt-1 text-purple-300 flex items-center justify-center gap-2">
            {color ? <span style={{ backgroundColor: color }} className="h-2 w-2 rounded-full" /> : null}
            <span>{`${value.toFixed(2)}%`}</span>
          </div>
        </div>
      )
    }
    return null
  }

  const turnoverPercentTooltip = ({ active, payload, label }: TooltipContentProps<any, any>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as {
        value?: number
        color?: string
        admissions?: number
        dismissals?: number
        employees?: number
      }
      const value = Number(data?.value ?? 0)
      if (!value) return null
      return (
        <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg">
          <div className="font-semibold text-center mb-2">{label}</div>
          <div className="flex items-center justify-center gap-2 text-purple-300">
            {data?.color ? <span style={{ backgroundColor: data.color }} className="h-2 w-2 rounded-full" /> : null}
            <span>{`${value.toFixed(1)}%`}</span>
          </div>
          <div className="mt-2 space-y-1 text-white/80">
            <div className="flex justify-between gap-4">
              <span>Admissao</span>
              <span className="text-emerald-300 font-semibold">
                {(data?.admissions ?? 0).toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Demissao</span>
              <span className="text-rose-300 font-semibold">
                {(data?.dismissals ?? 0).toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Colaboradores</span>
              <span className="text-white font-semibold">
                {(data?.employees ?? 0).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  const absenteeismTooltip = ({ active, payload, label }: TooltipContentProps<any, any>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as {
        value?: number
        color?: string
        faltas?: number
        atestados?: number
        base?: number
      }
      const value = Number(data?.value ?? 0)
      if (!value) return null
      return (
        <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg">
          <div className="font-semibold text-center mb-2">{label}</div>
          <div className="flex items-center justify-center gap-2 text-purple-300">
            {data?.color ? <span style={{ backgroundColor: data.color }} className="h-2 w-2 rounded-full" /> : null}
            <span>{`${value.toFixed(2)}%`}</span>
          </div>
          <div className="mt-2 space-y-1 text-white/80">
            <div className="flex justify-between gap-4">
              <span>Faltas</span>
              <span className="text-emerald-300 font-semibold">{formatNumberTwoDecimals(data?.faltas)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Atestados</span>
              <span className="text-amber-300 font-semibold">{formatNumberTwoDecimals(data?.atestados)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Base</span>
              <span className="text-white font-semibold">{formatNumberTwoDecimals(data?.base)}</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  const formatLabelNumber = (value: unknown) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric.toLocaleString('pt-BR') : ''
  }

  const formatPositiveLabelNumber = (value: unknown) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric.toLocaleString('pt-BR') : ''
  }

  const handleClearFilters = () => {
    setCompanyFilter(companyOptions.length ? String(companyOptions[0]) : '')
    setYearFilter(yearOptions.length ? String(yearOptions[0]) : '')
    setMonthFilter(monthOptions.length ? String(monthOptions[0]) : '')
    setSectorFilter('')
  }

  const formatCompanyLabel = (value: number) => {
    if (value === 4) return 'Frigosul'
    if (value === 5) return 'Pantaneira'
    return String(value)
  }

  return (
    <div className="space-y-4">
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 shadow-inner shadow-black/10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-emerald-200 font-semibold">
          <FileText className="w-6 h-6 text-amber-300" />
          FOLHA MENSAL
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
      <div className="bg-gradient-to-br from-violet-300/25 via-violet-500/20 to-slate-900/45 border border-violet-300/30 rounded-xl p-4 shadow-lg">
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Colaboradores</p>
            <div className="-mt-1">
              <Users className="w-5 h-5 text-violet-300" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-2xl font-semibold text-violet-200">
              {isLoadingPayroll ? '...' : formatIndicator(closingRegistrations.size)}
            </p>
          </div>
          <div className="h-4" />
        </div>
      </div>
      <div className="bg-gradient-to-br from-orange-300/25 via-orange-500/20 to-slate-900/45 border border-orange-300/30 rounded-xl p-4 shadow-lg">
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Turnover</p>
            <div className="-mt-1">
              <RefreshCcw className="w-5 h-5 text-orange-300" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-2xl font-semibold text-orange-200">
              {isLoadingPayroll ? '...' : formatPercent(turnoverPercent)}
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/70 font-semibold">
            <span>
              ADMISSAO: <span className="text-white">{turnoverCounts.admissions}</span>
            </span>
            <span>
              DEMISSAO: <span className="text-white">{turnoverCounts.dismissals}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="bg-gradient-to-br from-red-300/25 via-red-500/20 to-slate-900/45 border border-red-300/30 rounded-xl p-4 shadow-lg">
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Absenteismo</p>
            <div className="-mt-1">
              <CalendarX className="w-5 h-5 text-red-300" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-2xl font-semibold text-red-200">
              {isLoadingPayroll ? '...' : formatPercent(payrollIndicators.absenteismoPercent)}
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/70 font-semibold">
            <span>
              FALTAS: <span className="text-white">{isLoadingPayroll ? '...' : formatIndicator(payrollIndicators.faltasRef)}</span>
            </span>           
            <span>
              ATESTADOS: <span className="text-white">{isLoadingPayroll ? '...' : formatIndicator(payrollIndicators.atestadosRef)}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="bg-gradient-to-br from-amber-300/25 via-amber-500/20 to-slate-900/45 border border-amber-300/30 rounded-xl p-4 shadow-lg">
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Abate</p>
            <div className="-mt-1">
              <Factory className="w-5 h-5 text-amber-300" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-2xl font-semibold text-amber-200">-</p>
          </div>
          <div className="h-4" />
        </div>
      </div>
    </div>

    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between text-white mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Salario por Setor</p>
          </div>
          <span className="text-emerald-300 text-xs font-semibold">{formatCurrency(eventsTotalValue)}</span>
        </div>
        {salaryChartData.length === 0 ? (
          <div className="mt-4 text-white/70 text-sm">Sem dados por setor.</div>
        ) : (
          <div className="relative mt-4">
            <div
              className={`grid gap-x-6 gap-y-4 relative ${salaryChartData.length <= 6 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}
            >
              {(salaryChartData.length <= 6
                ? [salaryChartData.slice(0, 6)]
                : [salaryChartData.slice(0, 6), salaryChartData.slice(6)]
              ).map((col, colIdx) => (
                <div key={colIdx} className="space-y-3 md:px-2">
                  {col.map((item) => (
                    <div key={item.label} className="relative group space-y-1">
                      <div className="grid grid-cols-[minmax(0,1fr)_80px_auto] items-center text-white text-xs gap-2">
                        <span className="font-semibold truncate pr-2 transition-colors duration-150 group-hover:text-emerald-100">
                          {item.label}
                        </span>
                        <span className="text-white/70 text-center font-semibold transition-colors duration-150 group-hover:text-emerald-200">
                          {item.percent.toFixed(1)}%
                        </span>
                        <span className="text-white font-semibold text-right transition-colors duration-150 group-hover:text-emerald-100">
                          {formatCurrency(item.valor)}
                        </span>
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
                            {item.percent.toFixed(1)}% {formatCurrency(item.valor)}
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
      <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Indicadores rapidos</p>
        <div className="mt-4 space-y-3">
          {[
            { label: 'Horas extras', value: formatIndicator(payrollIndicators.extras) },
            { label: 'DSR', value: formatIndicator(payrollIndicators.dsr) },
            { label: 'Atestados', value: formatIndicator(payrollIndicators.atestadosVolue) },
            { label: 'Ajuda de Custo', value: formatIndicator(payrollIndicators.ajuda) },
            { label: 'Beneficio', value: '--' },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <span className="text-white/70 text-xs">{item.label}</span>
              <span className="text-emerald-300 text-xs font-semibold">
                {isLoadingPayroll ? '...' : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Colaboradores por Setor</p>
        <span className="text-emerald-300 text-xs font-semibold">
          {closingRegistrations.size.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="mt-3 h-64 rounded-lg border border-white/10 bg-white/5 chart-container">
        {collaboratorSectorChartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/50 text-sm">
            Sem dados para exibir.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={collaboratorSectorChartData} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
              <XAxis
                dataKey="label"
                interval={0}
                height={80}
                tick={<SectorTick />}
                axisLine={{ stroke: '#475569' }}
              />
              <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} />
              <RechartsTooltip content={countTooltip} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="totalValue" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                {collaboratorSectorChartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="totalValue"
                  position="top"
                  formatter={formatLabelNumber}
                  fill="#FFFFFF"
                  fontSize={12}
                  isAnimationActive={false}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>

    <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Admissao e Demissao por setor</p>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1 text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Admissao: {turnoverCounts.admissions.toLocaleString('pt-BR')}
          </span>
          <span className="flex items-center gap-1 text-rose-300">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Demissao: {turnoverCounts.dismissals.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>
      <div className="mt-3 h-52 rounded-lg border border-white/10 bg-white/5 chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={turnoverSectorChartData} barGap={0} margin={{ top: 20, right: 16, left: 0, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
            <XAxis
              dataKey="label"
              interval={0}
              height={80}
              tick={<SectorTick />}
              axisLine={{ stroke: '#475569' }}
            />
            <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} />
            <RechartsTooltip content={turnoverTooltip} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="admissions" name="Admissao" fill="#22c55e" radius={[8, 8, 0, 0]} isAnimationActive={false}>
              <LabelList
                dataKey="admissions"
                position="top"
                formatter={formatPositiveLabelNumber}
                fill="#FFFFFF"
                fontSize={12}
                isAnimationActive={false}
              />
            </Bar>
            <Bar dataKey="dismissals" name="Demissao" fill="#f43f5e" radius={[8, 8, 0, 0]} isAnimationActive={false}>
              <LabelList
                dataKey="dismissals"
                position="top"
                formatter={formatPositiveLabelNumber}
                fill="#FFFFFF"
                fontSize={12}
                isAnimationActive={false}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Absenteísmo por Setor</p>
      </div>
      <div className="mt-3 h-64 rounded-lg border border-white/10 bg-white/5 chart-container">
        {isLoadingPayroll ? (
          <div className="h-full flex items-center justify-center text-white/50 text-sm">Carregando...</div>
        ) : absenteeismSectorChartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/50 text-sm">
            Sem dados para exibir.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={absenteeismSectorChartData} margin={{ top: 20, right: 16, left: 0, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
              <XAxis
                dataKey="label"
                interval={0}
                height={80}
                tick={<SectorTick />}
                axisLine={{ stroke: '#475569' }}
              />
              <YAxis
                tickFormatter={(tick) => `${tick.toFixed(0)}%`}
                tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                axisLine={{ stroke: '#475569' }}
              />
              <RechartsTooltip content={absenteeismTooltip} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="value" name="Absenteísmo" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                {absenteeismSectorChartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(value: unknown) => {
                    const numeric = Number(value)
                    if (Number.isFinite(numeric) && numeric > 0) {
                      return `${numeric.toFixed(1)}%`
                    }
                    return ''
                  }}
                  fill="#FFFFFF"
                  fontSize={12}
                  isAnimationActive={false}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>

    <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Turnover por Setor</p>
      </div>
      <div className="mt-3 h-64 rounded-lg border border-white/10 bg-white/5 chart-container">
        {turnoverSectorPercentChartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/50 text-sm">
            Sem dados para exibir.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={turnoverSectorPercentChartData} margin={{ top: 20, right: 16, left: 0, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
              <XAxis
                dataKey="label"
                interval={0}
                height={80}
                tick={<SectorTick />}
                axisLine={{ stroke: '#475569' }}
              />
              <YAxis
                tickFormatter={(tick) => `${tick.toFixed(0)}%`}
                tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                axisLine={{ stroke: '#475569' }}
              />
              <RechartsTooltip content={turnoverPercentTooltip} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="value" name="Turnover" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                {turnoverSectorPercentChartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(value: unknown) => {
                    const numeric = Number(value)
                    if (Number.isFinite(numeric) && numeric > 0) {
                      return `${numeric.toFixed(1)}%`
                    }
                    return ''
                  }}
                  fill="#FFFFFF"
                  fontSize={12}
                  isAnimationActive={false}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  </div>
)

}

export default PayrollMonthlyPanel
