import React, { useRef, useState } from 'react'
import {
  CalendarDays,
  CalendarX2,
  ChevronsRight,
  Clock10,
  DollarSign,
  Edit,
  Eye,
  Factory,
  FileText,
  RotateCcwKey,
  Settings,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { MODULE_LABELS } from '../utils/moduleParser'
import type { EmployeeNameSuggestion } from '../services/employeeService'

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
  readonly?: boolean
  availableSectors?: string[]
  fetchNameSuggestions?: (query: string) => Promise<EmployeeNameSuggestion[]>
  lockUsername?: boolean
}

const AVAILABLE_MODULES = MODULE_LABELS

type PermissionKey =
  | 'creater'
  | 'read'
  | 'update'
  | 'delete'
  | 'password'
  | 'falta'
  | 'time'
  | 'producao'
  | 'folha'
  | 'custos'
  | 'afastamentos'
  | 'config'

const BASE_PERMISSIONS: PermissionKey[] = ['creater', 'read', 'update', 'delete', 'password']
const OPERATIONS_PERMISSIONS: PermissionKey[] = ['falta', 'time', 'producao', 'config']
const PAYROLL_PERMISSIONS: PermissionKey[] = ['folha', 'custos', 'afastamentos', 'config']

const INITIAL_PERMISSIONS: Record<PermissionKey, boolean> = {
  creater: false,
  read: false,
  update: false,
  delete: false,
  password: false,
  falta: false,
  time: false,
  producao: false,
  folha: false,
  custos: false,
  afastamentos: false,
  config: false,
}

export default function UserForm({
  newUser,
  setNewUser,
  isCreating,
  createFeedback,
  onCancel,
  onSubmit,
  readonly = false,
  availableSectors = [],
  fetchNameSuggestions,
  lockUsername = false,
}: Props) {
  const usernameInputRef = useRef<HTMLInputElement | null>(null)
  const profileSelectRef = useRef<HTMLSelectElement | null>(null)
  const suppressNextNameSuggestionsRef = useRef(false)
  const [permissoes, setPermissoes] = useState(INITIAL_PERMISSIONS)
  const [sectorSelection, setSectorSelection] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [nameSuggestions, setNameSuggestions] = useState<EmployeeNameSuggestion[]>([])
  const [showNameSuggestions, setShowNameSuggestions] = useState(false)
  const [isNameFocused, setIsNameFocused] = useState(false)
  const [validationErrors, setValidationErrors] = useState({
    name: false,
    username: false,
    job_title: false,
    type_user: false,
    authorizedSector: false,
    authorizedModules: false,
  })

  const handleUsernameChange = (value: string) => {
    const upperValue = value.toUpperCase()
    
    // Verificar se há espaços
    if (upperValue.includes(' ')) {
      setUsernameError('Não pode conter espaços. Use apenas letras, números e caracteres especiais como _ ou -')
    } else {
      setUsernameError('')
    }
    
    // Remover espaços ao salvar
    setNewUser((p) => ({ ...p, username: upperValue.replace(/\s/g, '') }))
  }

  const handleNameChange = (value: string) => {
    setNewUser((p) => ({ ...p, name: value.toUpperCase() }))
    if (!value || value.trim().length < 4) {
      setNameSuggestions([])
      setShowNameSuggestions(false)
    }
  }

  React.useEffect(() => {
    if (readonly || !fetchNameSuggestions) return
    if (suppressNextNameSuggestionsRef.current) {
      suppressNextNameSuggestionsRef.current = false
      return
    }
    const query = (newUser.name || '').trim()
    if (query.length < 4) return

    let isActive = true
    const timer = setTimeout(async () => {
      const results = await fetchNameSuggestions(query)
      if (!isActive) return
      setNameSuggestions(results)
      setShowNameSuggestions(isNameFocused && results.length > 0)
    }, 250)

    return () => {
      isActive = false
      clearTimeout(timer)
    }
  }, [fetchNameSuggestions, newUser.name, readonly])

  const handleSelectName = (suggestion: EmployeeNameSuggestion) => {
    setNewUser((p) => ({
      ...p,
      name: suggestion.name.toUpperCase(),
      job_title: suggestion.role ? suggestion.role.toUpperCase() : p.job_title,
      authorizedSector: suggestion.sector ? suggestion.sector.toUpperCase() : p.authorizedSector,
    }))
    setNameSuggestions([])
    setShowNameSuggestions(false)
    suppressNextNameSuggestionsRef.current = true
    requestAnimationFrame(() => {
      if (lockUsername) {
        profileSelectRef.current?.focus()
      } else {
        usernameInputRef.current?.focus()
      }
    })
  }

  const handleNameBlur = () => {
    setIsNameFocused(false)
    setShowNameSuggestions(false)
  }

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setShowNameSuggestions(false)
    }
  }

  const clearFieldError = (field: keyof typeof validationErrors) => {
    setValidationErrors((prev) => ({ ...prev, [field]: false }))
  }

  const getInputClasses = (hasError: boolean, readOnly: boolean = false) => `
    w-full bg-white/5 text-white text-[13px] leading-tight border border-white/10
    ${hasError ? 'border-red-400' : ''}
    ${readOnly || readonly ? 'opacity-60 cursor-not-allowed' : 'focus:border-emerald-400 focus:bg-emerald-400/6'}
    outline-none transition-colors duration-200 px-4 py-2 rounded-lg uppercase placeholder:tracking-widest placeholder:text-white/40
  `

  const getTagContainerClasses = (hasError: boolean, height: string = 'min-h-[70px] max-h-[70px]') => `
    w-full bg-white/5 text-white text-[13px] leading-tight border border-white/10
    ${hasError ? 'border-red-400' : ''}
    outline-none transition-colors duration-200 px-4 py-2 rounded-lg ${height}
    overflow-y-auto flex content-start items-start gap-2 flex-wrap
  `

  const getSectorsArray = () =>
    newUser.authorizedSector
      ? newUser.authorizedSector
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .sort()
      : []

  const getModulesArray = () =>
    newUser.authorizedModules
      ? newUser.authorizedModules
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .sort()
      : []

  const getFilteredSectors = () => {
    const current = getSectorsArray()
    return availableSectors.filter((s) => !current.includes(s))
  }

  const getFilteredModules = () => {
    const currentModuleNames = getModulesArray().map((m) => m.split(' (')[0])
    return AVAILABLE_MODULES.filter((m) => !currentModuleNames.includes(m))
  }

  const handleSectorChange = (value: string) => {
    if (!value) return
    
    // Se "TODOS" foi selecionado, deixa apenas ele
    if (value === 'TODOS') {
      setNewUser((p) => ({ ...p, authorizedSector: 'TODOS' }))
      return
    }
    
    const current = getSectorsArray()
    if (current.includes(value)) return
    const next = [...current, value]
    setNewUser((p) => ({ ...p, authorizedSector: next.join(',') }))
  }

  const handleRemoveSector = (sectorToRemove: string) => {
    const current = getSectorsArray()
    setNewUser((p) => ({ ...p, authorizedSector: current.filter((s) => s !== sectorToRemove).join(',') }))
  }

  const hasAllSectors = () => {
    const sectors = getSectorsArray()
    return sectors.includes('TODOS')
  }

  const getPermissionKeysForModule = () => {
    const isOperationsModule = newUser.modules === 'OPERACOES' || newUser.modules === 'OPERACAO'
    const isPayrollModule = newUser.modules === 'FOLHA DE PAGAMENTO'
    const base = BASE_PERMISSIONS.filter((k) => (k === 'password' ? newUser.modules === 'SEGURANCA' : true))
    if (isOperationsModule) {
      return [...base, ...OPERATIONS_PERMISSIONS]
    }
    if (isPayrollModule) {
      return [...base, ...PAYROLL_PERMISSIONS]
    }
    return base
  }

  const handleAddModule = () => {
    if (!newUser.modules) return
    const selectedPerms = getPermissionKeysForModule()
      .filter((key) => permissoes[key])
      .map((key) => key.toUpperCase())
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

  const validateForm = () => {
    const errors = {
      name: !newUser.name?.trim(),
      username: !newUser.username?.trim(),
      job_title: !newUser.job_title?.trim(),
      type_user: !newUser.type_user?.trim(),
      authorizedSector: !newUser.authorizedSector?.trim(),
      authorizedModules: !newUser.authorizedModules?.trim(),
    }
    setValidationErrors(errors)
    return !Object.values(errors).some(Boolean)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    if (!validateForm()) {
      e.preventDefault()
      return
    }
    onSubmit(e)
  }

  return (
    <form
      className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-6 mt-2"
      onSubmit={handleFormSubmit}
      autoComplete="off"
    >
      {/* Row 1 - Nome / Usuario */}
      <div className="col-span-12 md:col-span-8 relative">
          <label className="block text-[10px] text-white/70 mb-1 tracking-[0.18em]">Nome completo</label>
        <input
          type="text"
          name="name"
          placeholder="Entre com o nome completo"
          value={newUser.name}
          onChange={(e) => !readonly && handleNameChange(e.target.value)}
          className={getInputClasses(validationErrors.name)}
          readOnly={readonly}
          onFocus={() => {
            setIsNameFocused(true)
            clearFieldError('name')
          }}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          autoComplete="off"
        />
        {!readonly && showNameSuggestions && nameSuggestions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-[#202422] border border-white/10 rounded-lg shadow-lg max-h-44 overflow-y-auto">
            {nameSuggestions.slice(0, 5).map((item) => (
              <button
                key={item.name}
                type="button"
                className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10 transition-colors"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelectName(item)}
              >
                <span className="block text-[12px] text-white/95">{item.name}</span>
                {item.role && <span className="block text-[10px] text-white/60">{item.role}</span>}
              </button>
            ))}
          </div>
        )}
        {validationErrors.name && <span className="text-orange-400 text-xs mt-1 block">⚠ Preencha este campo.</span>}
      </div>

      <div className="col-span-12 md:col-span-4">
          <label className="block text-[10px] text-white/70 mb-1 tracking-[0.18em]">Usuário</label>
        <input
          type="text"
          name="username"
          placeholder="Nome de Usuário"
          value={newUser.username}
          onChange={(e) => !readonly && handleUsernameChange(e.target.value)}
          className={getInputClasses(validationErrors.username || !!usernameError, readonly || lockUsername)}
          readOnly={readonly || lockUsername}
          onFocus={() => clearFieldError('username')}
          ref={usernameInputRef}
        />
        {validationErrors.username && !usernameError && <span className="text-orange-400 text-xs mt-1 block">⚠ Preencha este campo.</span>}
        {usernameError && <span className="text-red-300 text-xs mt-1 block">{usernameError}</span>}
      </div>

      {/* Row 2 - Cargo / Perfil / Data */}
        <div className="col-span-12 md:col-span-5">
          <label className="block text-[10px] text-white/70 mb-1 tracking-[0.18em]">Cargo</label>
          <input
          type="text"
          name="job_title"
          placeholder="Cargo do usuário"
          value={newUser.job_title}
          onChange={(e) => !readonly && setNewUser((p) => ({ ...p, job_title: e.target.value.toUpperCase() }))}
          className={getInputClasses(validationErrors.job_title)}
          readOnly={readonly}
          onFocus={() => clearFieldError('job_title')}
        />
        {validationErrors.job_title && <span className="text-orange-400 text-xs mt-1 block">⚠ Preencha este campo.</span>}
      </div>
      <div className="col-span-12 md:col-span-4">
          <label className="block text-[10px] text-white/70 mb-1 tracking-[0.18em]">Perfil</label>
        <select
          name="type_user"
          value={newUser.type_user}
          onChange={(e) => !readonly && setNewUser((p) => ({ ...p, type_user: e.target.value }))}
          className={getInputClasses(validationErrors.type_user)}
          disabled={readonly}
          onFocus={() => clearFieldError('type_user')}
          ref={profileSelectRef}
        >
          <option value="" className="bg-[#202422] text-white border-0 outline-none">--</option>
          <option value="USUARIO" className="bg-[#202422] text-white border-0 outline-none">USUARIO</option>
          <option value="ADMINISTRADOR" className="bg-[#202422] text-white border-0 outline-none">ADMINISTRADOR</option>
          <option value="GERENTE" className="bg-[#202422] text-white border-0 outline-none">GERENTE</option>
        </select>
        {validationErrors.type_user && <span className="text-orange-400 text-xs mt-1 block">⚠ Preencha este campo.</span>}
      </div>
      <div className="col-span-12 md:col-span-3">
          <label className="block text-[10px] text-white/70 mb-1 tracking-[0.18em]">Data de Registro</label>
        <input type="date" value={newUser.date_registration} readOnly className={getInputClasses(false, true)} />
      </div>

      {/* Row 3 - Setor / Setor Autorizado */}
      <div className="col-span-12 md:col-span-4">
          <label className="block text-[10px] text-white/70 mb-1 tracking-[0.18em]">Setor</label>
        <select
          value={sectorSelection}
          onChange={(e) => {
            setSectorSelection(e.target.value)
            handleSectorChange(e.target.value)
            setSectorSelection('')
          }}
          onFocus={() => clearFieldError('authorizedSector')}
          disabled={hasAllSectors() || readonly}
          className={getInputClasses(false)}
        >
          <option value="" className="bg-[#202422] text-white">--</option>
          <option value="TODOS" className="bg-[#202422] text-white">
            TODOS
          </option>
          {getFilteredSectors().map((s) => (
            <option key={s} value={s} className="bg-[#202422] text-white">
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-12 md:col-span-8">
          <label className="block text-[10px] text-white/70 mb-1 tracking-[0.18em]">Setor Autorizado</label>
        <div className={getTagContainerClasses(validationErrors.authorizedSector, 'min-h-[45px] max-h-[77px]')}>
          {getSectorsArray().map((s) => (
            <span
              key={s}
              className="inline-flex items-start gap-2 bg-[#342e4a] text-white text-[11px] px-2 py-1 rounded-md border border-[#50406a] uppercase tracking-wider max-w-full break-words whitespace-normal"
            >
              <span className="break-words whitespace-normal">{s}</span>
              {!readonly && (
                <button
                  type="button"
                  className="w-4 h-4 flex items-center justify-center rounded-md bg-white/5 text-white/80 hover:bg-rose-500/40 ml-1"
                  onClick={() => handleRemoveSector(s)}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
        {validationErrors.authorizedSector && <span className="text-orange-400 text-xs mt-1 block">⚠ Preencha este campo.</span>}
      </div>

      {/* Row 4 - Modulos / Permissoes / Add */}
      <div className="col-span-12 md:col-span-4">
          <label className="block text-[10px] text-white/70 mb-1 tracking-[0.18em]">Módulos</label>
        <select
          value={newUser.modules}
          onChange={(e) => !readonly && setNewUser((p) => ({ ...p, modules: e.target.value }))}
          className={`${getInputClasses(false)} border-transparent border-b-2 focus:border-emerald-400/90`}
          disabled={readonly}
          onFocus={() => clearFieldError('authorizedModules')}
        >
          <option value="">--</option>
          {getFilteredModules().map((m) => (
            <option key={m} value={m} className="bg-[#202422] text-white">
              {m}
            </option>
          ))}
        </select>

        {newUser.modules && !readonly && (
          <div className="flex flex-wrap items-center gap-2 mt-3 w-full">
            {getPermissionKeysForModule().map((key) => (
              <label key={key} className="cursor-pointer flex items-center gap-1.5" title={key.toUpperCase()}>
                <input
                  type="checkbox"
                  checked={permissoes[key]}
                  onChange={(e) => setPermissoes((p) => ({ ...p, [key]: e.target.checked }))}
                  className="sr-only"
                />
                <div
                  className={`w-8 h-8 flex items-center justify-center rounded bg-[#2b2b40] border border-gray-600 peer-checked:border-[#10b981] peer-checked:bg-[#10b981]/20 transition-all ${
                    permissoes[key]
                      ? (key === 'creater'
                        ? 'bg-amber-600/12 border border-amber-500/80 ring-2 ring-amber-300/50'
                        : key === 'update'
                        ? 'bg-sky-600/10 border border-sky-500/80 ring-2 ring-sky-300/50'
                        : key === 'delete'
                        ? 'bg-red-600/10 border border-red-500/80 ring-2 ring-red-300/50'
                        : key === 'read'
                        ? 'bg-emerald-500/10 border border-emerald-400/80 ring-2 ring-emerald-300/50'
                        : key === 'password'
                        ? 'bg-violet-600/10 border border-violet-400/80 ring-2 ring-violet-300/50'
                        : key === 'falta'
                        ? 'bg-rose-600/10 border border-rose-500/80 ring-2 ring-rose-300/50'
                        : key === 'time'
                        ? 'bg-cyan-600/10 border border-cyan-500/80 ring-2 ring-cyan-300/50'
                        : key === 'producao'
                        ? 'bg-amber-600/10 border border-amber-500/80 ring-2 ring-amber-300/50'
                        : key === 'folha'
                        ? 'bg-emerald-600/10 border border-emerald-500/80 ring-2 ring-emerald-300/50'
                        : key === 'custos'
                        ? 'bg-amber-600/10 border border-amber-500/80 ring-2 ring-amber-300/50'
                        : key === 'afastamentos'
                        ? 'bg-sky-600/10 border border-sky-500/80 ring-2 ring-sky-300/50'
                        : key === 'config'
                        ? 'bg-indigo-600/10 border border-indigo-500/80 ring-2 ring-indigo-300/50'
                        : '')
                      : 'hover:bg-white/6'
                  }`}
                >
                  {key === 'creater' ? <UserPlus size={22} className={permissoes[key] ? 'text-amber-400' : 'text-gray-500'} /> : null}
                  {key === 'update' ? <Edit size={22} className={permissoes[key] ? 'text-blue-400' : 'text-gray-500'} /> : null}
                  {key === 'delete' ? <Trash2 size={22} className={permissoes[key] ? 'text-red-400' : 'text-gray-500'} /> : null}
                  {key === 'read' ? <Eye size={22} className={permissoes[key] ? 'text-emerald-400' : 'text-gray-500'} /> : null}
                  {key === 'password' ? <RotateCcwKey size={25} className={permissoes[key] ? 'text-violet-400' : 'text-gray-500'} /> : null}
                  {key === 'falta' ? <CalendarX2 size={22} className={permissoes[key] ? 'text-rose-400' : 'text-gray-500'} /> : null}
                  {key === 'time' ? <Clock10 size={22} className={permissoes[key] ? 'text-cyan-400' : 'text-gray-500'} /> : null}
                  {key === 'producao' ? <Factory size={22} className={permissoes[key] ? 'text-amber-400' : 'text-gray-500'} /> : null}
                  {key === 'folha' ? <FileText size={22} className={permissoes[key] ? 'text-emerald-400' : 'text-gray-500'} /> : null}
                  {key === 'custos' ? <DollarSign size={22} className={permissoes[key] ? 'text-amber-400' : 'text-gray-500'} /> : null}
                  {key === 'afastamentos' ? <CalendarDays size={22} className={permissoes[key] ? 'text-sky-400' : 'text-gray-500'} /> : null}
                  {key === 'config' ? <Settings size={22} className={permissoes[key] ? 'text-indigo-400' : 'text-gray-500'} /> : null}
                </div>
              </label>
            ))}

            <button
              type="button"
              onClick={handleAddModule}
              title="Adicionar módulo com permissões"
              className="ml-auto flex items-center justify-center px-3 py-1 rounded-lg bg-transparent border border-gray-600 text-white/90 hover:bg-emerald-500/12 hover:border-emerald-300/80 transition-all shadow-sm"
            >
              <ChevronsRight className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        )}
      </div>

      {/* Modulos autorizados */}
      <div className="col-span-12 md:col-span-8">
          <label className="text-[10px] text-white/70 mb-1 tracking-[0.18em]">Módulos Autorizados</label>
        <div className={getTagContainerClasses(validationErrors.authorizedModules, 'min-h-[45px] max-h-[112px]')}>
          {getModulesArray().map((m, idx) => (
            <span
              key={idx}
              className="inline-flex items-start gap-2 bg-[#342e4a] text-white text-[11px] px-2 py-1 rounded-md border border-[#50406a] uppercase tracking-wider max-w-full break-words whitespace-normal"
            >
              <span className="break-words whitespace-normal">{m}</span>
              {!readonly && (
                <button
                  type="button"
                  onClick={() => handleRemoveModule(m)}
                  className="w-4 h-4 flex items-center justify-center rounded-md bg-white/5 text-white/80 hover:bg-rose-500/40 ml-1"
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
        {validationErrors.authorizedModules && <span className="text-orange-400 text-xs mt-1 block">⚠ Preencha este campo.</span>}
      </div>

      {createFeedback && (
        <div className="col-span-12 flex justify-center">
          <div className="text-sm text-amber-200 bg-amber-500/10 border border-amber-300/40 rounded-md px-4 py-2 min-w-[320px] text-center">
            {createFeedback}
          </div>
        </div>
      )}

      {/* Footer save */}
      <div className="p-4 border-t border-white/10 col-span-12 md:col-span-12 flex justify-center gap-3 items-center">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors"
          aria-label="Cancelar criação de usuário"
        >
          Cancelar
        </button>

        {!readonly && (
          <button
            type="submit"
            disabled={isCreating}
            className="px-4 py-2 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Criando...' : 'Salvar'}
          </button>
        )}
      </div>
    </form>
  )
}


