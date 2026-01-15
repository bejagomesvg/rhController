import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Factory,
  Filter,
  Plus,
  Edit,
  Trash2,
  NotebookPen,
  Check,
  X as XIcon,
  ArrowDown01,
  ArrowDown10,
  ArrowDownAZ,
  ArrowDownZA,
  EyeOff,
  Eye,
} from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import 'react-day-picker/dist/style.css'
import { toast, Toaster } from 'react-hot-toast'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import { loadSession } from '../../services/sessionService'
import { verifyPassword } from '../../services/authService'
import {
  upsertProductionRow,
  fetchProductionRows,
  fetchClosingProductionRows,
  deleteProductionRow,
  deleteProductionRowsByIds,
  insertProductionRows,
  deleteClosingProductionRowsByIds,
  insertClosingProductionRows,
  toNumberOrNull,
} from '../../services/productionService'
import { fetchEmployeeCompanies } from '../../services/employeeService'

interface OperationsProducaoPanelProps {
  supabaseUrl?: string;
  supabaseKey?: string;
}

type ProductionRow = {
  id: number;
  company: number | '';
  date: string;
  slaughtered: number | '';
  compraTraseiro: number | '';
  compraDianteiro: number | '';
  compraPA: number | '';
  vendaTraseiro: number | '';
  vendaDianteiro: number | '';
  vendaPA: number | '';
  desossaTraseiro: number | '';
  desossaDianteiro: number | '';
  desossaPA: number | '';
  userRegistration?: string | null;
  dateRegistration?: string | null;
  isNew?: boolean;
  isClosure?: boolean;
}

const OperationsProducaoPanel: React.FC<OperationsProducaoPanelProps> = ({ supabaseUrl, supabaseKey }) => {
  const resolvedSupabaseUrl = supabaseUrl ?? (import.meta as any).env?.VITE_SUPABASE_URL
  const resolvedSupabaseKey = supabaseKey ?? (import.meta as any).env?.VITE_SUPABASE_KEY
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [closePassword, setClosePassword] = useState('')
  const [closePasswordError, setClosePasswordError] = useState<'required' | 'invalid' | null>(null)
  const [closeAttempts, setCloseAttempts] = useState(0)
  const [isClosing, setIsClosing] = useState(false)
  const [isClosureTableVisible, setIsClosureTableVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('prod-closure-visible') !== '0'
  })
  const [tableHidden, setTableHidden] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('prod-table-hidden') === '1'
  })
  const [datePickerOpenId, setDatePickerOpenId] = useState<number | null>(null)
  const datePickerPopoverRef = useRef<HTMLDivElement | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const [datePickerPosition, setDatePickerPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  })
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePasswordError, setDeletePasswordError] = useState<'required' | 'invalid' | null>(null)
  const [deleteAttempts, setDeleteAttempts] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProductionRow | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValues, setEditingValues] = useState<any | null>(null)

  const mockRows: ProductionRow[] = []

  const [rows, setRows] = useState<ProductionRow[]>(mockRows)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  })
  const [closureSortConfig, setClosureSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  })
  const [filterCompany, setFilterCompany] = useState<string>('5')
  const [filterYear, setFilterYear] = useState<string>('')
  const [filterMonth, setFilterMonth] = useState<string>('')
  const [closureFilterCompany, setClosureFilterCompany] = useState<string>('')
  const [closureFilterRef, setClosureFilterRef] = useState<string>('')
  const [employeeCompanies, setEmployeeCompanies] = useState<number[]>([])
  const companyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...employeeCompanies, ...rows.map((r) => r.company)]
            .filter((c) => c !== '' && c !== null && c !== undefined)
            .map((c) => Number(c))
        )
      ).sort((a, b) => a - b),
    [employeeCompanies, rows]
  )
  const yearOptions = useMemo(() => {
    const years = rows
      .map((r) => (r.date ? String(r.date).split('-')[0] : ''))
      .filter((y) => y)
    return Array.from(new Set(years)).sort()
  }, [rows])
  useEffect(() => {
    if (filterYear) return
    if (!yearOptions.length) return
    const mostRecent = [...yearOptions].sort().slice(-1)[0]
    setFilterYear(mostRecent)
  }, [filterYear, yearOptions])

  const monthOptions = useMemo(() => {
    const months = rows
      .filter((r) => {
        const parts = r.date ? String(r.date).split('-') : []
        const year = parts.length === 3 ? parts[0] : ''
        const matchCompany = !filterCompany || String(r.company) === String(filterCompany)
        const matchYear = !filterYear || year === filterYear
        return matchCompany && matchYear
      })
      .map((r) => {
        const parts = r.date ? String(r.date).split('-') : []
        return parts.length === 3 ? parts[1] : ''
      })
      .filter((m) => m)
    return Array.from(new Set(months)).sort()
  }, [rows, filterCompany, filterYear])
  useEffect(() => {
    if (!monthOptions.length) {
      if (filterMonth) setFilterMonth('')
      return
    }
    if (filterMonth && monthOptions.includes(filterMonth)) return
    const mostRecent = [...monthOptions].sort().slice(-1)[0]
    setFilterMonth(mostRecent)
  }, [filterMonth, monthOptions])
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (r.isNew) return true
      const parts = r.date ? String(r.date).split('-') : []
      const year = parts.length === 3 ? parts[0] : ''
      const month = parts.length === 3 ? parts[1] : ''
      const matchCompany = !filterCompany || String(r.company) === String(filterCompany)
      const matchYear = !filterYear || year === filterYear
      const matchMonth = !filterMonth || month === filterMonth
      return matchCompany && matchYear && matchMonth
    })
  }, [rows, filterCompany, filterYear, filterMonth])
  useEffect(() => {
    const loadCompanies = async () => {
      const result = await fetchEmployeeCompanies(resolvedSupabaseUrl, resolvedSupabaseKey)
      if (result.ok) {
        setEmployeeCompanies(result.companies)
      }
    }
    loadCompanies()
  }, [resolvedSupabaseUrl, resolvedSupabaseKey])

  const loadProductionRows = async () => {
    const result = await fetchProductionRows(resolvedSupabaseUrl, resolvedSupabaseKey)
    if (result.ok) {
      const mapped: ProductionRow[] = result.rows.map((r) => ({
        id: r.id,
        company: r.company ?? '',
        date: r.date_ ?? '',
        slaughtered: r.slaughtered ?? '',
        compraTraseiro: r.compratraseiro ?? '',
        compraDianteiro: r.compradianteiro ?? '',
        compraPA: r.comprapa ?? '',
        vendaTraseiro: r.vendatraseiro ?? '',
        vendaDianteiro: r.vendadianteiro ?? '',
        vendaPA: r.vendapa ?? '',
        desossaTraseiro: r.desossatraseiro ?? '',
        desossaDianteiro: r.desossadianteiro ?? '',
        desossaPA: r.desossapa ?? '',
        isNew: false,
      }))
      setRows(mapped)
      if (!mapped.length) {
        setFilterCompany('5')
        setFilterYear('')
        setFilterMonth('')
      }
    } else {
      setRows([])
      setFilterCompany('5')
      setFilterYear('')
      setFilterMonth('')
    }
  }
  useEffect(() => {
    loadProductionRows()
  }, [resolvedSupabaseUrl, resolvedSupabaseKey])
  useEffect(() => {
    if (datePickerOpenId === null) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const inInput = dateInputRef.current?.contains(target)
      const inPopover = datePickerPopoverRef.current?.contains(target)
      if (!inInput && !inPopover) setDatePickerOpenId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [datePickerOpenId])
  useEffect(() => {
    if (datePickerOpenId === null) return
    const handleReposition = () => {
      if (!dateInputRef.current) return
      const rect = dateInputRef.current.getBoundingClientRect()
      const estimatedHeight = 280
      const padding = 8
      const openAbove = rect.bottom + estimatedHeight + padding > window.innerHeight
      setDatePickerPosition({
        left: rect.left,
        top: openAbove ? rect.top - estimatedHeight - padding : rect.bottom + padding,
      })
    }
    handleReposition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [datePickerOpenId])
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('prod-closure-visible', isClosureTableVisible ? '1' : '0')
  }, [isClosureTableVisible])
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('prod-table-hidden', tableHidden ? '1' : '0')
  }, [tableHidden])
  const loadClosures = async () => {
    const result = await fetchClosingProductionRows(resolvedSupabaseUrl, resolvedSupabaseKey)
    if (result.ok) {
      const mapped: ProductionRow[] = result.rows.map((r) => ({
        id: r.id,
        company: r.company ?? '',
        date: r.date_ ?? '',
        slaughtered: r.slaughtered ?? '',
        compraTraseiro: r.compratraseiro ?? '',
        compraDianteiro: r.compradianteiro ?? '',
        compraPA: r.comprapa ?? '',
        vendaTraseiro: r.vendatraseiro ?? '',
        vendaDianteiro: r.vendadianteiro ?? '',
        vendaPA: r.vendapa ?? '',
        desossaTraseiro: r.desossatraseiro ?? '',
        desossaDianteiro: r.desossadianteiro ?? '',
        desossaPA: r.desossapa ?? '',
        userRegistration: r.user_registration ?? null,
        dateRegistration: r.date_registration ?? null,
        isClosure: true,
      }))
      setClosureRows(mapped)
    } else {
      setClosureRows([])
    }
  }
  useEffect(() => {
    loadClosures()
  }, [resolvedSupabaseUrl, resolvedSupabaseKey])

  const [closureRows, setClosureRows] = useState<ProductionRow[]>([])

  const formatDateDisplay = (value?: string) => {
    if (!value) return ''
    if (value.includes('/')) return value
    const parts = value.split('-')
    if (parts.length === 3) {
      const [yy, mm, dd] = parts
      return `${dd}/${mm}/${yy}`
    }
    return value
  }

  const formatDateTimeDisplay = (value?: string | null) => {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    const datePart = parsed.toLocaleDateString('pt-BR')
    const timePart = parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${datePart} ${timePart}`
  }

  const formatMonthYearDisplay = (value?: string) => {
    if (!value) return ''
    if (value.includes('/')) {
      const parts = value.split('/')
      if (parts.length === 3) return `${parts[1]}/${parts[2]}`
      if (parts.length === 2) return value
    }
    const parts = value.split('-')
    if (parts.length === 3) {
      const [yy, mm] = parts
      return `${mm}/${yy}`
    }
    return value
  }

  const groupedClosureRows = useMemo(() => {
    const byKey = new Map<string, ProductionRow & { latestDateRegistration?: string | null }>()
    closureRows.forEach((row) => {
      const monthYear = formatMonthYearDisplay(row.date)
      const companyKey = row.company !== '' ? String(row.company) : ''
      if (!monthYear || !companyKey) return
      const key = `${companyKey}-${monthYear}`
      const existing = byKey.get(key)
      const nextDateReg = row.dateRegistration ?? null
      const nextDateRegTs = nextDateReg ? new Date(nextDateReg).getTime() : 0
      if (!existing) {
        byKey.set(key, {
          ...row,
          date: monthYear,
          slaughtered: toNumberOrNull(row.slaughtered) ?? 0,
          compraTraseiro: toNumberOrNull(row.compraTraseiro) ?? 0,
          compraDianteiro: toNumberOrNull(row.compraDianteiro) ?? 0,
          compraPA: toNumberOrNull(row.compraPA) ?? 0,
          vendaTraseiro: toNumberOrNull(row.vendaTraseiro) ?? 0,
          vendaDianteiro: toNumberOrNull(row.vendaDianteiro) ?? 0,
          vendaPA: toNumberOrNull(row.vendaPA) ?? 0,
          desossaTraseiro: toNumberOrNull(row.desossaTraseiro) ?? 0,
          desossaDianteiro: toNumberOrNull(row.desossaDianteiro) ?? 0,
          desossaPA: toNumberOrNull(row.desossaPA) ?? 0,
          latestDateRegistration: nextDateReg,
          userRegistration: row.userRegistration ?? null,
          dateRegistration: nextDateReg,
          isClosure: true,
        })
        return
      }
      const currentDateReg = existing.latestDateRegistration ?? null
      const currentDateRegTs = currentDateReg ? new Date(currentDateReg).getTime() : 0
      const useNext = nextDateRegTs >= currentDateRegTs
      byKey.set(key, {
        ...existing,
        slaughtered: (existing.slaughtered as number) + (toNumberOrNull(row.slaughtered) ?? 0),
        compraTraseiro: (existing.compraTraseiro as number) + (toNumberOrNull(row.compraTraseiro) ?? 0),
        compraDianteiro: (existing.compraDianteiro as number) + (toNumberOrNull(row.compraDianteiro) ?? 0),
        compraPA: (existing.compraPA as number) + (toNumberOrNull(row.compraPA) ?? 0),
        vendaTraseiro: (existing.vendaTraseiro as number) + (toNumberOrNull(row.vendaTraseiro) ?? 0),
        vendaDianteiro: (existing.vendaDianteiro as number) + (toNumberOrNull(row.vendaDianteiro) ?? 0),
        vendaPA: (existing.vendaPA as number) + (toNumberOrNull(row.vendaPA) ?? 0),
        desossaTraseiro: (existing.desossaTraseiro as number) + (toNumberOrNull(row.desossaTraseiro) ?? 0),
        desossaDianteiro: (existing.desossaDianteiro as number) + (toNumberOrNull(row.desossaDianteiro) ?? 0),
        desossaPA: (existing.desossaPA as number) + (toNumberOrNull(row.desossaPA) ?? 0),
        latestDateRegistration: useNext ? nextDateReg : currentDateReg,
        userRegistration: useNext ? row.userRegistration ?? null : existing.userRegistration ?? null,
        dateRegistration: useNext ? nextDateReg : existing.dateRegistration ?? null,
      })
    })
    return Array.from(byKey.values())
  }, [closureRows, toNumberOrNull, formatMonthYearDisplay])
  const closureCompanyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          groupedClosureRows
            .map((r) => r.company)
            .filter((c) => c !== '' && c !== null && c !== undefined)
            .map((c) => Number(c))
        )
      ).sort((a, b) => a - b),
    [groupedClosureRows]
  )
  const closureRefOptions = useMemo(() => {
    const refs = groupedClosureRows
      .map((r) => formatMonthYearDisplay(r.date))
      .filter((ref) => ref)
    return Array.from(new Set(refs)).sort()
  }, [groupedClosureRows, formatMonthYearDisplay])
  const filteredClosureRows = useMemo(() => {
    return groupedClosureRows.filter((row) => {
      const matchCompany = !closureFilterCompany || String(row.company) === String(closureFilterCompany)
      const matchRef = !closureFilterRef || formatMonthYearDisplay(row.date) === closureFilterRef
      return matchCompany && matchRef
    })
  }, [groupedClosureRows, closureFilterCompany, closureFilterRef, formatMonthYearDisplay])

  const startEdit = (rowId: number) => {
    const row = rows.find((r) => r.id === rowId)
    if (!row) return
    setEditingId(rowId)
    setEditingValues({ ...row, date: row.date ?? '' })
  }

  const cancelEdit = () => {
    if (editingId) {
      setRows((prev) => prev.filter((r) => !(r.id === editingId && r.isNew)))
    }
    setEditingId(null)
    setEditingValues(null)
  }

  const getMonthYearRef = (value?: string) => {
    if (!value) return ''
    if (value.includes('/')) {
      const parts = value.split('/')
      if (parts.length === 3) return `${parts[1]}/${parts[2]}`
      if (parts.length === 2) return value
    }
    const parts = value.split('-')
    if (parts.length === 3) {
      const [yy, mm] = parts
      return `${mm}/${yy}`
    }
    return value
  }

  const handleEditKeyDown = (field: string) => (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const order = [
      'company',
      'date',
      'slaughtered',
      'compraTraseiro',
      'compraDianteiro',
      'compraPA',
      'vendaTraseiro',
      'vendaDianteiro',
      'vendaPA',
      'desossaTraseiro',
      'desossaDianteiro',
      'desossaPA',
    ]
    const idx = order.indexOf(field)
    const nextField = order[idx + 1]
    const nextId = nextField ? `prod-${editingId}-${nextField}` : `prod-${editingId}-save`
    const nextEl = document.getElementById(nextId)
    nextEl?.focus()
  }

  const toNullIfZero = (value: any) => {
    if (value === 0 || value === '0') return null
    return value
  }

  const toIsoDateValue = (value: Date) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const toDateValue = (value?: string | null) => {
    if (!value) return null
    const normalized = value.includes('T') ? value : `${value}T00:00:00`
    const parsed = new Date(normalized)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const currentYear = new Date().getFullYear()
  const monthShortNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  const getDisabledDates = (company: number | '', currentId?: number, currentDate?: string) => {
    if (company === '' || company === null || company === undefined) return []
    const disabled = rows
      .filter((r) => r.id !== currentId && String(r.company) === String(company) && r.date)
      .map((r) => toDateValue(r.date))
      .filter((d): d is Date => Boolean(d))
    if (currentDate) {
      const current = toDateValue(currentDate)
      if (!current) return disabled
      return disabled.filter((d) => d.getTime() !== current.getTime())
    }
    return disabled
  }

  const saveEdit = async () => {
    if (!editingId || !editingValues) return
    const companyRequired = editingValues.company !== '' && editingValues.company !== null && editingValues.company !== undefined
    const dateRequired = Boolean((editingValues.date || '').trim())
    if (!companyRequired || !dateRequired) {
      toast.error('Empresa e Data são obrigatórios.')
      return
    }
    const normalizedCompany = Number(editingValues.company)
    const normalizedDate = (editingValues.date || '').trim()
    const duplicate = rows.some(
      (r) =>
        r.id !== editingId &&
        Number(r.company) === normalizedCompany &&
        (r.date || '').trim() === normalizedDate
    )
    if (duplicate) {
      toast.error('Já existe registro para esta Empresa e Data.')
      return
    }

    const monthYearRef = getMonthYearRef((editingValues.date || '').trim())
    if (monthYearRef) {
      const hasClosed = closureRows.some(
        (row) =>
          String(row.company) === String(editingValues.company) && getMonthYearRef(row.date) === monthYearRef
      )
      if (hasClosed) {
        toast.error(`${monthYearRef} fechada para a empresa${editingValues.company}`)
        return
      }
    }

    const session = loadSession()
    const isNewRow = rows.some((r) => r.id === editingId && r.isNew)
    const upsertResult = await upsertProductionRow(
      {
        id: editingValues.id,
        isNew: isNewRow,
        company: Number(editingValues.company),
        date_: editingValues.date,
        slaughtered: toNullIfZero(editingValues.slaughtered),
        compratraseiro: toNullIfZero(editingValues.compraTraseiro),
        compradianteiro: toNullIfZero(editingValues.compraDianteiro),
        comprapa: toNullIfZero(editingValues.compraPA),
        vendatraseiro: toNullIfZero(editingValues.vendaTraseiro),
        vendadianteiro: toNullIfZero(editingValues.vendaDianteiro),
        vendapa: toNullIfZero(editingValues.vendaPA),
        desossatraseiro: toNullIfZero(editingValues.desossaTraseiro),
        desossadianteiro: toNullIfZero(editingValues.desossaDianteiro),
        desossapa: toNullIfZero(editingValues.desossaPA),
        type_registration: session?.type_user || 'manual',
        user_registration: session?.username || session?.name || 'system',
      },
      resolvedSupabaseUrl,
      resolvedSupabaseKey
    )

    if (!upsertResult.ok) {
      toast.error(upsertResult.error || 'Erro ao salvar.')
      return
    }

    const savedRow = upsertResult.rows?.[0]
    const newId = savedRow?.id ?? editingValues.id ?? editingId

    setRows((prev) =>
      prev.map((r) =>
        r.id === editingId
          ? { ...r, ...editingValues, id: newId ?? r.id, isNew: false }
          : r
      )
    )
    setEditingId(null)
    setEditingValues(null)
    toast.success(isNewRow ? 'Registro gravado com sucesso.' : 'Registro atualizado com sucesso.')
  }

  const formatThousands = (value?: any) => {
    if (value === '' || value === undefined || value === null) return ''
    const num = Number(value)
    if (Number.isNaN(num)) return ''
    return num.toLocaleString('pt-BR')
  }

  const handleNumberChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, '')
    const numeric = onlyDigits ? Number(onlyDigits) : 0
    const limited = Math.min(numeric, 9999)
    if (numeric > 9999) {
      toast.error('Valor máximo permitido é 9999.')
    }
    setEditingValues((prev: any) => ({ ...prev, [field]: limited }))
  }

  const addNewRow = () => {
    const existingNew = rows.find((r) => r.isNew)
    if (existingNew) {
      setEditingId(existingNew.id)
      setEditingValues(existingNew)
      setTimeout(() => {
        document.getElementById(`prod-${existingNew.id}-company`)?.focus()
      }, 0)
      return
    }
    const nextId = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1
    const blankRow: ProductionRow = {
      id: nextId,
      company: filterCompany ? Number(filterCompany) : '',
      date: '',
      slaughtered: '',
      compraTraseiro: '',
      compraDianteiro: '',
      compraPA: '',
      vendaTraseiro: '',
      vendaDianteiro: '',
      vendaPA: '',
      desossaTraseiro: '',
      desossaDianteiro: '',
      desossaPA: '',
      isNew: true,
    }
    setRows((prev) => [blankRow, ...prev])
    setEditingId(nextId)
    setEditingValues(blankRow)
    setTimeout(() => {
      document.getElementById(`prod-${nextId}-company`)?.focus()
    }, 0)
  }

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }
  const handleClosureSort = (key: string) => {
    setClosureSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const sortedRows = useMemo(() => {
    const normalizeDate = (val: any) => {
      if (!val) return 0
      const parsed = new Date(val)
      return parsed.getTime() || 0
    }
    const getValue = (row: any, key: string) => {
      switch (key) {
        case 'date':
          return normalizeDate(row.date)
        case 'company':
        case 'slaughtered':
        case 'compraTraseiro':
        case 'compraDianteiro':
        case 'compraPA':
        case 'vendaTraseiro':
        case 'vendaDianteiro':
        case 'vendaPA':
        case 'desossaTraseiro':
        case 'desossaDianteiro':
        case 'desossaPA':
          return Number(row[key] ?? 0)
        default:
          return row[key] ?? ''
      }
    }
    const data = [...filteredRows]
    data.sort((a, b) => {
      // Linhas novas sempre no topo
      if (a.isNew && !b.isNew) return -1
      if (!a.isNew && b.isNew) return 1
      const va = getValue(a, sortConfig.key)
      const vb = getValue(b, sortConfig.key)
      if (va < vb) return sortConfig.direction === 'asc' ? -1 : 1
      if (va > vb) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [filteredRows, sortConfig])
  const sortedClosureRows = useMemo(() => {
    const normalizeMonthYear = (val: string) => {
      if (!val) return 0
      if (val.includes('/')) {
        const parts = val.split('/')
        if (parts.length >= 2) {
          const mm = Number(parts[0])
          const yy = Number(parts[1])
          if (!Number.isNaN(mm) && !Number.isNaN(yy)) {
            return new Date(yy, mm - 1, 1).getTime()
          }
        }
      }
      const parts = val.split('-')
      if (parts.length === 3) {
        const [yy, mm] = parts
        const parsed = new Date(Number(yy), Number(mm) - 1, 1)
        return parsed.getTime() || 0
      }
      return 0
    }
    const getValue = (row: any, key: string) => {
      switch (key) {
        case 'date':
          return normalizeMonthYear(formatMonthYearDisplay(row.date))
        case 'company':
        case 'slaughtered':
        case 'compraTraseiro':
        case 'compraDianteiro':
        case 'compraPA':
        case 'vendaTraseiro':
        case 'vendaDianteiro':
        case 'vendaPA':
        case 'desossaTraseiro':
        case 'desossaDianteiro':
        case 'desossaPA':
          return Number(row[key] ?? 0)
        default:
          return row[key] ?? ''
      }
    }
    const data = [...filteredClosureRows]
    data.sort((a, b) => {
      const va = getValue(a, closureSortConfig.key)
      const vb = getValue(b, closureSortConfig.key)
      if (va < vb) return closureSortConfig.direction === 'asc' ? -1 : 1
      if (va > vb) return closureSortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [closureSortConfig, formatMonthYearDisplay, filteredClosureRows])

  const totals = useMemo(() => {
    const initial = {
      slaughtered: 0,
      compraTraseiro: 0,
      compraDianteiro: 0,
      compraPA: 0,
      vendaTraseiro: 0,
      vendaDianteiro: 0,
      vendaPA: 0,
      desossaTraseiro: 0,
      desossaDianteiro: 0,
      desossaPA: 0,
    }
    return filteredRows.reduce((acc, row) => {
      ; (Object.keys(initial) as Array<keyof typeof initial>).forEach((field) => {
        const value = Number(row[field] ?? 0)
        acc[field] += Number.isFinite(value) ? value : 0
      })
      return acc
    }, { ...initial })
  }, [filteredRows])

  const renderSortIndicator = (
    isActive: boolean,
    direction: 'asc' | 'desc',
    variant: 'text' | 'number'
  ) => {
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

  return (
    <div className="space-y-4">
      {/* Barra de título */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 shadow-inner shadow-black/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-emerald-200 font-semibold">
            <Factory className="w-6 h-6 text-amber-300" />
            Produção
          </div>
          {/* Filtros estáticos */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-[0.2em]">
              <Filter className="w-4 h-4 text-emerald-300" />
              Filtros
            </div>
            <select
              className="w-28 bg-slate-900/80 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
              style={{ colorScheme: 'dark' }}
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
            >
              <option className="bg-slate-900 text-emerald-200" value="">
                Empresa
              </option>
              {companyOptions.map((c) => (
                <option key={`filter-company-${c}`} value={c} className="bg-slate-900 text-emerald-200">
                  {c}
                </option>
              ))}
            </select>
            <select
              className="w-20 bg-slate-900/80 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
              style={{ colorScheme: 'dark' }}
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option className="bg-slate-900 text-emerald-200" value="">
                Ano
              </option>
              {yearOptions.map((y) => (
                <option key={`filter-year-${y}`} value={y} className="bg-slate-900 text-emerald-200">
                  {y}
                </option>
              ))}
            </select>
            <select
              className="w-16 bg-slate-900/80 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
              style={{ colorScheme: 'dark' }}
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option className="bg-slate-900 text-emerald-200" value="">
                Mês
              </option>
              {monthOptions.map((m) => (
                <option key={`filter-month-${m}`} value={m} className="bg-slate-900 text-emerald-200">
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="border border-emerald-400/40 rounded-lg bg-white/5 shadow-lg shadow-emerald-500/10 p-4 shadow-lg w-full min-w-0 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white text-sm">
            <Factory className="w-5 h-5 text-emerald-300" />
            Lançamentos de Produção
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50">Exibindo {filteredRows.length} registro(s)</span>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border border-emerald-400/60 bg-emerald-500/15 text-emerald-100 font-semibold flex items-center gap-2 hover:bg-emerald-500/25 transition-colors"
              title="Novo"
              onClick={addNewRow}
            >
              <Plus className="w-5 h-5" />
              Novo
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border border-amber-400/60 bg-amber-500/10 text-amber-100 font-semibold flex items-center gap-2 hover:bg-amber-500/20 transition-colors"
              title="Fechar"
              onClick={() => {
                setCloseModalOpen(true)
                setClosePassword('')
                setClosePasswordError(null)
                setCloseAttempts(0)
              }}
            >
              <NotebookPen className="w-4 h-4" />
              Fechar
            </button>
            <button
              type="button"
              className="p-2 rounded-md border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-emerald-400/60 transition"
              title="Ocultar/mostrar tabela"
              onClick={() => setTableHidden((prev) => !prev)}
            >
              {tableHidden ? (
                <Eye className="w-5 h-5 text-emerald-400" />
              ) : (
                <EyeOff className="w-5 h-5 text-rose-400" />
              )}
            </button>
          </div>
        </div>
        {!tableHidden && (
          <div className="border border-blue-500/40 rounded-lg overflow-hidden bg-slate-900/60 shadow-inner shadow-black/20">
            <div
              className="custom-scroll overflow-x-auto overflow-y-auto max-h-[460px] min-w-0 max-w-full"
              style={{ scrollbarGutter: 'stable' }}
            >
              <table className="w-full min-w-0 text-left text-xs text-white/80">
                <thead className="rounded-lg bg-slate-900/80 tracking-[0.2em] sticky top-0 z-10 backdrop-blur-xl">
                  <tr>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none"
                      onClick={() => handleSort('company')}
                    >
                      <span className="inline-flex items-center justify-center">
                        Emp
                        {renderSortIndicator(sortConfig.key === 'company', sortConfig.direction, 'number')}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none"
                      onClick={() => handleSort('date')}
                    >
                      <span className="inline-flex items-center justify-center">
                        DATA
                        {renderSortIndicator(sortConfig.key === 'date', sortConfig.direction, 'number')}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none"
                      onClick={() => handleSort('slaughtered')}
                    >
                      <span className="inline-flex items-center justify-center">
                        ABATE
                        {renderSortIndicator(
                          sortConfig.key === 'slaughtered',
                          sortConfig.direction,
                          'number'
                        )}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none leading-4"
                      onClick={() => handleSort('compraTraseiro')}
                    >
                      <span className="inline-flex items-center justify-center">
                        <span className="leading-4 text-center">
                          Compra<br />TRAS.
                        </span>
                        {renderSortIndicator(
                          sortConfig.key === 'compraTraseiro',
                          sortConfig.direction,
                          'number'
                        )}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none leading-4"
                      onClick={() => handleSort('compraDianteiro')}
                    >
                      <span className="inline-flex items-center justify-center">
                        <span className="leading-4 text-center">
                          Compra<br />DIANT.
                        </span>
                        {renderSortIndicator(
                          sortConfig.key === 'compraDianteiro',
                          sortConfig.direction,
                          'number'
                        )}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none"
                      onClick={() => handleSort('compraPA')}
                    >
                      <span className="inline-flex items-center justify-center">
                        Compra <br />PA
                        {renderSortIndicator(sortConfig.key === 'compraPA', sortConfig.direction, 'number')}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none leading-4"
                      onClick={() => handleSort('vendaTraseiro')}
                    >
                      <span className="inline-flex items-center justify-center">
                        <span className="leading-4 text-center">
                          Venda<br />TRAS.
                        </span>
                        {renderSortIndicator(
                          sortConfig.key === 'vendaTraseiro',
                          sortConfig.direction,
                          'number'
                        )}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none leading-4"
                      onClick={() => handleSort('vendaDianteiro')}
                    >
                      <span className="inline-flex items-center justify-center">
                        <span className="leading-4 text-center">
                          Venda<br />DIANT.
                        </span>
                        {renderSortIndicator(
                          sortConfig.key === 'vendaDianteiro',
                          sortConfig.direction,
                          'number'
                        )}
                      </span>
                    </th>
                    <th
                      className="w-14 px-1 py-2 text-center cursor-pointer select-none"
                      onClick={() => handleSort('vendaPA')}
                    >
                      <span className="inline-flex items-center justify-center">
                        Venda <br />PA
                        {renderSortIndicator(sortConfig.key === 'vendaPA', sortConfig.direction, 'number')}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none leading-4"
                      onClick={() => handleSort('desossaTraseiro')}
                    >
                      <span className="inline-flex items-center justify-center">
                        <span className="leading-4 text-center">
                          Desossa<br />TRAS.
                        </span>
                        {renderSortIndicator(
                          sortConfig.key === 'desossaTraseiro',
                          sortConfig.direction,
                          'number'
                        )}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none leading-4"
                      onClick={() => handleSort('desossaDianteiro')}
                    >
                      <span className="inline-flex items-center justify-center">
                        <span className="leading-4 text-center">
                          Desossa<br />DIANT.
                        </span>
                        {renderSortIndicator(
                          sortConfig.key === 'desossaDianteiro',
                          sortConfig.direction,
                          'number'
                        )}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 text-center cursor-pointer select-none"
                      onClick={() => handleSort('desossaPA')}
                    >
                      <span className="inline-flex items-center justify-center">
                        Desossa <br />PA
                        {renderSortIndicator(sortConfig.key === 'desossaPA', sortConfig.direction, 'number')}
                      </span>
                    </th>
                    <th className="w-12 px-1 py-2 text-center">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="bg-white/5">
                  {sortedRows.map((row) => (
                    <tr key={row.id} className="border-t border-white/5 hover:bg-emerald-500/5 transition-colors">
                      <td className="text-center">
                        {editingId === row.id && (row.isNew || editingValues?.isNew) ? (
                          <select
                            className="w-20 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[6px] text-white text-center focus:border-emerald-400 outline-none"
                            value={editingValues?.company ?? ''}
                            onChange={(e) =>
                              setEditingValues((prev: any) => ({
                                ...prev,
                                company: e.target.value ? Number(e.target.value) : '',
                              }))
                            }
                            id={`prod-${editingId}-company`}
                            onKeyDown={handleEditKeyDown('company')}
                            autoComplete="off"
                          >
                            <option value="" disabled>
                              Empresa
                            </option>
                            {companyOptions.map((opt) => (
                              <option key={`company-${opt}`} value={opt as any}>
                                {opt}
                              </option>
                            ))}
                            {editingValues?.company &&
                              !companyOptions.includes(editingValues.company) && (
                                <option value={editingValues.company}>{editingValues.company}</option>
                              )}
                          </select>
                        ) : (
                          row.company ?? '-'
                        )}
                      </td>
                      <td className="whitespace-nowrap text-center">
                        {editingId === row.id && (row.isNew || editingValues?.isNew) ? (
                          <div
                            className="relative inline-flex"
                          >
                            <input
                              type="text"
                              readOnly
                              className="w-32 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[6px] text-white text-center focus:border-emerald-400 outline-none cursor-pointer"
                              value={formatDateDisplay(editingValues?.date)}
                              id={`prod-${editingId}-date`}
                              onClick={(event) => {
                                dateInputRef.current = event.currentTarget
                                setDatePickerOpenId(row.id)
                              }}
                              onFocus={(event) => {
                                dateInputRef.current = event.currentTarget
                                setDatePickerOpenId(row.id)
                              }}
                              onKeyDown={handleEditKeyDown('date')}
                              autoComplete="off"
                              placeholder="dd/mm/aaaa"
                            />
                            {datePickerOpenId === row.id &&
                              createPortal(
                                <div
                                  ref={datePickerPopoverRef}
                                  className="fixed z-[9999] rounded-lg border border-emerald-500/40 bg-slate-900/95 p-1.5 shadow-xl"
                                  style={{ top: datePickerPosition.top, left: datePickerPosition.left }}
                                >
                                  <DayPicker
                                    mode="single"
                                    className="daypicker-dark"
                                    locale={ptBR}
                                    selected={toDateValue(editingValues?.date) ?? undefined}
                                    onSelect={(day) => {
                                      if (!day) return
                                      setEditingValues((prev: any) => ({
                                        ...prev,
                                        date: toIsoDateValue(day),
                                      }))
                                      setDatePickerOpenId(null)
                                    }}
                                    disabled={getDisabledDates(
                                      editingValues?.company ?? row.company,
                                      row.id,
                                      editingValues?.date
                                    )}
                                    modifiers={{
                                      blocked: getDisabledDates(
                                        editingValues?.company ?? row.company,
                                        row.id,
                                        editingValues?.date
                                      ),
                                    }}
                                    modifiersClassNames={{
                                      blocked: 'rdp-blocked',
                                    }}
                                  captionLayout="dropdown"
                                  defaultMonth={
                                    filterYear && filterMonth
                                      ? new Date(Number(filterYear), Number(filterMonth) - 1, 1)
                                      : undefined
                                  }
                                  formatters={{
                                    formatMonthCaption: (date) => monthShortNames[date.getMonth()],
                                    formatMonthDropdown: (date) => monthShortNames[date.getMonth()],
                                  }}
                                  fromYear={currentYear - 2}
                                  toYear={currentYear}
                                />
                                </div>,
                                document.body
                              )}
                          </div>
                        ) : (
                          formatDateDisplay(row.date)
                        )}
                      </td>
                      <td className="text-center">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[4px] text-white text-center focus:border-emerald-400 outline-none"
                            value={formatThousands(editingValues?.slaughtered)}
                            onChange={handleNumberChange('slaughtered')}
                            id={`prod-${editingId}-slaughtered`}
                            onKeyDown={handleEditKeyDown('slaughtered')}
                            autoComplete="off"
                          />
                        ) : (
                          row.slaughtered ?? '-'
                        )}
                      </td>
                      <td className="text-center">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[4px] text-white text-center focus:border-emerald-400 outline-none"
                            value={formatThousands(editingValues?.compraTraseiro)}
                            onChange={handleNumberChange('compraTraseiro')}
                            id={`prod-${editingId}-compraTraseiro`}
                            onKeyDown={handleEditKeyDown('compraTraseiro')}
                            autoComplete="off"
                          />
                        ) : (
                          row.compraTraseiro ?? '-'
                        )}
                      </td>
                      <td className="text-center">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[4px] text-white text-center focus:border-emerald-400 outline-none"
                            value={formatThousands(editingValues?.compraDianteiro)}
                            onChange={handleNumberChange('compraDianteiro')}
                            id={`prod-${editingId}-compraDianteiro`}
                            onKeyDown={handleEditKeyDown('compraDianteiro')}
                            autoComplete="off"
                          />
                        ) : (
                          row.compraDianteiro ?? '-'
                        )}
                      </td>
                      <td className="text-center">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[4px] text-white text-center focus:border-emerald-400 outline-none"
                            value={formatThousands(editingValues?.compraPA)}
                            onChange={handleNumberChange('compraPA')}
                            id={`prod-${editingId}-compraPA`}
                            onKeyDown={handleEditKeyDown('compraPA')}
                            autoComplete="off"
                          />
                        ) : (
                          row.compraPA ?? '-'
                        )}
                      </td>
                      <td className="text-center">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[4px] text-white text-center focus:border-emerald-400 outline-none"
                            value={formatThousands(editingValues?.vendaTraseiro)}
                            onChange={handleNumberChange('vendaTraseiro')}
                            id={`prod-${editingId}-vendaTraseiro`}
                            onKeyDown={handleEditKeyDown('vendaTraseiro')}
                            autoComplete="off"
                          />
                        ) : (
                          row.vendaTraseiro ?? '-'
                        )}
                      </td>
                      <td className="text-center">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[4px] text-white text-center focus:border-emerald-400 outline-none"
                            value={formatThousands(editingValues?.vendaDianteiro)}
                            onChange={handleNumberChange('vendaDianteiro')}
                            id={`prod-${editingId}-vendaDianteiro`}
                            onKeyDown={handleEditKeyDown('vendaDianteiro')}
                            autoComplete="off"
                          />
                        ) : (
                          row.vendaDianteiro ?? '-'
                        )}
                      </td>
                      <td className="text-center">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[4px] text-white text-center focus:border-emerald-400 outline-none"
                            value={formatThousands(editingValues?.vendaPA)}
                            onChange={handleNumberChange('vendaPA')}
                            id={`prod-${editingId}-vendaPA`}
                            onKeyDown={handleEditKeyDown('vendaPA')}
                            autoComplete="off"
                          />
                        ) : (
                          row.vendaPA ?? '-'
                        )}
                      </td>
                      <td className="text-center">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[4px] text-white text-center focus:border-emerald-400 outline-none"
                            value={formatThousands(editingValues?.desossaTraseiro)}
                            onChange={handleNumberChange('desossaTraseiro')}
                            id={`prod-${editingId}-desossaTraseiro`}
                            onKeyDown={handleEditKeyDown('desossaTraseiro')}
                            autoComplete="off"
                          />
                        ) : (
                          row.desossaTraseiro ?? '-'
                        )}
                      </td>
                      <td className="text-center">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[4px] text-white text-center focus:border-emerald-400 outline-none"
                            value={formatThousands(editingValues?.desossaDianteiro)}
                            onChange={handleNumberChange('desossaDianteiro')}
                            id={`prod-${editingId}-desossaDianteiro`}
                            onKeyDown={handleEditKeyDown('desossaDianteiro')}
                            autoComplete="off"
                          />
                        ) : (
                          row.desossaDianteiro ?? '-'
                        )}
                      </td>
                      <td className="text-center">
                        {editingId === row.id ? (
                          <input
                            className="w-14 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[4px] text-white text-center focus:border-emerald-400 outline-none"
                            value={formatThousands(editingValues?.desossaPA)}
                            onChange={handleNumberChange('desossaPA')}
                            id={`prod-${editingId}-desossaPA`}
                            onKeyDown={handleEditKeyDown('desossaPA')}
                            autoComplete="off"
                          />
                        ) : (
                          row.desossaPA ?? '-'
                        )}
                      </td>
                      <td className="text-center">
                        <div className="inline-flex items-center gap-2">
                          {editingId === row.id ? (
                            <>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-lime-500/20 transition-colors text-lime-500 disabled:opacity-50 focus:outline-none focus:ring-0"
                                title="Salvar"
                                onClick={saveEdit}
                                id={editingId ? `prod-${editingId}-save` : undefined}
                              >
                                <Check className="w-5 h-5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-rose-500/20 transition-colors text-rose-500 disabled:opacity-50 focus:outline-none focus:ring-0"
                                title="Cancelar"
                                onClick={cancelEdit}
                              >
                                <XIcon className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-lime-500/20 transition-colors text-lime-600 focus:outline-none focus:ring-0"
                                title="Editar"
                                onClick={() => startEdit(row.id)}
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-rose-500/20 transition-colors text-rose-600 disabled:opacity-50 focus:outline-none focus:ring-0"
                                title="Excluir"
                                onClick={() => {
                                  if (row.isNew) {
                                    setRows((prev) => prev.filter((r) => r.id !== row.id))
                                    return
                                  }
                                  setDeleteTarget(row)
                                  setDeletePassword('')
                                  setDeletePasswordError(null)
                                  setDeleteAttempts(0)
                                  setDeleteModalOpen(true)
                                }}
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky rounded-b-lg bottom-0 z-10 bg-slate-900/80 backdrop-blur-xl">
                  <tr className="tracking-[0.2em] text-emerald-100">
                    <td className="text-center py-1" colSpan={2}>
                      Totais
                    </td>
                    <td className="text-center py-1">{formatThousands(totals.slaughtered)}</td>
                    <td className="text-center py-1">{formatThousands(totals.compraTraseiro)}</td>
                    <td className="text-center py-1">{formatThousands(totals.compraDianteiro)}</td>
                    <td className="text-center py-1">{formatThousands(totals.compraPA)}</td>
                    <td className="text-center py-1">{formatThousands(totals.vendaTraseiro)}</td>
                    <td className="text-center py-1">{formatThousands(totals.vendaDianteiro)}</td>
                    <td className="text-center py-1">{formatThousands(totals.vendaPA)}</td>
                    <td className="text-center py-1">{formatThousands(totals.desossaTraseiro)}</td>
                    <td className="text-center py-1">{formatThousands(totals.desossaDianteiro)}</td>
                    <td className="text-center py-1">{formatThousands(totals.desossaPA)}</td>
                    <td className="text-center py-1" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="bg-blue-900/20 border border-blue-500/40 rounded-lg p-4 shadow-lg w-full min-w-0 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white text-sm">
            <Factory className="w-5 h-5 text-emerald-300" />
            Fechamentos de Produção
          </div>
          <div className="flex items-center gap-2">
            <select
              className="w-22 bg-slate-900/80 text-emerald-300 border border-white/15 rounded-md px-2 py-1 outline-none focus:border-emerald-400"
              style={{ colorScheme: 'dark' }}
              value={closureFilterCompany}
              onChange={(e) => setClosureFilterCompany(e.target.value)}
            >
              <option className="bg-slate-900 text-emerald-200" value="">
                Empresa
              </option>
              {closureCompanyOptions.map((c) => (
                <option key={`closure-company-${c}`} value={c} className="bg-slate-900 text-emerald-200">
                  {c}
                </option>
              ))}
            </select>
            <select
              className="w-26 bg-slate-900/80 text-emerald-300 border border-white/15 rounded-md px-2 py-1 outline-none focus:border-emerald-400"
              style={{ colorScheme: 'dark' }}
              value={closureFilterRef}
              onChange={(e) => setClosureFilterRef(e.target.value)}
            >
              <option className="bg-slate-900 text-emerald-200" value="">
                Referencia
              </option>
              {closureRefOptions.map((ref) => (
                <option key={`closure-ref-${ref}`} value={ref} className="bg-slate-900 text-emerald-200">
                  {ref}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="p-2 rounded-md border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-emerald-400/60 transition"
              title="Ocultar/mostrar tabela"
              onClick={() => setIsClosureTableVisible((prev) => !prev)}
            >
              {isClosureTableVisible ? (
                <EyeOff className="w-5 h-5 text-rose-400" />
              ) : (
                <Eye className="w-5 h-5 text-emerald-400" />
              )}
            </button>
          </div>
        </div>
        {isClosureTableVisible && (
          <div className="border border-white/10 rounded-lg overflow-hidden bg-slate-900/60 shadow-inner shadow-black/20">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs text-white/80">
              <thead className="bg-green-800 text-[10px] tracking-[0.2em] text-white/70">
                <tr>
                  <th
                    className="w-10 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                    onClick={() => handleClosureSort('company')}
                  >
                    <span className="inline-flex items-center justify-center">
                      EMP
                      {renderSortIndicator(closureSortConfig.key === 'company', closureSortConfig.direction, 'number')}
                    </span>
                  </th>
                  <th
                    className="px-1 py-2 font-semibold text-center cursor-pointer select-none"
                    onClick={() => handleClosureSort('date')}
                  >
                    <span className="inline-flex items-center justify-center">
                      REF
                      {renderSortIndicator(closureSortConfig.key === 'date', closureSortConfig.direction, 'number')}
                    </span>
                  </th>
                  <th
                    className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                    onClick={() => handleClosureSort('slaughtered')}
                  >
                    <span className="inline-flex items-center justify-center">
                      ABATE
                      {renderSortIndicator(
                        closureSortConfig.key === 'slaughtered',
                        closureSortConfig.direction,
                        'number'
                      )}
                    </span>
                  </th>
                  <th
                    className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
                    onClick={() => handleClosureSort('compraTraseiro')}
                  >
                    <span className="inline-flex items-center justify-center">
                      <span className="leading-4 text-center">
                        Compra<br />TRAS.
                      </span>
                      {renderSortIndicator(
                        closureSortConfig.key === 'compraTraseiro',
                        closureSortConfig.direction,
                        'number'
                      )}
                    </span>
                  </th>
                  <th
                    className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
                    onClick={() => handleClosureSort('compraDianteiro')}
                  >
                    <span className="inline-flex items-center justify-center">
                      <span className="leading-4 text-center">
                        Compra<br />DIANT.
                      </span>
                      {renderSortIndicator(
                        closureSortConfig.key === 'compraDianteiro',
                        closureSortConfig.direction,
                        'number'
                      )}
                    </span>
                  </th>
                  <th
                    className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                    onClick={() => handleClosureSort('compraPA')}
                  >
                    <span className="inline-flex items-center justify-center">
                      Compra <br />PA
                      {renderSortIndicator(
                        closureSortConfig.key === 'compraPA',
                        closureSortConfig.direction,
                        'number'
                      )}
                    </span>
                  </th>
                  <th
                    className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
                    onClick={() => handleClosureSort('vendaTraseiro')}
                  >
                    <span className="inline-flex items-center justify-center">
                      <span className="leading-4 text-center">
                        Venda<br />TRAS.
                      </span>
                      {renderSortIndicator(
                        closureSortConfig.key === 'vendaTraseiro',
                        closureSortConfig.direction,
                        'number'
                      )}
                    </span>
                  </th>
                  <th
                    className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
                    onClick={() => handleClosureSort('vendaDianteiro')}
                  >
                    <span className="inline-flex items-center justify-center">
                      <span className="leading-4 text-center">
                        Venda<br />DIANT.
                      </span>
                      {renderSortIndicator(
                        closureSortConfig.key === 'vendaDianteiro',
                        closureSortConfig.direction,
                        'number'
                      )}
                    </span>
                  </th>
                  <th
                    className="w-14 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                    onClick={() => handleClosureSort('vendaPA')}
                  >
                    <span className="inline-flex items-center justify-center">
                      Venda <br />PA
                      {renderSortIndicator(
                        closureSortConfig.key === 'vendaPA',
                        closureSortConfig.direction,
                        'number'
                      )}
                    </span>
                  </th>
                  <th
                    className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
                    onClick={() => handleClosureSort('desossaTraseiro')}
                  >
                    <span className="inline-flex items-center justify-center">
                      <span className="leading-4 text-center">
                        Desossa<br />TRAS.
                      </span>
                      {renderSortIndicator(
                        closureSortConfig.key === 'desossaTraseiro',
                        closureSortConfig.direction,
                        'number'
                      )}
                    </span>
                  </th>
                  <th
                    className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
                    onClick={() => handleClosureSort('desossaDianteiro')}
                  >
                    <span className="inline-flex items-center justify-center">
                      <span className="leading-4 text-center">
                        Desossa<br />DIANT.
                      </span>
                      {renderSortIndicator(
                        closureSortConfig.key === 'desossaDianteiro',
                        closureSortConfig.direction,
                        'number'
                      )}
                    </span>
                  </th>
                  <th
                    className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                    onClick={() => handleClosureSort('desossaPA')}
                  >
                    <span className="inline-flex items-center justify-center">
                      Desossa <br />PA
                      {renderSortIndicator(
                        closureSortConfig.key === 'desossaPA',
                        closureSortConfig.direction,
                        'number'
                      )}
                    </span>
                  </th>
                  <th className="px-1 py-2 font-semibold text-center">USUARIO</th>
                  <th className="px-1 py-2 font-semibold text-center">DATA</th>
                  <th className="w-13 px-1 py-2 font-semibold text-center">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {sortedClosureRows.map((row: ProductionRow) => (
                  <tr key={`${row.company}-${row.date}`} className="border-t border-white/5">
                    <td className="w-10 text-center py-1">{row.company}</td>
                    <td className="text-center py-1">{formatMonthYearDisplay(row.date)}</td>
                      <td className="text-center py-1">{formatThousands(row.slaughtered)}</td>
                      <td className="text-center py-1">{formatThousands(row.compraTraseiro)}</td>
                      <td className="text-center py-1">{formatThousands(row.compraDianteiro)}</td>
                      <td className="text-center py-1">{formatThousands(row.compraPA)}</td>
                      <td className="text-center py-1">{formatThousands(row.vendaTraseiro)}</td>
                      <td className="text-center py-1">{formatThousands(row.vendaDianteiro)}</td>
                      <td className="text-center py-1">{formatThousands(row.vendaPA)}</td>
                      <td className="text-center py-1">{formatThousands(row.desossaTraseiro)}</td>
                      <td className="text-center py-1">{formatThousands(row.desossaDianteiro)}</td>
                      <td className="text-center py-1">{formatThousands(row.desossaPA)}</td>
                    <td className="w-50 text-center py-1">{row.userRegistration || '-'}</td>
                    <td className="w-21 text-center py-1">{formatDateTimeDisplay(row.dateRegistration) || '-'}</td>
                    <td className="text-center py-1">
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-rose-500/20 transition-colors text-rose-600 focus:outline-none focus:ring-0"
                        title="Excluir"
                        onClick={() => {
                          setDeleteTarget(row)
                          setDeletePassword('')
                          setDeletePasswordError(null)
                          setDeleteAttempts(0)
                          setDeleteModalOpen(true)
                        }}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <ConfirmDeleteModal
        open={closeModalOpen}
        title="Fechar painel de produção"
        description={<p>Confirme sua senha para fechar.</p>}
        passwordValue={closePassword}
        passwordError={closePasswordError}
        attempts={closeAttempts}
        onPasswordChange={(value) => {
          setClosePassword(value)
          setClosePasswordError(null)
        }}
        onCancel={() => {
          setCloseModalOpen(false)
          setClosePassword('')
          setClosePasswordError(null)
          setCloseAttempts(0)
          setIsClosing(false)
        }}
        onConfirm={async () => {
          const pwd = closePassword.trim()
          if (!pwd) {
            setClosePasswordError('required')
            return
          }
          if (closeAttempts >= 2) {
            setClosePasswordError('invalid')
            setCloseModalOpen(false)
            toast.error('Limite de tentativas atingido.')
            return
          }
          const session = loadSession()
          if (!session || !session.password) {
            setClosePasswordError('invalid')
            return
          }
          setIsClosing(true)
          const ok = await verifyPassword(pwd, session.password)
          if (!ok) {
            setIsClosing(false)
            setCloseAttempts((prev) => prev + 1)
            setClosePasswordError('invalid')
            return
          }
          const payloads = filteredRows
            .filter((row) => !row.isNew && row.company !== '' && row.date)
            .map((row) => ({
              company: Number(row.company),
              date_: row.date,
              slaughtered: toNumberOrNull(row.slaughtered),
              compratraseiro: toNumberOrNull(row.compraTraseiro),
              compradianteiro: toNumberOrNull(row.compraDianteiro),
              comprapa: toNumberOrNull(row.compraPA),
              vendatraseiro: toNumberOrNull(row.vendaTraseiro),
              vendadianteiro: toNumberOrNull(row.vendaDianteiro),
              vendapa: toNumberOrNull(row.vendaPA),
              desossatraseiro: toNumberOrNull(row.desossaTraseiro),
              desossadianteiro: toNumberOrNull(row.desossaDianteiro),
              desossapa: toNumberOrNull(row.desossaPA),
              type_registration: 'Sistema',
              user_registration: session?.username || session?.name || 'system',
            }))
          const idsToDelete = filteredRows
            .filter((row) => !row.isNew && row.company !== '' && row.date)
            .map((row) => row.id)
            .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
          const closingResult = await insertClosingProductionRows(
            payloads,
            resolvedSupabaseUrl,
            resolvedSupabaseKey
          )
          setIsClosing(false)
          if (!closingResult.ok) {
            toast.error(closingResult.error || 'Erro ao fechar producao.')
            return
          }
          const deleteResult = await deleteProductionRowsByIds(
            idsToDelete,
            resolvedSupabaseUrl,
            resolvedSupabaseKey
          )
          if (!deleteResult.ok) {
            toast.error(deleteResult.error || 'Erro ao limpar producao.')
            return
          }
          await loadClosures()
          await loadProductionRows()
          setCloseModalOpen(false)
          setClosePassword('')
          setClosePasswordError(null)
          setCloseAttempts(0)
          toast.success('Fechamento gravado com sucesso.')
        }}
        confirmLabel={isClosing ? 'Fechando...' : 'Fechar'}
        cancelLabel="Cancelar"
      />
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-slate-800 text-white border border-white/10 shadow-lg',
          success: { iconTheme: { primary: '#22c55e', secondary: 'white' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: 'white' } },
        }}
      />
      <ConfirmDeleteModal
        open={deleteModalOpen}
        title="Excluir registro"
        description={
          <p>
            Confirme a exclusão de{' '}
            <span className="text-amber-300 font-semibold">
              {formatDateDisplay(deleteTarget?.date) || '--'}
            </span>{' '}
            empresa{' '}
            <span className="text-amber-300 font-semibold">{deleteTarget?.company ?? '--'}</span>.
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
          setDeleteModalOpen(false)
          setDeletePassword('')
          setDeletePasswordError(null)
          setDeleteAttempts(0)
          setDeleteTarget(null)
          setIsDeleting(false)
        }}
        onConfirm={async () => {
          if (!deleteTarget) return
          const pwd = deletePassword.trim()
          if (!pwd) {
            setDeletePasswordError('required')
            return
          }
          if (deleteAttempts >= 2) {
            setDeletePasswordError('invalid')
            setDeleteModalOpen(false)
            toast.error('Limite de tentativas atingido.')
            return
          }
          const session = loadSession()
          if (!session || !session.password) {
            setDeletePasswordError('invalid')
            return
          }
          setIsDeleting(true)
          const okPwd = await verifyPassword(pwd, session.password)
          if (!okPwd) {
            setIsDeleting(false)
            setDeleteAttempts((prev) => prev + 1)
            setDeletePasswordError('invalid')
            return
          }

          if (deleteTarget.isNew) {
            setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
          } else if (deleteTarget.isClosure) {
            const ref = formatMonthYearDisplay(deleteTarget.date)
            const matches = closureRows.filter(
              (row) =>
                String(row.company) === String(deleteTarget.company) &&
                formatMonthYearDisplay(row.date) === ref
            )
            const payloads = matches.map((row) => ({
              company: Number(row.company),
              date_: row.date,
              slaughtered: toNumberOrNull(row.slaughtered),
              compratraseiro: toNumberOrNull(row.compraTraseiro),
              compradianteiro: toNumberOrNull(row.compraDianteiro),
              comprapa: toNumberOrNull(row.compraPA),
              vendatraseiro: toNumberOrNull(row.vendaTraseiro),
              vendadianteiro: toNumberOrNull(row.vendaDianteiro),
              vendapa: toNumberOrNull(row.vendaPA),
              desossatraseiro: toNumberOrNull(row.desossaTraseiro),
              desossadianteiro: toNumberOrNull(row.desossaDianteiro),
              desossapa: toNumberOrNull(row.desossaPA),
              type_registration: 'Sistema',
              user_registration: row.userRegistration ?? session?.username ?? session?.name ?? 'system',
              date_registration: row.dateRegistration ?? new Date().toISOString(),
            }))
            const insertResult = await insertProductionRows(
              payloads,
              resolvedSupabaseUrl,
              resolvedSupabaseKey
            )
            if (!insertResult.ok) {
              toast.error(insertResult.error || 'Erro ao restaurar producao.')
              setIsDeleting(false)
              return
            }
            const idsToDelete = matches
              .map((row) => row.id)
              .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
            const deleteResult = await deleteClosingProductionRowsByIds(
              idsToDelete,
              resolvedSupabaseUrl,
              resolvedSupabaseKey
            )
            if (!deleteResult.ok) {
              toast.error(deleteResult.error || 'Erro ao excluir fechamento.')
              setIsDeleting(false)
              return
            }
            await loadClosures()
            await loadProductionRows()
          } else {
            const result = await deleteProductionRow(
              deleteTarget.id,
              resolvedSupabaseUrl,
              resolvedSupabaseKey
            )
            if (!result.ok) {
              toast.error(result.error || 'Erro ao excluir.')
              return
            }
            setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
          }

          setDeleteModalOpen(false)
          setDeletePassword('')
          setDeletePasswordError(null)
          setDeleteAttempts(0)
          setDeleteTarget(null)
          setIsDeleting(false)
          toast.success(deleteTarget.isClosure ? 'Fechamento revertido com sucesso.' : 'Registro excluido com sucesso.')
        }}
        confirmLabel={isDeleting ? 'Excluindo...' : 'Excluir'}
        cancelLabel="Cancelar"
      />
    </div>
  )
}

export default OperationsProducaoPanel
