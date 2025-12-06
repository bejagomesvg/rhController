import React, { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { validateEmployeeSheet, validateEmployeeRow, formatCPF, formatDate, formatSalary, REQUIRED_FIELDS } from '../utils/employeeParser'

type ImportStatus = 'idle' | 'validating' | 'uploading' | 'done' | 'error'
type SheetData = Record<string, any>[]

interface RowError {
  rowIndex: number
  errors: string[]
}

interface HistoryEntry {
  date: string
  banco: string
  arquivo: string
  usuario: string
  id?: number
}

interface TableLoadProps {
  onBack: () => void
  userName?: string
  userRole?: string
  title?: string
  description?: string
}

const TableLoad: React.FC<TableLoadProps> = ({
  onBack,
  userName = 'Usuario',
  userRole = 'Perfil nao informado',
  title = 'Carga de Tabelas',
  description = 'Importar massa de dados via planilha.',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sheetType, setSheetType] = useState<'CADASTRO' | 'HORAS_EXTRAS' | 'FECHAMENTO' | ''>('')
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [progress, setProgress] = useState<number>(0)
  const [messages, setMessages] = useState<string[]>([])
  const [sheetData, setSheetData] = useState<SheetData>([])
  const [columns, setColumns] = useState<string[]>([])
  const [sheetHeaderError, setSheetHeaderError] = useState<string[]>([])
  const [previewVisible, setPreviewVisible] = useState<boolean>(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [importFinished, setImportFinished] = useState<boolean>(false)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

  const hideImportButton = sheetHeaderError.length > 0 || sheetData.length === 0 || importFinished

  const statusLabel: Record<ImportStatus, string> = {
    idle: '',
    validating: 'Validando planilha',
    uploading: 'Enviando dados',
    done: 'Concluido',
    error: 'Erro',
  }

  const pushMessage = (message: string) => {
    setMessages((prev) => [message, ...prev].slice(0, 6))
  }

  const extractFieldFromError = (errorMsg: string): string | null => {
    const knownFields = [...REQUIRED_FIELDS, 'CPF']
    const match = knownFields.find((field) => errorMsg.startsWith(field))
    return match || null
  }

  const formatNow = () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(
      now.getMinutes()
    )}`
  }

  const formatDateFromDb = (value?: string | null) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}`
  }

  const fetchHistory = async () => {
    if (!supabaseUrl || !supabaseKey) return
    try {
      const url = new URL(`${supabaseUrl}/rest/v1/log_table_load`)
      url.searchParams.set('select', 'id,registration,date_registration,file_,user_registration')
      url.searchParams.set('order', 'date_registration.desc')
      const res = await fetch(url.toString(), {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=minimal',
        },
      })
      if (!res.ok) {
        console.error('Erro ao buscar histórico', await res.text())
        return
      }
      const data = (await res.json()) as Array<{
        id: number
        registration: string
        date_registration: string
        file_: string
        user_registration: string
      }>
      setHistory(
        data.map((item) => ({
          id: item.id,
          banco: item.registration,
          date: formatDateFromDb(item.date_registration),
          arquivo: item.file_,
          usuario: item.user_registration,
        }))
      )
    } catch (error) {
      console.error('Erro ao buscar histórico', error)
    }
  }

  const renderMessage = (msg: string) => {
    // Destaca o sufixo entre parênteses (ex.: campos com problema) em amarelo/verm.
    const warningMatch = msg.match(/^(.*-)\s*\(\s*([^)]+)\s*\)(.*)$/)
    if (warningMatch) {
      const [, before, suffix, after] = warningMatch
      return (
        <span className="text-xs">
          {before} <span className="text-amber-300">( {suffix} )</span>
          {after}
        </span>
      )
    }
    if (msg.trim().startsWith('❌')) {
      const firstParen = msg.indexOf('(')
      const lastParen = msg.lastIndexOf(')')
      if (firstParen !== -1 && lastParen !== -1 && lastParen > firstParen) {
        const before = msg.slice(0, firstParen).trimEnd()
        const suffix = msg.slice(firstParen + 1, lastParen)
        const after = msg.slice(lastParen + 1)
        return (
          <span className="text-xs">
            {before} <span className="text-rose-400">( {suffix} )</span>
            {after}
          </span>
        )
      }
    }
    return <span className="text-xs">{msg}</span>
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file)
    setProgress(0)
    setStatus('idle')
    setMessages([])
    setSheetData([])
    setColumns([])
    setPreviewVisible(false)
    setImportFinished(false)
    if (file) {
      pushMessage(`Arquivo selecionado: ${file.name}`)
      // Ler automaticamente o arquivo ao selecionar
      readExcelFile(file)
    }
  }

  const readExcelFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as SheetData
        
        setImportFinished(false)
        
        if (jsonData.length === 0) {
          pushMessage('Arquivo vazio.')
          setSheetData([])
          setColumns([])
          setSheetHeaderError([])
          return
        }

        const cols = Object.keys(jsonData[0] || {})
        
        // Validar headers obrigatórios
        const headerValidation = validateEmployeeSheet(cols)
        if (!headerValidation.valid) {
          setSheetHeaderError(headerValidation.missingFields)
          const missing = headerValidation.missingFields.join(', ')
          pushMessage(`❌ Campos obrigatórios faltando: (${missing})`)
          setSheetData([])
          setColumns([])
          return
        }

        // Headers válidos, limpar erro
        setSheetHeaderError([])
        pushMessage(`Headers validados: ${cols.length} coluna(s)`)

        // Validar dados de cada linha
        const rowErrors: RowError[] = []
        jsonData.forEach((row, index) => {
          const validation = validateEmployeeRow(row)
          if (!validation.valid) {
            rowErrors.push({
              rowIndex: index + 2, // +2 pois começa em 1 e há header
              errors: validation.errors,
            })
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
          const suffix = fieldsText ? ` ( ${fieldsText})` : ''
          pushMessage(`⚠️  ${rowErrors.length} linha(s) - ${suffix} corrigidos e validado!`)
        } else {
          pushMessage(`Todas as ${jsonData.length} linhas validadas com sucesso`)
        }

        const displayColumns = REQUIRED_FIELDS.filter((field) => cols.includes(field))
        setColumns(displayColumns)
        setSheetData(jsonData)
        pushMessage(`✅ ${jsonData.length} linha(s) pronta pra ser enviada ao servidor`)
      } catch (error) {
        console.error('Erro ao ler arquivo:', error)
        pushMessage('❌ Erro ao ler o arquivo.')
        setSheetData([])
        setColumns([])
        setSheetHeaderError([])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const insertHistory = async (entry: { registration: string; date: string; file: string; user: string }) => {
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_KEY)')
      return false
    }
    try {
      const maxLen = 50
      const truncate = (value: string) => (value.length > maxLen ? value.slice(0, maxLen) : value)
      // id precisa caber em INT
      const id = Math.floor(Math.random() * 900_000_000) + 1
      const url = new URL(`${supabaseUrl}/rest/v1/log_table_load`)
      const payload = {
        id,
        registration: truncate(entry.registration),
        // Gravando com horário completo (timestamptz no banco)
        date_registration: new Date().toISOString(),
        file_: truncate(entry.file),
        user_registration: truncate(entry.user),
      }
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errTxt = await res.text()
        console.error('Erro ao gravar histórico', errTxt)
        pushMessage('❌ Erro ao gravar log no banco')
        return false
      }
      const [created] = (await res.json()) as Array<{
        id: number
        registration: string
        date_registration: string
        file_: string
        user_registration: string
      }>
      if (created) {
        await fetchHistory()
        return true
      }
      pushMessage('❌ Erro ao gravar log no banco')
      return false
    } catch (error) {
      console.error('Erro ao gravar histórico', error)
      pushMessage('❌ Erro ao gravar log no banco')
      return false
  }
  }

  const simulateImport = async () => {
    if (!sheetType) {
      setStatus('error')
      pushMessage('Escolha o tipo de planilha antes de importar.')
      return
    }
    if (!selectedFile) {
      setStatus('error')
      pushMessage('Selecione um arquivo antes de importar.')
      return
    }

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    try {
      setPreviewVisible(false)
      setStatus('validating')
      setProgress(20)
      pushMessage(`Validando a planilha "${selectedFile.name}" para ser envida ao Servidor`)
      await sleep(600)

      setStatus('uploading')
      setProgress(65)
      pushMessage('Enviando dados para o servidor...')
      await sleep(900)

      setStatus('done')
      setProgress(100)
      setMessages(['✅ Importação concluída com sucesso.'])
      await insertHistory({
        registration: sheetType === 'CADASTRO' ? 'Cadastro de Funcionário' : sheetType || '-',
        date: formatNow(),
        file: selectedFile?.name || '-',
        user: userName || '-',
      })
      setPreviewVisible(true)
      setImportFinished(true)
    } catch (error) {
      console.error('Erro na importacao simulada:', error)
      setStatus('error')
      pushMessage('Erro ao importar. Tente novamente.')
      setPreviewVisible(false)
      setImportFinished(false)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setSheetType('')
    setStatus('idle')
    setProgress(0)
    setMessages([])
    setSheetData([])
    setColumns([])
    setSheetHeaderError([])
    setPreviewVisible(false)
    setImportFinished(false)
  }

  const getStatusColor = () => {
    if (status === 'error') return 'text-amber-300'
    if (status === 'done') return 'text-emerald-300'
    return 'text-white/80'
  }

  const formatDisplayValue = (columnName: string, value: any): string => {
    if (!value) return '-'
    
    switch (columnName) {
      case 'CPF':
        return formatCPF(value)
      case 'Nascimento':
      case 'Admissão':
      case 'Data Afastamento':
        return formatDate(value)
      case 'Valor Salário':
        return formatSalary(value)
      default:
        return String(value)
    }
  }

  return (
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
        {/* Coluna Esquerda - Formulário */}
        <div className="lg:col-span-6 bg-slate-900/70 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
                <div>
                  <p className="text-white font-semibold leading-tight">Importar planilha</p>
                  <p className="text-white/60 text-xs">Formatos aceitos: XLSX, CSV.</p>
                </div>
              </div>
              {selectedFile && (
                <button
                  className="text-white/60 hover:text-white transition-colors"
                  onClick={() => handleFileSelect(null)}
                  title="Limpar arquivo"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-white/70 mb-1">Tipo de planilha</label>
                <select
                  value={sheetType}
                  onChange={(e) => setSheetType(e.target.value as any)}
                  className="w-full bg-white/5 text-white text-sm border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-400"
                >
                  <option value="" className="bg-[#202422] text-white">Selecione</option>
                  <option value="CADASTRO" className="bg-[#202422] text-white">CADASTRO</option>
                  <option value="HORAS_EXTRAS" className="bg-[#202422] text-white">HORAS EXTRAS</option>
                  <option value="FECHAMENTO" className="bg-[#202422] text-white">FECHAMENTO</option>
                </select>
              </div>
              {sheetType && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-md bg-transparent border border-emerald-500/60 text-emerald-300 font-semibold hover:bg-emerald-500/20 hover:border-emerald-400/80 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <Upload className="w-5 h-5" />
                  Upload
                </button>
              )}
            </div>
          </div>

          <div
            className={`border-2 border-dashed rounded-md p-2 flex flex-col items-center justify-center gap-3 ${
              status === 'error' ? 'border-amber-400/60 bg-amber-500/5' : 'border-white/15 bg-white/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
            {/* Log rápido */}
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <p className="text-white font-semibold">Log rápido</p>
              </div>
              {messages.length === 0 ? (
                <p className="text-white/60 text-sm">Nenhuma mensagem ainda.</p>
              ) : (
                <ul className="text-white/80 text-sm space-y-1 max-h-[200px] overflow-y-auto">
                  {messages.map((msg, idx) => (
                    <li key={idx} className="flex items-start">
                      {renderMessage(msg)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Status: <span className={getStatusColor()}>{statusLabel[status]}</span></span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  status === 'done' ? 'bg-emerald-400' : status === 'error' ? 'bg-amber-300' : 'bg-emerald-300/80'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-button justify-center gap-2">
              {!hideImportButton && (
                <button
                  type="button"
                  onClick={simulateImport}
                  disabled={status === 'uploading' || status === 'validating'}
                  className="px-4 py-2 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {status === 'uploading' || status === 'validating' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ClipboardList className="w-4 h-4" />
                  )}
                  Importar
                </button>
              )}

              <button
                type="button"
                className="px-4 py-2 rounded-md bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors"
                onClick={resetForm}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>

        {/* Coluna Direita - Checklist Expandido com Tabela */}
        <div className="lg:col-span-6 lg:sticky lg:top-24">
          <div className="bg-slate-900/70 border border-white/10 rounded-xl overflow-x-auto h-full">
            <table className="w-full text-xs">
              <thead className="bg-purple-300/10">
                <tr className="border-b border-white/10">
                  <th className="px-1 py-1.5 text-white/70 font-semibold text-center">DATA</th>
                  <th className="text-left px-1 py-1.5 text-white/70 font-semibold">BANCO</th>
                  <th className="text-left px-1 py-1.5 text-white/70 font-semibold">ARQUIVO</th>
                  <th className="text-left px-1 py-1.5 text-white/70 font-semibold">USUÁRIO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-1 py-3 text-white/50 text-xs text-center">
                      Nenhum registro de importação ainda.
                    </td>
                  </tr>
                ) : (
                  history.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="px-1 py-1.5 text-white/80 text-center">{item.date}</td>
                      <td className="px-1 py-1.5 text-white/80">{item.banco}</td>
                      <td className="px-1 py-1.5 text-white/80">{item.arquivo}</td>
                      <td className="px-1 py-1.5 text-white/80">{item.usuario}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mensagens, Erros e Tabela - Full Width Abaixo */}
      <div className="space-y-4">
        {/* Ocultando o detalhamento de erros por linha conforme solicitado */}

        {previewVisible && sheetData.length > 0 && (
          <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
              <p className="text-white font-semibold">Preview dos dados ({sheetData.length} linha(s))</p>
            </div>
            <div className="overflow-x-auto border border-white/10 rounded-lg">
              <table className="w-full text-sm text-white/80">
                <thead className="bg-slate-800/80 border-b border-white/10">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="px-4 py-2 text-left font-semibold text-white/90 text-xs uppercase tracking-wide">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheetData.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}>
                      {columns.map((col) => (
                        <td key={`${idx}-${col}`} className="px-4 py-2 text-white/70 truncate max-w-xs">
                          {formatDisplayValue(col, row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sheetData.length > 10 && (
              <p className="text-white/60 text-xs text-center py-2">
                Exibindo 10 de {sheetData.length} linhas
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TableLoad
