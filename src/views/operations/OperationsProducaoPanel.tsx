import React, { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import { loadSession } from '../../services/sessionService'
import { verifyPassword } from '../../services/authService'
import { upsertProductionRow, fetchProductionRows, deleteProductionRow } from '../../services/productionService'
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
  const [tableHidden, setTableHidden] = useState(false)
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
  const [filterCompany, setFilterCompany] = useState<string>('')
  const [filterYear, setFilterYear] = useState<string>('')
  const [filterMonth, setFilterMonth] = useState<string>('')
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

  const monthOptions = useMemo(() => {
    const months = rows
      .map((r) => {
        const parts = r.date ? String(r.date).split('-') : []
        return parts.length === 3 ? parts[1] : ''
      })
      .filter((m) => m)
    return Array.from(new Set(months)).sort()
  }, [rows])
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
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

  useEffect(() => {
    const loadData = async () => {
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
      } else {
        setRows([])
      }
    }
    loadData()
  }, [resolvedSupabaseUrl, resolvedSupabaseKey])

  const [closureRows, setClosureRows] = useState<ProductionRow[]>([
    {
      id: 10001,
      company: 5,
      date: '2025-12-01',
      slaughtered: 200,
      compraTraseiro: 10,
      compraDianteiro: 12,
      compraPA: 5,
      vendaTraseiro: 20,
      vendaDianteiro: 18,
      vendaPA: 8,
      desossaTraseiro: 6,
      desossaDianteiro: 4,
      desossaPA: 2,
      isClosure: true,
    },
    {
      id: 10002,
      company: 5,
      date: '2025-11-01',
      slaughtered: 180,
      compraTraseiro: 8,
      compraDianteiro: 10,
      compraPA: 4,
      vendaTraseiro: 15,
      vendaDianteiro: 16,
      vendaPA: 7,
      desossaTraseiro: 5,
      desossaDianteiro: 3,
      desossaPA: 2,
      isClosure: true,
    },
  ])

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

    const session = loadSession()
    const isNewRow = rows.some((r) => r.id === editingId && r.isNew)
    const upsertResult = await upsertProductionRow(
      {
        id: editingValues.id,
        isNew: isNewRow,
        company: Number(editingValues.company),
        date_: editingValues.date,
        slaughtered: editingValues.slaughtered,
        compratraseiro: editingValues.compraTraseiro,
        compradianteiro: editingValues.compraDianteiro,
        comprapa: editingValues.compraPA,
        vendatraseiro: editingValues.vendaTraseiro,
        vendadianteiro: editingValues.vendaDianteiro,
        vendapa: editingValues.vendaPA,
        desossatraseiro: editingValues.desossaTraseiro,
        desossadianteiro: editingValues.desossaDianteiro,
        desossapa: editingValues.desossaPA,
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingValues((prev: any) => ({ ...prev, date: e.target.value }))
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
      company: '',
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
      ;(Object.keys(initial) as Array<keyof typeof initial>).forEach((field) => {
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
              className="w-28 bg-white/5 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
            >
              <option value="">Empresa</option>
              {companyOptions.map((c) => (
                <option key={`filter-company-${c}`} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="w-20 bg-white/5 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="">Ano</option>
              {yearOptions.map((y) => (
                <option key={`filter-year-${y}`} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              className="w-16 bg-white/5 text-emerald-300 text-sm border border-white/15 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="">Mês</option>
              {monthOptions.map((m) => (
                <option key={`filter-month-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="bg-blue-900/30 border border-blue-500/40 rounded-lg p-4 shadow-lg w-full min-w-0 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Factory className="w-4 h-4 text-emerald-300" />
            Lançamentos de Produção
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50">Exibindo {filteredRows.length} registro(s)</span>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border border-emerald-400/60 bg-emerald-500/15 text-emerald-100 text-xs font-semibold flex items-center gap-2 hover:bg-emerald-500/25 transition-colors"
              title="Novo"
              onClick={addNewRow}
            >
              <Plus className="w-4 h-4" />
              Novo
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border border-amber-400/60 bg-amber-500/10 text-amber-100 text-xs font-semibold flex items-center gap-2 hover:bg-amber-500/20 transition-colors"
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
              className="px-3 py-1.5 rounded-md border border-sky-400/60 bg-sky-500/10 text-sky-100 text-xs font-semibold flex items-center gap-2 hover:bg-sky-500/20 transition-colors"
              title={tableHidden ? 'Mostrar tabela' : 'Ocultar tabela'}
              onClick={() => setTableHidden((prev) => !prev)}
            >
              {tableHidden ? 'Mostrar' : 'Ocultar'}
            </button>
          </div>
        </div>
        {!tableHidden && (
          <div className="border border-white/10 rounded-lg overflow-hidden bg-slate-900/60 shadow-inner shadow-black/20">
            <div className="overflow-x-auto overflow-y-auto max-h-[460px] min-w-0 max-w-full">
              <table className="w-full min-w-0 text-left text-xs text-white/80">
                <thead className="bg-green-800 text-[10px] tracking-[0.2em] text-white/70 sticky top-0 z-10 backdrop-blur">
                  <tr>
                    <th
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                      onClick={() => handleSort('company')}
                    >
                      <span className="inline-flex items-center justify-center">
                        Emp
                        {renderSortIndicator(sortConfig.key === 'company', sortConfig.direction, 'number')}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                      onClick={() => handleSort('date')}
                    >
                      <span className="inline-flex items-center justify-center">
                        Data
                        {renderSortIndicator(sortConfig.key === 'date', sortConfig.direction, 'number')}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                      onClick={() => handleSort('slaughtered')}
                    >
                      <span className="inline-flex items-center justify-center">
                        Abate
                        {renderSortIndicator(
                          sortConfig.key === 'slaughtered',
                          sortConfig.direction,
                          'number'
                        )}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
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
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
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
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                      onClick={() => handleSort('compraPA')}
                    >
                      <span className="inline-flex items-center justify-center">
                        Compra <br />PA
                        {renderSortIndicator(sortConfig.key === 'compraPA', sortConfig.direction, 'number')}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
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
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
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
                      className="w-14 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                      onClick={() => handleSort('vendaPA')}
                    >
                      <span className="inline-flex items-center justify-center">
                        Venda <br />PA
                        {renderSortIndicator(sortConfig.key === 'vendaPA', sortConfig.direction, 'number')}
                      </span>
                    </th>
                    <th
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
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
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none leading-4"
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
                      className="w-12 px-1 py-2 font-semibold text-center cursor-pointer select-none"
                      onClick={() => handleSort('desossaPA')}
                    >
                      <span className="inline-flex items-center justify-center">
                        Desossa <br />PA
                        {renderSortIndicator(sortConfig.key === 'desossaPA', sortConfig.direction, 'number')}
                      </span>
                    </th>
                    <th className="w-12 px-1 py-2 font-semibold text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
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
                          <input
                            type="date"
                            className="w-32 bg-slate-800/80 border border-emerald-500/30 rounded px-2 py-[6px] text-white text-center focus:border-emerald-400 outline-none"
                            value={editingValues?.date ?? ''}
                            onChange={handleDateChange}
                            id={`prod-${editingId}-date`}
                            onKeyDown={handleEditKeyDown('date')}
                          />
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
              <tfoot className="sticky bottom-0 z-10">
                <tr className="border-t border-white/10 bg-emerald-900/60 font-semibold text-emerald-100">
                  <td className="text-center py-1" colSpan={2}>
                    Total
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
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Factory className="w-4 h-4 text-emerald-300" />
            Fechamentos de Produção (estático)
          </div>
          <span className="text-xs text-white/50">Exibindo {closureRows.length} registro(s)</span>
        </div>
        <div className="border border-white/10 rounded-lg overflow-hidden bg-slate-900/60 shadow-inner shadow-black/20">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs text-white/80">
              <thead className="bg-green-800 text-[10px] tracking-[0.2em] text-white/70">
                <tr>
                  <th className="px-1 py-2 font-semibold text-center">Emp</th>
                  <th className="px-1 py-2 font-semibold text-center">Data</th>
                  <th className="w-12 px-1 py-2 font-semibold text-center">Abate</th>
                  <th className="w-12 px-1 py-2 font-semibold text-center leading-4">Compra<br />TRAS.</th>
                  <th className="w-12 px-1 py-2 font-semibold text-center leading-4">Compra<br />DIANT.</th>
                  <th className="w-12 px-1 py-2 font-semibold text-center">Compra<br />PA</th>
                  <th className="w-12 px-1 py-2 font-semibold text-center leading-4">Venda<br />TRAS.</th>
                  <th className="w-12 px-1 py-2 font-semibold text-center leading-4">Venda<br />DIANT.</th>
                  <th className="w-14 px-1 py-2 font-semibold text-center">Venda<br />PA</th>
                  <th className="w-12 px-1 py-2 font-semibold text-center leading-4">Desossa<br />TRAS.</th>
                  <th className="w-12 px-1 py-2 font-semibold text-center leading-4">Desossa<br />DIANT.</th>
                  <th className="w-12 px-1 py-2 font-semibold text-center">Desossa<br />PA</th>
                  <th className="w-12 px-1 py-2 font-semibold text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {closureRows.map((row: ProductionRow) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="text-center py-1">{row.company}</td>
                    <td className="text-center py-1">{formatDateDisplay(row.date)}</td>
                    <td className="text-center py-1">{row.slaughtered}</td>
                    <td className="text-center py-1">{row.compraTraseiro}</td>
                    <td className="text-center py-1">{row.compraDianteiro}</td>
                    <td className="text-center py-1">{row.compraPA}</td>
                    <td className="text-center py-1">{row.vendaTraseiro}</td>
                    <td className="text-center py-1">{row.vendaDianteiro}</td>
                    <td className="text-center py-1">{row.vendaPA}</td>
                    <td className="text-center py-1">{row.desossaTraseiro}</td>
                    <td className="text-center py-1">{row.desossaDianteiro}</td>
                    <td className="text-center py-1">{row.desossaPA}</td>
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
          setIsClosing(false)
          if (!ok) {
            setCloseAttempts((prev) => prev + 1)
            setClosePasswordError('invalid')
            return
          }
          setCloseModalOpen(false)
          setClosePassword('')
          setClosePasswordError(null)
          setCloseAttempts(0)
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
          setIsDeleting(false)
          if (!okPwd) {
            setDeleteAttempts((prev) => prev + 1)
            setDeletePasswordError('invalid')
            return
          }

          if (deleteTarget.isNew) {
            setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
          } else if (deleteTarget.isClosure) {
            setClosureRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
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
          toast.success('Registro excluído com sucesso.')
        }}
        confirmLabel={isDeleting ? 'Excluindo...' : 'Excluir'}
        cancelLabel="Cancelar"
      />
    </div>
  )
}

export default OperationsProducaoPanel
