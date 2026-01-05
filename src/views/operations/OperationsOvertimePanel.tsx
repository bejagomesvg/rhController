import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDown01, ArrowDown10, ArrowDownAZ, ArrowDownZA, ChartLine, Check, Clock, Edit, Filter, Receipt, Search, Trash2, X } from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import { loadSession } from '../../services/sessionService'
import { verifyPassword } from '../../services/authService'
import { abbreviateSector } from '../../utils/abbreviateSector'
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { createRotatedLabelRenderer } from '../../components/RotatedValueLabel'
import SectorTick from '../../components/SectorTick'

const BASE_MONTHLY_HOURS = 220
const MAX_OVERTIME_ROWS = 20000
const PAGE_SIZE = 1000
const CHART_EPS = 1e-3
const BAR_TOOLTIP_STYLE = { backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, color: '#fff' }

interface OperationsOvertimePanelProps {
  supabaseUrl?: string
  supabaseKey?: string
}

type EmployeeExtras = {
  company: number | null
  sector: string | null
  salary: number
}

type OvertimeRow = {
  id: string
  date: string
  dateShort: string
  dateIso: string
  company: number | string
  companyValue: number
  companyLabel: string
  registration: string
  registrationValue: number
  name: string
  sector: string
  sectorOriginal: string | null
  salary: number
  hrs303: string
  hrs304: string
  hrs505: string
  hrs506: string
  hrs511: string
  hrs512: string
  plus60: string
  minus60: string
  plus100: string
  hours60: string
  hours100: string
  plus60Minutes: number
  minus60Minutes: number
  plus100Minutes: number
  hours60Minutes: number
  hours100Minutes: number
  hrs303Minutes: number
  hrs304Minutes: number
  hrs505Minutes: number
  hrs506Minutes: number
  hrs511Minutes: number
  hrs512Minutes: number
}

type OvertimeSortKey =
  | 'date'
  | 'company'
  | 'registration'
  | 'name'
  | 'sector'
  | 'plus60'
  | 'minus60'
  | 'plus100'
  | 'hours60'
  | 'hours100'

const parseIntervalMinutes = (value: string | null | undefined) => {
  if (!value) return 0
  const [hoursStr, minutesStr] = value.split(':')
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  return hours * 60 + minutes
}

const formatMinutes = (value: number) => {
  if (!Number.isFinite(value)) return '-'
  if (value === 0) return ''
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const formatDateBr = (value: string | null | undefined) => {
  if (!value) return '-'
  const [year, month, day] = value.split('-')
  if (year && month && day) return `${day}/${month}/${year}`
  return value
}

const formatDateDayMonth = (value: string | null | undefined) => {
  if (!value) return '-'
  const [year, month, day] = value.split('-')
  if (year && month && day) return `${day}/${month}`
  return value
}

const formatDayRange = (startIso: string | null | undefined, endIso: string | null | undefined) => {
  if (!startIso && !endIso) return '-'
  const startMatch = startIso?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const endMatch = endIso?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!startMatch && !endMatch) return '-'
  const startDay = startMatch ? startMatch[3] : endMatch ? endMatch[3] : '--'
  const startMonth = startMatch ? startMatch[2] : endMatch ? endMatch[2] : '--'
  const endDay = endMatch ? endMatch[3] : startDay
  const endMonth = endMatch ? endMatch[2] : startMonth
  if (startMonth === endMonth) {
    return `${startDay}-${endDay} / ${endMonth}`
  }
  return `${startDay}/${startMonth} - ${endDay}/${endMonth}`
}

const formatCompanyLabel = (value: number | string) => {
  const num = Number(value)
  if (num === 4) return 'Frigosul'
  if (num === 5) return 'Pantaneira'
  return String(value ?? '-')
}

const formatLabelHours = (value: unknown) => {
  const minutes = Math.round(Number(value ?? 0) * 60)
  return formatMinutes(minutes)
}

const formatLabelCurrency = (value: unknown) => {
  const num = Number(value ?? 0)
  return num > 0 ? num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
}

const rotatedLabelValue60 = createRotatedLabelRenderer((val: number) => formatLabelCurrency(val), { color: '#e2e8f0' })
const rotatedLabelValueTotal = createRotatedLabelRenderer((val: number) => formatLabelCurrency(val), { color: '#e2e8f0' })

const labelForHoursLine = (name: unknown) => {
  const n = String(name ?? '').toLowerCase()
  if (n.includes('60')) return '60%'
  if (n.includes('100')) return '100%'
  return String(name ?? '')
}

const labelForValuesLine = (name: unknown) => {
  const n = String(name ?? '').toLowerCase()
  if (n.includes('60')) return '60%'
  if (n.includes('100')) return '100%'
  return String(name ?? '')
}

const renderMonthlyHoursTooltip = ({ active, payload, label }: TooltipContentProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null
  const order: Record<string, number> = { hours60: 0, hours100: 1 }
  const sorted = [...payload].sort((a, b) => (order[a.dataKey] ?? 99) - (order[b.dataKey] ?? 99))
  return (
    <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold mb-1 text-center">{`Mês: ${label}`}</div>
      {sorted.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 justify-center text-center">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className={entry.dataKey === 'hours60' ? 'text-sky-300' : 'text-rose-300'}>
            {labelForHoursLine(entry.dataKey)}: {formatMinutes(Math.round(Number(entry.value ?? 0)))}
          </span>
        </div>
      ))}
    </div>
  )
}

const renderMonthlyValuesTooltip = ({ active, payload, label }: TooltipContentProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null
  const order: Record<string, number> = { value60: 0, value100: 1 }
  const sorted = [...payload].sort((a, b) => (order[a.dataKey] ?? 99) - (order[b.dataKey] ?? 99))
  return (
    <div className="rounded-lg border border-blue-500/60 bg-[#0f172a] px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold mb-1 text-center">{`Mês: ${label}`}</div>
      {sorted.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 justify-center text-center">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className={entry.dataKey === 'value60' ? 'text-sky-300' : 'text-emerald-300'}>
            {labelForValuesLine(entry.dataKey)}:{' '}
            {entry.value > 0 ? Number(entry.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
          </span>
        </div>
      ))}
    </div>
  )
}

const makeBarTooltipHours = () => ({ active, payload, label }: TooltipContentProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null
  const entry = payload[0]
  const minutes = Math.round(Number(entry.value ?? 0) * 60)
  return (
    <div className="rounded-lg border border-blue-500/60 px-3 py-2 text-xs text-white shadow-lg" style={BAR_TOOLTIP_STYLE}>
      <div className="font-semibold mb-1 text-center">{label ?? ''}</div>
      <div className="flex items-center gap-2 justify-center text-center">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
        <span className="text-sky-200">{minutes > 0 ? formatMinutes(minutes) : '-'}</span>
      </div>
    </div>
  )
}

const makeBarTooltipValues = () => ({ active, payload, label }: TooltipContentProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null
  const entry = payload[0]
  return (
    <div className="rounded-lg border border-blue-500/60 px-3 py-2 text-xs text-white shadow-lg" style={BAR_TOOLTIP_STYLE}>
      <div className="font-semibold mb-1 text-center">{label ?? ''}</div>
      <div className="flex items-center gap-2 justify-center text-center">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
        <span className="text-sky-200">
          {entry.value > 0 ? Number(entry.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
        </span>
      </div>
    </div>
  )
}

const barTooltipHours = makeBarTooltipHours()
const barTooltipValues = makeBarTooltipValues()

const OperationsOvertimePanel: React.FC<OperationsOvertimePanelProps> = ({ supabaseKey, supabaseUrl }) => {
  const currentYear = String(new Date().getFullYear())
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const [filterText, setFilterText] = useState('')
  const [filterTextInput, setFilterTextInput] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterDay, setFilterDay] = useState('')
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([])
  const [availableSectors, setAvailableSectors] = useState<string[]>([])
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [showTable, setShowTable] = useState(false)
  const [rows, setRows] = useState<OvertimeRow[]>([])
  const [rawRows, setRawRows] = useState<OvertimeRow[]>([])
  const [salaryByRegistration, setSalaryByRegistration] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: OvertimeSortKey; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<{
    hrs303: string
    hrs304: string
    hrs505: string
    hrs506: string
    hrs511: string
    hrs512: string
  } | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePasswordError, setDeletePasswordError] = useState<'required' | 'invalid' | null>(null)
  const [deleteAttempts, setDeleteAttempts] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<OvertimeRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const clearNameFilter = () => {
    if (filterText || filterTextInput) {
      setFilterText('')
      setFilterTextInput('')
    }
  }

  const applyNameFilter = () => {
    const next = filterTextInput.trim()
    setFilterText(next)
    setFilterDay('')
  }

  const formatTimeInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}:${digits.slice(2)}`
  }

  const handleEditInputChange = (field: keyof NonNullable<typeof editingValues>) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTimeInput(event.target.value)
    setEditingValues((prev) => (prev ? { ...prev, [field]: formatted } : prev))
  }

  const editFieldOrder: Array<keyof NonNullable<typeof editingValues>> = ['hrs303', 'hrs304', 'hrs505', 'hrs506', 'hrs511', 'hrs512']

  const handleEditKeyDown = (field: keyof NonNullable<typeof editingValues>) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (!editingId) return
    const idx = editFieldOrder.indexOf(field)
    const nextField = idx >= 0 ? editFieldOrder[idx + 1] : null
    if (nextField) {
      const nextEl = document.getElementById(`edit-${editingId}-${nextField}`) as HTMLInputElement | null
      if (nextEl) {
        nextEl.focus()
        nextEl.select?.()
        return
      }
    }
    const saveBtn = document.getElementById(`edit-${editingId}-save`) as HTMLButtonElement | null
    if (saveBtn) {
      saveBtn.focus()
      saveBtn.click()
      return
    }
    saveEditRow()
  }

  const minutesToPayload = (value: string | null | undefined) => {
    if (value === null || value === undefined) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    const mins = parseIntervalMinutes(trimmed)
    const safeMins = Number.isFinite(mins) ? mins : 0
    const hours = Math.floor(Math.max(safeMins, 0) / 60)
    const minutes = Math.max(safeMins, 0) % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const startEditRow = (row: OvertimeRow) => {
    setEditingId(row.id)
    setEditingValues({
      hrs303: row.hrs303,
      hrs304: row.hrs304,
      hrs505: row.hrs505,
      hrs506: row.hrs506,
      hrs511: row.hrs511,
      hrs512: row.hrs512,
    })
  }

  const cancelEditRow = () => {
    setEditingId(null)
    setEditingValues(null)
  }

  const saveEditRow = async () => {
    if (!editingId || !editingValues) return
    if (!supabaseUrl || !supabaseKey) {
      toast.error('Credenciais do Supabase ausentes.')
      return
    }
    try {
      setIsSavingEdit(true)
      const payload = {
        hrs303: minutesToPayload(editingValues.hrs303),
        hrs304: minutesToPayload(editingValues.hrs304),
        hrs505: minutesToPayload(editingValues.hrs505),
        hrs506: minutesToPayload(editingValues.hrs506),
        hrs511: minutesToPayload(editingValues.hrs511),
        hrs512: minutesToPayload(editingValues.hrs512),
      }

      const res = await fetch(`${supabaseUrl}/rest/v1/overtime?id=eq.${editingId}`, {
        method: 'PATCH',
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
        throw new Error(errTxt || 'Erro ao salvar horas extras')
      }

      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== editingId) return row
          const hrs303Minutes = parseIntervalMinutes(editingValues.hrs303)
          const hrs304Minutes = parseIntervalMinutes(editingValues.hrs304)
          const hrs505Minutes = parseIntervalMinutes(editingValues.hrs505)
          const hrs506Minutes = parseIntervalMinutes(editingValues.hrs506)
          const hrs511Minutes = parseIntervalMinutes(editingValues.hrs511)
          const hrs512Minutes = parseIntervalMinutes(editingValues.hrs512)
          const plus60Minutes = hrs505Minutes + hrs506Minutes
          const minus60Minutes = hrs511Minutes + hrs512Minutes
          const plus100Minutes = hrs303Minutes + hrs304Minutes
          const hours60Minutes = plus60Minutes - minus60Minutes
          return {
            ...row,
            hrs303: formatMinutes(hrs303Minutes),
            hrs304: formatMinutes(hrs304Minutes),
            hrs505: formatMinutes(hrs505Minutes),
            hrs506: formatMinutes(hrs506Minutes),
            hrs511: formatMinutes(hrs511Minutes),
            hrs512: formatMinutes(hrs512Minutes),
            plus60: formatMinutes(plus60Minutes),
            minus60: formatMinutes(minus60Minutes),
            plus100: formatMinutes(plus100Minutes),
            hours60: formatMinutes(hours60Minutes),
            hrs303Minutes,
            hrs304Minutes,
            hrs505Minutes,
            hrs506Minutes,
            hrs511Minutes,
            hrs512Minutes,
            plus60Minutes,
            minus60Minutes,
            plus100Minutes,
            hours60Minutes,
          }
        }),
      )
      toast.success('Horas extras atualizadas com sucesso!')
      setEditingId(null)
      setEditingValues(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar horas extras'
      toast.error(msg)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteRow = (row: OvertimeRow) => {
    setDeleteTarget(row)
    setDeleteModalOpen(true)
    setDeletePassword('')
    setDeletePasswordError(null)
    setDeleteAttempts(0)
  }

  const resetDeleteState = () => {
    setDeleteModalOpen(false)
    setDeletePassword('')
    setDeletePasswordError(null)
    setDeleteAttempts(0)
    setDeleteTarget(null)
    setIsDeleting(false)
  }

  const confirmDeleteRow = () => {
    const pwd = deletePassword.trim()
    if (!pwd) {
      setDeletePasswordError('required')
      return
    }
    const session = loadSession()
    if (!session) {
      setDeletePasswordError('invalid')
      return
    }
    if (deleteAttempts >= 2) {
      toast.error('Limite de tentativas atingido.')
      resetDeleteState()
      return
    }
    verifyPassword(pwd, session.password).then(async (valid) => {
      if (!valid) {
        const next = deleteAttempts + 1
        setDeleteAttempts(next)
        setDeletePasswordError('invalid')
        if (next >= 3) {
          toast.error('Limite de tentativas atingido.')
          resetDeleteState()
        }
        return
      }
      if (!deleteTarget || !supabaseUrl || !supabaseKey) {
        setDeletePasswordError('invalid')
        return
      }
      try {
        setIsDeleting(true)
        const res = await fetch(`${supabaseUrl}/rest/v1/overtime?id=eq.${deleteTarget.id}`, {
          method: 'DELETE',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: 'return=minimal',
          },
        })
        if (!res.ok) {
          const errTxt = await res.text()
          throw new Error(errTxt || 'Erro ao excluir horas extras')
        }
        setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
        toast.success('Horas extras excluídas com sucesso!')
        resetDeleteState()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao excluir horas extras'
        toast.error(msg)
      } finally {
        setIsDeleting(false)
      }
    })
  }

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return

    const fetchOvertime = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const DBG_ONLY = '204575'
        const showDbg = () => String(filterText ?? '').trim() === DBG_ONLY

        const url = new URL(`${supabaseUrl}/rest/v1/overtime`)
        url.searchParams.set('select', 'id,registration,name,date_,hrs303,hrs304,hrs505,hrs506,hrs511,hrs512')
        url.searchParams.set('order', 'date_.desc')

        const needle = filterText.trim()
        if (needle) {
          if (/^\d+$/.test(needle)) {
            url.searchParams.set('or', `(registration.eq.${needle},name.ilike.*${needle}*)`)
          } else {
            url.searchParams.set('name', `ilike.*${needle}*`)
          }
        }

        const baseUrl = url.toString()
        const overtimeData: any[] = []
        const numericNeedle = /^\d+$/.test(needle)

        if (numericNeedle) {
          // When searching by numeric registration, request all matching rows
          // in a single call (no Range header). This avoids potential issues
          // where paged Range requests drop rows on the backend.
          const res = await fetch(baseUrl, {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: 'count=exact',
            },
          })
          if (!res.ok) {
            throw new Error((await res.text()) || 'Erro ao buscar horas extras')
          }
          const pageData = await res.json()
          overtimeData.push(...pageData)
        } else {
          let from = 0
          let totalFromHeader: number | null = null
          while (from < MAX_OVERTIME_ROWS && (totalFromHeader === null || from < totalFromHeader)) {
            const to = Math.min(from + PAGE_SIZE - 1, MAX_OVERTIME_ROWS - 1)
            const res = await fetch(baseUrl, {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                Range: `${from}-${to}`,
                Prefer: 'count=exact',
              },
            })

            if (!res.ok) {
              throw new Error((await res.text()) || 'Erro ao buscar horas extras')
            }

            const pageData = await res.json()
            overtimeData.push(...pageData)

            const contentRange = res.headers.get('content-range')
            if (contentRange) {
              const [, totalStr] = contentRange.split('/') || []
              const totalNum = Number(totalStr)
              totalFromHeader = Number.isFinite(totalNum) ? totalNum : null
            }

            if (pageData.length < PAGE_SIZE) {
              break
            }
            from += PAGE_SIZE
          }
        }
        // Deduplicate fetched overtime rows by `id` to avoid counting the same
        // database record multiple times (can happen when using paged requests).
        // If search is numeric, ensure we explicitly request all rows for
        // that registration once more to avoid any backend pagination/Range
        // oddities that could drop rows.
        try {
          const needleExplicit = filterText.trim()
          if (/^\d+$/.test(needleExplicit)) {
            try {
              const regUrl = new URL(`${supabaseUrl}/rest/v1/overtime`)
              regUrl.searchParams.set('select', 'id,registration,name,date_,hrs303,hrs304,hrs505,hrs506,hrs511,hrs512')
              regUrl.searchParams.set('registration', `eq.${needleExplicit}`)
              regUrl.searchParams.set('order', 'date_.desc')
              const regRes = await fetch(regUrl.toString(), {
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  Prefer: 'count=exact',
                },
              })
              if (regRes.ok) {
                const regData = await regRes.json()
                overtimeData.push(...regData)
                // eslint-disable-next-line no-console
                if (showDbg()) console.debug('[OVERTIME-DBG] explicit registration fetch appended count=', regData.length, 'registration=', needleExplicit, 'ids=', regData.map((r: any) => r.id))
              }
            } catch (e) {
              // ignore explicit fetch errors
            }
          }
        } catch (e) {
          // ignore
        }

        const uniqueOvertimeByIdMap = new Map<string, any>()
        overtimeData.forEach((r: any) => {
          const key = `${String(r.id ?? '')}|${String(r.date_ ?? '')}|${String(r.registration ?? '')}`
          if (!uniqueOvertimeByIdMap.has(key)) {
            uniqueOvertimeByIdMap.set(key, r)
          }
        })

        // Se a busca for por cadastro numérico, garantir com uma fetch
        // direta por `registration` (o valor pesquisado) para recuperar
        // lançamentos que possam ter sido perdidos por paginação/Range.
        try {
          const needleDbg = filterText.trim()
          if (/^\d+$/.test(needleDbg)) {
            // Fetch direto por registration pesquisado (assegura inclusão)
            try {
              const urlDirect = new URL(`${supabaseUrl}/rest/v1/overtime`)
              urlDirect.searchParams.set('select', 'id,registration,name,date_,hrs303,hrs304,hrs505,hrs506,hrs511,hrs512')
              urlDirect.searchParams.set('registration', `eq.${needleDbg}`)
              const resDirect = await fetch(urlDirect.toString(), {
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  Prefer: 'count=exact',
                },
              })
              if (resDirect.ok) {
                const pageData = await resDirect.json()
                pageData.forEach((r: any) => {
                  const key = `${String(r.id ?? '')}|${String(r.date_ ?? '')}|${String(r.registration ?? '')}`
                  if (!uniqueOvertimeByIdMap.has(key)) uniqueOvertimeByIdMap.set(key, r)
                })
              }
            } catch (e) {
              // ignore direct fetch errors
            }

            const regs = Array.from(new Set(overtimeData.map((r: any) => r.registration).filter((x: any) => x !== null && x !== undefined)))
            for (const reg of regs) {
              try {
                const urlReg = new URL(`${supabaseUrl}/rest/v1/overtime`)
                urlReg.searchParams.set('select', 'id,registration,name,date_,hrs303,hrs304,hrs505,hrs506,hrs511,hrs512')
                urlReg.searchParams.set('registration', `eq.${reg}`)
                const resReg = await fetch(urlReg.toString(), {
                  headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    Prefer: 'count=exact',
                  },
                })
                if (resReg.ok) {
                  const pageData = await resReg.json()
                  pageData.forEach((r: any) => {
                    const key = `${String(r.id ?? '')}|${String(r.date_ ?? '')}|${String(r.registration ?? '')}`
                    if (!uniqueOvertimeByIdMap.has(key)) uniqueOvertimeByIdMap.set(key, r)
                  })
                }
              } catch (e) {
                // ignore per-reg fetch errors
              }
            }
          }
        } catch (e) {
          // ignore
        }

        const uniqueOvertime = Array.from(uniqueOvertimeByIdMap.values())

        // DEBUG: log unique fetched records for the current name/registration filter
        try {
          const needleDbg = filterText.trim()
          if (/^\d+$/.test(needleDbg)) {
            const rowsForReg = uniqueOvertime.filter((r: any) => String(r.registration) === needleDbg)
            // eslint-disable-next-line no-console
            if (showDbg()) {
              console.debug('[OVERTIME-DBG] uniqueOvertime count=', uniqueOvertime.length, 'rowsForReg count=', rowsForReg.length, 'rowsForReg=', rowsForReg.map((r: any) => ({ id: r.id, date: r.date_ })))
              console.debug('[OVERTIME-DBG] uniqueOvertime ids=', rowsForReg.map((r: any) => String(r.id)))
            }
          }
        } catch (e) {
          // ignore
        }

        const registrations = Array.from(
          new Set(
            uniqueOvertime
              .map((row: any) => row.registration)
              .filter((reg: any) => reg !== null && reg !== undefined),
          ),
        )

        let employees: Record<string, EmployeeExtras> = {}
        if (registrations.length > 0) {
          const empUrl = new URL(`${supabaseUrl}/rest/v1/employee`)
          empUrl.searchParams.set('select', 'registration,company,sector,salary')
          empUrl.searchParams.set('registration', `in.(${registrations.join(',')})`)

          const empRes = await fetch(empUrl.toString(), {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
          })

          if (empRes.ok) {
            const empData = await empRes.json()
            const map: Record<string, EmployeeExtras> = {}
            const salaryMap: Record<string, number> = {}
            empData.forEach((emp: any) => {
              if (emp.registration === null || emp.registration === undefined) return
              map[String(emp.registration)] = {
                company: emp.company ?? null,
                sector: emp.sector ?? null,
                salary: Number(emp.salary) || 0,
              }
              salaryMap[String(emp.registration)] = Number(emp.salary) || 0
            })
            employees = map
            setSalaryByRegistration(salaryMap)
          }
        }

        let mappedRows: OvertimeRow[] = uniqueOvertime.map((row: any) => {
          const registration = row.registration === null || row.registration === undefined ? '' : String(row.registration)
          const employee = employees[registration]
          const hrs303Minutes = parseIntervalMinutes(row.hrs303)
          const hrs304Minutes = parseIntervalMinutes(row.hrs304)
          const hrs505Minutes = parseIntervalMinutes(row.hrs505)
          const hrs506Minutes = parseIntervalMinutes(row.hrs506)
          const hrs511Minutes = parseIntervalMinutes(row.hrs511)
          const hrs512Minutes = parseIntervalMinutes(row.hrs512)
          const plus60Minutes = hrs505Minutes + hrs506Minutes
          const minus60Minutes = hrs511Minutes + hrs512Minutes
          const plus100Minutes = hrs303Minutes + hrs304Minutes
          const hours60Minutes = plus60Minutes - minus60Minutes
          const sectorOriginal = employee?.sector ?? null
          const sectorLabel = abbreviateSector(sectorOriginal)
          const salary = employee?.salary ?? 0

          return {
            id: row.id ? String(row.id) : `${registration}-${row.date_ ?? ''}`,
            dateIso: row.date_ ?? '',
            date: formatDateBr(row.date_),
            dateShort: formatDateDayMonth(row.date_),
            company: employee?.company ?? '-',
            companyValue: Number(employee?.company) || 0,
            companyLabel: formatCompanyLabel(employee?.company ?? '-'),
            registration: registration || '-',
            registrationValue: Number(registration) || 0,
            name: row.name ?? '-',
            sector: sectorLabel,
            sectorOriginal,
            salary,
            hrs303: formatMinutes(hrs303Minutes),
            hrs304: formatMinutes(hrs304Minutes),
            hrs505: formatMinutes(hrs505Minutes),
            hrs506: formatMinutes(hrs506Minutes),
            hrs511: formatMinutes(hrs511Minutes),
            hrs512: formatMinutes(hrs512Minutes),
            plus60: formatMinutes(plus60Minutes),
            minus60: formatMinutes(minus60Minutes),
            plus100: formatMinutes(plus100Minutes),
            hours60: formatMinutes(hours60Minutes),
            hours100: formatMinutes(plus100Minutes),
            plus60Minutes,
            minus60Minutes,
            plus100Minutes,
            hours60Minutes,
            hours100Minutes: plus100Minutes,
            hrs303Minutes,
            hrs304Minutes,
            hrs505Minutes,
            hrs506Minutes,
            hrs511Minutes,
            hrs512Minutes,
          }
        })

        // Fallback: se algum registro bruto de `uniqueOvertime` não foi mapeado
        // (p.ex. por dedupe ou formato inesperado), mapeie e anexe aqui.
        try {
          const mappedById = new Map<string, OvertimeRow>(mappedRows.map((r) => [String(r.id), r]))
          const missing = uniqueOvertime.filter((r: any) => !mappedById.has(String(r.id)))
          if (missing.length > 0) {
            const extraMapped = missing.map((row: any) => {
              const registration = row.registration === null || row.registration === undefined ? '' : String(row.registration)
              const employee = employees[registration]
              const hrs303Minutes = parseIntervalMinutes(row.hrs303)
              const hrs304Minutes = parseIntervalMinutes(row.hrs304)
              const hrs505Minutes = parseIntervalMinutes(row.hrs505)
              const hrs506Minutes = parseIntervalMinutes(row.hrs506)
              const hrs511Minutes = parseIntervalMinutes(row.hrs511)
              const hrs512Minutes = parseIntervalMinutes(row.hrs512)
              const plus60Minutes = hrs505Minutes + hrs506Minutes
              const minus60Minutes = hrs511Minutes + hrs512Minutes
              const plus100Minutes = hrs303Minutes + hrs304Minutes
              const hours60Minutes = plus60Minutes - minus60Minutes
              const sectorOriginal = employee?.sector ?? null
              const sectorLabel = abbreviateSector(sectorOriginal)
              const salary = employee?.salary ?? 0
              return {
                id: row.id ? String(row.id) : `${registration}-${row.date_ ?? ''}`,
                dateIso: row.date_ ?? '',
                date: formatDateBr(row.date_),
                dateShort: formatDateDayMonth(row.date_),
                company: employee?.company ?? '-',
                companyValue: Number(employee?.company) || 0,
                companyLabel: formatCompanyLabel(employee?.company ?? '-'),
                registration: registration || '-',
                registrationValue: Number(registration) || 0,
                name: row.name ?? '-',
                sector: sectorLabel,
                sectorOriginal,
                salary,
                hrs303: formatMinutes(hrs303Minutes),
                hrs304: formatMinutes(hrs304Minutes),
                hrs505: formatMinutes(hrs505Minutes),
                hrs506: formatMinutes(hrs506Minutes),
                hrs511: formatMinutes(hrs511Minutes),
                hrs512: formatMinutes(hrs512Minutes),
                plus60: formatMinutes(plus60Minutes),
                minus60: formatMinutes(minus60Minutes),
                plus100: formatMinutes(plus100Minutes),
                hours60: formatMinutes(hours60Minutes),
                hours100: formatMinutes(plus100Minutes),
                plus60Minutes,
                minus60Minutes,
                plus100Minutes,
                hours60Minutes,
                hours100Minutes: plus100Minutes,
                hrs303Minutes,
                hrs304Minutes,
                hrs505Minutes,
                hrs506Minutes,
                hrs511Minutes,
                hrs512Minutes,
              } as OvertimeRow
            })
            mappedRows = mappedRows.concat(extraMapped)
            // eslint-disable-next-line no-console
            if (showDbg()) console.debug('[OVERTIME-DBG] appended missing mapped rows count=', missing.length, 'ids=', missing.map((m: any) => m.id))
          }
        } catch (e) {
          // ignore
        }

        // DEBUG: mostrar os registros já mapeados (id, dateIso, registration, company)
        try {
          // eslint-disable-next-line no-console
          if (showDbg()) console.debug('[OVERTIME-DBG] mappedRows count=', mappedRows.length, 'ids=', mappedRows.map((r) => ({ id: r.id, date: r.dateIso, registration: r.registration, company: r.company })))
          const needleDbg = filterText.trim()
          if (/^\d+$/.test(needleDbg)) {
            const mustId = '5858'
            const found = mappedRows.find((m) => String(m.id) === String(mustId))
            // eslint-disable-next-line no-console
            if (showDbg()) console.debug('[OVERTIME-DBG] mappedRows contains id 5858?', !!found, found ? { id: found.id, date: found.dateIso, registration: found.registration } : null)
          }
        } catch (e) {
          // ignore
        }

        // Extra safeguard: se a busca for por cadastro numérico, realizar
        // uma fetch explícita por esse `registration` e anexar quaisquer
        // linhas não presentes em `mappedRows` (diagnóstico para IDs perdidos).
        try {
          const needleExplicit = filterText.trim()
          if (/^\d+$/.test(needleExplicit)) {
            const regUrl = new URL(`${supabaseUrl}/rest/v1/overtime`)
            regUrl.searchParams.set('select', 'id,registration,name,date_,hrs303,hrs304,hrs505,hrs506,hrs511,hrs512')
            regUrl.searchParams.set('registration', `eq.${needleExplicit}`)
            regUrl.searchParams.set('order', 'date_.desc')
            const regRes = await fetch(regUrl.toString(), {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                Prefer: 'count=exact',
              },
            })
            if (regRes.ok) {
              const regRows = await regRes.json()
              const mappedIdsSet = new Set(mappedRows.map((m) => String(m.id)))
              const missing = regRows.filter((r: any) => !mappedIdsSet.has(String(r.id)))
              if (missing.length > 0) {
                const extraMapped = missing.map((row: any) => {
                  const registration = row.registration === null || row.registration === undefined ? '' : String(row.registration)
                  const employee = (employees && employees[registration]) || undefined
                  const hrs303Minutes = parseIntervalMinutes(row.hrs303)
                  const hrs304Minutes = parseIntervalMinutes(row.hrs304)
                  const hrs505Minutes = parseIntervalMinutes(row.hrs505)
                  const hrs506Minutes = parseIntervalMinutes(row.hrs506)
                  const hrs511Minutes = parseIntervalMinutes(row.hrs511)
                  const hrs512Minutes = parseIntervalMinutes(row.hrs512)
                  const plus60Minutes = hrs505Minutes + hrs506Minutes
                  const minus60Minutes = hrs511Minutes + hrs512Minutes
                  const plus100Minutes = hrs303Minutes + hrs304Minutes
                  const hours60Minutes = plus60Minutes - minus60Minutes
                  const sectorOriginal = employee?.sector ?? null
                  const sectorLabel = abbreviateSector(sectorOriginal)
                  const salary = employee?.salary ?? 0
                  return {
                    id: row.id ? String(row.id) : `${registration}-${row.date_ ?? ''}`,
                    dateIso: row.date_ ?? '',
                    date: formatDateBr(row.date_),
                    dateShort: formatDateDayMonth(row.date_),
                    company: employee?.company ?? '-',
                    companyValue: Number(employee?.company) || 0,
                    companyLabel: formatCompanyLabel(employee?.company ?? '-'),
                    registration: registration || '-',
                    registrationValue: Number(registration) || 0,
                    name: row.name ?? '-',
                    sector: sectorLabel,
                    sectorOriginal,
                    salary,
                    hrs303: formatMinutes(hrs303Minutes),
                    hrs304: formatMinutes(hrs304Minutes),
                    hrs505: formatMinutes(hrs505Minutes),
                    hrs506: formatMinutes(hrs506Minutes),
                    hrs511: formatMinutes(hrs511Minutes),
                    hrs512: formatMinutes(hrs512Minutes),
                    plus60: formatMinutes(plus60Minutes),
                    minus60: formatMinutes(minus60Minutes),
                    plus100: formatMinutes(plus100Minutes),
                    hours60: formatMinutes(hours60Minutes),
                    hours100: formatMinutes(plus100Minutes),
                    plus60Minutes,
                    minus60Minutes,
                    plus100Minutes,
                    hours60Minutes,
                    hours100Minutes: plus100Minutes,
                    hrs303Minutes,
                    hrs304Minutes,
                    hrs505Minutes,
                    hrs506Minutes,
                    hrs511Minutes,
                    hrs512Minutes,
                  } as OvertimeRow
                })
                mappedRows = mappedRows.concat(extraMapped)
                // eslint-disable-next-line no-console
                if (showDbg()) console.debug('[OVERTIME-DBG] explicit registration fetch appended to mappedRows ids=', missing.map((m: any) => m.id))
              } else {
                // eslint-disable-next-line no-console
                if (showDbg()) console.debug('[OVERTIME-DBG] explicit registration fetch found no new ids, count=', regRows.length)
              }
            } else {
                // eslint-disable-next-line no-console
                if (showDbg()) console.debug('[OVERTIME-DBG] explicit registration fetch failed status=', regRes.status)
            }
          }
        } catch (e) {
          // ignore
        }

        const companiesSet = new Set<string>()
        const sectorsSet = new Set<string>()
        const yearsSet = new Set<string>()
        const monthsSet = new Set<string>()
        const daysSet = new Set<string>()
        mappedRows.forEach((row) => {
          if (row.company !== '-' && row.company !== null && row.company !== undefined) {
            companiesSet.add(String(row.company))
          }
          if (row.sectorOriginal) {
            sectorsSet.add(row.sectorOriginal)
          }
          const match = row.dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
          if (match) {
            yearsSet.add(match[1])
            monthsSet.add(match[2])
            daysSet.add(match[3])
          }
        })
        setAvailableCompanies(Array.from(companiesSet).sort((a, b) => Number(a) - Number(b)))
        setAvailableSectors(Array.from(sectorsSet).sort((a, b) => a.localeCompare(b)))
        setAvailableYears(Array.from(yearsSet).sort((a, b) => Number(a) - Number(b)))
        setAvailableMonths(Array.from(monthsSet).sort((a, b) => Number(a) - Number(b)))
        setAvailableDays(Array.from(daysSet).sort((a, b) => Number(a) - Number(b)))

        const filteredRows = mappedRows.filter((row) => {
          const needle = filterText.trim()
          const numericNeedle = /^\d+$/.test(needle)
          // If user searched by numeric registration, ignore other filters (company/sector/day/month/year)
          const matchCompany = numericNeedle ? true : filterCompany ? String(row.companyValue) === filterCompany : true
          const matchSector = numericNeedle ? true : filterSector ? row.sectorOriginal === filterSector : true
          const hasDate = row.dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
          const yearVal = hasDate ? hasDate[1] : null
          const monthVal = hasDate ? hasDate[2] : null
          const dayVal = hasDate ? hasDate[3] : null
          const matchYear = numericNeedle ? true : filterYear ? yearVal === filterYear : true
          const matchMonth = numericNeedle ? true : filterMonth ? monthVal === filterMonth : true
          const matchDay = numericNeedle ? true : filterDay ? dayVal === filterDay : true
          return matchCompany && matchSector && matchYear && matchMonth && matchDay
        })

        // Preserve the ungrouped, daily rows so totals can always be computed from
        // the actual daily entries even when `rows` is later grouped by registration.
        try {
          const needleDbg = filterText.trim()
          if (/^\d+$/.test(needleDbg)) {
            const rowsInMapped = mappedRows.filter((m) => String(m.registration) === needleDbg)
            const rowsInFiltered = filteredRows.filter((f) => String(f.registration) === needleDbg)
            // eslint-disable-next-line no-console
            if (showDbg()) console.debug('[OVERTIME-DBG] compare mapped vs filtered for reg=', needleDbg, 'mappedCount=', rowsInMapped.length, 'filteredCount=', rowsInFiltered.length, 'mappedIds=', rowsInMapped.map((r) => ({ id: r.id, date: r.dateIso })), 'filteredIds=', rowsInFiltered.map((r) => ({ id: r.id, date: r.dateIso })))
          }
        } catch (e) {
          // ignore
        }
        setRawRows(filteredRows)

        const finalRows = filterDay || filterText
          ? filteredRows
          : (() => {
            const grouped = new Map<
              string,
              {
                registration: string
                name: string
                company: number | string
                companyValue: number
                companyLabel: string
                sector: string
                sectorOriginal: string | null
                salary: number
                plus60Minutes: number
                minus60Minutes: number
                plus100Minutes: number
                hours60Minutes: number
                hours100Minutes: number
                hrs303Minutes: number
                hrs304Minutes: number
                hrs505Minutes: number
                hrs506Minutes: number
                hrs511Minutes: number
                hrs512Minutes: number
                minDate: string | null
                maxDate: string | null
              }
            >()
            // Fallback: além de `filteredRows`, inclua também quaisquer linhas
            // já mapeadas (`mappedRows`) que pertençam aos mesmos `registration`
            // presentes em `filteredRows` mas que por algum motivo não chegaram
            // à lista final (evita perder linhas como a de 16/12).
            const isNumericSearch = /^\d+$/.test(filterText.trim())
            let rowsToGroup: OvertimeRow[] = []
            if (isNumericSearch) {
              // For numeric registration search, map directly from `uniqueOvertime`
              // for that registration to ensure no raw rows are missed.
              const needleReg = filterText.trim()
              const mapRawToOvertimeRow = (row: any): OvertimeRow => {
                const registration = row.registration === null || row.registration === undefined ? '' : String(row.registration)
                const employee = employees[registration]
                const hrs303Minutes = parseIntervalMinutes(row.hrs303)
                const hrs304Minutes = parseIntervalMinutes(row.hrs304)
                const hrs505Minutes = parseIntervalMinutes(row.hrs505)
                const hrs506Minutes = parseIntervalMinutes(row.hrs506)
                const hrs511Minutes = parseIntervalMinutes(row.hrs511)
                const hrs512Minutes = parseIntervalMinutes(row.hrs512)
                const plus60Minutes = hrs505Minutes + hrs506Minutes
                const minus60Minutes = hrs511Minutes + hrs512Minutes
                const plus100Minutes = hrs303Minutes + hrs304Minutes
                const hours60Minutes = plus60Minutes - minus60Minutes
                const sectorOriginal = employee?.sector ?? null
                const sectorLabel = abbreviateSector(sectorOriginal)
                const salary = employee?.salary ?? 0
                return {
                  id: row.id ? String(row.id) : `${registration}-${row.date_ ?? ''}`,
                  dateIso: row.date_ ?? '',
                  date: formatDateBr(row.date_),
                  dateShort: formatDateDayMonth(row.date_),
                  company: employee?.company ?? '-',
                  companyValue: Number(employee?.company) || 0,
                  companyLabel: formatCompanyLabel(employee?.company ?? '-'),
                  registration: registration || '-',
                  registrationValue: Number(registration) || 0,
                  name: row.name ?? '-',
                  sector: sectorLabel,
                  sectorOriginal,
                  salary,
                  hrs303: formatMinutes(hrs303Minutes),
                  hrs304: formatMinutes(hrs304Minutes),
                  hrs505: formatMinutes(hrs505Minutes),
                  hrs506: formatMinutes(hrs506Minutes),
                  hrs511: formatMinutes(hrs511Minutes),
                  hrs512: formatMinutes(hrs512Minutes),
                  plus60: formatMinutes(plus60Minutes),
                  minus60: formatMinutes(minus60Minutes),
                  plus100: formatMinutes(plus100Minutes),
                  hours60: formatMinutes(hours60Minutes),
                  hours100: formatMinutes(plus100Minutes),
                  plus60Minutes,
                  minus60Minutes,
                  plus100Minutes,
                  hours60Minutes,
                  hours100Minutes: plus100Minutes,
                  hrs303Minutes,
                  hrs304Minutes,
                  hrs505Minutes,
                  hrs506Minutes,
                  hrs511Minutes,
                  hrs512Minutes,
                }
              }
              rowsToGroup = uniqueOvertime
                .filter((u: any) => String(u.registration) === needleReg)
                .map((u: any) => mapRawToOvertimeRow(u))
            } else {
              // Build rowsToGroup as a union of `filteredRows` and `mappedRows`,
              // deduplicated by `id`, preserving `filteredRows` ordering.
              const rowsToGroupMap = new Map<string, OvertimeRow>()
              filteredRows.forEach((r) => rowsToGroupMap.set(String(r.id), r))
              mappedRows.forEach((m) => {
                if (!rowsToGroupMap.has(String(m.id))) rowsToGroupMap.set(String(m.id), m)
              })
              rowsToGroup = Array.from(rowsToGroupMap.values())
            }
            try {
              const dbgId = '204575'
              const mappedIds = mappedRows.filter((m) => String(m.registration) === dbgId).map((m) => String(m.id))
              const filteredIds = filteredRows.filter((f) => String(f.registration) === dbgId).map((f) => String(f.id))
              const rowsToGroupIds = rowsToGroup.filter((r) => String(r.registration) === dbgId).map((r) => String(r.id))
              // eslint-disable-next-line no-console
              if (showDbg()) console.debug('[OVERTIME-DBG] id=', dbgId, 'mappedIds=', mappedIds.length, mappedIds, 'filteredIds=', filteredIds.length, filteredIds, 'rowsToGroupIds=', rowsToGroupIds.length, rowsToGroupIds)
            } catch (e) {
              // ignore
            }

            rowsToGroup.forEach((row) => {
              const current = grouped.get(row.registration) ?? {
                registration: row.registration,
                name: row.name,
                company: row.company,
                companyValue: row.companyValue,
                companyLabel: row.companyLabel,
                sector: row.sector,
                sectorOriginal: row.sectorOriginal,
                salary: row.salary ?? 0,
                plus60Minutes: 0,
                minus60Minutes: 0,
                plus100Minutes: 0,
                hours60Minutes: 0,
                hours100Minutes: 0,
                hrs303Minutes: 0,
                hrs304Minutes: 0,
                hrs505Minutes: 0,
                hrs506Minutes: 0,
                hrs511Minutes: 0,
                hrs512Minutes: 0,
                minDate: row.dateIso || null,
                maxDate: row.dateIso || null,
              }
              if (row.salary && row.salary > 0) current.salary = row.salary
              current.plus60Minutes += row.plus60Minutes
              current.minus60Minutes += row.minus60Minutes
              current.plus100Minutes += row.plus100Minutes
              // não acumular `hours60Minutes`/`hours100Minutes` aqui — iremos
              // calcular o saldo (net) a partir de `plus60Minutes` e `minus60Minutes`
              // quando formos mapear para a linha agrupada.
              current.hrs303Minutes += row.hrs303Minutes
              current.hrs304Minutes += row.hrs304Minutes
              current.hrs505Minutes += row.hrs505Minutes
              current.hrs506Minutes += row.hrs506Minutes
              current.hrs511Minutes += row.hrs511Minutes
              current.hrs512Minutes += row.hrs512Minutes
              if (row.dateIso) {
                if (!current.minDate || row.dateIso < current.minDate) current.minDate = row.dateIso
                if (!current.maxDate || row.dateIso > current.maxDate) current.maxDate = row.dateIso
              }
              if (row.name) current.name = row.name
              if (row.sector) current.sector = row.sector
              grouped.set(row.registration, current)
            })

            // Diagnostic logging for a specific registration to help debug
            // discrepancies between daily sums and grouped sums. Use
            // `rowsToGroup` (os dados efetivamente agrupados) em vez de
            // `filteredRows` para evitar confusão quando incluímos linhas
            // extras no fallback.
            try {
              const dbgIds = ['202079', '204575']
              dbgIds.forEach((dbgId) => {
                const rowsForDbg = rowsToGroup.filter((r) => String(r.registration) === dbgId)
                if (rowsForDbg.length > 0) {
                  const sumDaily = rowsForDbg.reduce((acc, r) => acc + (r.hours60Minutes ?? r.plus60Minutes ?? 0), 0)
                  const sumPlus60 = rowsForDbg.reduce((acc, r) => acc + (r.plus60Minutes ?? 0), 0)
                  const sumMinus60 = rowsForDbg.reduce((acc, r) => acc + (r.minus60Minutes ?? 0), 0)
                  // eslint-disable-next-line no-console
                  if (showDbg() || dbgId === '204575') console.debug('[OVERTIME-DBG] id=', dbgId, 'rowsToGroup count=', rowsForDbg.length, 'sumDaily=', sumDaily, 'sumPlus60=', sumPlus60, 'sumMinus60=', sumMinus60)
                  // eslint-disable-next-line no-console
                  if (showDbg() || dbgId === '204575')
                    console.table(
                      rowsForDbg.map((r) => ({
                        id: r.id,
                        date: r.dateIso,
                        dateShort: r.dateShort,
                        hrs303: r.hrs303,
                        hrs304: r.hrs304,
                        hrs505: r.hrs505,
                        hrs506: r.hrs506,
                        hrs511: r.hrs511,
                        hrs512: r.hrs512,
                        plus60: r.plus60,
                        plus60Minutes: r.plus60Minutes,
                        minus60Minutes: r.minus60Minutes,
                        hours60Minutes: r.hours60Minutes,
                        hours60Label: formatMinutes(r.hours60Minutes ?? 0),
                      })),
                    )
                }
              })
            } catch (e) {
              // ignore
            }

            return Array.from(grouped.values()).map((g) => {
              const rangeLabel = formatDayRange(g.minDate, g.maxDate)
              // Diagnostic: log grouped totals for debug registrations
              try {
                const dbgIds = ['202079', '204575']
                if (dbgIds.includes(String(g.registration))) {
                  const netHours60 = (g.plus60Minutes || 0) - (g.minus60Minutes || 0)
                  const netHours100 = g.plus100Minutes || 0
                  // eslint-disable-next-line no-console
                  if (showDbg())
                    console.debug(
                      '[OVERTIME-DBG] grouped for',
                      g.registration,
                      'plus60=', g.plus60Minutes,
                      'minus60=', g.minus60Minutes,
                      'netHours60=', netHours60,
                      'netHours100=', netHours100,
                    )
                }
              } catch (e) {
                // ignore
              }
              return {
                id: g.registration,
                dateIso: g.maxDate ?? '',
                date: rangeLabel,
                dateShort: rangeLabel,
                company: g.company,
                companyValue: g.companyValue,
                companyLabel: g.companyLabel,
                registration: g.registration,
                registrationValue: Number(g.registration) || 0,
                name: g.name,
                sector: g.sector,
                sectorOriginal: g.sectorOriginal,
                salary: g.salary,
                plus60: formatMinutes(g.plus60Minutes),
                minus60: formatMinutes(g.minus60Minutes),
                plus100: formatMinutes(g.plus100Minutes),
                // calcular saldo líquido (plus - minus) para 60%
                hours60: formatMinutes((g.plus60Minutes || 0) - (g.minus60Minutes || 0)),
                hours100: formatMinutes(g.plus100Minutes || 0),
                hrs303: formatMinutes(g.hrs303Minutes),
                hrs304: formatMinutes(g.hrs304Minutes),
                hrs505: formatMinutes(g.hrs505Minutes),
                hrs506: formatMinutes(g.hrs506Minutes),
                hrs511: formatMinutes(g.hrs511Minutes),
                hrs512: formatMinutes(g.hrs512Minutes),
                plus60Minutes: g.plus60Minutes,
                minus60Minutes: g.minus60Minutes,
                plus100Minutes: g.plus100Minutes,
                hours60Minutes: (g.plus60Minutes || 0) - (g.minus60Minutes || 0),
                hours100Minutes: g.plus100Minutes || 0,
                hrs303Minutes: g.hrs303Minutes,
                hrs304Minutes: g.hrs304Minutes,
                hrs505Minutes: g.hrs505Minutes,
                hrs506Minutes: g.hrs506Minutes,
                hrs511Minutes: g.hrs511Minutes,
                hrs512Minutes: g.hrs512Minutes,
              }
            })
          })()

        setRows(finalRows)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao buscar horas extras'
        setError(msg)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOvertime()
  }, [filterCompany, filterDay, filterMonth, filterSector, filterText, filterYear, supabaseKey, supabaseUrl])

  useEffect(() => {
    if (availableCompanies.length > 0 && (!filterCompany || !availableCompanies.includes(filterCompany))) {
      setFilterCompany(availableCompanies[0])
    }
  }, [availableCompanies, filterCompany])

  useEffect(() => {
    if (availableYears.length === 0) return
    if (availableYears.includes(filterYear)) return
    if (availableYears.includes(currentYear)) {
      setFilterYear(currentYear)
    } else {
      setFilterYear(availableYears[0])
    }
  }, [availableYears, currentYear, filterYear])

  useEffect(() => {
    if (availableMonths.length === 0) return
    if (availableMonths.includes(filterMonth)) return
    if (availableMonths.includes(currentMonth)) {
      setFilterMonth(currentMonth)
    } else {
      setFilterMonth(availableMonths[0])
    }
  }, [availableMonths, currentMonth, filterMonth])

  const toggleSort = (key: OvertimeSortKey) => {
    setSort((prev) => {
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

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    const dir = sort.direction === 'asc' ? 1 : -1
    copy.sort((a, b) => {
      switch (sort.key) {
        case 'date': {
          const aVal = a.dateIso || ''
          const bVal = b.dateIso || ''
          if (aVal === bVal) return 0
          return aVal > bVal ? dir : -dir
        }
        case 'company': {
          if (a.companyValue === b.companyValue) return 0
          return a.companyValue > b.companyValue ? dir : -dir
        }
        case 'registration': {
          if (a.registrationValue === b.registrationValue) return 0
          return a.registrationValue > b.registrationValue ? dir : -dir
        }
        case 'name': {
          return a.name.localeCompare(b.name) * dir
        }
        case 'sector': {
          return a.sector.localeCompare(b.sector) * dir
        }
        case 'plus60': {
          if (a.plus60Minutes === b.plus60Minutes) return 0
          return a.plus60Minutes > b.plus60Minutes ? dir : -dir
        }
        case 'minus60': {
          if (a.minus60Minutes === b.minus60Minutes) return 0
          return a.minus60Minutes > b.minus60Minutes ? dir : -dir
        }
        case 'plus100': {
          if (a.plus100Minutes === b.plus100Minutes) return 0
          return a.plus100Minutes > b.plus100Minutes ? dir : -dir
        }
        case 'hours60': {
          if (a.hours60Minutes === b.hours60Minutes) return 0
          return a.hours60Minutes > b.hours60Minutes ? dir : -dir
        }
        case 'hours100': {
          if (a.hours100Minutes === b.hours100Minutes) return 0
          return a.hours100Minutes > b.hours100Minutes ? dir : -dir
        }
        default:
          return 0
      }
    })
    return copy
  }, [rows, sort])

  const totals = useMemo(() => {
    // Use the ungrouped daily rows (`rawRows`) to compute totals so that the
    // aggregated values always reflect the sum of the individual daily entries.
    let total60Minutes = 0
    let total100Minutes = 0
    let totalValue60 = 0
    let totalValue100 = 0

    rawRows.forEach((row) => {
      const salary = salaryByRegistration[row.registration] ?? row.salary ?? 0
      const hours60 = Math.max(row.hours60Minutes ?? row.plus60Minutes ?? 0, 0)
      const hours100 = Math.max(row.hours100Minutes ?? row.plus100Minutes ?? 0, 0)

      total60Minutes += hours60
      total100Minutes += hours100

      if (salary > 0) {
        const hourly = salary / BASE_MONTHLY_HOURS
        if (hours60 > 0) totalValue60 += hourly * 1.6 * (hours60 / 60)
        if (hours100 > 0) totalValue100 += hourly * 2 * (hours100 / 60)
      }
    })

    return {
      total60Label: formatMinutes(total60Minutes),
      total100Label: formatMinutes(total100Minutes),
      totalValue60Label: totalValue60 > 0 ? totalValue60.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-',
      totalValue100Label: totalValue100 > 0 ? totalValue100.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-',
    }
  }, [salaryByRegistration, rawRows])

  const sectorChartData = useMemo(() => {
    const byRegistrationAndSector = new Map<
      string,
      {
        sector: string
        hours60: number
        hours100: number
        salary: number
      }
    >()

    sortedRows.forEach((row) => {
      const sectorRaw = row.sectorOriginal || row.sector || 'Sem setor'
      const sectorNumber = Number(sectorRaw)
      if ((!Number.isNaN(sectorNumber) && sectorNumber <= 0) || sectorRaw === '0' || sectorRaw === '') {
        return
      }
      const sector = sectorRaw
      const key = `${sector}__${row.registration ?? row.id}`
      const current = byRegistrationAndSector.get(key) ?? { sector, hours60: 0, hours100: 0, salary: 0 }
      const hours60Positive = Math.max(row.hours60Minutes ?? 0, 0)
      const hours100Positive = Math.max(row.hours100Minutes ?? row.plus100Minutes ?? 0, 0)
      current.hours60 += hours60Positive
      current.hours100 += hours100Positive
      const salary = salaryByRegistration[row.registration] ?? row.salary ?? 0
      if (salary > 0) current.salary = salary
      byRegistrationAndSector.set(key, current)
    })

    const bySector = new Map<
      string,
      {
        sector: string
        hours60: number
        hours100: number
        value60: number
        value100: number
      }
    >()

    byRegistrationAndSector.forEach((reg) => {
      const sectorKey = reg.sector
      const current = bySector.get(sectorKey) ?? { sector: sectorKey, hours60: 0, hours100: 0, value60: 0, value100: 0 }
      current.hours60 += reg.hours60
      current.hours100 += reg.hours100

      if (reg.salary > 0) {
        const hourly = reg.salary / BASE_MONTHLY_HOURS
        if (reg.hours60 > 0) current.value60 += hourly * 1.6 * (reg.hours60 / 60)
        if (reg.hours100 > 0) current.value100 += hourly * 2 * (reg.hours100 / 60)
      }

      bySector.set(sectorKey, current)
    })

    const data = Array.from(bySector.values())
      .map((item) => {
        const hours60Pos = Number.isFinite(item.hours60) ? Math.max(item.hours60, 0) : 0
        const hours100Pos = Number.isFinite(item.hours100) ? Math.max(item.hours100, 0) : 0
        const value60Safe = Number.isFinite(item.value60) ? Math.max(item.value60, 0) : 0
        const value100Safe = Number.isFinite(item.value100) ? Math.max(item.value100, 0) : 0
        return {
          sector: abbreviateSector(item.sector) || item.sector,
          hours60Hours: hours60Pos / 60,
          hours100Hours: hours100Pos / 60,
          hoursTotal: (hours60Pos + hours100Pos) / 60,
          value60: value60Safe,
          value100: value100Safe,
          valueTotal: value60Safe + value100Safe,
        }
      })
      .filter(
        (item) =>
          item.hours60Hours > CHART_EPS || item.hours100Hours > CHART_EPS || item.value60 > CHART_EPS || item.value100 > CHART_EPS,
      )

    data.sort((a, b) => {
      // Ordena por horas totais; em caso de empate usa valor total
      if (b.hoursTotal !== a.hoursTotal) return b.hoursTotal - a.hoursTotal
      return b.valueTotal - a.valueTotal
    })

    return data
  }, [salaryByRegistration, sortedRows])

  const sectorChartDataHours60 = useMemo(
    () => {
      const data = sectorChartData.filter((item) => item.hours60Hours > CHART_EPS)
      data.sort((a, b) => b.hours60Hours - a.hours60Hours)
      return data
    },
    [sectorChartData],
  )
  const sectorChartDataHours100 = useMemo(
    () => {
      const data = sectorChartData.filter((item) => item.hours100Hours > CHART_EPS)
      data.sort((a, b) => b.hours100Hours - a.hours100Hours)
      return data
    },
    [sectorChartData],
  )
  const sectorChartDataValue60 = useMemo(
    () => {
      const data = sectorChartData.filter((item) => item.value60 > CHART_EPS)
      data.sort((a, b) => b.value60 - a.value60)
      return data
    },
    [sectorChartData],
  )
  const sectorChartDataValue100 = useMemo(
    () => {
      const data = sectorChartData.filter((item) => item.value100 > CHART_EPS)
      data.sort((a, b) => b.value100 - a.value100)
      return data
    },
    [sectorChartData],
  )
  const sectorChartDataHoursTotal = useMemo(
    () => {
      const data = sectorChartData.filter((item) => item.hoursTotal > CHART_EPS)
      data.sort((a, b) => b.hoursTotal - a.hoursTotal)
      return data
    },
    [sectorChartData],
  )
  const sectorChartDataValueTotal = useMemo(
    () => {
      const data = sectorChartData.filter((item) => item.valueTotal > CHART_EPS)
      data.sort((a, b) => b.valueTotal - a.valueTotal)
      return data
    },
    [sectorChartData],
  )

  const monthlyChartData = useMemo(() => {
    type RegMonthKey = string
    const regMonth = new Map<
      RegMonthKey,
      { month: string; hours60: number; hours100: number; salary: number }
    >()

    sortedRows.forEach((row) => {
      if (!row.dateIso) return
      const monthKey = row.dateIso.slice(0, 7) // YYYY-MM
      if (!monthKey) return
      const regKey = `${row.registration}-${monthKey}`
      const salary = salaryByRegistration[row.registration] ?? row.salary ?? 0
      const hours60 = Math.max(row.hours60Minutes ?? 0, 0)
      const hours100 = Math.max(row.hours100Minutes ?? row.plus100Minutes ?? 0, 0)
      const current = regMonth.get(regKey) ?? { month: monthKey, hours60: 0, hours100: 0, salary: 0 }
      current.hours60 += hours60
      current.hours100 += hours100
      if (salary > 0) current.salary = salary
      regMonth.set(regKey, current)
    })

    const byMonth = new Map<
      string,
      { month: string; hours60: number; hours100: number; value60: number; value100: number }
    >()

    regMonth.forEach((item) => {
      const monthAgg =
        byMonth.get(item.month) ?? { month: item.month, hours60: 0, hours100: 0, value60: 0, value100: 0 }
      monthAgg.hours60 += item.hours60
      monthAgg.hours100 += item.hours100
      if (item.salary > 0) {
        const hourly = item.salary / BASE_MONTHLY_HOURS
        monthAgg.value60 += hourly * 1.6 * (item.hours60 / 60)
        monthAgg.value100 += hourly * 2 * (item.hours100 / 60)
      }
      byMonth.set(item.month, monthAgg)
    })

    return Array.from(byMonth.values())
      .sort((a, b) => (a.month > b.month ? 1 : -1))
      .map((m) => {
        const [year, month] = m.month.split('-')
        const label = month && year ? `${month}/${year.slice(-2)}` : m.month
        return {
          ...m,
          label,
          hours60Label: formatMinutes(m.hours60),
          hours100Label: formatMinutes(m.hours100),
          value60Label: m.value60 > 0 ? m.value60.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '',
          value100Label: m.value100 > 0 ? m.value100.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '',
        }
      })
  }, [salaryByRegistration, sortedRows])

  const tableContent = useMemo(() => {
    if (!supabaseUrl || !supabaseKey) {
      return <p className="text-sm text-amber-200">Defina VITE_SUPABASE_URL e VITE_SUPABASE_KEY para carregar os dados.</p>
    }
    if (error) {
      return <p className="text-sm text-rose-200">{error}</p>
    }
    if (isLoading) {
      return <p className="text-sm text-white/80">Carregando horas extras...</p>
    }
    if (rows.length === 0) {
      return <p className="text-sm text-white/70">Nenhum lançamento encontrado.</p>
    }
    return (
      <div className="border border-emerald-400/40 rounded-lg overflow-hidden bg-slate-900/60 shadow-lg shadow-emerald-500/10">
        <div className="overflow-x-auto overflow-y-auto max-h-[460px]">
          <table className="w-full text-left text-sm text-white/80">
            <thead className="bg-green-800 text-[11px] uppercase tracking-[0.2em] text-white/70 sticky top-0 z-10 backdrop-blur">
              <tr>
                <th className="px-2 py-2 font-semibold text-center">
                  <button type="button" className="inline-flex items-center" onClick={() => toggleSort('date')}>
                    Data
                    {renderSortIndicator(sort.key === 'date', sort.direction, 'number')}
                  </button>
                </th>
                <th className="px-2 py-2 font-semibold text-center">
                  <button type="button" className="inline-flex items-center" onClick={() => toggleSort('company')}>
                    Emp
                    {renderSortIndicator(sort.key === 'company', sort.direction, 'number')}
                  </button>
                </th>
                <th className="px-2 py-2 font-semibold text-center">
                  <button type="button" className="inline-flex items-center" onClick={() => toggleSort('registration')}>
                    Cadastro
                    {renderSortIndicator(sort.key === 'registration', sort.direction, 'number')}
                  </button>
                </th>
                <th className="px-2 py-2 font-semibold">
                  <button type="button" className="inline-flex items-center" onClick={() => toggleSort('name')}>
                    Nome
                    {renderSortIndicator(sort.key === 'name', sort.direction, 'text')}
                  </button>
                </th>
                {filterText ? (
                  <>
                    <th className="px-2 py-2 font-semibold text-center">+100%</th>
                    <th className="px-2 py-2 font-semibold text-center">+100% Nt</th>
                    <th className="px-2 py-2 font-semibold text-center">+60%</th>
                    <th className="px-2 py-2 font-semibold text-center">+60% Nt</th>
                    <th className="px-2 py-2 font-semibold text-center">-60%</th>
                    <th className="px-2 py-2 font-semibold text-center">-60% Nt</th>
                    <th className="px-2 py-2 font-semibold text-center">Ações</th>
                  </>
                ) : (
                  <>
                    <th className="px-2 py-2 font-semibold">
                      <button type="button" className="inline-flex items-center" onClick={() => toggleSort('sector')}>
                        Setor
                        {renderSortIndicator(sort.key === 'sector', sort.direction, 'text')}
                      </button>
                    </th>
                    <th className="px-2 py-2 font-semibold text-center">
                      <button type="button" className="inline-flex items-center" onClick={() => toggleSort('plus60')}>
                        +60%
                        {renderSortIndicator(sort.key === 'plus60', sort.direction, 'number')}
                      </button>
                    </th>
                    <th className="px-2 py-2 font-semibold text-center">
                      <button type="button" className="inline-flex items-center" onClick={() => toggleSort('minus60')}>
                        -60%
                        {renderSortIndicator(sort.key === 'minus60', sort.direction, 'number')}
                      </button>
                    </th>
                    <th className="px-2 py-2 font-semibold text-center">
                      <button type="button" className="inline-flex items-center" onClick={() => toggleSort('plus100')}>
                        +100%
                        {renderSortIndicator(sort.key === 'plus100', sort.direction, 'number')}
                      </button>
                    </th>
                    <th className="px-2 py-2 font-semibold text-center">
                      <button type="button" className="inline-flex items-center" onClick={() => toggleSort('hours60')}>
                        Hrs 60%
                        {renderSortIndicator(sort.key === 'hours60', sort.direction, 'number')}
                      </button>
                    </th>
                    <th className="px-2 py-2 font-semibold text-center">
                      <button type="button" className="inline-flex items-center" onClick={() => toggleSort('hours100')}>
                        Hrs 100%
                        {renderSortIndicator(sort.key === 'hours100', sort.direction, 'number')}
                      </button>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id} className="border-t border-white/5 hover:bg-emerald-500/5 transition-colors">
                  <td className="py-1 whitespace-nowrap text-xs text-center">{row.dateShort}</td>
                  <td className="py-1 text-center text-xs">{row.company}</td>
                  <td className="py-1 text-center text-xs">{row.registration}</td>
                  <td className="py-1">{row.name}</td>
                  {filterText ? (
                    <>
                      <td className="py-1 px-1 text-center align-middle">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[6px] text-white text-center focus:border-emerald-400 outline-none"
                            id={`edit-${editingId}-hrs303`}
                            value={editingValues?.hrs303 ?? ''}
                            onChange={handleEditInputChange('hrs303')}
                            inputMode="numeric"
                            pattern="\\d*"
                            onKeyDown={handleEditKeyDown('hrs303')}
                          />
                        ) : (
                          row.hrs303
                        )}
                      </td>
                      <td className="py-1 px-1 text-center align-middle">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[6px] text-white text-center focus:border-emerald-400 outline-none"
                            id={`edit-${editingId}-hrs304`}
                            value={editingValues?.hrs304 ?? ''}
                            onChange={handleEditInputChange('hrs304')}
                            inputMode="numeric"
                            pattern="\\d*"
                            onKeyDown={handleEditKeyDown('hrs304')}
                          />
                        ) : (
                          row.hrs304
                        )}
                      </td>
                      <td className="py-1 px-1 text-center align-middle">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[6px] text-white text-center focus:border-emerald-400 outline-none"
                            id={`edit-${editingId}-hrs505`}
                            value={editingValues?.hrs505 ?? ''}
                            onChange={handleEditInputChange('hrs505')}
                            inputMode="numeric"
                            pattern="\\d*"
                            onKeyDown={handleEditKeyDown('hrs505')}
                          />
                        ) : (
                          row.hrs505
                        )}
                      </td>
                      <td className="py-1 px-1 text-center align-middle">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[6px] text-white text-center focus:border-emerald-400 outline-none"
                            id={`edit-${editingId}-hrs506`}
                            value={editingValues?.hrs506 ?? ''}
                            onChange={handleEditInputChange('hrs506')}
                            inputMode="numeric"
                            pattern="\\d*"
                            onKeyDown={handleEditKeyDown('hrs506')}
                          />
                        ) : (
                          row.hrs506
                        )}
                      </td>
                      <td className="py-1 px-1 text-center align-middle">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[6px] text-white text-center focus:border-emerald-400 outline-none"
                            id={`edit-${editingId}-hrs511`}
                            value={editingValues?.hrs511 ?? ''}
                            onChange={handleEditInputChange('hrs511')}
                            inputMode="numeric"
                            pattern="\\d*"
                            onKeyDown={handleEditKeyDown('hrs511')}
                          />
                        ) : (
                          row.hrs511
                        )}
                      </td>
                      <td className="py-1 px-1 text-center align-middle">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[6px] text-white text-center focus:border-emerald-400 outline-none"
                            id={`edit-${editingId}-hrs512`}
                            value={editingValues?.hrs512 ?? ''}
                            onChange={handleEditInputChange('hrs512')}
                            inputMode="numeric"
                            pattern="\\d*"
                            onKeyDown={handleEditKeyDown('hrs512')}
                          />
                        ) : (
                          row.hrs512
                        )}
                      </td>
                      <td className="py-1 text-center">
                        <div className="inline-flex items-center gap-2 text-emerald-100">
                          {editingId === row.id ? (
                            <>
                              <button
                                type="button"
                                id={`edit-${editingId}-save`}
                                className="p-1 rounded hover:bg-lime-500/20 transition-colors text-lime-500 disabled:opacity-50"
                                title="Salvar"
                                onClick={saveEditRow}
                                disabled={isSavingEdit}
                              >
                                <Check className="w-5 h-5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-rose-500/20 transition-colors text-rose-500 disabled:opacity-50"
                                title="Cancelar"
                                onClick={cancelEditRow}
                                disabled={isSavingEdit}
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="p-1 rounded hover:bg-lime-500/20 transition-colors text-lime-600" title="Editar" onClick={() => startEditRow(row)}>
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-rose-500/20 transition-colors text-rose-600 disabled:opacity-50"
                                title="Excluir"
                                onClick={() => handleDeleteRow(row)}
                                disabled={isSavingEdit}
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-1 text-xs">{row.sector}</td>
                      <td className="py-1 text-center">{row.plus60}</td>
                      <td className="py-1 text-center">{row.minus60}</td>
                      <td className="py-1 text-center">{row.plus100}</td>
                      <td className="py-1 text-center text-blue-400 font-semibold">{row.hours60}</td>
                      <td className="py-1 text-center text-red-500 font-semibold">{row.hours100}</td>
                    </>
                  )}
                </tr>
              ))}
              {/* Linha de total quando filtro por Nome/Cadastro estiver ativo */}
              {filterText && (() => {
                const sumHrs303 = sortedRows.reduce((acc, r) => acc + (r.hrs303Minutes ?? 0), 0)
                const sumHrs304 = sortedRows.reduce((acc, r) => acc + (r.hrs304Minutes ?? 0), 0)
                const sumHrs505 = sortedRows.reduce((acc, r) => acc + (r.hrs505Minutes ?? 0), 0)
                const sumHrs506 = sortedRows.reduce((acc, r) => acc + (r.hrs506Minutes ?? 0), 0)
                const sumHrs511 = sortedRows.reduce((acc, r) => acc + (r.hrs511Minutes ?? 0), 0)
                const sumHrs512 = sortedRows.reduce((acc, r) => acc + (r.hrs512Minutes ?? 0), 0)

                return (
                  <tr className="border-t border-white/5 bg-emerald-500/5 font-semibold">
                    <td className="py-1 whitespace-nowrap text-xs text-center"></td>
                    <td className="py-1 text-center text-xs"></td>
                    <td className="py-1 text-center text-xs"></td>
                    <td className="py-1">Total</td>
                    <td className="py-1 px-1 text-center align-middle">{formatMinutes(sumHrs303)}</td>
                    <td className="py-1 px-1 text-center align-middle">{formatMinutes(sumHrs304)}</td>
                    <td className="py-1 px-1 text-center align-middle">{formatMinutes(sumHrs505)}</td>
                    <td className="py-1 px-1 text-center align-middle">{formatMinutes(sumHrs506)}</td>
                    <td className="py-1 px-1 text-center align-middle">{formatMinutes(sumHrs511)}</td>
                    <td className="py-1 px-1 text-center align-middle">{formatMinutes(sumHrs512)}</td>
                    <td className="py-1 text-center"></td>
                  </tr>
                )
              })()}
            </tbody>
          </table>
        </div>
      </div>
    )
  }, [editingId, editingValues, error, isLoading, rows, sortedRows, supabaseKey, supabaseUrl])

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
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 shadow-inner shadow-black/10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-emerald-200 font-semibold">
              <Clock className="w-6 h-6 text-amber-300" />
              HORAS EXTRAS
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-[0.2em]">
                <Filter className="w-4 h-4 text-emerald-300" />
                Filtros
              </div>
              <select
                className="w-23 bg-white/5 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
                value={filterCompany}
                onChange={(e) => {
                  clearNameFilter()
                  setFilterCompany(e.target.value)
                }}
              >
                {availableCompanies.map((company) => (
                  <option key={company} value={company} className="bg-slate-900">
                    {formatCompanyLabel(company)}
                  </option>
                ))}
              </select>
              <select
                className="w-30 bg-white/5 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
                value={filterSector}
                onChange={(e) => {
                  clearNameFilter()
                  setFilterSector(e.target.value)
                }}
              >
                <option value="" className="bg-slate-900">Setor</option>
                {availableSectors.map((sector) => (
                  <option key={sector} value={sector} className="bg-slate-900">
                    {abbreviateSector(sector)}
                  </option>
                ))}
              </select>
              <select
                className="w-18 bg-white/5 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
                value={filterYear}
                onChange={(e) => {
                  clearNameFilter()
                  setFilterYear(e.target.value)
                }}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year} className="bg-slate-900">
                    {year}
                  </option>
                ))}
              </select>
              <select
                className="w-16 bg-white/5 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
                value={filterMonth}
                onChange={(e) => {
                  clearNameFilter()
                  setFilterMonth(e.target.value)
                }}
              >
                {availableMonths.map((month) => (
                  <option key={month} value={month} className="bg-slate-900">
                    {month}
                  </option>
                ))}
              </select>
              <select
                className="w-14 bg-white/5 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
                value={filterDay}
                onChange={(e) => {
                  clearNameFilter()
                  setFilterDay(e.target.value)
                }}
              >
                <option value="" className="bg-slate-900">Dia</option>
                {availableDays.map((day) => (
                  <option key={day} value={day} className="bg-slate-900">
                    {day}
                  </option>
                ))}
              </select>

              <div className="w-full sm:w-48 relative">
                <input
                  type="text"
                  placeholder="Nome ou Cadastro"
                  className="w-full bg-white/5 text-emerald-300 text-sm border border-white/15 rounded-md pr-8 pl-2 py-1.5 outline-none focus:border-emerald-400"
                  value={filterTextInput}
                  onChange={(e) => setFilterTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyNameFilter()
                  }}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-200 hover:text-emerald-100"
                  title="Pesquisar Nome"
                  aria-label="Aplicar filtro"
                  onClick={applyNameFilter}
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-blue-900/30 border border-blue-500/40 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <Clock className="w-4 h-4 text-emerald-300" />
              Lançamentos de horas extras
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50">
                Exibindo {rows.length} registro(s) | <span className="text-blue-400 font-semibold">Hrs 60%: {totals.total60Label}</span> |{' '}
                <span className="text-red-500 font-semibold">Hrs 100%: {totals.total100Label}</span> |{' '}
                <span className="text-blue-300 font-semibold">Valores 60%: {totals.totalValue60Label}</span> |{' '}
                <span className="text-red-500 font-semibold">Valores 100%: {totals.totalValue100Label}</span>
              </span>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-emerald-400/50 text-emerald-200 text-xs hover:bg-emerald-500/10 transition-colors"
                onClick={() => setShowTable((prev) => !prev)}
                title={showTable ? 'Ocultar tabela' : 'Mostrar tabela'}
              >
                {showTable ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          {showTable && tableContent}
        </div>
        <div className="bg-blue-900/30 border border-blue-500/40 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between text-white/70 text-sm mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-300" />
              Distribuição das Horas por Setores
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-md border border-emerald-400/40 bg-white/5 text-emerald-100 font-semibold">
                Total 60%: {totals.total60Label}
              </span>
              <span className="px-2 py-1 rounded-md border border-rose-400/40 bg-white/5 text-rose-100 font-semibold">
                Total 100%: {totals.total100Label}
              </span>
            </div>
          </div>
          {sectorChartData.length === 0 ? (
            <p className="text-sm text-white/60">Nenhum dado para exibir gráficos.</p>
          ) : (
            <div className="space-y-4">
              {/* GRAFICO - HORAS 60% */}
              <div className="bg-white/5 border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/10">
                <p className="text-xs text-white/60 mb-2">Horas 60%</p>
                <div className="mt-2 h-80 rounded-lg border border-white/10 bg-white/5 chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorChartDataHours60} margin={{ top: 20, right: 16, left: 0, bottom: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                      <XAxis
                        dataKey="sector"
                        tick={<SectorTick />}
                        axisLine={{ stroke: '#475569' }}
                        interval={0}
                        height={80}
                      />
                      <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                      <Tooltip cursor={{ fill: 'transparent' }} content={barTooltipHours} />
                      <Bar dataKey="hours60Hours" fill="#38bdf8" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                        <LabelList dataKey="hours60Hours" position="top" formatter={formatLabelHours} fill="#e2e8f0" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* GRAFICO - HORAS 100% */}
              <div className="bg-white/5 border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/10">
                <p className="text-xs text-white/60 mb-2">Horas 100%</p>
                {sectorChartDataHours100.length === 0 ? (
                  <div className="mt-2 h-80 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/60 text-sm">
                    Sem dados para exibir.
                  </div>
                ) : (
                  <div className="mt-2 h-80 rounded-lg border border-white/10 bg-white/5 chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorChartDataHours100} margin={{ top: 20, right: 16, left: 0, bottom: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                        <XAxis dataKey="sector" tick={<SectorTick />} axisLine={{ stroke: '#475569' }} interval={0} height={80} />
                        <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                        <Tooltip cursor={{ fill: 'transparent' }} content={barTooltipHours} />
                        <Bar dataKey="hours100Hours" fill="#f43f5e" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="hours100Hours" position="top" formatter={formatLabelHours} fill="#e2e8f0" fontSize={11} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              {/* GRAFICO - HORAS 60% + 100% */}
              <div className="bg-white/5 border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/10">
                <p className="text-xs text-white/60 mb-2">Horas 60% + 100%</p>
                {sectorChartDataHoursTotal.length === 0 ? (
                  <div className="mt-2 h-80 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/60 text-sm">
                    Sem dados para exibir.
                  </div>
                ) : (
                  <div className="mt-2 h-80 rounded-lg border border-white/10 bg-white/5 chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorChartDataHoursTotal} margin={{ top: 20, right: 16, left: 0, bottom: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                        <XAxis dataKey="sector" tick={<SectorTick />} axisLine={{ stroke: '#475569' }} interval={0} height={80} />
                        <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                        <Tooltip cursor={{ fill: 'transparent' }} content={barTooltipHours} />
                        <Bar dataKey="hoursTotal" fill="#22c55e" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="hoursTotal" position="top" formatter={formatLabelHours} fill="#e2e8f0" fontSize={11} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-900/30 border border-blue-500/40 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between text-white/70 text-sm mb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-300" />
              Distribuição dos Valores das Horas Extras por Setores
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-md border border-emerald-400/40 bg-white/5 text-emerald-100 font-semibold">
                Valor 60%: {totals.totalValue60Label}
              </span>
              <span className="px-2 py-1 rounded-md border border-rose-400/40 bg-white/5 text-rose-100 font-semibold">
                Valor 100%: {totals.totalValue100Label}
              </span>
            </div>
          </div>
          {sectorChartData.length === 0 ? (
            <p className="text-sm text-white/60">Nenhum dado para exibir gráficos.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {/* GRAFICO - VALOR 60% */}
              <div className="bg-white/5 border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/10">
                <p className="text-xs text-white/60 mb-2">Valores 60%</p>
                <div className="mt-2 h-96 rounded-lg border border-white/10 bg-white/5 chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorChartDataValue60} margin={{ top: 70, right: 16, left: 0, bottom: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                      <XAxis dataKey="sector" tick={<SectorTick />} axisLine={{ stroke: '#475569' }} interval={0} height={80} />
                      <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                      <Tooltip cursor={{ fill: 'transparent' }} content={barTooltipValues} />
                      <Bar dataKey="value60" fill="#38bdf8" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                        <LabelList dataKey="value60" content={rotatedLabelValue60} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* GRAFICO - VALOR 100% */}
              <div className="bg-white/5 border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/10">
                <p className="text-xs text-white/60 mb-2">Valores 100%</p>
                {sectorChartDataValue100.length === 0 ? (
                  <div className="mt-2 h-96 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/60 text-sm">
                    Sem dados para exibir.
                  </div>
                ) : (
                  <div className="mt-2 h-96 rounded-lg border border-white/10 bg-white/5 chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorChartDataValue100} margin={{ top: 70, right: 16, left: 0, bottom: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                        <XAxis dataKey="sector" tick={<SectorTick />} axisLine={{ stroke: '#475569' }} interval={0} height={80} />
                        <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                        <Tooltip cursor={{ fill: 'transparent' }} content={barTooltipValues} />
                        <Bar dataKey="value100" fill="#f43f5e" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          <LabelList
                            dataKey="value100"
                            position="top"
                            formatter={(value: unknown) => {
                              const num = Number(value ?? 0)
                              return num > 0 ? num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
                            }}
                            fill="#e2e8f0"
                            fontSize={11}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              {/* GRAFICO - VALOR 60% + 100% */}
              <div className="bg-white/5 border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/10">
                <p className="text-xs text-white/60 mb-2">Valores 60% + 100%</p>
                <div className="mt-2 h-96 rounded-lg border border-white/10 bg-white/5 chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorChartDataValueTotal} margin={{ top: 70, right: 16, left: 0, bottom: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                      <XAxis dataKey="sector" tick={<SectorTick />} axisLine={{ stroke: '#475569' }} interval={0} height={80} />
                      <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                      <Tooltip cursor={{ fill: 'transparent' }} content={barTooltipValues} />
                      <Bar dataKey="valueTotal" fill="#22c55e" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                        <LabelList dataKey="valueTotal" content={rotatedLabelValueTotal} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* GRAFICO - DISTRIBUIÇÃO MENSAL */}
        <div className="bg-blue-900/30 border border-blue-500/40 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between text-white/70 text-sm mb-3">
            <div className="flex items-center gap-2">
              <ChartLine className="w-4 h-4 text-emerald-300" />
              Distribuição mensal (Horas e Valores)
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-md border border-emerald-400/40 bg-white/5 text-emerald-100 font-semibold">
                Total 60%: {totals.total60Label}
              </span>
              <span className="px-2 py-1 rounded-md border border-rose-400/40 bg-white/5 text-rose-100 font-semibold">
                Total 100%: {totals.total100Label}
              </span>
              <span className="px-2 py-1 rounded-md border border-emerald-400/40 bg-white/5 text-emerald-100 font-semibold">
                Valor 60%: {totals.totalValue60Label}
              </span>
              <span className="px-2 py-1 rounded-md border border-rose-400/40 bg-white/5 text-rose-100 font-semibold">
                Valor 100%: {totals.totalValue100Label}
              </span>
            </div>
          </div>
          {monthlyChartData.length === 0 ? (
            <p className="text-sm text-white/60">Nenhum dado para exibir gráficos.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/10">
                <p className="text-xs text-white/60 mb-2">Horas 60% e 100%</p>
                <div className="mt-2 h-72 rounded-lg border border-white/10 bg-white/5 chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyChartData} margin={{ top: 30, right: 16, left: 0, bottom: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                      <XAxis dataKey="label" tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} />
                      <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                      <Tooltip cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} content={renderMonthlyHoursTooltip} />
                      <Line type="monotone" dataKey="hours60" name="Horas 60%" stroke="#38bdf8" strokeWidth={4} dot={{ r: 4 }} isAnimationActive={false}>
                        <LabelList
                          dataKey="hours60"
                          position="top"
                          formatter={(value: unknown) => formatMinutes(Math.round(Number(value ?? 0)))}
                          fill="#e2e8f0"
                          fontSize={10}
                        />
                      </Line>
                      <Line type="monotone" dataKey="hours100" name="Horas 100%" stroke="#f43f5e" strokeWidth={4} dot={{ r: 4 }} isAnimationActive={false}>
                        <LabelList
                          dataKey="hours100"
                          position="top"
                          formatter={(value: unknown) => formatMinutes(Math.round(Number(value ?? 0)))}
                          fill="#e2e8f0"
                          fontSize={10}
                        />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white/5 border border-emerald-400/40 rounded-lg p-3 shadow-lg shadow-emerald-500/10">
                <p className="text-xs text-white/60 mb-2">Valores 60% e 100%</p>
                <div className="mt-2 h-72 rounded-lg border border-white/10 bg-white/5 chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyChartData} margin={{ top: 30, right: 16, left: 0, bottom: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" />
                      <XAxis dataKey="label" tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} />
                      <YAxis tick={{ fill: '#9aa4b3ff', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickCount={8} />
                      <Tooltip cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} content={renderMonthlyValuesTooltip} />
                      <Line type="monotone" dataKey="value60" name="Valor 60%" stroke="#38bdf8" strokeWidth={4} dot={{ r: 4 }} isAnimationActive={false}>
                        <LabelList
                          dataKey="value60"
                          position="top"
                          formatter={(value: unknown) => {
                            const num = Number(value ?? 0)
                            return num > 0 ? num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
                          }}
                          fill="#e2e8f0"
                          fontSize={10}
                        />
                      </Line>
                      <Line type="monotone" dataKey="value100" name="Valor 100%" stroke="#f43f5e" strokeWidth={4} dot={{ r: 4 }} isAnimationActive={false}>
                        <LabelList
                          dataKey="value100"
                          position="top"
                          formatter={(value: unknown) => {
                            const num = Number(value ?? 0)
                            return num > 0 ? num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
                          }}
                          fill="#e2e8f0"
                          fontSize={10}
                        />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        <ConfirmDeleteModal
          open={deleteModalOpen}
          title="Excluir horas extras"
          description={
            <p>
              Excluindo <span className="text-rose-300">{deleteTarget?.dateShort ?? '--'}</span> -{' '}
              <span className="text-rose-300">{deleteTarget?.name ?? '--'}</span> confirma?
            </p>
          }
          passwordValue={deletePassword}
          passwordError={deletePasswordError}
          attempts={deleteAttempts}
          onPasswordChange={(value) => {
            setDeletePassword(value)
            setDeletePasswordError(null)
          }}
          onCancel={() => {
            resetDeleteState()
          }}
          onConfirm={confirmDeleteRow}
          confirmLabel={isDeleting ? 'Excluindo...' : 'Excluir'}
          cancelLabel="Cancelar"
        />
      </div>
    </>
  )
}

export default OperationsOvertimePanel
