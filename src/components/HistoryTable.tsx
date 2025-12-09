import React from 'react'
import type { HistoryEntry } from '../models/history'
import { ChevronLeft, ChevronRight, Loader2, Search, X, ArrowUp, ArrowDown, FilePlusCorner, FileMinusCorner } from 'lucide-react'

interface HistoryTableProps {
  history: HistoryEntry[]
  renderActionIcon: (action?: string) => React.ReactNode
  isLoading: boolean
  error?: string | null
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  sortConfig: { key: string; direction: 'ascending' | 'descending' } | null
  onSort: (key: string) => void
}

const SortableHeader: React.FC<{
  label: string
  sortKey: string
  sortConfig: HistoryTableProps['sortConfig']
  onSort: HistoryTableProps['onSort']
  className?: string
}> = ({ label, sortKey, sortConfig, onSort, className = '' }) => (
  <th className={`px-1 py-1.5 text-white/70 font-semibold ${className}`}>
    <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 w-full h-full">
      {label}
      {sortConfig?.key === sortKey && (
        sortConfig.direction === 'ascending' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      )}
    </button>
  </th>
)

const HistoryTable: React.FC<HistoryTableProps> = ({
  history,
  renderActionIcon,
  isLoading,
  error,
  currentPage,
  totalPages,
  onPageChange,
  searchQuery,
  onSearchChange,
  sortConfig,
  onSort,
}) => {
  return (
    <div className="lg:col-span-6 lg:sticky lg:top-24">
      <div className="bg-slate-900/70 border border-white/10 rounded-xl h-full overflow-hidden flex flex-col">
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar no histórico..."
              className="w-full bg-white/5 text-white text-sm border border-white/10 rounded-lg pl-9 pr-8 py-2 outline-none focus:border-emerald-400"
            />
            {searchQuery && (
              <button onClick={() => onSearchChange('')} className="absolute top-1/2 right-2 -translate-y-1/2 text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto custom-scroll flex-grow">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10 bg-emerald-800/95">
              <tr className="border-b border-white/10">
                <SortableHeader label="DATA" sortKey="date" sortConfig={sortConfig} onSort={onSort} className="text-center" />
                <SortableHeader label="BANCO DADOS" sortKey="banco" sortConfig={sortConfig} onSort={onSort} className="text-left" />
                <SortableHeader label="ACAO" sortKey="acao" sortConfig={sortConfig} onSort={onSort} className="text-center" />
                <SortableHeader label="ARQUIVO" sortKey="arquivo" sortConfig={sortConfig} onSort={onSort} className="text-left" />
                <SortableHeader label="USUARIO" sortKey="usuario" sortConfig={sortConfig} onSort={onSort} className="text-left" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-[11px]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-1 py-3 text-white/60 text-xs text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Carregando histórico...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr><td colSpan={5} className="px-1 py-3 text-rose-300 text-xs text-center">{error}</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={5} className="px-1 py-3 text-white/50 text-xs text-center">Nenhum registro de Carga da tabela ainda.</td></tr>
              ) : (
                history.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-1 py-1.5 text-white/80 text-center text-[11px]">{item.date}</td>
                    <td className="px-1 py-1.5 text-white/80 text-[11px] text-left">{item.banco}</td>
                    <td className="px-1 py-1.5 text-white/80 text-[11px] text-center">
                      {item.acao?.toLowerCase() === 'inclusao' ? (
                        <FilePlusCorner className="w-4 h-4 text-emerald-400 inline-block" />
                      ) : item.acao?.toLowerCase() === 'delete' || item.acao?.toLowerCase() === 'exclusao' ? (
                        <FileMinusCorner className="w-4 h-4 text-rose-400 inline-block" />
                      ) : (
                        renderActionIcon(item.acao)
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-white/80 text-[11px] text-left">{item.arquivo}</td>
                    <td className="px-1 py-1.5 text-white/80 text-[11px] text-left">{item.usuario}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-white/70 text-xs">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center gap-1 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryTable

