import React, { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarMinus2, CalendarX, Filter, Hospital, Plane, RotateCw, UserCheck, UserX, Users } from 'lucide-react'
import { ACTIVE_BAR_HOVER, ChartTooltip } from '../../components/ChartTooltip'
import { abbreviateSector } from '../../utils/abbreviateSector'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'

type PayrollAbsencesPanelProps = {
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

type StatusRow = {
  id: number | null
  description: string | null
}

const CHART_COLORS = ['#8b5cf6', '#f97316', '#ef4444', '#f59e0b', '#22c55e', '#0ea5e9']

// Hypothetical Absence Event IDs
const ABSENCE_EVENT_IDS = {
  MEDICAL_LEAVE: [56, 57], // Atestados (already in PayrollMonthlyPanel for absenteeism)
  UNJUSTIFIED_ABSENCE: [502, 651, 652], // Faltas (already in PayrollMonthlyPanel for absenteeism)
  VACATION: [700], // Hypothetical
  MATERNITY_LEAVE: [701], // Hypothetical
  PATERNITY_LEAVE: [702], // Hypothetical
}

const WORK_EVENT_IDS = [3, 5] // 3: normal, 5: noturno

const PayrollAbsencesPanel: React.FC<PayrollAbsencesPanelProps> = ({ supabaseKey, supabaseUrl }) => {
  const [closingRows, setClosingRows] = useState<ClosingRow[]>([])
  const [employeeInfo, setEmployeeInfo] = useState<
    Map<string, { sector: string | null; company: number | null; status: number | null; date_hiring: string | null; date_status: string | null }>
  >(new Map())
  const [statusDescriptions, setStatusDescriptions] = useState<Map<number, string>>(new Map())
  const [absenceEventRows, setAbsenceEventRows] = useState<PayrollEventRow[]>([])
  const [isLoadingAbsences, setIsLoadingAbsences] = useState(false)
  const [isLoadingWorkedHours, setIsLoadingWorkedHours] = useState(false)
  const [workedHours, setWorkedHours] = useState({ total: 0, normal: 0, night: 0 })
  const [workedHoursBySector, setWorkedHoursBySector] = useState<{ label: string; totalValue: number; color: string }[]>([])
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

  const normalizeRegistration = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null
    return String(value).trim()
  }

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

  const valueTooltip = ({ active, payload }: TooltipContentProps<any, any>) => {
    if (!active || !payload || payload.length === 0) return null
    const pl = payload[0]
    if (!pl || pl.value === undefined || pl.value === null) return null
    const labelRaw = pl?.payload?.label
    const label = labelRaw === undefined || labelRaw === null ? '' : String(labelRaw)
    const dotColor = (pl as any)?.color ?? (pl?.payload as any)?.color
    return (
      <ChartTooltip
        title={label}
        items={[
          {
            value: Number(pl.value).toLocaleString('pt-BR'),
            color: dotColor,
          },
        ]}
      />
    )
  }

  const headcountTooltip = ({ active, payload, label }: TooltipContentProps<any, any>) => {
    if (!active || !payload || payload.length === 0) return null
    const data = payload[0]?.payload as { total?: number; active?: number } | undefined
    if (!data) return null
    const safeLabel = label === undefined || label === null ? '' : String(label)
    return (
      <ChartTooltip
        title={safeLabel}
        align="start"
        items={[
          {
            label: 'Total',
            value: Number(data.total ?? 0).toLocaleString('pt-BR'),
            color: '#0ea5e9',
            emphasize: true,
          },
          {
            label: 'Ativos',
            value: Number(data.active ?? 0).toLocaleString('pt-BR'),
            color: '#22c55e',
            emphasize: true,
          },
        ]}
      />
    )
  }

  const formatLabelNumber = (value: unknown) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric.toLocaleString('pt-BR') : ''
  }

  const formatIndicator = (value: number) => {
    if (value === 0) return '--'
    return value.toLocaleString('pt-BR')
  }

  const formatPercent = (value: number) => {
    const safe = Number.isFinite(value) ? value : 0
    return `${safe.toFixed(1)}%`
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
          const closingChunkRaw = (await closingRes.json()) as { company: number | null; competence: string | null; registration: number | null }[]
          const closingChunk: ClosingRow[] = closingChunkRaw.map((row) => ({
            competence: row.competence ?? null,
            registration: row.registration ?? null,
            company: row.company ?? null,
          }))
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

    try {
      const statusData: StatusRow[] = []
      const statusUrl = new URL(`${supabaseUrl}/rest/v1/status`)
      statusUrl.searchParams.set('select', 'id,description')
      const statusPageSize = 1000
      let statusStart = 0
      let statusHasMore = true
      while (statusHasMore) {
        const statusRes = await fetch(statusUrl.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Range: `${statusStart}-${statusStart + statusPageSize - 1}`,
          },
          signal: controller.signal,
        })
        if (!statusRes.ok) {
          throw new Error(await statusRes.text())
        }
        const statusChunk = (await statusRes.json()) as StatusRow[]
        statusData.push(...statusChunk)
        if (statusChunk.length < statusPageSize) {
          statusHasMore = false
        } else {
          statusStart += statusPageSize
        }
      }
      const statusMap = new Map<number, string>()
      statusData.forEach((row) => {
        if (row.id === null || row.id === undefined) return
        statusMap.set(row.id, row.description ?? `Status ${row.id}`)
      })
      setStatusDescriptions(statusMap)
    } catch (err) {
      // silencioso
    }
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
    return Array.from(new Set(months)).sort((a, b) => a - b)
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

  const closingRegistrations = useMemo(() => {
    const regs = new Set<string>()
    const targetYear = Number(yearFilter)
    const targetMonth = Number(monthFilter)
    const hasMonthFilter = monthFilter !== ''

    closingRows.forEach((row) => {
      const regKey = normalizeRegistration(row.registration)
      if (!regKey) return
      const info = employeeInfo.get(regKey)
      if (companyFilter && String(info?.company ?? '') !== companyFilter) return
      if (sectorFilter && info?.sector !== sectorFilter) return
      const parsed = parseYearMonth(row.competence)
      if (!parsed) return
      if (yearFilter && parsed.year !== targetYear) return
      if (hasMonthFilter && parsed.month !== targetMonth) return
      regs.add(regKey)
    })

    return regs
  }, [closingRows, companyFilter, employeeInfo, monthFilter, sectorFilter, yearFilter])

  const closingRegistrationsByMonth = useMemo(() => {
    const map = new Map<number, Set<string>>()
    const targetYear = Number(yearFilter)
    closingRows.forEach((row) => {
      const regKey = normalizeRegistration(row.registration)
      if (!regKey) return
      const info = employeeInfo.get(regKey)
      if (companyFilter && String(info?.company ?? row.company ?? '') !== companyFilter) return
      if (sectorFilter && info?.sector !== sectorFilter) return
      const parsed = parseYearMonth(row.competence)
      if (!parsed) return
      if (yearFilter && parsed.year !== targetYear) return
      if (!map.has(parsed.month)) {
        map.set(parsed.month, new Set<string>())
      }
      map.get(parsed.month)!.add(regKey)
    })
    return map
  }, [closingRows, companyFilter, employeeInfo, sectorFilter, yearFilter])

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
    if (filteredRegistrations.size === 0) {
      setAbsenceEventRows([])
      return
    }
    const controller = new AbortController()
    const fetchAbsences = async () => {
      setIsLoadingAbsences(true)
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
          setAbsenceEventRows([])
          return
        }

        const baseUrl = new URL(`${supabaseUrl}/rest/v1/payroll`)
        baseUrl.searchParams.set('select', 'registration,events,volue,references_,competence')
        if (targetCompetences.length === 1) {
          baseUrl.searchParams.set('competence', `eq.${targetCompetences[0]}`)
        } else {
          baseUrl.searchParams.set('competence', `in.(${targetCompetences.join(',')})`)
        }

        const allAbsenceEventIds = Object.values(ABSENCE_EVENT_IDS).flat();
        if (allAbsenceEventIds.length > 0) {
          baseUrl.searchParams.set('events', `in.(${allAbsenceEventIds.join(',')})`);
        }

        const registrations = Array.from(filteredRegistrations)
        const registrationChunks =
          registrations.length > 0 ? Array.from({ length: Math.ceil(registrations.length / 500) }, (_, idx) =>
            registrations.slice(idx * 500, (idx + 1) * 500)
          ) : [[]]

        const payrollData: PayrollEventRow[] = []
        const pageSize = 1000

        for (const regChunk of registrationChunks) {
          const url = new URL(baseUrl.toString())
          if (regChunk.length > 0) {
            url.searchParams.set('registration', `in.(${regChunk.join(',')})`)
          }
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
        }
        setAbsenceEventRows(payrollData)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setAbsenceEventRows([])
        }
      } finally {
        setIsLoadingAbsences(false)
      }
    }
    fetchAbsences()
    return () => controller.abort()
  }, [filteredRegistrations, supabaseKey, supabaseUrl, yearFilter, monthFilter])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    if (!yearFilter) return
    if (filteredRegistrations.size === 0) {
      setWorkedHours({ total: 0, normal: 0, night: 0 })
      setWorkedHoursBySector([])
      return
    }
    const controller = new AbortController()
    const fetchWorkedHours = async () => {
      setIsLoadingWorkedHours(true)
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
          setWorkedHours({ total: 0, normal: 0, night: 0 })
          return
        }

        const baseUrl = new URL(`${supabaseUrl}/rest/v1/payroll`)
        baseUrl.searchParams.set('select', 'registration,events,references_,competence')
        if (targetCompetences.length === 1) {
          baseUrl.searchParams.set('competence', `eq.${targetCompetences[0]}`)
        } else {
          baseUrl.searchParams.set('competence', `in.(${targetCompetences.join(',')})`)
        }
        baseUrl.searchParams.set('events', `in.(${WORK_EVENT_IDS.join(',')})`)

        const registrations = Array.from(filteredRegistrations)
        const registrationChunks =
          registrations.length > 0 ? Array.from({ length: Math.ceil(registrations.length / 500) }, (_, idx) =>
            registrations.slice(idx * 500, (idx + 1) * 500)
          ) : [[]]

        let totalHours = 0
        let normalHours = 0
        let nightHours = 0
        const sectorTotals = new Map<string, number>()
        const monthTotals = new Map<number, number>()

        const pageSize = 1000
        for (const regChunk of registrationChunks) {
          const url = new URL(baseUrl.toString())
          if (regChunk.length > 0) {
            url.searchParams.set('registration', `in.(${regChunk.join(',')})`)
          }
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
            chunk.forEach((row) => {
              const hours = Number(row.references_ ?? 0)
              if (Number.isFinite(hours)) {
                totalHours += hours
                if (row.events === 3) {
                  normalHours += hours
                } else if (row.events === 5) {
                  nightHours += hours
                }
                const regKey = normalizeRegistration(row.registration)
                if (regKey && filteredRegistrations.has(regKey)) {
                  const sector = abbreviateSector(employeeInfo.get(regKey)?.sector ?? null)
                  sectorTotals.set(sector, (sectorTotals.get(sector) || 0) + hours)
                  const parsed = parseYearMonth(row.competence)
                  if (parsed && parsed.year === Number(yearFilter)) {
                    monthTotals.set(parsed.month, (monthTotals.get(parsed.month) || 0) + hours)
                  }
                }
              }
            })
            if (chunk.length < pageSize) {
              hasMore = false
            } else {
              start += pageSize
            }
          }
        }
        setWorkedHours({ total: totalHours, normal: normalHours, night: nightHours })
        const isAllMonths = monthFilter === ''
        const dataArray = isAllMonths
          ? Array.from(monthTotals.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([month, totalValue], idx) => ({
                label: formatMonthLabel(month),
                totalValue,
                color: CHART_COLORS[idx % CHART_COLORS.length],
              }))
          : Array.from(sectorTotals.entries())
              .map(([label, totalValue], idx) => ({
                label,
                totalValue,
                color: CHART_COLORS[idx % CHART_COLORS.length],
              }))
              .sort((a, b) => b.totalValue - a.totalValue)
        setWorkedHoursBySector(dataArray)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setWorkedHours({ total: 0, normal: 0, night: 0 })
          setWorkedHoursBySector([])
        }
      } finally {
        setIsLoadingWorkedHours(false)
      }
    }
    fetchWorkedHours()
    return () => controller.abort()
  }, [competenceOptions, filteredRegistrations, monthFilter, supabaseKey, supabaseUrl, yearFilter])

  const absenceIndicators = useMemo(() => {
    let totalAbsenceDays = 0
    let medicalLeaveDays = 0
    let unjustifiedAbsenceDays = 0
    let vacationDays = 0
    let maternityLeaveDays = 0
    let paternityLeaveDays = 0
    let totalEmployeesWithAbsence = new Set<string>()

    absenceEventRows.forEach((row) => {
      const days = row.references_ ?? 0 // Assuming 'references_' stores days
      if (days > 0) {
        totalAbsenceDays += days
        if (row.registration) {
          totalEmployeesWithAbsence.add(normalizeRegistration(row.registration)!)
        }
      }

      if (ABSENCE_EVENT_IDS.MEDICAL_LEAVE.includes(row.events!)) medicalLeaveDays += days
      if (ABSENCE_EVENT_IDS.UNJUSTIFIED_ABSENCE.includes(row.events!)) unjustifiedAbsenceDays += days
      if (ABSENCE_EVENT_IDS.VACATION.includes(row.events!)) vacationDays += days
      if (ABSENCE_EVENT_IDS.MATERNITY_LEAVE.includes(row.events!)) maternityLeaveDays += days
      if (ABSENCE_EVENT_IDS.PATERNITY_LEAVE.includes(row.events!)) paternityLeaveDays += days
    })

    const totalActiveEmployees = filteredRegistrations.size; // Total employees for the period
    const avgAbsenceDaysPerEmployee = totalActiveEmployees > 0 ? totalAbsenceDays / totalActiveEmployees : 0;
    // Taxa: Horas Ausentes (card 2) / Horas Trabalhadas (card 1)
    const worked = workedHours.total
    const absenceRate = worked > 0 ? (totalAbsenceDays / worked) * 100 : 0

    return {
      totalAbsenceDays,
      medicalLeaveDays,
      unjustifiedAbsenceDays,
      vacationDays,
      maternityLeaveDays,
      paternityLeaveDays,
      avgAbsenceDaysPerEmployee,
      totalEmployeesWithAbsence: totalEmployeesWithAbsence.size,
      absenceRate,
    }
  }, [absenceEventRows, filteredRegistrations, workedHours.total])

  const absenceByEventTotals = useMemo(() => {
    const totals = new Map<number, number>()
    absenceEventRows.forEach((row) => {
      const eventId = Number(row.events)
      const value = Number(row.references_ ?? 0)
      if (!Number.isFinite(eventId) || !Number.isFinite(value)) return
      totals.set(eventId, (totals.get(eventId) ?? 0) + value)
    })
    return totals
  }, [absenceEventRows])

  const absenceByEventCounts = useMemo(() => {
    const counts = new Map<number, number>()
    absenceEventRows.forEach((row) => {
      const eventId = Number(row.events)
      if (!Number.isFinite(eventId)) return
      counts.set(eventId, (counts.get(eventId) ?? 0) + 1)
    })
    return counts
  }, [absenceEventRows])

  const absenceByTypeChartData = useMemo(() => {
    const mapping: { label: string; eventIds: number[] }[] = [
      { label: 'Atestado', eventIds: [56] },
      { label: 'Atest. Noturno', eventIds: [57] },
      { label: 'Suspensão', eventIds: [502] },
      { label: 'Flt Não Injust.', eventIds: [651] },
      { label: 'Faltas Injust.', eventIds: [652] },
    ]

    const data = mapping
      .map((item, idx) => {
        const value = item.eventIds.reduce((sum, id) => sum + (absenceByEventTotals.get(id) ?? 0), 0)
        return { ...item, value, color: CHART_COLORS[idx % CHART_COLORS.length] }
      })
      .filter((item) => item.value > 0)

    const total = data.reduce((sum, item) => sum + item.value, 0)
    return data
      .map((item) => ({
        ...item,
        percent: total > 0 ? (item.value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [absenceByEventTotals])

  const absenceCountsByGroup = useMemo(() => {
    const isAllMonths = monthFilter === ''
    if (isAllMonths) {
      const monthMap = new Map<number, { atestados: number; faltas: number }>()
      absenceEventRows.forEach((row) => {
        const parsed = parseYearMonth(row.competence)
        if (!parsed) return
        if (yearFilter && parsed.year !== Number(yearFilter)) return
        if (!monthMap.has(parsed.month)) {
          monthMap.set(parsed.month, { atestados: 0, faltas: 0 })
        }
        const monthData = monthMap.get(parsed.month)!
        if (ABSENCE_EVENT_IDS.MEDICAL_LEAVE.includes(row.events ?? -1)) {
          monthData.atestados += 1
        }
        if (ABSENCE_EVENT_IDS.UNJUSTIFIED_ABSENCE.includes(row.events ?? -1)) {
          monthData.faltas += 1
        }
      })
      let atestados = 0
      let faltas = 0
      monthMap.forEach((value) => {
        atestados += value.atestados
        faltas += value.faltas
      })
      return { atestados, faltas }
    }

    const atestados = (absenceByEventCounts.get(56) ?? 0) + (absenceByEventCounts.get(57) ?? 0)
    const faltas =
      (absenceByEventCounts.get(502) ?? 0) +
      (absenceByEventCounts.get(651) ?? 0) +
      (absenceByEventCounts.get(652) ?? 0)
    return { atestados, faltas }
  }, [absenceByEventCounts, absenceEventRows, monthFilter, yearFilter])

  const absenceBySectorChartData = useMemo(() => {
    const isAllMonths = monthFilter === ''
    if (isAllMonths) {
      const monthMap = new Map<number, number>()
      absenceEventRows.forEach((row) => {
        const regKey = normalizeRegistration(row.registration)
        if (!regKey || !filteredRegistrations.has(regKey)) return
        const parsed = parseYearMonth(row.competence)
        if (!parsed) return
        if (yearFilter && parsed.year !== Number(yearFilter)) return
        monthMap.set(parsed.month, (monthMap.get(parsed.month) || 0) + (row.references_ ?? 0))
      })
      return Array.from(monthMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([month, totalValue], idx) => ({
          label: formatMonthLabel(month),
          totalValue,
          color: CHART_COLORS[idx % CHART_COLORS.length],
        }))
    }

    const sectorAbsences = new Map<string, number>()
    absenceEventRows.forEach((row) => {
      const regKey = normalizeRegistration(row.registration)
      if (!regKey || !filteredRegistrations.has(regKey)) return
      const sector = abbreviateSector(employeeInfo.get(regKey)?.sector ?? null)
      sectorAbsences.set(sector, (sectorAbsences.get(sector) || 0) + (row.references_ ?? 0)) // Assuming references_ is days
    })
    return Array.from(sectorAbsences.entries())
      .map(([label, totalValue], idx) => ({ label, totalValue, color: CHART_COLORS[idx % CHART_COLORS.length] }))
      .sort((a, b) => b.totalValue - a.totalValue)
  }, [absenceEventRows, employeeInfo, filteredRegistrations, monthFilter, yearFilter])

  const headcountBySectorChartData = useMemo(() => {
    const isAllMonths = monthFilter === ''
    if (isAllMonths) {
      const monthMap = new Map<number, { total: number; active: number }>()
      closingRegistrationsByMonth.forEach((regs, month) => {
        let total = 0
        let active = 0
        regs.forEach((reg) => {
          total += 1
          if (employeeInfo.get(reg)?.status === 1) active += 1
        })
        monthMap.set(month, { total, active })
      })
      return Array.from(monthMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([month, values]) => ({
          label: formatMonthLabel(month),
          total: values.total,
          active: values.active,
        }))
    }

    const sectorMap = new Map<string, { total: number; active: number }>()
    closingRegistrations.forEach((reg) => {
      const info = employeeInfo.get(reg)
      const sector = abbreviateSector(info?.sector ?? null)
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, { total: 0, active: 0 })
      }
      const entry = sectorMap.get(sector)!
      entry.total += 1
      if (info?.status === 1) {
        entry.active += 1
      }
    })
    return Array.from(sectorMap.entries())
      .map(([label, values]) => ({
        label,
        total: values.total,
        active: values.active,
      }))
      .sort((a, b) => b.total - a.total)
  }, [closingRegistrations, closingRegistrationsByMonth, employeeInfo, monthFilter])

  const headcountTotals = useMemo(
    () =>
      headcountBySectorChartData.reduce(
        (acc, curr) => {
          acc.total += curr.total
          acc.active += curr.active
          return acc
        },
        { total: 0, active: 0 }
      ),
    [headcountBySectorChartData]
  )

  const extraIndicators = useMemo(() => {
    const totalCollaborators = closingRegistrations.size

    let activeEmployees = 0
    closingRegistrations.forEach((reg) => {
      const status = employeeInfo.get(reg)?.status
      if (status === 1) activeEmployees += 1
    })

    let totalAbsenceEvents = 0
    closingRegistrations.forEach((reg) => {
      const status = employeeInfo.get(reg)?.status
      if (status === 1 || status === 2 || status === 7) return
      totalAbsenceEvents += 1
    })

    const vacationEmployees = new Set<string>()
    closingRegistrations.forEach((reg) => {
      const status = employeeInfo.get(reg)?.status
      if (status === 2) {
        vacationEmployees.add(reg)
      }
    })

    return {
      totalCollaborators,
      totalAbsenceEvents,
      activeEmployees,
      vacationEmployees: vacationEmployees.size,
    }
  }, [absenceEventRows, closingRegistrations, employeeInfo])

  const absenceByStatusChartData = useMemo(() => {
    const isAllMonths = monthFilter === ''
    if (isAllMonths) {
      const monthTotals = Array.from(closingRegistrationsByMonth.entries())
        .map(([month, regs]) => {
          let total = 0
          regs.forEach((reg) => {
            const status = Number(employeeInfo.get(reg)?.status)
            if ([1, 2, 7].includes(status)) return
            total += 1
          })
          return { month, total }
        })
        .filter((item) => item.total > 0)
        .sort((a, b) => a.month - b.month)

      return monthTotals.map((item, idx) => ({
        label: formatMonthLabel(item.month),
        totalValue: item.total,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }))
    }

    const map = new Map<number, number>()
    closingRegistrations.forEach((reg) => {
      const status = Number(employeeInfo.get(reg)?.status)
      if ([1, 2, 7].includes(status)) return
      if (!Number.isFinite(status)) return
      map.set(status, (map.get(status) || 0) + 1)
    })
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    return entries.map(([status, totalValue], idx) => ({
      label: statusDescriptions.get(status) ?? `Status ${status}`,
      totalValue,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }))
  }, [closingRegistrations, closingRegistrationsByMonth, employeeInfo, monthFilter, statusDescriptions])

  const handleClearFilters = () => {
    setCompanyFilter(companyOptions.length ? String(companyOptions[0]) : '')
    setYearFilter(yearOptions.length ? String(yearOptions[0]) : '')
    setMonthFilter(monthOptions.length ? String(monthOptions[0]) : '')
    setSectorFilter('')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 shadow-inner shadow-black/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-emerald-200 font-semibold">
            <CalendarX className="w-6 h-6 text-amber-300" />
            AFASATAMENTOS
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

        {/* CARD - HORAS TRABALHADAS */}
        <div className="bg-gradient-to-br from-cyan-300/25 via-cyan-500/20 to-slate-900/45 border border-cyan-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Horas Trabalhadas</p>
              <div className="-mt-1">
                <CalendarX className="w-5 h-5 text-cyan-300" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-2xl font-semibold text-cyan-200">
                {isLoadingWorkedHours ? '...' : formatIndicator(workedHours.total)}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-white/70 font-semibold">
              <span>
                NORMAL:{' '}
                <span className="text-white">
                  {isLoadingWorkedHours ? '...' : formatIndicator(workedHours.normal)}
                </span>
              </span>
              <span>
                NOT:{' '}
                <span className="text-white">
                  {isLoadingWorkedHours ? '...' : formatIndicator(workedHours.night)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* CARD - HORAS AUSENTES */}
        <div className="bg-gradient-to-br from-purple-300/25 via-purple-500/20 to-slate-900/45 border border-purple-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Horas Ausentes</p>
              <div className="-mt-1">
                <CalendarMinus2 className="w-5 h-5 text-purple-300" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-2xl font-semibold text-purple-200">
                {isLoadingAbsences ? '...' : formatIndicator(absenceIndicators.totalAbsenceDays)}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-white/70 font-semibold">
              <span>
                ATEST:{' '}
                <span className="text-white">
                  {isLoadingAbsences ? '...' : formatIndicator(absenceIndicators.medicalLeaveDays)}
                </span>
              </span>
              <span>
                FALTAS:{' '}
                <span className="text-white">
                  {isLoadingAbsences ? '...' : formatIndicator(absenceIndicators.unjustifiedAbsenceDays)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* CARD - TAXA DE ABSENTEISMO */}
        <div className="bg-gradient-to-br from-pink-300/25 via-pink-500/20 to-slate-900/45 border border-pink-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                Tx de Absenteismo{monthFilter === '' ? ' - ANUAL' : ''}
              </p>
              <div className="-mt-1">
                <Hospital className="w-5 h-5 text-pink-300" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-2xl font-semibold text-pink-200">
                {isLoadingAbsences || isLoadingWorkedHours ? '...' : formatPercent(absenceIndicators.absenceRate)}
              </p>
            </div>
          </div>
        </div>

        {/* CARD - COLABORADORES COM AUSÊNCIAS */}
        <div className="bg-gradient-to-br from-teal-300/25 via-teal-500/20 to-slate-900/45 border border-teal-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                Colab. c/ Ausencia{monthFilter === '' ? ' - ANUAL' : ''}
              </p>
              <div className="-mt-1">
                <Users className="w-5 h-5 text-teal-300" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-2xl font-semibold text-teal-200">
                {isLoadingAbsences ? '...' : formatIndicator(absenceIndicators.totalEmployeesWithAbsence)}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-white/70 font-semibold">
              <span>
                ATEST:{' '}
                <span className="text-white">
                  {isLoadingAbsences ? '...' : formatIndicator(absenceCountsByGroup.atestados)}
                </span>
              </span>
              <span>
                FALTAS:{' '}
                <span className="text-white">
                  {isLoadingAbsences ? '...' : formatIndicator(absenceCountsByGroup.faltas)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* CARD - TOTAL COLABORADORES */}
        <div className="bg-gradient-to-br from-amber-300/25 via-amber-500/20 to-slate-900/45 border border-amber-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                Total Colaboradores{monthFilter === '' ? ' - ANUAL' : ''}
              </p>
              <div className="-mt-1">
                <UserX className="w-5 h-5 text-amber-300" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-2xl font-semibold text-amber-200">
                {isLoadingAbsences ? '...' : formatIndicator(extraIndicators.totalCollaborators)}
              </p>
            </div>
          </div>
        </div>

        {/* CARD - TOTAL AFASTAMENTOS */}
        <div className="bg-gradient-to-br from-emerald-300/25 via-emerald-500/20 to-slate-900/45 border border-emerald-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Total Afastamentos</p>
              <div className="-mt-1">
                <Activity className="w-5 h-5 text-emerald-300" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-2xl font-semibold text-emerald-200">
                {isLoadingAbsences ? '...' : formatIndicator(extraIndicators.totalAbsenceEvents)}
              </p>
            </div>
          </div>
        </div>

        {/* CARD - COLABORADORES FÉRIAS */}
        <div className="bg-gradient-to-br from-rose-300/25 via-rose-500/20 to-slate-900/45 border border-rose-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Colaboradores Férias</p>
              <div className="-mt-1">
                <Plane className="w-5 h-5 text-rose-300" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-2xl font-semibold text-rose-200">
                {isLoadingAbsences ? '...' : formatIndicator(extraIndicators.vacationEmployees)}
              </p>
            </div>
          </div>
        </div>

        {/* CARD - COLABORADORES ATIVOS */}
        <div className="bg-gradient-to-br from-indigo-300/25 via-indigo-500/20 to-slate-900/45 border border-indigo-300/30 rounded-xl p-3 shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Colaboradores Ativos</p>
              <div className="-mt-1">
                <UserCheck className="w-5 h-5 text-indigo-300" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-2xl font-semibold text-indigo-200">
                {isLoadingAbsences ? '...' : formatIndicator(extraIndicators.activeEmployees)}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* GRAFICO - TOTAL COLABORADORES & COLABORADORES ATIVOS POR SETOR */}
      <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between text-white mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Total Colaboradores & Colaboradores Ativos</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#0ea5e9' }} />
              Total: <span className="text-emerald-300 font-semibold">{formatIndicator(headcountTotals.total)}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#22c55e' }} />
              Ativos:{' '}
              <span className="text-emerald-300 font-semibold">{formatIndicator(headcountTotals.active)}</span>
            </span>
          </div>
        </div>
        {headcountBySectorChartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
        ) : (
          <div className="relative mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={headcountBySectorChartData} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  height={80}
                  tick={<SectorTick />}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                  axisLine={{ stroke: '#475569' }}
                />
                <RechartsTooltip content={headcountTooltip} cursor={{ fill: 'transparent' }} />
                <Bar
                  dataKey="total"
                  name="Total"
                  fill="#0ea5e9"
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={false}
                  animationDuration={0}
                  activeBar={ACTIVE_BAR_HOVER}
                >
                  <LabelList
                    dataKey="total"
                    position="top"
                    formatter={formatLabelNumber}
                    fill="#FFFFFF"
                    fontSize={12}
                  />
                </Bar>
                <Line
                  type="monotone"
                  dataKey="active"
                  name="Ativos"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#22c55e' }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* GRAFICO - HORAS TRABALHADAS POR SETOR */}
      <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between text-white mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Horas Trabalhadas por Setor</p>
          </div>
          <span className="text-emerald-300 text-xs font-semibold">{formatIndicator(workedHours.total)} Hrs</span>
        </div>
        {isLoadingWorkedHours ? (
          <div className="h-64 flex items-center justify-center text-white/50 text-sm">Carregando...</div>
        ) : workedHoursBySector.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
        ) : (
          <div className="relative mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workedHoursBySector} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  height={80}
                  tick={<SectorTick />}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                  axisLine={{ stroke: '#475569' }}
                />
                <RechartsTooltip content={countTooltip} cursor={{ fill: 'transparent' }} />
                <Bar
                  dataKey="totalValue"
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={false}
                  animationDuration={0}
                  activeBar={ACTIVE_BAR_HOVER}
                >
                  {workedHoursBySector.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="totalValue"
                    position="top"
                    formatter={formatLabelNumber}
                    fill="#FFFFFF"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* GRAFICO - AUSÊNCIAS POR SETOR */}
      <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
            Ausências por {monthFilter === '' ? 'Mês' : 'Setor'}
          </p>
          <span className="text-emerald-300 text-xs font-semibold">{formatIndicator(absenceIndicators.totalAbsenceDays)} Hrs</span>
        </div>
        {isLoadingAbsences ? (
          <div className="h-64 flex items-center justify-center text-white/50 text-sm">Carregando...</div>
        ) : absenceBySectorChartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
        ) : (
          <div className="mt-3 h-64 rounded-lg border border-white/10 bg-white/5 chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={absenceBySectorChartData} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  height={80}
                  tick={<SectorTick />}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                  axisLine={{ stroke: '#475569' }}
                />
                <RechartsTooltip content={countTooltip} cursor={{ fill: 'transparent' }} />
                <Bar
                  dataKey="totalValue"
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={false}
                  animationDuration={0}
                  activeBar={ACTIVE_BAR_HOVER}
                >
                  {absenceBySectorChartData.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="totalValue"
                    position="top"
                    formatter={formatLabelNumber}
                    fill="#FFFFFF"
                    fontSize={12}

                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* GRAFICO - AUSÊNCIA POR TIPO */}
        <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-white mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Ausências por Tipo</p>
            </div>
            <span className="text-emerald-300 text-xs font-semibold">{formatIndicator(absenceIndicators.totalAbsenceDays)} Hrs</span>
          </div>
          {isLoadingAbsences ? (
            <div className="h-64 flex items-center justify-center text-white/50 text-sm">Carregando...</div>
          ) : absenceByTypeChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
          ) : (
            <div className="relative mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={absenceByTypeChartData} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  height={80}
                  tick={<SectorTick />}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                  axisLine={{ stroke: '#475569' }}
                />
                <RechartsTooltip content={valueTooltip} cursor={{ fill: 'transparent' }} />
                <Bar
                  dataKey="value"
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={false}
                  animationDuration={0}
                  activeBar={ACTIVE_BAR_HOVER}
                >
                  {absenceByTypeChartData.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="value"
                      position="top"
                      formatter={formatLabelNumber}
                      fill="#FFFFFF"
                      fontSize={12}

                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* GRAFICO - AFASTAMENTO POR TIPO (status_) */}
        <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-white mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Afastamento por Tipo</p>
            </div>
            <span className="text-emerald-300 text-xs font-semibold">
              {formatIndicator(extraIndicators.totalAbsenceEvents)}
            </span>
          </div>
          {isLoadingAbsences ? (
            <div className="h-64 flex items-center justify-center text-white/50 text-sm">Carregando...</div>
          ) : absenceByStatusChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-white/50 text-sm">Sem dados para exibir.</div>
          ) : (
            <div className="relative mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={absenceByStatusChartData} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  height={80}
                  tick={<SectorTick />}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  tick={{ fill: '#9aa4b3ff', fontSize: 10 }}
                  axisLine={{ stroke: '#475569' }}
                />
                <RechartsTooltip content={countTooltip} cursor={{ fill: 'transparent' }} />
                <Bar
                  dataKey="totalValue"
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={false}
                  animationDuration={0}
                  activeBar={ACTIVE_BAR_HOVER}
                >
                  {absenceByStatusChartData.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="totalValue"
                      position="top"
                      formatter={formatLabelNumber}
                      fill="#FFFFFF"
                      fontSize={12}

                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      
    </div>
  )
}

export default PayrollAbsencesPanel
