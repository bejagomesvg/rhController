import React, { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ArrowLeft, Circle, CircleCheckBig, ClipboardList, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import { validateEmployeeSheet, validateEmployeeRow, REQUIRED_FIELDS, formatDate } from '../utils/employeeParser'
import { insertEmployees, fetchEmployeeRegistrations } from '../services/employeeService'
import { insertPayroll } from '../services/payrollService'
import type { HistoryEntry } from '../services/logService'
import { fetchHistory, insertHistory } from '../services/logService'
import LogItem from '../components/LogItem'


type ImportStatus = 'idle' | 'validating' | 'uploading' | 'done' | 'error'
type SheetData = Record<string, any>[]

interface RowError {
  rowIndex: number
  errors: string[]
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
  const [sheetType, setSheetType] = useState<'CADASTRO' | 'FOLHA PGTO' | 'HORAS EXTRAS' | ''>('')
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [progress, setProgress] = useState<number>(0)
  const [messages, setMessages] = useState<string[]>([])
  const [sheetData, setSheetData] = useState<SheetData>([])
  const [columns, setColumns] = useState<string[]>([])
  const [sheetHeaderError, setSheetHeaderError] = useState<string[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [importFinished, setImportFinished] = useState<boolean>(false)
  const [showPreview, setShowPreview] = useState<boolean>(false)
  const [neutralLogStyle, setNeutralLogStyle] = useState<boolean>(false)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

  const hideImportButton = sheetHeaderError.length > 0 || sheetData.length === 0 || importFinished
  const supportedSheets = ['CADASTRO', 'FOLHA PGTO'] as const
  const isSupportedSheet = supportedSheets.includes(sheetType as any)
  const isCadastro = sheetType === 'CADASTRO'
  const isFolha = sheetType === 'FOLHA PGTO'
  const requiredFolhaHeaders = ['cadastro', 'Colaborador', 'Evento', 'Pagamento', 'Referencia', 'valor']

  const statusLabel: Record<ImportStatus, string> = {
    idle: '',
    validating: ' Validando planilha',
    uploading: ' Enviando dados',
    done: ' Concluido',
    error: ' Erro',
  }

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const pushMessage = (message: string) => {
    setMessages((prev) => [message, ...prev].slice(0, 6))
  }

  const extractFieldFromError = (errorMsg: string): string | null => {
    const knownFields = [...REQUIRED_FIELDS, 'CPF']
    const match = knownFields.find((field) => errorMsg.startsWith(field))
    return match || null
  }

  const formatDateFromDb = (value?: string | null) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const pad = (n: number) => String(n).padStart(2, '0')
    // Converte para o fuso local do navegador (ou servidor) ao exibir
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}`
  }

  const formatNow = () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(
      now.getMinutes()
    )}`
  }

  const getRefMonthYear = (value: any): string => {
    if (!value) return ''
    const raw = formatDate(value) // tenta normalizar dd/mm -> ISO
    const d = new Date(raw || value)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  }

  useEffect(() => {
    ;(async () => {
      const list = await fetchHistory(supabaseUrl, supabaseKey)
      setHistory(
        list.map((item) => ({
          ...item,
          date: formatDateFromDb(item.date),
        }))
      )
    })()
  }, [supabaseKey, supabaseUrl])

  useEffect(() => {
    setShowPreview(false)
    setSelectedFile(null)
    setSheetData([])
    setSheetHeaderError([])
    setImportFinished(false)
    setStatus('idle'); setNeutralLogStyle(true)
    setNeutralLogStyle(false)
    setProgress(0)
    setColumns([])
    resetFileInput()
    if (sheetType && !isSupportedSheet) {
      pushMessage(`Regras para "${sheetType}" ainda NAO implementadas.`)
    }
  }, [sheetType, isSupportedSheet])

  const handleFileSelect = (file: File | null) => {
    if (!isSupportedSheet) {
      pushMessage(`Regras para "${sheetType}" ainda NAO implementadas.`)
      setSelectedFile(null)
      setSheetData([])
      setColumns([])
      resetFileInput()
      setStatus('idle'); setNeutralLogStyle(true)
      setNeutralLogStyle(false)
      setProgress(0)
      return
    }
    setSelectedFile(file)
    setProgress(0)
    setStatus('idle'); setNeutralLogStyle(true)
    setNeutralLogStyle(false)
    setMessages([])
    setSheetData([])
    setColumns([])
    setImportFinished(false)
    setShowPreview(false)
    if (file) {
      pushMessage(`Arquivo selecionado: ${file.name}`)
      readExcelFile(file)
    }
  }

  const readExcelFile = (file: File) => {
    if (!isSupportedSheet) {
      pushMessage(`Regras para "${sheetType}" ainda NAO implementadas.`)
      setSheetData([])
      resetFileInput()
      setSelectedFile(null)
      setStatus('idle'); setNeutralLogStyle(true)
      setProgress(0)
      setColumns([])
      return
    }
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as ArrayBuffer
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as SheetData

        setImportFinished(false)

        if (jsonData.length === 0) {
          pushMessage('XxX Arquivo vazio.')
          setSheetData([])
          setSheetHeaderError([])
          return
        }

        const cols = Object.keys(jsonData[0] || {})
        if (isCadastro) {
          const headerValidation = validateEmployeeSheet(cols)
          if (!headerValidation.valid) {
            setSheetHeaderError(headerValidation.missingFields)
            const missing = headerValidation.missingFields.join(', ')
            pushMessage(`XxX Campos obrigatorios faltando: (${missing})`)
            setStatus('error'); setNeutralLogStyle(true)
            setSheetData([])
            setColumns([])
            return
          }
        } else if (isFolha) {
          const missingFolha = requiredFolhaHeaders.filter((h) => !cols.includes(h))
          if (missingFolha.length > 0) {
            setSheetHeaderError(missingFolha)
            pushMessage(`XxX Campos obrigatorios faltando: (${missingFolha.join(', ')})`)
            setStatus('error'); setNeutralLogStyle(true)
            setSheetData([])
            setColumns([])
            return
          }
          setSheetHeaderError([])
          pushMessage(`OoO Headers validados: ${cols.length} coluna(s)`)

          const regNumbers = Array.from(
            new Set(
              jsonData
                .map((row) => Number(String(row['cadastro'] ?? '').replace(/\D/g, '')))
                .filter((n) => !Number.isNaN(n))
            )
          )
          const employeeRegs = await fetchEmployeeRegistrations(supabaseUrl, supabaseKey)
          if (!employeeRegs.ok) {
            pushMessage('XxX Erro ao validar colaboradores (employee).')
            setSheetData([])
            setColumns([])
            setStatus('error'); setNeutralLogStyle(true)
            return
          }
          const missingRegs = regNumbers.filter((r) => !employeeRegs.registrations.has(r))
          if (missingRegs.length > 0) {
            pushMessage(`XxX Colaboradores nao encontrado: (${missingRegs.join(', ')})`)
            setSheetData([])
            setColumns([])
            setStatus('error'); setNeutralLogStyle(true)
            setImportFinished(false)
            return
          }
        } else {
          setSheetHeaderError([])
          pushMessage(`OoO Headers validados: ${cols.length} coluna(s)`)
        }
        if (isCadastro) {
          const rowErrors: RowError[] = []
          jsonData.forEach((row, index) => {
            const validation = validateEmployeeRow(row)
            if (!validation.valid) {
              rowErrors.push({
                rowIndex: index + 2,
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
            const suffix = fieldsText ? ` (${fieldsText})` : ''
            pushMessage(`:) ${rowErrors.length} linha(s) - ${suffix} corrigidas/validadas!`)
          } else {
            pushMessage(`OoO Todas as ${jsonData.length} linhas validadas com sucesso`)
          }
        } else {
          // Validacao simples para FOLHA PGTO: campos obrigatorios NAO vazios
          const folhaRowErrors: RowError[] = []
          jsonData.forEach((row, index) => {
            const missingFields: string[] = []
            requiredFolhaHeaders.forEach((field) => {
              if (!row[field] || String(row[field]).trim() === '') missingFields.push(field)
            })
            if (missingFields.length > 0) {
              folhaRowErrors.push({
                rowIndex: index + 2,
                errors: missingFields.map((f) => `${f} Sao obrigatorio`),
              })
            }
          })

          if (folhaRowErrors.length > 0) {
            const errorFields = new Set<string>()
            folhaRowErrors.forEach((rowErr) => {
              rowErr.errors.forEach((msg) => {
                const field = requiredFolhaHeaders.find((f) => msg.startsWith(f))
                if (field) errorFields.add(field)
              })
            })
            const fieldsText = Array.from(errorFields).join(', ')
            const suffix = fieldsText ? ` (${fieldsText})` : ''
            pushMessage(`:) ${folhaRowErrors.length} linha(s) - ${suffix} corrigidas/validadas!`)
          } else {
            pushMessage(`OoO Todas as ${jsonData.length} linhas validadas com sucesso`)
          }
        }

        setSheetData(jsonData)
        if (isCadastro) {
          const displayColumns = REQUIRED_FIELDS.filter((field) => cols.includes(field))
          setColumns(displayColumns)
        } else if (isFolha) {
          const folhaOrder = ['cadastro', 'Colaborador', 'Evento', 'Pagamento', 'Referencia', 'valor']
          const ordered = folhaOrder.filter((c) => cols.includes(c))
          const remaining = cols.filter((c) => !ordered.includes(c))
          // Converter campos numumeros para inteiro
          const normalized = jsonData.map((row) => {
            const cadastroNum = row['cadastro'] ? Number(String(row['cadastro']).replace(/\D/g, '')) : row['cadastro']
            const eventoNum = row['Evento'] ? Number(String(row['Evento']).replace(/\D/g, '')) : row['Evento']
            const valorNum = row['valor']
              ? Number(String(row['valor']).replace(/[^\d,-]/g, '').replace(',', '.'))
              : row['valor']
            const valorFormatado =
              typeof valorNum === 'number' && !Number.isNaN(valorNum)
                ? valorNum.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                : row['valor']
            return {
              ...row,
              cadastro: cadastroNum,
              Evento: eventoNum,
              valor: valorFormatado,
            }
          })
          setSheetData(normalized)
          setColumns([...ordered, ...remaining])
        } else {
          setColumns(Object.keys(jsonData[0] || {}))
        }
        if (!isFolha) setSheetData(jsonData)
        pushMessage(`OoO ${jsonData.length} linha(s) pronta pra ser enviada ao servidor`)
      } catch (error) {
        console.error('Erro ao ler arquivo:', error)
        pushMessage('Erro ao ler o arquivo.')
        setSheetData([])
        setSheetHeaderError([])
        setColumns([])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const simulateImport = async () => {
    if (!sheetType) {
      setStatus('idle'); setNeutralLogStyle(true)
      pushMessage('Escolha o tipo de planilha antes de importar.')
      return
    }
    if (!selectedFile) {
      setStatus('idle'); setNeutralLogStyle(true)
      pushMessage('Selecione um arquivo antes de importar.')
      return
    }
    if (!isSupportedSheet) {
      setStatus('idle'); setNeutralLogStyle(true)
      pushMessage(`Regras para "${sheetType}" ainda NAO implementadas.`)
      return
    }

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    try {
      setStatus('validating')
      setProgress(20)
      pushMessage(`Validando a planilha "${selectedFile.name}"...`)
      await sleep(600)

      setStatus('uploading')
      setProgress(65)
      pushMessage('Enviando dados para o servidor...')
      await sleep(900)

      if (isCadastro) {
        const employeeResult = await insertEmployees(sheetData, userName, supabaseUrl, supabaseKey)
        if (!employeeResult.ok) {
          setStatus('idle'); setNeutralLogStyle(true)
          pushMessage('XxX Falha ao gravar tabela employee. Log NAO enviado.')
          setImportFinished(false)
          return
        }
        pushMessage(`OoO Employee: ${employeeResult.updatedCount} atualizados, ${employeeResult.newCount} inseridos.`)
      } else if (isFolha) {
        const payrollResult = await insertPayroll(sheetData, userName, supabaseUrl, supabaseKey)
        if (!payrollResult.ok) {
          setStatus('idle'); setNeutralLogStyle(true)
          pushMessage(`XxX Erro ao gravar tabela payroll: ${payrollResult.error || 'erro desconhecido'}`)
          setImportFinished(false)
          return
        }
        pushMessage(`OoO Payroll: ${payrollResult.inserted} linha(s) inseridas.`)
        await insertHistory(
          {
            registration: `Folha Pgto Ref.: ${getRefMonthYear(sheetData[0]?.['Pagamento']) || '-'}`,
            date: formatNow(),
            file: selectedFile?.name || '-',
            user: userName || '-',
          },
          supabaseUrl,
          supabaseKey
        )
      }

      setStatus('done')
      setProgress(100)
      pushMessage('OoO Carga da tabela concluida com sucesso.')

      if (isCadastro) {
        await insertHistory(
          {
            registration: 'Cadastro de Funcionario',
            date: formatNow(),
            file: selectedFile?.name || '-',
            user: userName || '-',
          },
          supabaseUrl,
          supabaseKey
        )
      }
      const list = await fetchHistory(supabaseUrl, supabaseKey)
      setHistory(
        list.map((item) => ({
          ...item,
          date: formatDateFromDb(item.date),
        }))
      )
      setImportFinished(true)
    } catch (error) {
      console.error('Erro na importacao simulada:', error)
      setStatus('idle'); setNeutralLogStyle(true)
      pushMessage('Erro ao importar. Tente novamente.')
      setImportFinished(false)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setSheetType('')
    setStatus('idle'); setNeutralLogStyle(true)
    setProgress(0)
    setMessages([])
    setSheetData([])
    setSheetHeaderError([])
    setImportFinished(false)
    setColumns([])
    resetFileInput()
  }

  const getStatusColor = () => {
    if (status === 'error') return 'text-amber-300'
    if (status === 'done') return 'text-emerald-300'
    return 'text-white/80'
  }

  return (
    <>
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

            <div className="flex flex-row items-end gap-3 flex-wrap w-full">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs text-white/70 mb-1">Tipo de planilha</label>
                <select
                  value={sheetType}
                  onChange={(e) => setSheetType(e.target.value as any)}
                  className="w-full bg-white/5 text-white text-sm border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-400"
                >
                  <option value="" className="bg-[#202422] text-white">
                    Selecione
                  </option>
                  <option value="CADASTRO" className="bg-[#202422] text-white">
                    CADASTRO
                  </option>
                  <option value="FOLHA PGTO" className="bg-[#202422] text-white">
                    FOLHA PGTO
                  </option>
                  <option value="HORAS EXTRAS" className="bg-[#202422] text-white">
                    HORAS EXTRAS
                  </option>
                </select>
              </div>
              {(sheetType === 'CADASTRO' || sheetType === 'FOLHA PGTO') && (
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-md bg-transparent border border-emerald-500/60 text-emerald-300 font-semibold hover:bg-emerald-500/20 hover:border-emerald-400/80 transition-all flex items-center gap-2 whitespace-nowrap"
                    title="Selecionar arquivo para upload"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-sm">Upload</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div
            className={`w-full border-2 border-dashed rounded-md p-0 flex flex-col items-center justify-start gap-3 ${
              status === 'error' && !neutralLogStyle ? 'border-amber-400/60 bg-amber-500/5' : 'border-white/15 bg-white/5'
            } overflow-hidden`}
            style={{ maxHeight: '180px', minHeight: '180px', backgroundColor: '#0c163d', color: '#cddcff' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
            <div className="w-full h-full flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4 px-2 py-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <CircleCheckBig className="w-4 h-4 text-emerald-300" />
                  <p className="text-white font-semibold text-sm">Status Operacao</p>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 text-white/80 text-xs cursor-pointer select-none"
                  onClick={() => setShowPreview((prev) => !prev)}
                  onKeyDown={(e) => e.key === 'Enter' && setShowPreview((prev) => !prev)}
                  aria-pressed={showPreview}
                >
                  {showPreview ? (
                    <CircleCheckBig className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Circle className="w-4 h-4 text-white" />
                  )}
                  <span className={showPreview ? 'text-emerald-200' : 'text-white/80'}>Ver tabela</span>
                </button>
              </div>
              <div
                className="custom-scroll log-scroll flex-1 min-h-0 max-h-[120px] overflow-y-auto rounded-md"
              >
                <ul className="text-white/80 text-xs space-y-1 list-none p-0 m-0">
                  <li className="text-white/50" aria-label="Aguardando novas mensagens">
                    <span className="blinking-cursor" aria-hidden="true" />
                  </li>
{messages.map((msg, idx) => (
  <li key={idx}>
    <LogItem message={msg} />
  </li>
))}

                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>
                Status: <span className={getStatusColor()}>{statusLabel[status]}</span>
              </span>
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

        <div className="lg:col-span-6 lg:sticky lg:top-24">
            <div className="bg-slate-900/70 border border-white/10 rounded-xl h-full overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[440px] min-h-0 custom-scroll">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-emerald-800/95">
                  <tr className="border-b border-white/10">
                    <th className="px-1 py-1.5 text-white/70 font-semibold text-center">DATA</th>
                    <th className="px-1 py-1.5 text-white/70 font-semibold text-center">BANCO</th>
                    <th className="px-1 py-1.5 text-white/70 font-semibold text-center">ARQUIVO</th>
                    <th className="px-1 py-1.5 text-white/70 font-semibold text-center">USUARIO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-1 py-3 text-white/50 text-xs text-center">
                        Nenhum registro de Carga da tabela ainda.
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
      </div>
      </div>

      {showPreview && sheetData.length > 0 && (
        <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            <p className="text-white font-semibold">Dados carregados ({sheetData.length} linha(s))</p>
          </div>
          <div className="overflow-x-auto border border-white/10 rounded-lg max-h-[300px] overflow-y-auto">
            <table className="w-full text-[11px] text-white/80">
              <thead className="bg-lime-400/20 border-b border-white/10 sticky top-0 z-20 text-slate-900">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 font-semibold text-white/90 uppercase tracking-wide text-center"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheetData.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}>
                    {columns.map((col) => {
                      const colKey = col.toLowerCase()
                      const isValor = isFolha && colKey === 'valor'
                      const isCenter =
                        isFolha && ['cadastro', 'evento', 'pagamento', 'Referencia'].includes(colKey)
                      const alignClass = isValor ? 'text-right' : isCenter ? 'text-center' : 'text-left'
                      return (
                        <td
                          key={`${idx}-${col}`}
                          className={`px-3 py-2 text-white/70 truncate max-w-xs ${alignClass}`}
                        >
                          {row[col] ?? '-'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

export default TableLoad
