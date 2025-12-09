import React, { useState } from 'react'
import { Users, FactoryIcon, Calendar } from 'lucide-react'

interface OperationsProps {
  onBack: () => void
  userName?: string
  userRole?: string
  title?: string
  description?: string
}

const tabs = [
  { key: 'hr', label: 'Recursos Humanos' },
  { key: 'production', label: 'Produção' },
  { key: 'overtime', label: 'Horas Extras' },
]

const Operations: React.FC<OperationsProps> = ({ onBack, userName, userRole, title, description }) => {
  const [active, setActive] = useState<string>('hr')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">{title || 'Operações'}</p>
          <h3 className="text-white text-xl font-semibold mt-1">{description || 'Gestão de operações RH, Produção e Controle de Horas Extras.'}</h3>
        </div>
        <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-3 rounded-xl shadow-inner shadow-black/20">
          <div>
            <p className="text-emerald-300 font-semibold leading-tight">{userName}</p>
            <p className="text-white/60 text-[11px] uppercase tracking-[0.25em]">{userRole}</p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-rose-100 bg-white/10 border border-white/10 px-3 py-2 rounded-lg hover:bg-rose-500/20 hover:border-rose-300/40 transition-colors text-xs font-semibold uppercase tracking-wide"
            title="Voltar"
          >
            Voltar
          </button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-3">
        <div className="flex gap-2 mb-[-1px]">
          {tabs.map((t) => {
            const isActive = active === t.key
            const base = `px-3 py-2 rounded-t-md text-sm font-medium flex items-center gap-2 transition-colors`
            const activeClasses = `bg-white/10 text-white border border-white/10 border-b-0 shadow`
            const inactiveClasses = `text-white/70 hover:bg-white/5`
            const Icon = t.key === 'hr' ? Users : t.key === 'production' ? FactoryIcon : Calendar
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`${base} ${isActive ? activeClasses + ' relative z-10' : inactiveClasses + ' relative z-0 translate-y-0.5'}`}
                aria-pressed={isActive}
                title={t.label}
              >
                <Icon className="w-4 h-4 text-white/90" />
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            )
          })}
        </div>

        <div className={`p-4 bg-white/2 rounded-b-md min-h-[200px] border border-white/10 border-t-0`}>
          {active === 'hr' && (
            <div>
              <h4 className="text-white font-semibold mb-2">Recursos Humanos</h4>
              <p className="text-white/70 text-sm">Área dedicada a gerenciamento de pessoas, nela que vamos apontar faltas, horas extra, etc.</p>
              {/* Placeholder: você pode inserir aqui componentes/tabelas específicas de RH */}
            </div>
          )}

          {active === 'production' && (
            <div>
              <h4 className="text-white font-semibold mb-2">Produção</h4>
              <p className="text-white/70 text-sm">Ferramentas e relatórios de produção e controle operacional.</p>
              {/* Placeholder: conteúdo de produção */}
            </div>
          )}

          {active === 'overtime' && (
            <div>
              <h4 className="text-white font-semibold mb-2">Horas Extras</h4>
              <p className="text-white/70 text-sm">Conciliação, aprovações e relatórios de horas extras.</p>
              {/* Placeholder: conteúdo de horas extras */}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Operations
