import React, { useMemo, useState } from 'react'
import { FileSpreadsheet, AlertTriangle, ArrowUp, ArrowDown, LoaderCircle, Pencil, Trash2, Check, X } from 'lucide-react'
import type { SheetData, RowError } from '../views/Table_load'

const formatDateCell = (value: any): string => {
  if (value === null || value === undefined || value === '') return '-'

  // Excel serial number -> usar UTC para evitar fuso (off-by-one)
  if (typeof value === 'number') {
    const excelEpochUtc = Date.UTC(1899, 11, 30) // Excel epoch
    const ms = excelEpochUtc + value * 24 * 60 * 60 * 1000
    const date = new Date(ms)
    if (!Number.isNaN(date.getTime())) {
      return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`
    }
  }

  // ISO "YYYY-MM-DD" sem deslocar fuso
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized === '00/00/0000' || normalized === '0000-00-00') return '-'

    const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
      const [, y, m, d] = isoMatch
      return `${d}/${m}/${y}`
    }
    // já vem em dd/mm/aaaa
    const brMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (brMatch) return value
  }

  // fallback
  return String(value)
}

const formatCpfCell = (value: any): string => {
  if (value === null || value === undefined || value === '') return '-'
  const digits = String(value).replace(/\D/g, '')
  if (digits.length === 0) return '-'
  const padded = digits.length < 11 ? digits.padStart(11, '0') : digits.slice(0, 11)
  return padded.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

const OVERTIME_CODES = ['303', '304', '505', '506', '511', '512'] as const

interface DataPreviewProps {
  show: boolean
  data: SheetData
  columns: string[]
  isFolha: boolean
  isOvertime?: boolean
  rowErrors: RowError[]
  filterText?: string
  onFilterChange?: (value: string) => void
  isLoading?: boolean
  hideHeader?: boolean
  showFilterInput?: boolean
  onUpdateRow?: (rowIndex: number, updatedRow: Record<string, any>) => void
  onDeleteRow?: (rowIndex: number) => void
}

const DataPreview: React.FC<DataPreviewProps> = ({
  show,
  data,
  columns,
  isFolha: _isFolha,
  isOvertime,
  rowErrors,
  filterText: externalFilter,
  onFilterChange,
  isLoading,
  hideHeader,
  showFilterInput = true,
  onUpdateRow,
  onDeleteRow,
}) => {
  const [localFilter, setLocalFilter] = useState('')
  const isControlled = onFilterChange !== undefined
  const filterText = isControlled ? (externalFilter ?? '') : localFilter
  const setFilterText = isControlled ? onFilterChange : setLocalFilter
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Record<string, any>>({})
  const showErrorColumn = rowErrors.length > 0
  const errorMap = useMemo(() => {
    const map = new Map<number, Map<string, string>>()
    rowErrors.forEach(error => {
      const cellErrors = new Map<string, string>()
      error.errors.forEach((errMsg: string) => {
        const field = errMsg.split(' ')[0].toLowerCase()
        cellErrors.set(field, errMsg)
      })
      map.set(error.rowIndex, cellErrors)
    })
    return map
  }, [rowErrors])

  const dateColumns = useMemo(
    () => new Set(['nascimento', 'admissao', 'data afastamento', 'pagamento', 'data']),
    []
  )

  const parseTimeToMinutes = (val: any): number => {
    if (val === null || val === undefined || val === '' || val === '-') return 0
    if (typeof val === 'number') {
      return Math.round(val * 24 * 60)
    }
    const raw = String(val).trim()
    if (!raw) return 0

    const colonMatch = raw.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/)
    if (colonMatch) {
      const [, h, m, s] = colonMatch
      const hours = Number(h)
      const minutes = Number(m)
      const seconds = s ? Number(s) : 0
      if ([hours, minutes, seconds].some((n) => Number.isNaN(n))) return 0
      return hours * 60 + minutes + Math.floor(seconds / 60)
    }

    const decimal = Number(raw.replace(',', '.'))
    if (!Number.isNaN(decimal)) {
      return Math.round(decimal * 60)
    }
    return 0
  }

  const formatMinutesAsTime = (minutes: number): string => {
    if (!Number.isFinite(minutes) || minutes <= 0) return '0:00'
    const hrs = Math.floor(minutes / 60)
    const mins = Math.abs(minutes % 60)
    return `${hrs}:${String(mins).padStart(2, '0')}`
  }

  const formatOvertimeInputValue = (rawVal: string): string => {
    const digits = rawVal.replace(/\D/g, '')
    if (digits.length <= 2) return digits
    const minutes = digits.slice(-2).padEnd(2, '0')
    const hours = digits.slice(0, -2)
    return `${hours}:${minutes}`
  }

  const overtimeTotals = useMemo(() => {
    const totals = OVERTIME_CODES.reduce<Record<string, number>>((acc, code) => {
      acc[code] = 0
      return acc
    }, {})
    if (!isOvertime) return totals
    data.forEach((row) => {
      OVERTIME_CODES.forEach((code) => {
        totals[code] += parseTimeToMinutes(row[code])
      })
    })
    return totals
  }, [data, isOvertime, parseTimeToMinutes])

  const filteredData = useMemo(() => {
    if (isControlled) return data
    if (!filterText.trim()) return data
    const needle = filterText.trim().toLowerCase()
    return data.filter((row) => {
      const cadastro = String(row['Cadastro'] ?? '').toLowerCase()
      const nome = String(row['Nome'] ?? '').toLowerCase()
      return cadastro.includes(needle) || nome.includes(needle)
    })
  }, [data, filterText, isControlled])

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData
    const { key, direction } = sortConfig
    return [...filteredData].sort((a, b) => {
      const av = a[key]
      const bv = b[key]

      const parseVal = (v: any) => {
        if (v === null || v === undefined) return ''
        const num = Number(v)
        if (!Number.isNaN(num)) return num
        return String(v).toLowerCase()
      }

      const va = parseVal(av)
      const vb = parseVal(bv)

      if (va < vb) return direction === 'asc' ? -1 : 1
      if (va > vb) return direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredData, sortConfig])

  const handleSort = (col: string) => {
    setSortConfig((prev) => {
      if (prev?.key === col) {
        return { key: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key: col, direction: 'asc' }
    })
  }

  const startEditingRow = (row: Record<string, any>, index: number) => {
    setEditingRowIndex(index)
    setEditDraft({ ...row })
  }

  const handleEditChange = (col: string, value: string) => {
    setEditDraft((prev) => ({ ...prev, [col]: value }))
  }

  const handleSaveRow = (index: number) => {
    if (onUpdateRow) {
      onUpdateRow(index, editDraft)
    }
    setEditingRowIndex(null)
    setEditDraft({})
  }

  const handleCancelEdit = () => {
    setEditingRowIndex(null)
    setEditDraft({})
  }

  const handleDeleteRow = (index: number) => {
    if (onDeleteRow) {
      onDeleteRow(index)
    }
    if (editingRowIndex === index) {
      setEditingRowIndex(null)
      setEditDraft({})
    }
  }

  if (!show) {
    return null
  }

  const totalColumnsCount = columns.length + (showErrorColumn ? 1 : 0) + (isOvertime ? 1 : 0)

  return (
    <div className="bg-slate-900/70 border border-white/10 rounded-xl overflow-hidden w-full">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/10">
        {!hideHeader && (
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            <p className="text-white font-semibold">
              {isLoading ? 'Carregando...' : `Dados carregados (${data.length} linha(s))`}
            </p>
            {isLoading && <LoaderCircle className="w-4 h-4 text-emerald-300 animate-spin" />}
          </div>
        )}
        {hideHeader && isLoading && (
          <div className="flex items-center gap-2">
            <LoaderCircle className="w-4 h-4 text-emerald-300 animate-spin" />
            <p className="text-white/70 text-sm">Carregando...</p>
          </div>
        )}
        {isOvertime && (
          <div className="flex flex-wrap items-center gap-2 ml-0 sm:ml-4">
            {OVERTIME_CODES.map((code) => (
              <div key={code} className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 shadow-sm shadow-black/20">
                <p className="text-white/80 text-[10px] uppercase tracking-wide text-center">{code}</p>
                <p className="text-emerald-200 font-semibold text-sm text-center">{formatMinutesAsTime(overtimeTotals[code] ?? 0)}</p>
              </div>
            ))}
          </div>
        )}
        {showFilterInput && (
          <div className="ml-auto w-full sm:w-64">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtrar por cadastro ou nome"
              className="w-full bg-white/5 text-white text-xs border border-white/15 rounded-md px-3 py-2 outline-none focus:border-emerald-400"
            />
          </div>
        )}
      </div>
      <div
        className="overflow-x-auto overflow-y-auto max-h-[420px] min-h-[220px] custom-scroll preview-scroll"
        style={{ scrollbarGutter: 'stable' }}
      >
        <table className="w-full text-[11px] text-white/80 border-collapse">
          <thead className="bg-blue-900 border-b border-blue-700 sticky top-0 z-30 text-white shadow-sm shadow-black/30">
            <tr>
              {showErrorColumn && <th className="px-2 py-2 font-semibold text-white/90 uppercase tracking-wide text-center w-8"></th>}
              {columns.map((col) => {
                const isSorted = sortConfig?.key === col
                const direction = sortConfig?.direction
                return (
                  <th key={col} className="px-3 py-2 font-semibold text-white/90 uppercase tracking-wide text-center">
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className="w-full flex items-center justify-center gap-1 hover:text-emerald-200 transition-colors"
                    >
                      <span>{col}</span>
                      {isSorted && (direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </button>
                  </th>
                )
              })}
              {isOvertime && (
                <th className="px-3 py-2 font-semibold text-white/90 uppercase tracking-wide text-center">
                  Acoes
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {!isLoading && sortedData.length === 0 && (
              <tr>
                <td colSpan={totalColumnsCount} className="px-3 py-8 text-center text-white/60">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {sortedData.map((row: Record<string, any>, rowIndex: number) => {
              const errorsForThisRow = errorMap.get(rowIndex + 2) // rowIndex is 0-based, error.rowIndex is 1-based from sheet
              const hasError = !!errorsForThisRow
              const originalIndex = data.indexOf(row)
              const isEditing = editingRowIndex === originalIndex

              return (
                <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? 'bg-white/5' : 'bg-transparent'} ${hasError ? 'bg-rose-500/10' : ''}`}>
                  {showErrorColumn && (
                    <td className="px-2 py-2 text-center">
                      {hasError && <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />}
                    </td>
                  )}
                  {columns.map((col) => {
                    const colKey = col.toLowerCase()
                    const cellError = errorsForThisRow?.get(colKey)
                    const isCellInvalid = !!cellError

                    // alinhamento: centro padrão, nome à esquerda, valor salário à direita
                    const normalizedKey = colKey.replace(/\s+/g, '')
                    let alignClass = 'text-center'
                    if (colKey === 'nome') {
                      alignClass = 'text-left'
                    } else if (normalizedKey === 'valorsalario') {
                      alignClass = 'text-right'
                    }
                    const shouldFormatDate = dateColumns.has(colKey)
                    const displayValue = shouldFormatDate
                      ? formatDateCell(row[col])
                      : colKey === 'cpf'
                        ? formatCpfCell(row[col])
                        : (row[col] ?? '-')
                    const isReadOnlyOvertimeField = isOvertime && (colKey === 'data' || colKey === 'cadastro' || colKey === 'nome')

                    return (
                      <td
                        key={`${rowIndex}-${col}`}
                        className={`px-3 py-2 text-white/70 truncate max-w-xs ${alignClass} ${isCellInvalid ? 'ring-1 ring-rose-500 ring-inset' : ''}`}
                        title={cellError}
                      >
                        {isEditing && !isReadOnlyOvertimeField ? (
                          <input
                            inputMode={isOvertime ? 'numeric' : undefined}
                            pattern={isOvertime ? '[0-9]*' : undefined}
                            className="w-full bg-white/10 text-white text-[11px] border border-white/15 rounded px-2 py-1 outline-none focus:border-emerald-400"
                            value={editDraft[col] ?? ''}
                            onChange={(e) => {
                              const rawVal = e.target.value
                              const formatted = isOvertime ? formatOvertimeInputValue(rawVal) : rawVal
                              handleEditChange(col, formatted)
                            }}
                          />
                        ) : (
                          displayValue
                        )}
                      </td>
                    )
                  })}
                  {isOvertime && (
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveRow(originalIndex)}
                            className="p-1.5 rounded bg-emerald-600/80 hover:bg-emerald-600 transition-colors"
                            title="Salvar edicao"
                          >
                            <Check className="w-4 h-4 text-white" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingRow(row, originalIndex)}
                            className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                            title="Editar linha"
                          >
                            <Pencil className="w-4 h-4 text-white" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(originalIndex)}
                            className="p-1.5 rounded bg-rose-600/80 hover:bg-rose-600 transition-colors"
                            title="Excluir linha"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataPreview
