import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast, Toaster } from 'react-hot-toast'
import {
  ArrowLeft,
  Check,
  TriangleAlert,
  X,
} from 'lucide-react'
import { validateEmployeeSheet, validateEmployeeRow, REQUIRED_FIELDS, formatDate } from '../utils/employeeParser'
import { insertEmployees, fetchEmployeeRegistrations } from '../services/employeeService'
import { checkPayrollMonthExists, insertPayroll } from '../services/payrollService'
import { insertOvertime, checkOvertimeDatesExist } from '../services/overtimeService'
import type { HistoryEntry } from '../models/history'
import { fetchHistory, insertHistory } from '../services/logService'
import { transformOvertimeApuracao, type OvertimeTransformResult } from '../utils/overtimeTransformer'
import ImportForm from '../components/ImportForm'
import HistoryTable from '../components/HistoryTable'
import DataPreview from '../components/DataPreview'
import PayrollConflictModal from '../components/PayrollConflictModal'
import OvertimeConflictModal from '../components/OvertimeConflictModal'
export interface RowError {
  rowIndex: number
  errors: string[]
}

// State Management with useReducer
export type ImportStatus = 'idle' | 'validating' | 'uploading' | 'done' | 'error'
export type SheetData = Record<string, any>[]
export type SheetType = 'CADASTRO' | 'FOLHA PGTO' | 'HORAS EXTRAS' | ''

export interface State {
  sheetType: SheetType
  selectedFile: File | null
  status: ImportStatus
  progress: number
  messages: string[]
  sheetData: SheetData
  columns: string[]
  sheetHeaderError: string[]
  rowErrors: RowError[]
  importFinished: boolean
  showPreview: boolean
  payrollConflictRef: string | null
  payrollConflictPassword: string
  payrollPasswordErrorType: 'required' | 'invalid' | null
  payrollPasswordAttempts: number
  payrollConflictDate: string | null
  payrollDeletedSuccessfully: boolean
  overtimeConflictRef: string | null
  overtimeConflictDate: string | null
  overtimePassword: string
  overtimePasswordError: 'required' | 'invalid' | null
  overtimePasswordAttempts: number
}

export type Action =
  | { type: 'SET_SHEET_TYPE'; payload: SheetType }
  | { type: 'SELECT_FILE'; payload: File | null }
  | { type: 'RESET_FORM' }
  | { type: 'RESET_FILE_INPUT' }
  | { type: 'PUSH_MESSAGE'; payload: string }
  | { type: 'SET_STATUS'; payload: ImportStatus }
  | { type: 'SET_PROGRESS'; payload: number }
  | { type: 'SET_PREVIEW'; payload: boolean }
  | { type: 'VALIDATION_ERROR'; payload: { messages: string[]; headers?: string[] } }
  | { type: 'FILE_READ_SUCCESS'; payload: { data: SheetData; columns: string[]; messages: string[]; rowErrors?: RowError[] } }
  | { type: 'SET_PAYROLL_CONFLICT'; payload: { ref: string; date: string } }
  | { type: 'UPDATE_PAYROLL_PASSWORD'; payload: string }
  | { type: 'SET_PAYROLL_PASSWORD_ERROR'; payload: 'required' | 'invalid' | null }
  | { type: 'INCREMENT_PASSWORD_ATTEMPTS' }
  | { type: 'RESET_PAYROLL_CONFLICT' }
  | { type: 'PAYROLL_DELETE_SUCCESS' }
  | { type: 'IMPORT_SUCCESS'; payload: { messages: string[] } }
  | { type: 'IMPORT_FAILURE'; payload: { messages: string[] } }
  | { type: 'SET_OVERTIME_CONFLICT'; payload: { ref: string; date: string } }
  | { type: 'UPDATE_OVERTIME_PASSWORD'; payload: string }
  | { type: 'SET_OVERTIME_PASSWORD_ERROR'; payload: 'required' | 'invalid' | null }
  | { type: 'INCREMENT_OVERTIME_PASSWORD_ATTEMPTS' }
  | { type: 'RESET_OVERTIME_CONFLICT' }
  | { type: 'OVERTIME_DELETE_SUCCESS' }

const initialState: State = {
  sheetType: '', selectedFile: null, status: 'idle', progress: 0, messages: [],
  sheetData: [], columns: [], sheetHeaderError: [], rowErrors: [], importFinished: false, showPreview: false,
  payrollConflictRef: null, payrollConflictPassword: '', payrollPasswordErrorType: null,
  payrollPasswordAttempts: 0, payrollConflictDate: null, payrollDeletedSuccessfully: false,
  overtimeConflictRef: null, overtimeConflictDate: null, overtimePassword: '', overtimePasswordError: null, overtimePasswordAttempts: 0,
}

interface TableLoadProps {
  onBack: () => void
  userName?: string
  userRole?: string
  title?: string
  description?: string
}

const tableLoadReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_SHEET_TYPE':
      return { ...initialState, sheetType: action.payload, messages: [] }
    case 'SELECT_FILE':
      return { ...state, selectedFile: action.payload, progress: 0, status: 'idle', messages: [], sheetData: [], columns: [], importFinished: false, showPreview: false }
    case 'RESET_FORM':
      return { ...initialState, messages: [] }
    case 'RESET_FILE_INPUT':
      return { ...state, selectedFile: null, sheetData: [], columns: [], status: 'idle', progress: 0 }
    case 'PUSH_MESSAGE':
      return { ...state, messages: [action.payload, ...state.messages].slice(0, 6) }
    case 'SET_STATUS':
      return { ...state, status: action.payload }
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload }
    case 'SET_PREVIEW':
      return { ...state, showPreview: action.payload }
    case 'VALIDATION_ERROR':
      return { ...state, status: 'error', sheetHeaderError: action.payload.headers || [], sheetData: [], columns: [], messages: [...action.payload.messages, ...state.messages].slice(0, 6) }
    case 'FILE_READ_SUCCESS':
      return { ...state, sheetData: action.payload.data, columns: action.payload.columns, rowErrors: action.payload.rowErrors || [], sheetHeaderError: [], messages: [...action.payload.messages, ...state.messages].slice(0, 6) }
    case 'SET_PAYROLL_CONFLICT':
      return { ...state, payrollConflictRef: action.payload.ref, payrollConflictDate: action.payload.date, status: 'idle', importFinished: false }
    case 'UPDATE_PAYROLL_PASSWORD':
      return { ...state, payrollConflictPassword: action.payload, payrollPasswordErrorType: null }
    case 'SET_PAYROLL_PASSWORD_ERROR':
      return { ...state, payrollPasswordErrorType: action.payload }
    case 'INCREMENT_PASSWORD_ATTEMPTS':
      return { ...state, payrollPasswordAttempts: state.payrollPasswordAttempts + 1 }
    case 'RESET_PAYROLL_CONFLICT':
      return { ...state, payrollConflictRef: null, payrollConflictDate: null, payrollConflictPassword: '', payrollPasswordAttempts: 0, payrollPasswordErrorType: null, payrollDeletedSuccessfully: false }
    case 'PAYROLL_DELETE_SUCCESS':
      return { ...state, status: 'done', payrollDeletedSuccessfully: true, importFinished: false, payrollConflictRef: null, payrollConflictDate: null, payrollConflictPassword: '', payrollPasswordAttempts: 0, payrollPasswordErrorType: null }
    case 'IMPORT_SUCCESS':
      return { ...state, status: 'done', progress: 100, importFinished: true, messages: [...action.payload.messages, ...state.messages].slice(0, 6) }
    case 'IMPORT_FAILURE':
      return { ...state, status: 'error', importFinished: false, messages: [...action.payload.messages, ...state.messages].slice(0, 6) }
    case 'SET_OVERTIME_CONFLICT':
      return { ...state, overtimeConflictRef: action.payload.ref, overtimeConflictDate: action.payload.date, status: 'idle', importFinished: false }
    case 'UPDATE_OVERTIME_PASSWORD':
      return { ...state, overtimePassword: action.payload, overtimePasswordError: null }
    case 'SET_OVERTIME_PASSWORD_ERROR':
      return { ...state, overtimePasswordError: action.payload }
    case 'INCREMENT_OVERTIME_PASSWORD_ATTEMPTS':
      return { ...state, overtimePasswordAttempts: state.overtimePasswordAttempts + 1 }
    case 'RESET_OVERTIME_CONFLICT':
      return { ...state, overtimeConflictRef: null, overtimeConflictDate: null, overtimePassword: '', overtimePasswordAttempts: 0, overtimePasswordError: null }
    case 'OVERTIME_DELETE_SUCCESS':
      return { ...state, status: 'done', importFinished: false, overtimeConflictRef: null, overtimeConflictDate: null, overtimePassword: '', overtimePasswordAttempts: 0, overtimePasswordError: null }
    default:
      return state
  }
}

// Helper function moved outside the component to be a stable reference.
const padNumber = (n: number) => String(n).padStart(2, '0')

const extractFieldFromError = (errorMsg: string): string | null => {
  const knownFields = [...REQUIRED_FIELDS, 'CPF']
  const match = knownFields.find((field) => errorMsg.startsWith(field))
  return match || null
}

const getRefMonthYear = (value: any): string => {
  if (!value) return ''

  // Handle Excel's numeric date format
  if (typeof value === 'number' && value > 1) {
    const excelEpoch = new Date(1899, 11, 30)
    const d = new Date(excelEpoch.getTime() + value * 86400000)
    if (!Number.isNaN(d.getTime())) {
      return `${padNumber(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
    }
  }

  // Handle string dates (DD/MM/YYYY, YYYY-MM-DD, etc.)
  const dateStr = String(value)
  const parts = dateStr.split(/[/.-]/)
  let d: Date
  if (parts.length === 3 && parts[2].length === 4) { // Looks like DD/MM/YYYY or MM/DD/YYYY
    // Assuming DD/MM/YYYY for Brazilian locale
    d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
  } else {
    d = new Date(value)
  }

  if (Number.isNaN(d.getTime())) return ''
  return `${padNumber(d.getMonth() + 1)}/${d.getFullYear()}`
}

const getRefFullDate = (value: any): string => {
  if (!value) return ''

  // ISO date yyyy-mm-dd (evita shift de fuso)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }

  if (typeof value === 'number' && value > 1) {
    const excelEpoch = new Date(1899, 11, 30)
    const d = new Date(excelEpoch.getTime() + value * 86400000)
    if (!Number.isNaN(d.getTime())) {
      return `${padNumber(d.getUTCDate())}/${padNumber(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
    }
  }

  const dateStr = String(value)
  const parts = dateStr.split(/[/.-]/)
  let d: Date
  if (parts.length === 3 && parts[2].length === 4) {
    d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
  } else {
    d = new Date(value)
  }

  if (Number.isNaN(d.getTime())) return ''
  return `${padNumber(d.getDate())}/${padNumber(d.getMonth() + 1)}/${d.getFullYear()}`
}

const formatIsoDateDisplay = (iso?: string): string => {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  return getRefFullDate(iso)
}

const extractRegistrationNumbers = (jsonData: SheetData): number[] => {
  const registrationSet = new Set<number>()
  jsonData.forEach(row => {
    const cadastroKey = Object.keys(row).find((k) => k.toLowerCase() === 'cadastro')
    const rawValue = cadastroKey ? row[cadastroKey] : row['cadastro']
    if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '') {
      const num = Number(String(rawValue).replace(/\D/g, ''))
      if (!Number.isNaN(num) && num > 0) {
        registrationSet.add(num)
      }
    }
  })
  return Array.from(registrationSet)
}

const formatDateFromDb = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${padNumber(date.getDate())}/${padNumber(date.getMonth() + 1)}/${date.getFullYear()} ${padNumber(date.getHours())}:${padNumber(
    date.getMinutes()
  )}`
}

const convertExcelDate = (serial: number): string => {
  if (typeof serial !== 'number' || serial <= 0) return String(serial);
  // Excel's epoch starts on 1899-12-30 due to a leap year bug with 1900.
  // We subtract 1 because Excel's day 1 is Jan 1, 1900.
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return String(serial);
  return `${padNumber(date.getUTCDate())}/${padNumber(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

const formatTimePreview = (val: any): string => {
  if (val === null || val === undefined || val === '') return '-'

  const pad = (n: number) => String(n).padStart(2, '0')

  // Numero vindo do Excel: 0-1 é fração do dia, >1 são dias (26h => 1.0833 dia)
  if (typeof val === 'number') {
    const totalHours = val * 24
    const hours = Math.floor(totalHours)
    const minutes = Math.floor((totalHours - hours) * 60)
    return `${hours}:${pad(minutes)}`
  }

  const raw = String(val).trim()
  if (!raw) return '-'

  const colonMatch = raw.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/)
  if (colonMatch) {
    const [, h, m] = colonMatch
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  }

  const decimal = Number(raw.replace(',', '.'))
  if (!Number.isNaN(decimal)) {
    const totalSeconds = Math.round(decimal * 3600)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return `${hours}:${pad(minutes)}`
  }

  return raw
}

const TableLoad: React.FC<TableLoadProps> = ({
  onBack,
  userName = 'Usuario',
  userRole = 'Perfil nao informado',
  title = 'Carga de Tabelas',
  description = 'Importar massa de dados via planilha.',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const supportedSheets = ['CADASTRO', 'FOLHA PGTO', 'HORAS EXTRAS'] as const
  const requiredFolhaHeaders = ['cadastro', 'Colaborador', 'Evento', 'Competencia', 'Referencia', 'valor']
  const requiredOvertimeHeaders = ['Data', 'Cadastro', 'Nome', '303', '304', '505', '506', '511', '512']
  const ITEMS_PER_PAGE = 10

  const [state, dispatch] = useReducer(tableLoadReducer, initialState)
  const {
    sheetType, selectedFile, status, messages, sheetData, columns, sheetHeaderError,
    importFinished, showPreview, payrollConflictRef, payrollDeletedSuccessfully, rowErrors,
    overtimeConflictRef,
  } = state

  const employeeRegsCache = useRef<Set<number> | null>(null)

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'ascending' | 'descending'
  } | null>({ key: 'date', direction: 'descending' })

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
  const isSupportedSheet = supportedSheets.includes(sheetType as 'CADASTRO' | 'FOLHA PGTO' | 'HORAS EXTRAS')
  const isCadastro = sheetType === 'CADASTRO'
  const isFolha = sheetType === 'FOLHA PGTO'
  const isOvertime = sheetType === 'HORAS EXTRAS'
  const hasBlockingRowErrors = rowErrors.length > 0 && !isCadastro
  const hideImportButton = sheetHeaderError.length > 0 || sheetData.length === 0 || (importFinished && !payrollDeletedSuccessfully) || hasBlockingRowErrors || payrollConflictRef !== null || overtimeConflictRef !== null
  
  useEffect(() => {
    setCurrentPage(1) // Reset page when search query changes
  }, [historySearchQuery, sortConfig])

  const processedHistory = useMemo(() => {
    // Format the date for display here, keeping the original history state clean
    const formattedHistory = history.map(item => ({
      ...item,
      date: formatDateFromDb(item.date),
    }))

    let filteredItems = formattedHistory
    if (!historySearchQuery) {
      filteredItems = formattedHistory
    } else {
      const lowercasedQuery = historySearchQuery.toLowerCase()
      filteredItems = formattedHistory.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(lowercasedQuery)
        )
      )
    }

    if (sortConfig !== null && sortConfig.key === 'date') {
      // Sort by original date from history state for accuracy
      const historyMap = new Map(history.map(item => [item.id, item.date]))
      const sortedItems = [...filteredItems].sort((a, b) => {
        const dateA = new Date(historyMap.get(a.id) || 0).getTime()
        const dateB = new Date(historyMap.get(b.id) || 0).getTime()
        return sortConfig.direction === 'ascending' ? dateA - dateB : dateB - dateA
      })
      return sortedItems
    }
    return filteredItems;
  }, [history, historySearchQuery, sortConfig])

  const paginatedHistory = processedHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const totalPages = Math.ceil(processedHistory.length / ITEMS_PER_PAGE)

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) setCurrentPage(page)
  }

  const statusLabel: Record<ImportStatus, string> = {
    idle: 'Aguardando ação',
    validating: ' Validando planilha',
    uploading: ' Enviando dados',
    done: ' Concluido',
    error: ' Erro',
  }

  const resetFileInput = React.useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending'
    }
    setSortConfig({ key, direction })
  }

  const pushMessage = React.useCallback((message: string) => {
    dispatch({ type: 'PUSH_MESSAGE', payload: message })
    if (message.startsWith('XxX')) {
      dispatch({ type: 'SET_SHEET_TYPE', payload: '' })
    }
  }, [dispatch])

  const getEmployeeRegistrationsCached = React.useCallback(async () => {
    if (employeeRegsCache.current) {
      return { ok: true, registrations: employeeRegsCache.current } as const
    }
    const res = await fetchEmployeeRegistrations(supabaseUrl, supabaseKey)
    if (res.ok) {
      employeeRegsCache.current = res.registrations
    }
    return res
  }, [supabaseKey, supabaseUrl])

  const fetchAndUpdateHistory = React.useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setIsHistoryLoading(true)
      setHistoryError(null)
    }
    try {
      const result = await fetchHistory(supabaseUrl, supabaseKey);
      // Set the raw history data. Formatting is now handled in useMemo.
      setHistory(result);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro ao carregar historico.'
      setHistoryError(`Erro ao carregar historico: ${errMsg}`)
      pushMessage(`XxX Erro ao carregar historico: ${errMsg}`)
    } finally {
      if (!silent) {
        setIsHistoryLoading(false)
      }
    }
  }, [supabaseUrl, supabaseKey, pushMessage])

  useEffect(() => {
    fetchAndUpdateHistory()
    employeeRegsCache.current = null // limpa cache ao montar para evitar dados stale entre sessões
  }, [fetchAndUpdateHistory])

  // Atualiza histórico periodicamente para refletir mudanças sem recarregar a página
  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchAndUpdateHistory({ silent: true }).catch(() => undefined)
    }, 15000) // 15s
    return () => window.clearInterval(interval)
  }, [fetchAndUpdateHistory])

  useEffect(() => {
    if (sheetType && !isSupportedSheet) {
      pushMessage(`Regras para "${sheetType}" ainda NAO implementadas.`)
      // Only reset the file input if the sheet type is unsupported.
      resetFileInput()
    }
  }, [sheetType, isSupportedSheet, pushMessage, resetFileInput])

  // Effect for showing toast notifications
  useEffect(() => {
    // Avoid showing toasts when the modal is open, as it has its own feedback
    if (payrollConflictRef || overtimeConflictRef) return

    if (status === 'done') {
      if (importFinished) {
        toast.success('Importação concluída com sucesso!')
      } else if (payrollDeletedSuccessfully) {
        toast.success('Dados da folha de pagamento excluídos com sucesso.')
      }
    } else if (status === 'error') {
      // Find the most recent relevant error message to display
      const firstErrorMessage = messages.find(msg => msg.startsWith('XxX'))
      if (firstErrorMessage) {
        // Clean up the message for better readability in the toast
        const cleanMessage = firstErrorMessage.replace('XxX', '').trim()
        toast.error(cleanMessage, { duration: 4000 })
      }
    }
  }, [status, importFinished, payrollDeletedSuccessfully, messages, payrollConflictRef])

  const handleFileSelect = async (file: File | null) => {
    if (sheetType && !isSupportedSheet) {
      pushMessage(`Regras para "${sheetType}" ainda NAO implementadas.`)
      dispatch({ type: 'SELECT_FILE', payload: null })
      resetFileInput()
      return
    }
    dispatch({ type: 'SELECT_FILE', payload: file })
    if (!file) {      return
    }
    if (file) {
      pushMessage(`Arquivo selecionado: ${file.name}`)

      let overtimeTransformed: OvertimeTransformResult | null = null
      if (isOvertime) {
        try {
          const buffer = await file.arrayBuffer()
          // Evita transformar planilha vazia
          const workbookCheck = XLSX.read(buffer, { type: 'array' })
          const firstSheetCheck = workbookCheck.Sheets[workbookCheck.SheetNames[0]]
          const rawJson = XLSX.utils.sheet_to_json(firstSheetCheck, { defval: '', raw: true, blankrows: false }) as SheetData
          if (rawJson.length === 0) {
            pushMessage('XxX Planilha vazia. Selecione um arquivo com dados.')
            dispatch({ type: 'VALIDATION_ERROR', payload: { messages: ['XxX Planilha vazia. Selecione um arquivo com dados.'] } })
            return
          }

          const transformed = transformOvertimeApuracao(buffer)
          overtimeTransformed = transformed
          if (transformed.rows.length === 0) {
            pushMessage('XxX Transformacao retornou 0 linhas.')
          } else {
            const periodDisplay = transformed.period
              ? (/^\d{2}\/\d{2}\/\d{4}$/.test(transformed.period.trim())
                ? transformed.period.trim()
                : getRefFullDate(transformed.period))
              : ''
            const periodSuffix = periodDisplay ? ` Data: ${periodDisplay}` : ''
            pushMessage(`OoO Transformacao pronta (${transformed.rows.length} linha(s)).${periodSuffix}`)
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Falha ao transformar horas extras.'
          pushMessage(`XxX Erro ao transformar horas extras: ${errMsg}`)
        }
      } else { }

      readExcelFile(file, overtimeTransformed ? { rows: overtimeTransformed.rows } : undefined)
    }
  }

  const dispatchHeaderError = React.useCallback((missingFields: string[]) => {
    const missing = missingFields.join(', ')
    dispatch({ type: 'VALIDATION_ERROR', payload: { messages: [`XxX Campos obrigatorios faltando: (${missing})`], headers: missingFields } })
  }, [dispatch])

  // Helper function to validate 'CADASTRO' sheets
  const validateCadastroSheet = React.useCallback((jsonData: SheetData, cols: string[], pushMessage: (msg: string) => void) => {
    const normalizeHeader = (h: string) => h.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

    // Mapa de nomes canônicos (sem acento) para os nomes esperados
    const canonicalMap = new Map<string, string>()
    REQUIRED_FIELDS.forEach((field) => {
      canonicalMap.set(normalizeHeader(field), field)
    })

    // Constrói colunas canônicas encontradas na planilha (mesmo que venham com acentos)
    const canonicalCols = new Set<string>()
    cols.forEach((c) => {
      const canon = canonicalMap.get(normalizeHeader(c))
      if (canon) canonicalCols.add(canon)
    })

    // Normaliza linhas copiando valores para as chaves canônicas quando existirem
    const normalizedData = jsonData.map((row) => {
      const newRow: Record<string, any> = { ...row }
      Object.keys(row).forEach((key) => {
        const canon = canonicalMap.get(normalizeHeader(key))
        if (canon && !(canon in newRow)) {
          newRow[canon] = row[key]
        }
      })
      return newRow
    })

    const headerValidation = validateEmployeeSheet(Array.from(canonicalCols))
    if (!headerValidation.valid) {
      dispatchHeaderError(headerValidation.missingFields)
      return { ok: false }
    }
    pushMessage(`OoO Headers validados: ${canonicalCols.size} coluna(s)`)
    const rowErrors: RowError[] = []
    normalizedData.forEach((row, index) => {
      const validation = validateEmployeeRow(row)
      if (!validation.valid) {
        rowErrors.push({ rowIndex: index + 2, errors: validation.errors })
      }
    })

    if (rowErrors.length > 0) {
      const errorFields = new Set<string>()
      rowErrors.forEach((rowErr) => {
        rowErr.errors.forEach((msg) => {
          const field = extractFieldFromError(msg)
          if (field) errorFields.add(field)
        })
      })
      const fieldsText = Array.from(errorFields).join(', ')

      // lista de cadastros das linhas com advertência
      const erroredIndices = new Set(rowErrors.map((r) => r.rowIndex - 2)) // zero-based
      const cadastroList = normalizedData
        .map((row, idx) => (erroredIndices.has(idx) ? String(row['Cadastro'] ?? '').trim() : ''))
        .filter((cad) => cad.length > 0)
        .join(', ')

      const fieldPart = fieldsText ? `(${fieldsText})` : ''
      const cadastroPart = cadastroList ? ` (${cadastroList})` : ''
      pushMessage(`:) ${rowErrors.length} linha(s) com ${fieldPart} corrigida(s)${cadastroPart}.`)
    } else {
      pushMessage(`OoO Todas as ${normalizedData.length} linhas validadas com sucesso`)
    }

    // Convert date fields from Excel serial number to readable format
    const formattedData = normalizedData.map(row => ({
      ...row,
      data_nascimento: row.data_nascimento ? convertExcelDate(row.data_nascimento) : row.data_nascimento,
      data_contratacao: row.data_contratacao ? convertExcelDate(row.data_contratacao) : row.data_contratacao,
      data_situacao: row.data_situacao ? convertExcelDate(row.data_situacao) : row.data_situacao,
    }));

    const displayColumns = REQUIRED_FIELDS.filter((field) => canonicalCols.has(field))
    dispatch({ type: 'FILE_READ_SUCCESS', payload: { data: formattedData, columns: displayColumns, messages: [], rowErrors } })
    return { ok: true }
  }, [dispatch, dispatchHeaderError])

  // Helper function to validate 'FOLHA PGTO' sheets
  const validateFolhaSheet = React.useCallback(async (jsonData: SheetData, cols: string[], pushMessage: (msg: string) => void) => {
    const normalizeHeader = (h: string) =>
      h
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^\p{L}\p{N}]/gu, '')
        .toLowerCase()

    const canonicalMap = new Map<string, string>([
      ['cadastro', 'cadastro'],
      ['colaborador', 'Colaborador'],
      ['nome', 'Colaborador'],
      ['evento', 'Evento'],
      ['competencia', 'Competencia'],
      ['referencia', 'Referencia'],
      ['valor', 'valor'],
    ])

    const canonicalCols = new Set<string>()
    cols.forEach((c) => {
      const canon = canonicalMap.get(normalizeHeader(c))
      if (canon) canonicalCols.add(canon)
    })

    const missingFolha = requiredFolhaHeaders.filter((h) => !canonicalCols.has(h))
    if (missingFolha.length > 0) {
      dispatchHeaderError(missingFolha)
      return { ok: false }
    }
    pushMessage(`OoO Headers validados: ${canonicalCols.size} coluna(s)`)

    // 1. Validate Employee Registrations
    const regNumbers = extractRegistrationNumbers(jsonData)
    const employeeRegsResult = await getEmployeeRegistrationsCached()
    if (!employeeRegsResult.ok) {
      dispatch({ type: 'IMPORT_FAILURE', payload: { messages: ['XxX Erro ao validar colaboradores.'] } })
      return { ok: false }
    }
    const { registrations } = employeeRegsResult
    const missingRegs = regNumbers.filter((r) => !registrations.has(r))
    if (missingRegs.length > 0) {
      dispatch({ type: 'VALIDATION_ERROR', payload: { messages: [`XxX Colaboradores nao encontrado: (${missingRegs.join(', ')})`] } })
      return { ok: false }
    }

    // 2. Check for existing payroll month
    const competenceKey = cols.find((c) => {
      const canon = normalizeHeader(c)
      return canon === 'competencia' || canon === 'pagamento'
    }) || 'Competencia'
    const competenceValue = jsonData[0]?.[competenceKey]
    const refMonth = getRefMonthYear(competenceValue) || '-'
    const payrollCheck = await checkPayrollMonthExists(competenceValue, supabaseUrl, supabaseKey)
    if (!payrollCheck.ok) {
      const detail = payrollCheck.error ? ` Detalhe: ${payrollCheck.error}` : ''
      dispatch({ type: 'IMPORT_FAILURE', payload: { messages: [`XxX Erro ao verificar folha ref. ${refMonth}.${detail}`] } })
      return { ok: false }
    }
    if (payrollCheck.exists) {
      pushMessage(`:) Competencia ref. ${refMonth} ja consta em payroll.`)
      // Use ISO garantido para o delete
      const iso = formatDate(competenceValue) || String(competenceValue)
      const dt = new Date(iso)
      const monthIso = Number.isNaN(dt.getTime())
        ? iso
        : `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-01`
      dispatch({ type: 'SET_PAYROLL_CONFLICT', payload: { ref: refMonth, date: monthIso } })
      // Do not return `ok: false`. The process is paused, pending user action in the modal.
      return { ok: true, paused: true } // Return a specific state to prevent further processing
    }

    // 3. Normalize and format data for preview
    const folhaOrder = ['cadastro', 'Colaborador', 'Evento', 'Competencia', 'Referencia', 'valor']
    const ordered = folhaOrder.map((c) => (c === 'Competencia' ? competenceKey : c)).filter((c) => cols.includes(c) || c === 'Competencia')
    const remaining = cols.filter((c) => !ordered.includes(c))
    const normalized = jsonData.map((row) => {
      const cadastroNum = row['cadastro'] ? Number(String(row['cadastro']).replace(/\D/g, '')) : row['cadastro']
      const eventoNum = row['Evento'] ? Number(String(row['Evento']).replace(/\D/g, '')) : row['Evento']
      const competenciaVal = row[competenceKey] ?? row['Competencia'] ?? row['competencia']
      const competenciaFmt = getRefMonthYear(competenciaVal) || competenciaVal
      let rawValorNum: number | null = null
      if (typeof row['valor'] === 'number') {
        rawValorNum = row['valor']
      } else if (row['valor']) {
        const cleaned = String(row['valor']).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')
        const parsed = Number(cleaned)
        rawValorNum = Number.isNaN(parsed) ? null : parsed
      }
      const valorFormatado = typeof rawValorNum === 'number' ? rawValorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : row['valor']
      return {
        ...row,
        [competenceKey]: competenciaFmt,
        Competencia: competenciaFmt,
        cadastro: cadastroNum,
        Evento: eventoNum,
        valor: valorFormatado,
        _valorRaw: rawValorNum,
      }
    })

    dispatch({ type: 'FILE_READ_SUCCESS', payload: { data: normalized, columns: [...ordered, ...remaining], messages: [], rowErrors: [] } })
    return { ok: true }
  }, [dispatch, supabaseUrl, supabaseKey])

  const validateOvertimeSheet = React.useCallback(async (jsonData: SheetData, cols: string[], pushMessage: (msg: string) => void, headerDate?: string) => {
    const normalizeHeader = (h: string) =>
      h
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^\p{L}\p{N}]/gu, '') // remove tudo que nao for letra/digito (inclui % e espaços/nbsp)
        .toLowerCase()

    const headerDateIso = headerDate ? formatDate(headerDate) || String(headerDate) : ''
    const normalizedCols = cols.map((c) => normalizeHeader(c))
    const hasData = normalizedCols.some((c) => c === 'data')
    const hasCadastro = normalizedCols.some((c) => c === 'cadastro')
    const hasNome = normalizedCols.some((c) => c === 'nome')
    const has303 = normalizedCols.some((c) => c === '303')
    const has304 = normalizedCols.some((c) => c === '304')
    const has505 = normalizedCols.some((c) => c === '505')
    const has506 = normalizedCols.some((c) => c === '506')
    const has511 = normalizedCols.some((c) => c === '511')
    const has512 = normalizedCols.some((c) => c === '512')

    const missingOvertime: string[] = []
    if (!hasData) missingOvertime.push('Data')
    if (!hasCadastro) missingOvertime.push('Cadastro')
    if (!hasNome) missingOvertime.push('Nome')
    if (!has303) missingOvertime.push('303')
    if (!has304) missingOvertime.push('304')
    if (!has505) missingOvertime.push('505')
    if (!has506) missingOvertime.push('506')
    if (!has511) missingOvertime.push('511')
    if (!has512) missingOvertime.push('512')

    if (missingOvertime.length > 0) {
      dispatchHeaderError(missingOvertime)
      return { ok: false }
    }
    pushMessage(`OoO Headers validados: ${cols.length} coluna(s)`)

    // Validar se as matrículas existem
    const regNumbers = extractRegistrationNumbers(jsonData)
    const employeeRegsResult = await getEmployeeRegistrationsCached()
    if (!employeeRegsResult.ok) {
      dispatch({ type: 'IMPORT_FAILURE', payload: { messages: ['XxX Erro ao validar colaboradores.'] } })
      return { ok: false }
    }
    const { registrations } = employeeRegsResult
    const missingRegs = regNumbers.filter((r) => !registrations.has(r))
    if (missingRegs.length > 0) {
      dispatch({ type: 'VALIDATION_ERROR', payload: { messages: [`XxX Colaboradores nao encontrado: (${missingRegs.join(', ')})`] } })
      return { ok: false }
    }

    // Checa se ja existe horas extras para as datas informadas (usa data completa dd/mm/aaaa)
    const dateKey = Object.keys(jsonData[0]).find((k) => k.toLowerCase() === 'data') || 'Data'
    const uniqueDates = new Set<string>()
    jsonData.forEach((row) => {
      const iso = formatDate(row[dateKey]) || headerDateIso
      if (iso) uniqueDates.add(iso)
    })
    const firstIso = Array.from(uniqueDates)[0] || ''

    const checkBatch = await checkOvertimeDatesExist(uniqueDates, supabaseUrl, supabaseKey)
    if (!checkBatch.ok) {
      const detail = checkBatch.error ? ` Detalhe: ${checkBatch.error}` : ''
      dispatch({ type: 'IMPORT_FAILURE', payload: { messages: [`XxX Erro ao verificar horas extras. ${detail}`] } })
      return { ok: false }
    }
    if (checkBatch.exists) {
      const refDate = formatIsoDateDisplay(firstIso || (checkBatch.dates && checkBatch.dates[0]) || '')
      const detailMsg = refDate ? ` ${refDate}` : ''
      dispatch({ type: 'SET_OVERTIME_CONFLICT', payload: { ref: detailMsg.trim() || '-', date: firstIso || (checkBatch.dates?.[0] || '') } })
      return { ok: true, paused: true }
    }

    const overtimeOrder = ['Data', 'Cadastro', 'Nome', '303', '304', '505', '506', '511', '512']
    const ordered = overtimeOrder.filter((c) => cols.includes(c))
    const remaining = cols.filter((c) => !ordered.includes(c))

    const normalized = jsonData.map((row) => {
      const cadastroKey = Object.keys(row).find((k) => k.toLowerCase() === 'cadastro')
      const dataKey = Object.keys(row).find((k) => k.toLowerCase() === 'data')
      const key303 = Object.keys(row).find((k) => normalizeHeader(k) === '303')
      const key304 = Object.keys(row).find((k) => normalizeHeader(k) === '304')
      const key505 = Object.keys(row).find((k) => normalizeHeader(k) === '505')
      const key506 = Object.keys(row).find((k) => normalizeHeader(k) === '506')
      const key511 = Object.keys(row).find((k) => normalizeHeader(k) === '511')
      const key512 = Object.keys(row).find((k) => normalizeHeader(k) === '512')

      const cadastroNum = cadastroKey ? Number(String(row[cadastroKey]).replace(/\D/g, '')) : row['Cadastro']
      const dataIso = formatDate(row[dataKey || 'Data']) || headerDateIso
      const preview303 = formatTimePreview(key303 ? row[key303] : row['303'])
      const preview304 = formatTimePreview(key304 ? row[key304] : row['304'])
      const preview505 = formatTimePreview(key505 ? row[key505] : row['505'])
      const preview506 = formatTimePreview(key506 ? row[key506] : row['506'])
      const preview511 = formatTimePreview(key511 ? row[key511] : row['511'])
      const preview512 = formatTimePreview(key512 ? row[key512] : row['512'])

      return {
        ...row,
        Cadastro: cadastroNum,
        Data: dataIso || row[dataKey || 'Data'] || headerDateIso,
        '303': preview303,
        '304': preview304,
        '505': preview505,
        '506': preview506,
        '511': preview511,
        '512': preview512,
      }
    })

    dispatch({
      type: 'FILE_READ_SUCCESS',
      payload: { data: normalized, columns: [...ordered, ...remaining], messages: [], rowErrors: [] },
    })
    return { ok: true }
  }, [dispatch, supabaseUrl, supabaseKey])

  const readExcelFile = (file: File, transformedOvertime?: { rows: SheetData; columns?: string[] }) => {
    if (!isSupportedSheet) {
      pushMessage(`Regras para "${sheetType}" ainda NAO implementadas.`)
      dispatch({ type: 'RESET_FILE_INPUT' })
      return
    }
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as ArrayBuffer
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const j5Cell = firstSheet?.['J5']?.v
        const j5DateIso = formatDate(j5Cell) || (j5Cell ? String(j5Cell) : '')
        let jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          defval: '', // garante que colunas vazias apareçam no objeto (cabecalho)
          raw: true,
          blankrows: false,
        }) as SheetData

        const headerRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', blankrows: false }) as any[][]
        let headers = Array.isArray(headerRows) && headerRows.length > 0
          ? (headerRows[0] || []).map((h: any) => String(h ?? '').trim())
          : Object.keys(jsonData[0] || {})

        if (isOvertime && transformedOvertime?.rows) {
          jsonData = transformedOvertime.rows
          const derivedColumns = transformedOvertime.columns && transformedOvertime.columns.length > 0
            ? transformedOvertime.columns
            : (jsonData.length > 0 ? Object.keys(jsonData[0]) : [])
          headers = derivedColumns.length > 0
            ? derivedColumns
            : ['Data', 'Cadastro', 'Nome', '303', '304', '505', '506', '511', '512']
        }

        if (jsonData.length === 0) {
          pushMessage('XxX Arquivo vazio.')
          dispatch({ type: 'VALIDATION_ERROR', payload: { messages: ['XxX Planilha vazia. Selecione um arquivo com dados.'] } })
          return
        }

        const cols = headers
        let validationResult: { ok: boolean; paused?: boolean }

        if (isCadastro) {
          validationResult = validateCadastroSheet(jsonData, cols, pushMessage)
        } else if (isFolha) {
          validationResult = await validateFolhaSheet(jsonData, cols, pushMessage)
        } else if (isOvertime) {
          validationResult = await validateOvertimeSheet(jsonData, cols, pushMessage, j5DateIso)
        } else {
          pushMessage(`OoO Headers validados: ${cols.length} coluna(s)`)
          dispatch({ type: 'FILE_READ_SUCCESS', payload: { data: jsonData, columns: headers, messages: [] } })
          validationResult = { ok: true }
        }

        if (validationResult.ok && !validationResult.paused) {
          pushMessage(`OoO ${jsonData.length} linha(s) pronta pra ser enviada ao servidor`)
        }
      } catch (error) {
        console.error('Erro ao ler arquivo:', error)
        pushMessage('Erro ao ler o arquivo.')
        dispatch({ type: 'VALIDATION_ERROR', payload: { messages: ['Erro ao processar o arquivo.'] } })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const simulateImport = async () => {
    if (!sheetType || !selectedFile || !isSupportedSheet) {
      pushMessage('Escolha o tipo de planilha antes de importar.')
      dispatch({ type: 'SET_STATUS', payload: 'idle' })
      return
    }
    if (payrollConflictRef && isFolha) {
      pushMessage('Resolva o conflito da folha antes de importar.')
      return
    }
    if (overtimeConflictRef && isOvertime) {
      pushMessage('Resolva o conflito de horas extras antes de importar.')
      return
    }

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    try {
      dispatch({ type: 'SET_STATUS', payload: 'validating' })
      dispatch({ type: 'SET_PROGRESS', payload: 20 })
      pushMessage(`Validando a planilha "${selectedFile.name}"...`)
      await sleep(600)

      dispatch({ type: 'SET_STATUS', payload: 'uploading' })
      dispatch({ type: 'SET_PROGRESS', payload: 65 })
      pushMessage('Enviando dados para o servidor...')
      await sleep(900)

      let finalMessages: string[] = []

      if (isCadastro) {
        const employeeResult = await insertEmployees(sheetData, userName, supabaseUrl, supabaseKey)
        if (!employeeResult.ok) {
          const employeeError = employeeResult.error ? `XxX Falha ao gravar employee: ${employeeResult.error}` : 'XxX Falha ao gravar employee.'
          dispatch({ type: 'IMPORT_FAILURE', payload: { messages: [employeeError] } })
          return
        }
        
        const { updatedCount, newCount } = employeeResult
        const parts: string[] = []
        if (updatedCount > 0) parts.push(`${updatedCount} atualizado(s)`)
        if (newCount > 0) parts.push(`${newCount} inserido(s)`)

        if (parts.length > 0) {
          finalMessages.push(`OoO Funcionários: ${parts.join(' e ')}.`)
        } else {
          finalMessages.push(`:) Nenhum funcionário novo ou alterado.`)
        }
        const logInsertedEmployees = await insertHistory(
          {
            table: 'employee',
            actions: 'Inclusao',
            file: selectedFile?.name || '-',
            user: userName || '-',
            type: 'Importado',
          },
          supabaseUrl,
          supabaseKey
        )
        if (!logInsertedEmployees) {
          pushMessage('XxX Falha ao registrar log de cadastro.')
        }


      } else if (isFolha) {
        const payrollResult = await insertPayroll(sheetData, userName, supabaseUrl, supabaseKey)
        if (!payrollResult.ok) {
          const payrollError = payrollResult.error ? `XxX Erro ao gravar tabela payroll: ${payrollResult.error}` : 'XxX Erro ao gravar tabela payroll.'
          dispatch({ type: 'IMPORT_FAILURE', payload: { messages: [payrollError] } })
          return
        }
        finalMessages.push(`OoO Payroll: ${payrollResult.inserted} linha(s) inseridas.`)
        const paymentValue = sheetData[0]?.['Competencia']
        const refMonthLog = getRefMonthYear(paymentValue)
        await insertHistory(
          {
            table: refMonthLog ? `payroll Ref. ${refMonthLog}` : 'payroll',
            actions: 'Inclusao',
            file: selectedFile?.name || '-',
            user: userName || '-',
            type: 'Importado',
          },
          supabaseUrl,
          supabaseKey
        )
      } else if (isOvertime) {
        if (overtimeConflictRef) {
          pushMessage('XxX Resolva o conflito de horas extras antes de importar.')
          return
        }
        const overtimeResult = await insertOvertime(sheetData, userName, supabaseUrl, supabaseKey)
        if (!overtimeResult.ok) {
          const overtimeError = overtimeResult.error ? `XxX Erro ao gravar horas extras: ${overtimeResult.error}` : 'XxX Erro ao gravar horas extras.'
          dispatch({ type: 'IMPORT_FAILURE', payload: { messages: [overtimeError] } })
          return
        }
        finalMessages.push(`OoO Horas extras: ${overtimeResult.inserted} linha(s) inseridas.`)
        const refDateLog = getRefFullDate(sheetData[0]?.['Data'])
        await insertHistory(
          {
            table: refDateLog ? `overtime Ref. ${refDateLog}` : 'overtime',
            actions: 'Inclusao',
            file: selectedFile?.name || '-',
            user: userName || '-',
            type: 'Importado',
          },
          supabaseUrl,
          supabaseKey
        )
      }

      finalMessages.push('OoO Carga da tabela concluida com sucesso.')
      dispatch({ type: 'IMPORT_SUCCESS', payload: { messages: finalMessages } })

      await fetchAndUpdateHistory()
    } catch (error) {
      console.error('Erro na importacao simulada:', error)
      dispatch({ type: 'IMPORT_FAILURE', payload: { messages: ['Erro ao importar. Tente novamente.'] } })
    }
  }

  const resetForm = () => {
    dispatch({ type: 'RESET_FORM' })
    resetFileInput()
    employeeRegsCache.current = null
  }

  const getStatusColor = () => {
    if (status === 'error') return 'text-amber-300'
    if (status === 'done') return 'text-emerald-400'
    return 'text-white/80'
  }

  const renderActionIcon = (acao?: string) => {
    const value = (acao || '').toLowerCase()
    if (value === 'inclusao' || value === 'inclus�o') {
      return <Check className="w-4 h-4 text-emerald-400 mx-auto" />
    }
    if (value === 'delete' || value === 'exclusao' || value === 'exclus�o') {
      return <X className="w-4 h-4 text-rose-400 mx-auto" />
    }
    if (value === 'alterou' || value === 'alteracao' || value === 'altera��o' || value === 'update') {
      return <TriangleAlert className="w-4 h-4 text-amber-400 mx-auto" />
    }
    return <span className="text-white/70 text-[11px] text-center block">{acao || '-'}</span>
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-slate-800 text-white border border-white/10 shadow-lg',
          success: { iconTheme: { primary: '#22c55e', secondary: 'white' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: 'white' } },
        }} />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-white text-2xl font-bold leading-tight">{title}</h2>
          <p className="text-white/70 text-sm mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-3 rounded-xl shadow-inner shadow-black/20">
          <div>
            <p className="text-emerald-300 font-semibold leading-tight">{userName}</p>
            <p className="text-white/60 text-[11px] uppercase tracking-[0.25em]">{userRole}</p>
          </div>
          <button
            onClick={() => {
              resetForm()
              onBack()
            }}
            className="flex items-center gap-2 text-emerald-100 bg-white/10 border border-white/10 px-3 py-2 rounded-lg hover:bg-emerald-500/20 hover:border-emerald-300/40 transition-colors text-xs font-semibold uppercase tracking-wide"
            title="Voltar para o dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <ImportForm
          state={state}
          dispatch={dispatch}
          fileInputRef={fileInputRef}
          onFileSelect={handleFileSelect}
          onImport={simulateImport}
          onReset={resetForm}
          isSupportedSheet={isSupportedSheet}
          hideImportButton={hideImportButton}
          statusLabel={statusLabel}
          getStatusColor={getStatusColor}
          cadastroHeaders={REQUIRED_FIELDS}
          folhaHeaders={requiredFolhaHeaders}
          overtimeHeaders={requiredOvertimeHeaders}
        />
        <HistoryTable
          history={paginatedHistory}
          renderActionIcon={renderActionIcon}
          isLoading={isHistoryLoading}
          error={historyError}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          searchQuery={historySearchQuery}
          onSearchChange={setHistorySearchQuery}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      </div>
      </div>

      <DataPreview
        show={showPreview}
        data={sheetData}
        columns={columns}
        isFolha={sheetType === 'FOLHA PGTO'}
        rowErrors={rowErrors} />

      <PayrollConflictModal
        state={state}
        dispatch={dispatch}
        pushMessage={pushMessage}
        onHistoryUpdate={fetchAndUpdateHistory}
        userName={userName}
        supabaseUrl={supabaseUrl}
        supabaseKey={supabaseKey}
      />
      <OvertimeConflictModal
        state={state}
        dispatch={dispatch}
        pushMessage={pushMessage}
        onHistoryUpdate={fetchAndUpdateHistory}
        userName={userName}
        supabaseUrl={supabaseUrl}
        supabaseKey={supabaseKey}
      />
    </>
  )
}

export default TableLoad
