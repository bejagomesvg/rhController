import React, { useEffect, useMemo, useState } from 'react'
import { toast, Toaster } from 'react-hot-toast'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Eye,
  RotateCcwKey,
  Edit,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import { hashPasswordPBKDF2, updatePassword, verifyPassword } from '../services/authService'
import { loadSession } from '../services/sessionService'
import { fetchEmployeeNameSuggestions, fetchEmployeeSectors } from '../services/employeeService'
import { getFullModulesPayload, MODULE_MAPPING } from '../utils/moduleParser'
import UserForm from '../components/UserForm'
import type { NewUserData } from '../components/UserForm'
import type { UserRow } from '../models/user'

type SortKey = 'name' | 'type_user' | 'status' | 'role' | 'sector'

interface SecurityProps {
  onBack: () => void
  userName?: string
  userRole?: string
  title?: string
  description?: string
}

const Security: React.FC<SecurityProps> = ({
  onBack,
  userName = 'Usuario',
  userRole = 'Perfil nao informado',
  title = 'Seguranca',
  description = 'Controle de acesso e firewall.',
}) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
  const defaultPassword = import.meta.env.VITE_SENHA_PADRAO

  const sessionUser = loadSession()
  const sessionPerms = useMemo(() => {
    const raw = typeof sessionUser?.security === 'string' ? sessionUser.security : ''
    return raw
      .split(',')
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean)
  }, [sessionUser?.security])
  const canCreate = sessionPerms.includes('CREATER')
  const canUpdate = sessionPerms.includes('UPDATE')
  const canDelete = sessionPerms.includes('DELETE')
  const canPassword = sessionPerms.includes('PASSWORD')

  const [usersData, setUsersData] = useState<UserRow[]>([])
  const [query, setQuery] = useState('')
  const [profileFilter, setProfileFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [isResettingId, setIsResettingId] = useState<number | null>(null)
  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null)
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePasswordError, setDeletePasswordError] = useState<'required' | 'invalid' | null>(null)
  const [deletePasswordAttempts, setDeletePasswordAttempts] = useState(0)
  const [confirmStatusUser, setConfirmStatusUser] = useState<UserRow | null>(null)
  const [statusPassword, setStatusPassword] = useState('')
  const [statusPasswordError, setStatusPasswordError] = useState<'required' | 'invalid' | null>(null)
  const [statusPasswordAttempts, setStatusPasswordAttempts] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [createFeedback, setCreateFeedback] = useState<string | null>(null)
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showViewEdit, setShowViewEdit] = useState(false)
  const [viewEditMode, setViewEditMode] = useState<'view' | 'edit'>('view')
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [sectorOptions, setSectorOptions] = useState<string[]>([])
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], [])
  // previously had sectorOptions / sectorSelection here - not used by this view anymore
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    type_user: '',
    job_title: '',
    allowed_sector: '',
    date_registration: todayIso,
    is_authorized: true,
    authorizedSector: '',
    modules: '',
    authorizedModules: '',
    security: [] as string[],
  })

  // Estado separado para edição do usuário
  const [editingUser, setEditingUser] = useState<NewUserData>({
    name: '',
    username: '',
    type_user: 'Usuario',
    job_title: '',
    allowed_sector: '',
    date_registration: '',
    is_authorized: true,
    authorizedSector: '',
    modules: '',
    authorizedModules: '',
    security: [] as string[],
  })

  // Recupera o estado de showCreate do localStorage
  useEffect(() => {
    const storedShowCreate = window.localStorage.getItem('rh_showCreate') === 'true'
    if (storedShowCreate) {
      setShowCreate(true)
    }
  }, [])

  // Salva o estado de showCreate no localStorage
  useEffect(() => {
    window.localStorage.setItem('rh_showCreate', showCreate.toString())
  }, [showCreate])

  const fetchNameSuggestions = React.useCallback(
    async (query: string) => {
      const result = await fetchEmployeeNameSuggestions(supabaseUrl, supabaseKey, query, 5, 7)
      if (!result.ok) {
        console.error('Erro ao buscar nomes de funcionarios:', result.error)
        return []
      }
      return result.suggestions
    },
    [supabaseKey, supabaseUrl],
  )

  useEffect(() => {
    const fetchSectors = async () => {
      if (!supabaseUrl || !supabaseKey) return
      const result = await fetchEmployeeSectors(supabaseUrl, supabaseKey, 7)
      if (!result.ok) {
        console.error('Erro ao carregar setores:', result.error)
        setSectorOptions([])
        return
      }
      setSectorOptions(result.sectors)
    }
    fetchSectors()
  }, [supabaseKey, supabaseUrl])
  useEffect(() => {
    const fetchUsers = async () => {
      if (!supabaseUrl || !supabaseKey) return
      try {
        const url = new URL(`${supabaseUrl}/rest/v1/user_registration`)
        url.searchParams.set('select', 'id,name,username,type_user,is_authorized,job_title,allowed_sector,security,evaluation,database,benefits,table_load,communication,development,shift_schedule_and_vacation,payroll,infrastructure,operations,recruitment,health_and_safety,security,training')
        url.searchParams.set('order', 'name.asc')

        const response = await fetch(url.toString(), {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        })
        if (!response.ok) throw new Error(`Supabase response ${response.status}`)
        const data = (await response.json()) as UserRow[]
        setUsersData(
          data.map((u) => ({
            ...u,
            role: u.job_title || '',
            sector: u.allowed_sector || '',
          })),
        )
      } catch (error) {
        console.error('Erro ao carregar usuarios:', error)
      }
    }
    fetchUsers()
  }, [supabaseKey, supabaseUrl])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = usersData.filter((user) => {
      const matchesQuery = !q || user.name.toLowerCase().includes(q)
      const matchesProfile = profileFilter === 'todos' || user.type_user.toLowerCase() === profileFilter
      const matchesStatus =
        statusFilter === 'todos' || (statusFilter === 'ativos' ? user.is_authorized : !user.is_authorized)
      return matchesQuery && matchesProfile && matchesStatus
    })
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'name') return (a.name || '').localeCompare(b.name || '') * dir
      if (sortKey === 'type_user') return (a.type_user || '').localeCompare(b.type_user || '') * dir
      if (sortKey === 'role') return (a.role || '').localeCompare(b.role || '') * dir
      if (sortKey === 'sector') return (a.sector || '').localeCompare(b.sector || '') * dir
      if (sortKey === 'status') return (Number(a.is_authorized) - Number(b.is_authorized)) * dir
      return 0
    })
    return sorted
  }, [query, profileFilter, statusFilter, sortDir, sortKey, usersData])

  const renderSortIcon = (key: SortKey) => {
    const active = sortKey === key
    const activeColor = active ? 'text-emerald-300' : 'text-white/80'
    if (!active) return <ChevronsUpDown className={`w-4 h-4 ${activeColor}`} />
    if (sortDir === 'asc') return <ChevronDown className={`w-4 h-4 ${activeColor}`} />
    return <ChevronUp className={`w-4 h-4 ${activeColor}`} />
  }

  const resetPassword = async (user: UserRow) => {
    if (!defaultPassword) {
      toast.error('Senha padrao (VITE_SENHA_PADRAO) nao configurada.')
      return
    }
    try {
      setIsResettingId(user.id)
      const hashed = defaultPassword.startsWith('pbkdf2:') ? defaultPassword : await hashPasswordPBKDF2(defaultPassword)
      await updatePassword(user.id, hashed)
      toast.success('Senha redefinida com sucesso!')
      setConfirmUser(null)
    } catch (error) {
      console.error('Erro ao redefinir senha:', error)
      toast.error('Nao foi possivel redefinir a senha.')
    } finally {
      setIsResettingId(null)
    }
  }

  const deleteUser = async (user: UserRow) => {
    if (!supabaseUrl || !supabaseKey) {
      toast.error('Config da base ausente.')
      return
    }
    try {
      setIsDeletingId(user.id)
      const url = new URL(`${supabaseUrl}/rest/v1/user_registration`)
      url.searchParams.set('id', `eq.${user.id}`)
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      })
      if (!response.ok) throw new Error(`Supabase delete ${response.status}`)
      setUsersData((prev) => prev.filter((u) => u.id !== user.id))
      setConfirmDelete(null)
      toast.success('Usuario excluido com sucesso!')
    } catch (error) {
      console.error('Erro ao deletar usuario:', error)
      toast.error('Nao foi possivel deletar o usuario.')
    } finally {
      setIsDeletingId(null)
    }
  }

  const openDeleteConfirm = (user: UserRow) => {
    setConfirmDelete(user)
    setDeletePassword('')
    setDeletePasswordError(null)
    setDeletePasswordAttempts(0)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    if (!deletePassword.trim()) {
      setDeletePasswordError('required')
      setDeletePasswordAttempts((prev) => prev + 1)
      return
    }
    if (!sessionUser?.password) {
      toast.error('Senha da sessao indisponivel.')
      return
    }
    const ok = await verifyPassword(deletePassword, sessionUser.password)
    if (!ok) {
      setDeletePasswordError('invalid')
      setDeletePasswordAttempts((prev) => prev + 1)
      return
    }
    await deleteUser(confirmDelete)
    setDeletePassword('')
    setDeletePasswordError(null)
    setDeletePasswordAttempts(0)
  }

  const openStatusConfirm = (user: UserRow) => {
    if (!canUpdate) return
    setConfirmStatusUser(user)
    setStatusPassword('')
    setStatusPasswordError(null)
    setStatusPasswordAttempts(0)
  }

  const handleToggleStatus = async () => {
    if (!confirmStatusUser) return
    if (!statusPassword.trim()) {
      setStatusPasswordError('required')
      setStatusPasswordAttempts((prev) => prev + 1)
      return
    }
    if (!sessionUser?.password) {
      toast.error('Senha da sessao indisponivel.')
      return
    }
    const ok = await verifyPassword(statusPassword, sessionUser.password)
    if (!ok) {
      setStatusPasswordError('invalid')
      setStatusPasswordAttempts((prev) => prev + 1)
      return
    }
    if (!supabaseUrl || !supabaseKey) {
      toast.error('Config da base ausente.')
      return
    }
    try {
      const nextStatus = !confirmStatusUser.is_authorized
      const updateUrl = new URL(`${supabaseUrl}/rest/v1/user_registration`)
      updateUrl.searchParams.set('id', `eq.${confirmStatusUser.id}`)
      const response = await fetch(updateUrl.toString(), {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ is_authorized: nextStatus }),
      })
      if (!response.ok) throw new Error(`Supabase update ${response.status}`)
      const [updated] = (await response.json()) as UserRow[]
      setUsersData((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, is_authorized: updated.is_authorized } : u)),
      )
      toast.success('Status atualizado com sucesso!')
      setConfirmStatusUser(null)
      setStatusPassword('')
      setStatusPasswordError(null)
      setStatusPasswordAttempts(0)
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Nao foi possivel atualizar o status.')
    }
  }

  const handleViewUser = (user: UserRow) => {
    // Reconstrói os módulos autorizados a partir dos dados do usuário
    const authorizedModulesArray: string[] = []
    const moduleColumns = Object.entries(MODULE_MAPPING).map(([, dbName]) => dbName)
    
    moduleColumns.forEach((dbColumnName) => {
      const permissions = (user as any)[dbColumnName]
      if (permissions) {
        // Encontra o nome português do módulo
        const moduleName = Object.entries(MODULE_MAPPING).find(([, db]) => db === dbColumnName)?.[0]
        if (moduleName) {
          authorizedModulesArray.push(`${moduleName} (${permissions})`)
        }
      }
    })
    
    const userData: NewUserData = {
      name: user.name || '',
      username: user.username || '',
      type_user: (user.type_user || 'USUARIO').toUpperCase(),
      job_title: user.job_title || '',
      allowed_sector: user.allowed_sector || '',
      date_registration: todayIso,
      is_authorized: user.is_authorized,
      authorizedSector: user.allowed_sector || '',
      modules: '',
      authorizedModules: authorizedModulesArray.join('\n'),
      security: user.security ? user.security.split(',').map(s => s.trim()) : [],
    }
    setEditingUser(userData)
    setEditingUserId(user.id)
    setViewEditMode('view')
    setUpdateFeedback(null)
    setShowViewEdit(true)
  }

  const handleEditUser = (user: UserRow) => {
    // Reconstrói os módulos autorizados a partir dos dados do usuário
    const authorizedModulesArray: string[] = []
    const moduleColumns = Object.entries(MODULE_MAPPING).map(([, dbName]) => dbName)
    
    moduleColumns.forEach((dbColumnName) => {
      const permissions = (user as any)[dbColumnName]
      if (permissions) {
        // Encontra o nome português do módulo
        const moduleName = Object.entries(MODULE_MAPPING).find(([, db]) => db === dbColumnName)?.[0]
        if (moduleName) {
          authorizedModulesArray.push(`${moduleName} (${permissions})`)
        }
      }
    })
    
    const userData: NewUserData = {
      name: user.name || '',
      username: user.username || '',
      type_user: (user.type_user || 'USUARIO').toUpperCase(),
      job_title: user.job_title || '',
      allowed_sector: user.allowed_sector || '',
      date_registration: todayIso,
      is_authorized: user.is_authorized,
      authorizedSector: user.allowed_sector || '',
      modules: '',
      authorizedModules: authorizedModulesArray.join('\n'),
      security: user.security ? user.security.split(',').map(s => s.trim()) : [],
    }
    setEditingUser(userData)
    setEditingUserId(user.id)
    setViewEditMode('edit')
    setUpdateFeedback(null)
    setShowViewEdit(true)
  }

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabaseUrl || !supabaseKey || !editingUserId) return
    
    // Validação de campos obrigatórios
    if (!editingUser.name?.trim()) {
      toast.error('NOME COMPLETO eh obrigatorio.')
      return
    }
    if (!editingUser.job_title?.trim()) {
      toast.error('CARGO eh obrigatorio.')
      return
    }
    if (!editingUser.type_user?.trim()) {
      toast.error('PERFIL eh obrigatorio.')
      return
    }
    if (!editingUser.authorizedSector?.trim()) {
      toast.error('SETOR AUTORIZADO eh obrigatorio.')
      return
    }
    if (!editingUser.authorizedModules?.trim()) {
      toast.error('MODULOS AUTORIZADOS eh obrigatorio.')
      return
    }
    
    try {
      setIsCreating(true)
      setUpdateFeedback(null)
      // Processa os modulos autorizados para o formato do banco (preenche null quando removidos)
      const modulesData = getFullModulesPayload(editingUser.authorizedModules)
      
      const payload = {
        name: editingUser.name.toUpperCase(),
        username: (editingUser.username || '').trim().toUpperCase(),
        type_user: editingUser.type_user.toUpperCase(),
        is_authorized: editingUser.is_authorized,
        job_title: editingUser.job_title.toUpperCase(),
        allowed_sector: editingUser.authorizedSector === 'TODOS' ? 'TODOS' : editingUser.authorizedSector,
        security: editingUser.security.join(','),
        ...modulesData,
      }
      
      const updateUrl = new URL(`${supabaseUrl}/rest/v1/user_registration`)
      updateUrl.searchParams.set('id', `eq.${editingUserId}`)
      
      const response = await fetch(updateUrl.toString(), {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(`Supabase update ${response.status}`)
      
      const [updated] = (await response.json()) as UserRow[]
      // Atualiza a lista de usuários
      setUsersData((prev) =>
        prev.map((u) =>
          u.id === editingUserId
            ? { ...updated, role: updated.job_title, sector: updated.allowed_sector }
            : u,
        ),
      )
      setShowViewEdit(false)
      setEditingUserId(null)
      setUpdateFeedback(null)
      toast.success('Usuario atualizado com sucesso!')
    }
    catch (error) {
      console.error('Erro ao atualizar usuario:', error)
      setUpdateFeedback('? Usuario nao disponivel')
      toast.error('Nao foi possivel atualizar o usuario.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreateFeedback(null)
    if (!supabaseUrl || !supabaseKey) {
      setCreateFeedback('Configuracao do banco ausente.')
      toast.error('Configuracao do banco ausente.')
      return
    }
    if (!newUser.name || !newUser.username) {
      setCreateFeedback('Preencha nome e usuario.')
      toast.error('Preencha nome e usuario.')
      return
    }
    if (!newUser.name?.trim()) {
      setCreateFeedback('NOME COMPLETO eh obrigatorio.')
      toast.error('NOME COMPLETO eh obrigatorio.')
      return
    }
    if (!newUser.username?.trim()) {
      setCreateFeedback('USUARIO eh obrigatorio.')
      toast.error('USUARIO eh obrigatorio.')
      return
    }
    if (!newUser.job_title?.trim()) {
      setCreateFeedback('CARGO eh obrigatorio.')
      toast.error('CARGO eh obrigatorio.')
      return
    }
    if (!newUser.type_user?.trim()) {
      setCreateFeedback('PERFIL eh obrigatorio.')
      toast.error('PERFIL eh obrigatorio.')
      return
    }
    if (!newUser.authorizedSector?.trim()) {
      setCreateFeedback('SETOR AUTORIZADO eh obrigatorio.')
      toast.error('SETOR AUTORIZADO eh obrigatorio.')
      return
    }
    if (!newUser.authorizedModules?.trim()) {
      setCreateFeedback('MODULOS AUTORIZADOS eh obrigatorio.')
      toast.error('MODULOS AUTORIZADOS eh obrigatorio.')
      return
    }
    if (newUser.username.includes(' ')) {
      setCreateFeedback('Username nao pode conter espacos.')
      toast.error('Username nao pode conter espacos.')
      return
    }
    if (!defaultPassword) {
      setCreateFeedback('Senha padrao (VITE_SENHA_PADRAO) nao configurada.')
      toast.error('Senha padrao (VITE_SENHA_PADRAO) nao configurada.')
      return
    }
    try {
      setIsCreating(true)
      setUpdateFeedback(null)
      const hashed = defaultPassword.startsWith('pbkdf2:')
        ? defaultPassword
        : await hashPasswordPBKDF2(defaultPassword)
      const insertUrl = new URL(`${supabaseUrl}/rest/v1/user_registration`)
      
      // Processa os modulos autorizados para o formato do banco (preenche null quando removidos)
      const modulesData = getFullModulesPayload(newUser.authorizedModules)
      
      const payload = {
        name: newUser.name.toUpperCase(),
        username: newUser.username.trim().toUpperCase(),
        type_user: newUser.type_user.toUpperCase(),
        is_authorized: newUser.is_authorized,
        job_title: newUser.job_title.toUpperCase(),
        allowed_sector: newUser.authorizedSector === 'TODOS' ? 'TODOS' : newUser.authorizedSector,
        security: newUser.security.join(','),
        password: hashed,
        user_creater: sessionUser?.username || '',
        ...modulesData,
      }
      const response = await fetch(insertUrl.toString(), {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(`Supabase insert ${response.status}`)
      const [created] = (await response.json()) as UserRow[]
      setUsersData((prev) => [...prev, { ...created, role: created.job_title, sector: created.allowed_sector }])
      setShowCreate(false)
      setCreateFeedback(null)
      setNewUser({
        name: '',
        username: '',
        type_user: '',
        job_title: '',
        allowed_sector: '',
        date_registration: todayIso,
        authorizedSector: '',
        is_authorized: true,
        security: [],
        modules: '',
        authorizedModules: '',
      })
      // reset of local sectorSelection no longer needed
      window.localStorage.removeItem('rh_showCreate')
      toast.success('Usuario criado com sucesso!')
    } catch (error) {
      console.error('Erro ao criar usuario:', error)
      setCreateFeedback('? Usuario nao disponivel')
      toast.error('Nao foi possivel criar o usuario.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-slate-800 text-white border border-white/10 shadow-lg',
          success: { iconTheme: { primary: '#22c55e', secondary: 'white' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: 'white' } },
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white text-2xl font-bold leading-tight">{title}</h2>
          <p className="text-white/70 text-sm mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-3 rounded-xl shadow-inner shadow-black/20">
          <div>
            <p className="text-emerald-300 font-semibold leading-tight">{userName}</p>
            <p className="text-white/60 text-[11px] uppercase tracking-[0.25em]">{userRole}</p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-emerald-100 bg-white/10 border border-white/10 px-3 py-2 rounded-lg hover:bg-emerald-500/20 hover:border-emerald-300/40 transition-colors text-xs font-semibold uppercase tracking-wide"
            title="Voltar para o dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>

      {confirmUser && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-white/15 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-400/60 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white text-lg font-semibold">Redefinir senha</h3>
                <p className="text-white/70 text-sm">
                  Deseja redefinir a senha de <span className="text-white font-semibold">{confirmUser.name}</span>?
                </p>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors"
                onClick={() => setConfirmUser(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={async () => {
                  if (!confirmUser) return
                  await new Promise((resolve) => setTimeout(resolve, 700))
                  resetPassword(confirmUser)
                }}
                disabled={isResettingId === confirmUser.id}
              >
                {isResettingId === confirmUser.id ? 'Redefinindo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewEdit && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 overflow-y-auto">
          <div className="bg-slate-900/90 border border-white/15 rounded-2xl shadow-2xl w-full max-w-4xl p-4 my-4">
            <div className="flex items-center justify-between mb-3 bg-blue-900/30 border border-blue-500/40 px-4 py-3 rounded-lg">
              <h2 className="text-white text-2xl font-bold flex-1 text-center">
                {viewEditMode === 'view' ? 'Visualizar Usuário' : 'Editar Usuário'}
              </h2>
              <button
                onClick={() => {
                  setShowViewEdit(false)
                  setUpdateFeedback(null)
                }}
                className="text-white/60 hover:text-white hover:border-red-400 border border-transparent rounded-lg p-1 transition-all ml-auto"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto">
              <UserForm
                newUser={editingUser}
                setNewUser={setEditingUser}
                isCreating={isCreating}
                createFeedback={updateFeedback}
                availableSectors={sectorOptions}
                fetchNameSuggestions={fetchNameSuggestions}
                lockUsername={viewEditMode === 'edit'}
                onCancel={() => {
                  setShowViewEdit(false)
                  setUpdateFeedback(null)
                }}
                onSubmit={viewEditMode === 'edit' ? handleUpdateUser : (e) => e.preventDefault()}
                readonly={viewEditMode === 'view'}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={Boolean(confirmDelete)}
        title="Excluir usuario"
        description={
          <p>
            Confirmar exclusao de <span className="text-white font-semibold">{confirmDelete?.name}</span>?
          </p>
        }
        passwordLabel="Confirmar com senha"
        passwordValue={deletePassword}
        passwordError={deletePasswordError}
        attempts={deletePasswordAttempts}
        onPasswordChange={(value) => {
          setDeletePassword(value)
          if (deletePasswordError) setDeletePasswordError(null)
        }}
        onCancel={() => {
          setConfirmDelete(null)
          setDeletePassword('')
          setDeletePasswordError(null)
          setDeletePasswordAttempts(0)
        }}
        onConfirm={handleConfirmDelete}
        confirmLabel={isDeletingId ? 'Excluindo...' : 'Excluir'}
      />

      <ConfirmDeleteModal
        open={Boolean(confirmStatusUser)}
        title="Alterar status do usuario"
        description={
          <p>
            Confirmar a alteracao de status de <span className="text-white font-semibold">{confirmStatusUser?.name}</span>{' '}
            para{' '}
            <span className="text-white font-semibold">
              {confirmStatusUser?.is_authorized ? 'Inativo' : 'Ativo'}
            </span>
            ?
          </p>
        }
        passwordLabel="Confirmar com senha"
        passwordValue={statusPassword}
        passwordError={statusPasswordError}
        attempts={statusPasswordAttempts}
        onPasswordChange={(value) => {
          setStatusPassword(value)
          if (statusPasswordError) setStatusPasswordError(null)
        }}
        onCancel={() => {
          setConfirmStatusUser(null)
          setStatusPassword('')
          setStatusPasswordError(null)
          setStatusPasswordAttempts(0)
        }}
        onConfirm={handleToggleStatus}
        confirmLabel="Confirmar"
      />

      <div className="space-y-3">
        {!showCreate && (
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex items-center bg-white/10 border border-white/15 rounded-lg px-3 text-white h-11">
              <Search className="w-4 h-4 text-white/70 mr-2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome..."
                className="flex-1 bg-transparent border-none outline-none placeholder:text-white/50 text-sm text-white h-full"
              />
            </div>
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="bg-white/10 border border-white/15 text-white text-sm rounded-lg px-3 h-11 outline-none"
            >
              <option value="todos">Todos os perfis</option>
              <option value="usuario">Usuario</option>
              <option value="administrador">Administrador</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/10 border border-white/15 text-white text-sm rounded-lg px-3 h-11 outline-none"
            >
              <option value="todos">Todos os status</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
            {canCreate && (
              <button
                className="flex items-center gap-2 text-yellow-600 bg-white/10 border border-yellow-400 px-3 py-2 rounded-lg hover:bg-amber-500/20 hover:border-amber-300/40 transition-colors text-xs font-semibold uppercase tracking-wide"
                title="Criar usuario"
                onClick={() => {
                  setShowCreate(true)
                  setCreateFeedback(null)
                }}
              >
                <UserPlus className="w-5 h-5" />
                Criar
              </button>
            )}
          </div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-lg p-0 shadow-inner shadow-black/30 overflow-hidden">
          <div className="h-[400px] overflow-y-auto overflow-x-hidden">
              <table className="table-auto w-full text-left text-sm text-white/80 border-collapse">
                <thead className="text-white/70 uppercase text-xs bg-slate-900 sticky top-0 z-20">
                  <tr>
                    <th className="py-2 px-1 font-semibold text-center border-b border-white/10">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 text-white/80 hover:text-white transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        {renderSortIcon('name')}
                        Nome Completo
                      </button>
                    </th>
                    <th className="py-2 px-1 font-semibold text-center border-b border-white/10 hidden md:table-cell">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 text-white/80 hover:text-white transition-colors"
                        onClick={() => handleSort('type_user')}
                      >
                        {renderSortIcon('type_user')}
                        Perfil
                      </button>
                    </th>
                    <th className="py-2 px-1 font-semibold text-center border-b border-white/10 hidden md:table-cell">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 text-white/80 hover:text-white transition-colors"
                        onClick={() => handleSort('status')}
                      >
                        {renderSortIcon('status')}
                        Status
                      </button>
                    </th>
                    <th className="py-2 px-1 font-semibold text-center border-b border-white/10 hidden lg:table-cell">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 text-white/80 hover:text-white transition-colors"
                        onClick={() => handleSort('role')}
                      >
                        {renderSortIcon('role')}
                        Cargos
                      </button>
                    </th>
                    <th className="py-2 px-1 font-semibold text-center border-b border-white/10 hidden lg:table-cell">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 text-white/80 hover:text-white transition-colors"
                        onClick={() => handleSort('sector')}
                      >
                        {renderSortIcon('sector')}
                        Setor
                      </button>
                    </th>
                    <th className="py-2 px-1 font-semibold text-center border-b border-white/10">Acoes</th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-emerald-500/5 transition-colors border-b border-white/10 text-sm">
                      <td className="py-1.5 px-3 text-white text-left border-r border-white/10">{user.name}</td>
                      <td className="py-1 px-1 align-center text-xs text-white/85 border-r border-white/10 hidden md:table-cell">
                        {user.type_user}
                      </td>
                      <td className="py-1 px-1 align-center border-r border-white/10 hidden md:table-cell">
                        <span
                          className={`text-xs font-semibold ${
                            user.is_authorized ? 'text-emerald-300' : 'text-rose-300'
                          } ${canUpdate ? 'cursor-pointer' : ''}`}
                          title={canUpdate ? 'Duplo clique para alterar status' : undefined}
                          onDoubleClick={() => openStatusConfirm(user)}
                        >
                          {user.is_authorized ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-1 px-1 align-center text-white border-r border-white/10 hidden lg:table-cell">
                        {user.role}
                      </td>
                      <td className="py-1 px-1 align-center text-white border-r border-white/10 hidden lg:table-cell">
                        {user.sector}
                      </td>
                      <td className="py-1 px-0 align-center">
                        <div className="flex items-center justify-center gap-0 text-white/80">
                          {canUpdate && (
                            <>
                              <button
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                                onClick={() => handleEditUser(user)}
                                title="Editar usuário"
                              >
                                <Edit className="w-5 h-5 text-blue-400" /> 
                              </button>
                              <button
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                                onClick={() => handleViewUser(user)}
                                title="Visualizar detalhes"
                              >
                                <Eye className="w-5 h-5 text-emerald-400" />
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              className="p-1 rounded hover:bg-white/10 transition-colors"
                              title="Excluir"
                              onClick={() => openDeleteConfirm(user)}
                              disabled={isDeletingId === user.id}
                            >
                              <Trash2 className="w-5 h-5 text-red-400" />
                            </button>
                          )}
                          {canPassword && (
                            <button
                              className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => setConfirmUser(user)}
                              disabled={isResettingId === user.id}
                              title="Redefinir senha"
                            >
                              <RotateCcwKey className="w-5 h-5 text-violet-400" />
                            </button>
                          )}
                         {!canUpdate && !canPassword && !canDelete && (
                            <span className="text-white/50 text-xs">--</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

      {showCreate && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 overflow-y-auto">
          <div className="bg-slate-900/90 border border-white/15 rounded-2xl shadow-2xl w-full max-w-4xl p-4 my-4">
            <div className="flex items-center justify-between mb-3 bg-blue-900/30 border border-blue-500/40 px-4 py-3 rounded-lg">
              <h2 className="text-white text-2xl font-bold flex-1 text-center">
                Criar Usuário
              </h2>
              <button
                onClick={() => {
                  setShowCreate(false)
                  setCreateFeedback(null)
                }}
                className="text-white/60 hover:text-white hover:border-red-400 border border-transparent rounded-lg p-1 transition-all ml-auto"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto">
              <UserForm
                newUser={newUser}
                setNewUser={setNewUser}
                isCreating={isCreating}
                createFeedback={createFeedback}
                availableSectors={sectorOptions}
                fetchNameSuggestions={fetchNameSuggestions}
                onCancel={() => {
                  setShowCreate(false)
                  setCreateFeedback(null)
                  window.localStorage.removeItem('rh_showCreate')
                }}
                onSubmit={handleCreateSubmit}
              />
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default Security



















