import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowLeftCircle,
  ArrowUpRight,
  ArrowRightCircle,
  Settings,
  Bell,
  Clock3,
  CalendarX2,
  Factory,
  LoaderCircle,
} from 'lucide-react'
import DataPreview from '../components/DataPreview'
import { type SheetData } from './Table_load'

interface OperationsProps {
  onBack: () => void
  userName?: string
  userRole?: string
  title?: string
  description?: string
  supabaseUrl?: string
  supabaseKey?: string
}

const sidebarItems = [
  { key: 'faltas', label: 'Faltas', icon: CalendarX2 },
  { key: 'overtime', label: 'Horas Extras', icon: Clock3 },
  { key: 'producao', label: 'Producao', icon: Factory },
  { key: 'alerts', label: 'Alerta', icon: Bell },
  { key: 'config', label: 'Configuracao', icon: Settings },
]

const Operations: React.FC<OperationsProps> = ({ onBack, userName, userRole, title, description, supabaseUrl, supabaseKey }) => {
  const [active, setActive] = useState<string>('overtime')
  const [overtimeRows, setOvertimeRows] = useState<any[]>([])
  const [isLoadingOvertime, setIsLoadingOvertime] = useState(false)
  const [overtimeError, setOvertimeError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalOvertime, setTotalOvertime] = useState(0)

  const OVERTIME_PAGE_SIZE = 15

  useEffect(() => {
    if (active !== 'overtime') return
    if (!supabaseUrl || !supabaseKey) {
      setOvertimeError('Credenciais do Supabase ausentes.')
      return
    }

    const fetchOvertime = async () => {
      try {
        setIsLoadingOvertime(true)
        setOvertimeError(null)

        const from = (currentPage - 1) * OVERTIME_PAGE_SIZE
        const to = from + OVERTIME_PAGE_SIZE - 1

        const url = new URL(`${supabaseUrl}/rest/v1/overtime`)
        url.searchParams.set('select', 'id,registration,name,date_,hrs303,hrs304,hrs505,hrs506,hrs511,hrs512')
        url.searchParams.set('order', 'date_.desc')

        const res = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: 'count=exact',
            Range: `${from}-${to}`,
          },
        })

        if (!res.ok) {
          const errTxt = await res.text()
          throw new Error(errTxt || 'Erro ao buscar horas extras')
        }

        const contentRange = res.headers.get('content-range')
        const total = contentRange ? Number(contentRange.split('/')[1] || '0') : 0
        setTotalOvertime(total)

        const data = (await res.json()) as any[]
        setOvertimeRows(data)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Erro ao buscar horas extras'
        setOvertimeError(msg)
      } finally {
        setIsLoadingOvertime(false)
      }
    }
    fetchOvertime()
  }, [active, supabaseKey, supabaseUrl, currentPage, OVERTIME_PAGE_SIZE])

  const totalPages = Math.ceil(totalOvertime / OVERTIME_PAGE_SIZE)
  const canGoNext = currentPage < totalPages
  const canGoPrev = currentPage > 1

  const formatDate = (value: string) => {
    if (!value) return '-'
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR')
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
    if (!Number.isFinite(minutes) || minutes < 0) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }

  const previewRows = useMemo(() => {
    let cumulative60 = 0
    let cumulative100 = 0
    return overtimeRows.map((row) => {
      const total60 = intervalToMinutes(row.hrs505) + intervalToMinutes(row.hrs506)
      const comp60 = intervalToMinutes(row.hrs511) + intervalToMinutes(row.hrs512)
      const total100 = intervalToMinutes(row.hrs303) + intervalToMinutes(row.hrs304)
      cumulative60 += total60
      cumulative100 += total100
      return {
        Data: formatDate(row.date_),
        Cadastro: row.registration ?? '-',
        Nome: row.name ?? '-',
        'Hrs 60%': minutesToInterval(total60),
        'Comp 60%': minutesToInterval(comp60),
        'Hrs 100%': minutesToInterval(total100),
        '60% Acumulado': minutesToInterval(cumulative60),
        '100% Acumulado': minutesToInterval(cumulative100),
        'AÇÕES': (
          <button
            type="button"
            className="flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded bg-emerald-500/15 border border-white/10 text-emerald-200 hover:bg-emerald-500/20"
          >
            <ArrowUpRight className="w-3 h-3" />
            Abrir
          </button>
        ),
      }
    })
  }, [overtimeRows])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">{title || 'Operacoes'}</p>
          <h3 className="text-white text-xl font-semibold mt-1">
            {description || 'Gestao de operacoes RH, Producao e Controle de Horas Extras.'}
          </h3>
        </div>
        <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-3 rounded-xl shadow-inner shadow-black/20">
          <div>
            <p className="text-emerald-300 font-semibold leading-tight">{userName}</p>
            <p className="text-white/60 text-[11px] uppercase tracking-[0.25em]">{userRole}</p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-emerald-100 bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 rounded-lg hover:bg-emerald-500/25 hover:border-emerald-400/70 transition-colors text-xs font-semibold uppercase tracking-wide"
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>

      <div className="flex gap-0">
        {/* Adiciona a classe 'group' para controlar o hover de toda a barra lateral */}
        <div className="group relative self-start">
          {/* A largura se expande no hover do grupo. Adiciona transição. */}
          <div className="flex flex-col bg-white/5 border border-white/10 border-r-0 rounded-l-xl overflow-hidden w-12 group-hover:w-40 transition-all duration-300 shadow-inner shadow-black/20">
            {sidebarItems.map((item, idx) => {
              const Icon = item.icon
              const isLast = idx === sidebarItems.length - 1
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`relative flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors h-11 ${
                    !isLast ? 'border-b border-white/5' : ''
                  } ${active === item.key ? 'bg-emerald-500/15 text-emerald-100' : ''}`}
                  title={item.label}
                  onClick={() => setActive(item.key)}
                  aria-pressed={active === item.key}
                >
                  {Icon && <Icon className="w-5 h-5 text-white/80 shrink-0" />}
                  <span className="font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 bg-white/5 border border-white/10 rounded-r-xl rounded-bl-xl rounded-tl-none p-3 shadow-inner shadow-black/10 min-h-[540px]">
          {active === 'overtime' && (
            <div className="space-y-3">
              <h4 className="text-white font-semibold">Apuração de Horas Extras</h4>
              {isLoadingOvertime && <p className="text-white/60 text-sm">Carregando...</p>}
              {overtimeError && <p className="text-rose-300 text-sm">{overtimeError}</p>}
              {!isLoadingOvertime && !overtimeError && overtimeRows.length === 0 && (
                <p className="text-white/60 text-sm">Nenhum registro encontrado.</p>
              )}
              {!isLoadingOvertime && !overtimeError && overtimeRows.length > 0 && (
                <DataPreview
                  show
                  data={previewRows as SheetData}
                  columns={[
                    'Data',
                    'Cadastro',
                    'Nome',
                    'Hrs 60%',
                    'Comp 60%',
                    'Hrs 100%',
                    '60% Acumulado',
                    '100% Acumulado',
                    'AÇÕES',
                  ]}
                  isFolha={false}
                  rowErrors={[]}
                />
              )}
              {!isLoadingOvertime && totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-white/70 pt-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!canGoPrev}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowLeftCircle className="w-4 h-4" />
                    Anterior
                  </button>
                  <div className="flex items-center gap-2">
                    {isLoadingOvertime && <LoaderCircle className="w-4 h-4 animate-spin" />}
                    <span>
                      Página {currentPage} de {totalPages}
                    </span>
                  </div>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!canGoNext}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Próxima
                    <ArrowRightCircle className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Operations
