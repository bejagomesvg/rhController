import React from 'react'
import {
  Circle, // Used for "Ver tabela" button
  CircleCheckBig,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import LogItem from './LogItem'
import type { Action, State, SheetType, ImportStatus } from '../views/Table_load'
import DownloadTemplateButton from './DownloadTemplateButton'

interface ImportFormProps {
  state: State
  dispatch: React.Dispatch<Action>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileSelect: (file: File | null) => void
  onImport: () => void
  onReset: () => void
  isSupportedSheet: boolean
  hideImportButton: boolean
  statusLabel: Record<ImportStatus, string>
  getStatusColor: () => string
  cadastroHeaders: string[]
  folhaHeaders: string[]
  overtimeHeaders: string[]
}

const ImportForm: React.FC<ImportFormProps> = ({
  state,
  dispatch,
  fileInputRef,
  onFileSelect,
  onImport,
  onReset,
  isSupportedSheet,
  hideImportButton,
  statusLabel,
  getStatusColor,
  cadastroHeaders,
  folhaHeaders,
  overtimeHeaders,
}) => {
  const { sheetType, selectedFile, status, messages, showPreview, progress, sheetData } = state
  const hasPreviewData = sheetData.length > 0
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false)

  const handleTogglePreview = () => {
    if (isPreviewLoading) return
    setIsPreviewLoading(true)
    dispatch({ type: 'SET_PREVIEW', payload: !showPreview })
    window.setTimeout(() => setIsPreviewLoading(false), 0)
  }

  return (
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
              onClick={() => onFileSelect(null)}
              title="Limpar arquivo"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:flex-nowrap flex-wrap items-start md:items-end gap-3 w-full">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-white/70 mb-1">Tipo de planilha</label>
            <select
              value={sheetType}
              onChange={(e) => dispatch({ type: 'SET_SHEET_TYPE', payload: e.target.value as SheetType })}
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
          {isSupportedSheet && (
            <div className="flex flex-wrap items-center gap-2 md:gap-3 shrink-0 md:self-end">
              <DownloadTemplateButton
                sheetType={sheetType}
                cadastroHeaders={cadastroHeaders}
                folhaHeaders={folhaHeaders}
                overtimeHeaders={overtimeHeaders}
                showLabel={false}
              />
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.value = ''
                  fileInputRef.current?.click()
                }}
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
          status === 'error' ? 'border-amber-400/60 bg-amber-500/5' : 'border-white/15 bg-white/5'
        } overflow-hidden`}
        style={{ maxHeight: '180px', minHeight: '180px', backgroundColor: '#0c163d', color: '#cddcff' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
        />
        <div className="w-full h-full flex flex-col gap-0">
            <div className="flex items-center justify-between gap-4 px-2 py-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <CircleCheckBig className="w-4 h-4 text-emerald-300" />
              <p className="text-white font-semibold text-sm">Status Operacao</p>
            </div>
            {hasPreviewData && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 text-white/80 text-xs cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleTogglePreview}
                  onKeyDown={(e) => e.key === 'Enter' && handleTogglePreview()}
                  aria-pressed={showPreview}
                  disabled={isPreviewLoading}
                >
                  {isPreviewLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                  ) : showPreview ? (
                    <CircleCheckBig className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Circle className="w-4 h-4 text-white" />
                  )}
                  <span className={showPreview ? 'text-emerald-200' : 'text-white/80'}>
                    {isPreviewLoading ? 'Carregando tabela...' : 'Preview'}
                  </span>
                </button>
              </div>
            )}
          </div>
          <div className="custom-scroll log-scroll flex-1 min-h-0 max-h-[135px] overflow-y-auto px-2">
            <ul className="text-white/80 text-xs space-y-1 list-none p-0 m-0">
              <li className="text-white/50" aria-label="Aguardando novas mensagens">
                <span className="blinking-cursor" aria-hidden="true" />
              </li>
              {messages.map((msg, idx) => (<li key={idx}><LogItem message={msg} /></li>))}
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-white/70">
          <span>Status: <span className={getStatusColor()}>{statusLabel[status]}</span></span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${status === 'done' ? 'bg-emerald-400' : status === 'error' ? 'bg-amber-300' : 'bg-emerald-300/80'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-button justify-center gap-2">
          {!hideImportButton && (
            <button
              type="button"
              onClick={onImport}
              disabled={status === 'uploading' || status === 'validating'}
              className="px-4 py-2 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {status === 'uploading' || status === 'validating' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              Importar
            </button>
          )}
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors"
            onClick={onReset}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImportForm
