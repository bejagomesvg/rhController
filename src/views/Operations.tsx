import React, { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Settings,
  Bell,
  Clock3,
  CalendarX2,
  Factory,
} from 'lucide-react'
import OperationsOvertimePanel from './operations/OperationsOvertimePanel'
import OperationsFaltasPanel from './operations/OperationsFaltasPanel'
import OperationsProducaoPanel from './operations/OperationsProducaoPanel'
import OperationsAlertsPanel from './operations/OperationsAlertsPanel'
import OperationsConfigPanel from './operations/OperationsConfigPanel'

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

const STORAGE_KEY = 'operations:lastActive'

const Operations: React.FC<OperationsProps> = ({ onBack, userName, userRole, title, description, supabaseUrl, supabaseKey, }) => {
  const [active, setActive] = useState<string>(() => {
    if (typeof window === 'undefined') return 'overtime'
    return localStorage.getItem(STORAGE_KEY) || 'overtime'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, active)
  }, [active])


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
        <div className="group relative self-start">
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
                aria-current={active === item.key ? 'page' : undefined}
              >
                {Icon && (
                  <Icon
                    className={`w-5 h-5 shrink-0 ${active === item.key ? 'text-emerald-300' : 'text-white/80'}`}
                  />
                )}
                <span className="font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {item.label}
                </span>
              </button>
            )
            })}
          </div>
        </div>

        <div className="flex-1 bg-white/5 border border-white/10 rounded-r-xl rounded-bl-xl rounded-tl-none p-3 shadow-inner shadow-black/10 min-h-[540px]">
          {active === 'faltas' && <OperationsFaltasPanel supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />}
          {active === 'overtime' && <OperationsOvertimePanel supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />}
          {active === 'producao' && <OperationsProducaoPanel supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />}
          {active === 'alerts' && <OperationsAlertsPanel supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />}
          {active === 'config' && <OperationsConfigPanel supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />}
        </div>
      </div>
    </div>
  )
}

export default Operations
