import React, { useState } from 'react'
import { X, PlusCircle, Edit, Trash2, Eye, KeyRound, ChevronsRight } from 'lucide-react'

export type NewUserData = {
  name: string
  username: string
  type_user: string
  job_title: string
  allowed_sector: string
  date_registration: string
  is_authorized: boolean
  authorizedSector: string
  modules: string
  authorizedModules: string
  security: string[]
}

interface Props {
  newUser: NewUserData
  setNewUser: React.Dispatch<React.SetStateAction<NewUserData>>
  isCreating: boolean
  createFeedback: string | null
  onCancel: () => void
  onSubmit: (e: React.FormEvent) => void
}

const AVAILABLE_SECTORS = [
  'ADMINISTRAÇÃO',
  'ALMOXARIFADO',
  'ATENDIMENTO AO CLIENTE',
  'COMERCIAL',
  'COMPRAS',
  'CONTABILIDADE',
  'DIRETORIA',
  'EXPEDIÇÃO',
  'FINANCEIRO',
  'FISCAL',
  'INOVAÇÃO E P&D',
  'JURÍDICO',
  'LOGÍSTICA',
  'MANUTENÇÃO',
  'MARKETING',
  'PLANEJAMENTO',
  'QUALIDADE',
  'RECURSOS HUMANOS (RH)',
  'SEGURANÇA DO TRABALHO',
  'TI',
  'VENDAS',
]

const AVAILABLE_MODULES = ['MODULOS 1', 'MODULOS 2', 'MODULOS 3', 'MODULOS 4', 'MODULOS 5']
const INITIAL_PERMISSIONS = { creater: false, update: false, delete: false, read: false, password: false }

export default function UserForm({ newUser, setNewUser, isCreating, createFeedback, onCancel, onSubmit }: Props) {
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [tagInputValue, setTagInputValue] = useState('')
  const [permissoes, setPermissoes] = useState(INITIAL_PERMISSIONS)
  const [sectorSelection, setSectorSelection] = useState('')

  const getInputClasses = (hasError: boolean, readOnly: boolean = false) => `
    w-full bg-white/5 text-white text-[13px] leading-tight border border-white/10
    ${hasError ? 'border-red-400' : ''}
    ${readOnly ? 'opacity-60 cursor-not-allowed' : 'focus:border-emerald-400 focus:bg-emerald-400/6'}
    outline-none transition-colors duration-200 px-4 py-2 rounded-lg uppercase placeholder:tracking-widest placeholder:text-white/40
  `

  const getTagContainerClasses = (hasError: boolean, height: string = 'min-h-[70px] max-h-[70px]') => `
    w-full bg-white/4 border border-white/8
    ${hasError ? 'border-red-300' : ''}
    transition-colors duration-200 px-2 py-2 rounded-md ${height} overflow-y-auto
    flex content-start items-start gap-2 flex-wrap
  `

  const getSectorsArray = () =>
    newUser.authorizedSector ? newUser.authorizedSector.split(',').map((s) => s.trim()).filter(Boolean) : []

  const getModulesArray = () =>
    newUser.authorizedModules ? newUser.authorizedModules.split('\n').map((s) => s.trim()).filter(Boolean) : []

  const getFilteredSectors = () => {
    const current = getSectorsArray()
    return AVAILABLE_SECTORS.filter((s) => !current.includes(s))
  }

  const getFilteredModules = () => {
    const currentModuleNames = getModulesArray().map((m) => m.split(' (')[0])
    return AVAILABLE_MODULES.filter((m) => !currentModuleNames.includes(m))
  }

  const handleSectorChange = (value: string) => {
    if (!value) return
    const current = getSectorsArray()
    if (current.includes(value)) return
    const next = [...current, value]
    setNewUser((p) => ({ ...p, authorizedSector: next.join(',') }))
  }

  const handleRemoveSector = (sectorToRemove: string) => {
    const current = getSectorsArray()
    setNewUser((p) => ({ ...p, authorizedSector: current.filter((s) => s !== sectorToRemove).join(',') }))
  }

  const handleTagInputKeyDown = () => {
    const val = tagInputValue.trim().toUpperCase()
    if (!val) return
    if (!AVAILABLE_SECTORS.includes(val)) {
      setErrors((p) => ({ ...p, authorizedSector: 'Setor inválido ou inexistente.' }))
      setTagInputValue('')
      return
    }
    const current = getSectorsArray()
    if (current.includes(val)) {
      setErrors((p) => ({ ...p, authorizedSector: 'Setor já adicionado.' }))
      setTagInputValue('')
      return
    }
    setNewUser((p) => ({ ...p, authorizedSector: [...current, val].join(',') }))
    setTagInputValue('')
    setErrors((p) => ({ ...p, authorizedSector: undefined }))
  }

  const handleAddModule = () => {
    if (!newUser.modules) return
    const selectedPerms = Object.entries(permissoes).filter(([, checked]) => checked).map(([k]) => k.toUpperCase())
    if (selectedPerms.length === 0) return
    const moduleString = `${newUser.modules} (${selectedPerms.join(',')})`
    const current = getModulesArray()
    if (current.some((m) => m.startsWith(newUser.modules))) return
    setNewUser((p) => ({ ...p, authorizedModules: [...current, moduleString].join('\n'), modules: '' }))
    setPermissoes(INITIAL_PERMISSIONS)
  }

  const handleRemoveModule = (moduleString: string) => {
    const current = getModulesArray()
    setNewUser((p) => ({ ...p, authorizedModules: current.filter((m) => m !== moduleString).join('\n') }))
  }

  return (
    <form className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-6 mt-2" onSubmit={onSubmit}>
      {/* Row 1 - Nome / Usuario */}
      <div className="col-span-12 md:col-span-8">
          <label className="block text-[10px] text-white/70 mb-1 uppercase tracking-[0.18em] font-semibold">Nome completo</label>
        <input
          type="text"
          name="name"
          placeholder="DIGITE O NOME COMPLETO"
          value={newUser.name}
          onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
          className={getInputClasses(!!errors.name)}
          required
        />
        {errors.name && <span className="text-red-300 text-xs mt-1 block">{errors.name}</span>}
      </div>

      <div className="col-span-12 md:col-span-4">
          <label className="block text-[10px] text-white/70 mb-1 uppercase tracking-[0.18em] font-semibold">Usuario</label>
        <input
          type="text"
          name="username"
          placeholder="NOME DE USUÁRIO"
          value={newUser.username}
          onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value.toUpperCase() }))}
          className={getInputClasses(!!errors.username)}
          required
        />
        {errors.username && <span className="text-red-300 text-xs mt-1 block">{errors.username}</span>}
      </div>

      {/* Row 2 - Cargo / Perfil / Data */}
        <div className="col-span-12 md:col-span-5">
          <label className="block text-[11px] text-white/70 mb-1 uppercase tracking-[0.18em] font-semibold">Cargo</label>
          <input
          type="text"
          name="job_title"
          placeholder="CARGO DO USUÁRIO"
          value={newUser.job_title}
          onChange={(e) => setNewUser((p) => ({ ...p, job_title: e.target.value.toUpperCase() }))}
          className={getInputClasses(false)}
        />
      </div>
      <div className="col-span-12 md:col-span-4">
          <label className="block text-[10px] text-white/70 mb-1 uppercase tracking-[0.18em] font-semibold">Perfil</label>
        <select
          name="type_user"
          value={newUser.type_user}
          onChange={(e) => setNewUser((p) => ({ ...p, type_user: e.target.value }))}
          className={getInputClasses(false)}
        >
          <option value="Usuario">USUARIO</option>
          <option value="Administrador">ADMINISTRADOR</option>
        </select>
      </div>
      <div className="col-span-12 md:col-span-3">
          <label className="block text-[10px] text-white/70 mb-1 uppercase tracking-[0.18em] font-semibold">Data de Registro</label>
        <input type="date" value={newUser.date_registration} readOnly className={getInputClasses(false, true)} />
      </div>

      {/* Row 3 - Setor / Setor Autorizado */}
      <div className="col-span-12 md:col-span-4">
          <label className="block text-[10px] text-white/70 mb-1 uppercase tracking-[0.18em] font-semibold">Setor</label>
        <select
          value={sectorSelection}
          onChange={(e) => {
            setSectorSelection(e.target.value)
            handleSectorChange(e.target.value)
            setSectorSelection('')
          }}
          className={getInputClasses(false)}
        >
          <option value="">--</option>
          {getFilteredSectors().map((s) => (
            <option key={s} value={s} className="bg-[#202422] text-white">
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-12 md:col-span-8">
          <label className="block text-[10px] text-white/70 mb-1 uppercase tracking-[0.18em] font-semibold">Setor Autorizado</label>
        <div className={getTagContainerClasses(!!errors.authorizedSector)}>
          {getSectorsArray().map((s) => (
            <span
              key={s}
              className="inline-flex items-start gap-2 bg-[#342e4a] text-white text-[12px] px-2 py-1 rounded-md border border-[#4b3d66] uppercase tracking-wider max-w-full break-words whitespace-normal"
            >
              <span className="break-words whitespace-normal">{s}</span>
              <button
                type="button"
                className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 text-white/80 hover:bg-rose-500/40 ml-1"
                onClick={() => handleRemoveSector(s)}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInputValue}
            onChange={(e) => setTagInputValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ',' ? (e.preventDefault(), handleTagInputKeyDown()) : null)}
            className="bg-transparent border-none outline-none text-white text-[13px] leading-tight uppercase flex-grow min-w-[100px] placeholder:text-white/40 px-3 py-2"
          />
          {errors.authorizedSector && <span className="text-red-300 text-xs mt-1 block">{errors.authorizedSector}</span>}
        </div>
      </div>

      {/* Row 4 - Modulos / Permissoes / Add */}
      <div className="col-span-12 md:col-span-4">
          <label className="block text-[10px] text-white/70 mb-1 uppercase tracking-[0.18em] font-semibold">Módulos</label>
        <select
          value={newUser.modules}
          onChange={(e) => setNewUser((p) => ({ ...p, modules: e.target.value }))}
          className={`${getInputClasses(false)} border-transparent border-b-2 focus:border-emerald-400/90`}
        >
          <option value="">--</option>
          {getFilteredModules().map((m) => (
            <option key={m} value={m} className="bg-[#202422] text-white">
              {m}
            </option>
          ))}
        </select>

        {newUser.modules && (
          <div className="flex items-center gap-2 mt-3 w-full">
            {Object.keys(permissoes).map((k) => (
              <label key={k} className="cursor-pointer flex items-center gap-1.5" title={k.toUpperCase()}>
                <input
                  type="checkbox"
                  checked={(permissoes as any)[k]}
                  onChange={(e) => setPermissoes((p) => ({ ...p, [k]: e.target.checked }))}
                  className="sr-only"
                />
                <div
                  className={`w-9 h-9 flex items-center justify-center rounded-md bg-white/5 border transition-all ${
                    (permissoes as any)[k]
                        ? (k === 'creater'
                          ? 'bg-emerald-600/12 border border-emerald-500/80 ring-2 ring-emerald-300/50'
                          : k === 'update'
                          ? 'bg-sky-600/10 border border-sky-500/80 ring-2 ring-sky-300/50'
                          : k === 'delete'
                          ? 'bg-rose-600/10 border border-rose-500/80 ring-2 ring-rose-300/50'
                          : k === 'read'
                          ? 'bg-amber-500/10 border border-amber-400/80 ring-2 ring-amber-300/50'
                          : k === 'password'
                          ? 'bg-violet-600/10 border border-violet-400/80 ring-2 ring-violet-300/50'
                          : '')
                      : 'hover:bg-white/6'
                  }`}
                >
                  {k === 'creater' ? <PlusCircle size={18} className={`${(permissoes as any)[k] ? 'text-emerald-300' : 'text-white/60'}`} /> : null}
                  {k === 'update' ? <Edit size={18} className={`${(permissoes as any)[k] ? 'text-blue-300' : 'text-white/60'}`} /> : null}
                  {k === 'delete' ? <Trash2 size={18} className={`${(permissoes as any)[k] ? 'text-rose-300' : 'text-white/60'}`} /> : null}
                  {k === 'read' ? <Eye size={18} className={`${(permissoes as any)[k] ? 'text-amber-300' : 'text-white/60'}`} /> : null}
                  {k === 'password' ? <KeyRound size={18} className={`${(permissoes as any)[k] ? 'text-violet-300' : 'text-white/60'}`} /> : null}
                </div>
              </label>
            ))}

            <button
              type="button"
              onClick={handleAddModule}
              title="Adicionar módulo com permissões"
              className="ml-auto flex items-center justify-center px-6 py-2 rounded-lg bg-transparent border border-emerald-400/60 text-white/90 hover:bg-emerald-500/12 hover:border-emerald-300/80 transition-all shadow-sm"
            >
              <ChevronsRight className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Modulos autorizados */}
      <div className="col-span-12 md:col-span-8">
          <label className="text-[10px] text-white/70 mb-1 uppercase tracking-[0.18em] font-semibold">Módulos Autorizados</label>
        <div className={`${getTagContainerClasses(false, 'min-h-[90px] max-h-[120px]')} px-3 py-2`}>
          {getModulesArray().map((m, idx) => (
            <span
              key={idx}
              className="inline-flex items-start gap-2 bg-[#342e4a] text-white text-[11px] px-2 py-1 rounded-md border border-[#50406a] uppercase tracking-wider max-w-full break-words whitespace-normal"
            >
              <span className="break-words whitespace-normal">{m}</span>
              <button
                type="button"
                onClick={() => handleRemoveModule(m)}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 text-white/80 hover:bg-rose-500/40 ml-1"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {createFeedback && (
        <div className="col-span-12 md:col-span-6 text-sm text-amber-200 bg-amber-500/10 border border-amber-300/40 rounded-md px-3 py-2">
          {createFeedback}
        </div>
      )}

      {/* Footer save */}
      <div className="p-4 border-t  col-span-12 md:col-span-12 flex justify-center gap-4 items-center">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-3 rounded-lg bg-transparent border border-white/10 text-white/80 hover:bg-white/5 hover:border-emerald-300/30 focus:outline-none focus:ring-2 focus:ring-emerald-300/10 transition-all text-xs"
          aria-label="Cancelar criação de usuário"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={isCreating}
          className="px-5 py-2 rounded-lg bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg text-sm border border-emerald-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
        >
          {isCreating ? 'Criando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
