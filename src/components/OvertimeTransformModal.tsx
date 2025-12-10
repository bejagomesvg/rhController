import React from 'react'
import { X } from 'lucide-react'
import type { OvertimeTransformResult } from '../utils/overtimeTransformer'

interface OvertimeTransformModalProps {
  open: boolean
  onClose: () => void
  result: OvertimeTransformResult | null
  fileName?: string
  error?: string | null
}

const columns = ['Data', 'Cadastro', 'Nome', '303', '304', '505', '506', '511', '512']

const OvertimeTransformModal: React.FC<OvertimeTransformModalProps> = ({ open, onClose, result, fileName, error }) => {
  if (!open) return null

  const rows = result?.rows || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between p-4 border-b border-white/10">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">Pré-visualização</p>
            <h3 className="text-white text-xl font-semibold">Transformação Horas Extras</h3>
            {fileName && <p className="text-white/60 text-sm mt-1">{fileName}</p>}
            {result?.period && <p className="text-emerald-300 text-xs mt-1">Período detectado: {result.period}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="Fechar pré-visualização"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="p-6 text-amber-200 text-sm">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-white/70 text-sm">Nenhum dado transformado.</div>
          ) : (
            <table className="min-w-full text-sm text-white/90">
              <thead className="bg-white/5 sticky top-0">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-semibold border-b border-white/10">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="odd:bg-white/0 even:bg-white/[0.03]">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                        {(row as Record<string, any>)[col] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

export default OvertimeTransformModal
