import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  KeyRound,
  Pencil,
  RotateCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { hashPasswordPBKDF2, updatePassword } from '../services/authService'
import { loadSession } from '../services/sessionService'

type SortKey = 'name' | 'type_user' | 'status' | 'role' | 'sector'

type UserRow = {
  id: number
  name: string
  username?: string
  type_user: string
  is_authorized: boolean
  job_title?: string
  allowed_sector?: string
  security?: string
  role?: string
  sector?: string
}

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
  const [showCreate, setShowCreate] = useState(false)
  const [createFeedback, setCreateFeedback] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], [])
  const sectorOptions = ['TODOS', 'ABATE', 'RH', 'CONTR QUALIDADE', 'DESOSSA', 'ADMINISTRATIVO', 'MIUDO']
  const [sectorSelection, setSectorSelection] = useState('')
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    type_user: 'Usuario',
    job_title: '',
    allowed_sector: '',
    date_registration: todayIso,
    is_authorized: true,
    authorizedSector: '',
    modules: '',
    authorizedModules: '',
    security: [] as string[],
  })
  useEffect(() => {
    const fetchUsers = async () => {
      if (!supabaseUrl || !supabaseKey) return
      try {
        const url = new URL(`${supabaseUrl}/rest/v1/user_registration`)
        url.searchParams.set('select', 'id,name,username,type_user,is_authorized,job_title,allowed_sector,security')
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
      alert('Senha padrao (VITE_SENHA_PADRAO) nao configurada.')
      return
    }
    try {
      setIsResettingId(user.id)
      const hashed = defaultPassword.startsWith('pbkdf2:') ? defaultPassword : await hashPasswordPBKDF2(defaultPassword)
      await updatePassword(user.id, hashed)
      setConfirmUser(null)
    } catch (error) {
      console.error('Erro ao redefinir senha:', error)
      alert('Nao foi possivel redefinir a senha.')
    } finally {
      setIsResettingId(null)
    }
  }

  const deleteUser = async (user: UserRow) => {
    if (!supabaseUrl || !supabaseKey) {
      alert('Config da base ausente.')
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
    } catch (error) {
      console.error('Erro ao deletar usuario:', error)
      alert('Nao foi possivel deletar o usuario.')
    } finally {
      setIsDeletingId(null)
    }
  }

  const handleCreateSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreateFeedback(null)
    if (!supabaseUrl || !supabaseKey) {
      setCreateFeedback('Configuração do banco ausente.')
      return
    }
    if (!newUser.name || !newUser.username) {
      setCreateFeedback('Preencha nome e usuario.')
      return
    }
    if (!defaultPassword) {
      setCreateFeedback('Senha padrao (VITE_SENHA_PADRAO) nao configurada.')
      return
    }
    try {
      setIsCreating(true)
      const hashed = defaultPassword.startsWith('pbkdf2:')
        ? defaultPassword
        : await hashPasswordPBKDF2(defaultPassword)
      const insertUrl = new URL(`${supabaseUrl}/rest/v1/user_registration`)
      const payload = {
        name: newUser.name,
        username: newUser.username.trim().toUpperCase(),
        type_user: newUser.type_user,
        is_authorized: newUser.is_authorized,
        job_title: newUser.job_title,
        allowed_sector: newUser.allowed_sector,
        security: newUser.security.join(','),
        password: hashed,
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
        type_user: 'Usuario',
        job_title: '',
        allowed_sector: '',
        authorizedSector: '',
        is_authorized: true,
        security: [],
        modules: '',
        authorizedModules: '',
      })
      setSectorSelection('')
    } catch (error) {
      console.error('Erro ao criar usuario:', error)
      setCreateFeedback('Nao foi possivel criar o usuario.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
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
            <div className="flex justify-end gap-3">
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

      {confirmDelete && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-white/15 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-400/60 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white text-lg font-semibold">Excluir usuario</h3>
                <p className="text-white/70 text-sm">
                  Confirmar exclusao de <span className="text-white font-semibold">{confirmDelete.name}</span>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors"
                onClick={() => setConfirmDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-rose-500 text-white font-semibold hover:bg-rose-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => confirmDelete && deleteUser(confirmDelete)}
                disabled={isDeletingId === confirmDelete.id}
              >
                {isDeletingId === confirmDelete.id ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {!showCreate && (
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex items-center bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white">
              <Search className="w-4 h-4 text-white/70 mr-2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome..."
                className="flex-1 bg-transparent border-none outline-none placeholder:text-white/50 text-sm text-white"
              />
            </div>
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="bg-white/10 border border-white/15 text-white text-sm rounded-lg px-3 py-2 outline-none"
            >
              <option value="todos">Todos os perfis</option>
              <option value="usuario">Usuario</option>
              <option value="administrador">Administrador</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/10 border border-white/15 text-white text-sm rounded-lg px-3 py-2 outline-none"
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

        {!showCreate ? (
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
                        Usuario
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
                      <td className="py-1 px-1 align-top text-xs text-white/85 border-r border-white/10 hidden md:table-cell">
                        {user.type_user}
                      </td>
                      <td className="py-1 px-1 align-top border-r border-white/10 hidden md:table-cell">
                        <span
                          className={`text-xs font-semibold ${
                            user.is_authorized ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {user.is_authorized ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-1 px-1 align-top text-white border-r border-white/10 hidden lg:table-cell">
                        {user.role}
                      </td>
                      <td className="py-1 px-1 align-top text-white border-r border-white/10 hidden lg:table-cell">
                        {user.sector}
                      </td>
                      <td className="py-1 px-0 align-top">
                        <div className="flex items-center justify-center gap-0 text-white/80">
                          {canUpdate && (
                            <>
                              <button className="p-1 rounded hover:bg-white/10 transition-colors" title="Editar">
                                <Pencil className="w-4 h-4 text-blue-300" />
                              </button>
                              <button className="p-1 rounded hover:bg-white/10 transition-colors" title="Atualizar">
                                <RotateCw className="w-4 h-4 text-emerald-300" />
                              </button>
                            </>
                          )}
                          {canPassword && (
                            <button
                              className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => setConfirmUser(user)}
                              disabled={isResettingId === user.id}
                              title="Redefinir senha"
                            >
                              <KeyRound className="w-4 h-4 text-cyan-300" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="p-1 rounded hover:bg-white/10 transition-colors"
                              title="Excluir"
                              onClick={() => setConfirmDelete(user)}
                              disabled={isDeletingId === user.id}
                            >
                              <Trash2 className="w-4 h-4 text-rose-300" />
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
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 shadow-inner shadow-black/30">
            <div className="-mx-4 -mt-4 px-4 py-2 bg-slate-900 rounded-t-lg border-b border-white/10 flex items-center justify-between">
              <span className="text-white font-semibold text-sm">
                FICHAS - Cadastro de {newUser.name || 'Usuario'}
              </span>
              <button
                type="button"
                className="p-2 rounded-md bg-white/5 border border-white/10 text-white/80 hover:bg-rose-500/20 hover:border-rose-400/60 hover:text-rose-200 transition-colors"
                title="Fechar ficha"
                onClick={() => {
                  setShowCreate(false)
                  setCreateFeedback(null)
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-4 -mt-4" onSubmit={handleCreateSubmit}>
              <div className="col-span-1 md:col-span-8">
                <label className="text-white/80 text-sm mb-1 block">Nome completo</label>
                <input
                  className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2 text-white outline-none"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
              </div>
              <div className="md:col-span-4">
                <label className="text-white/80 text-sm mb-1 block">Usuario</label>
                <input
                  className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2 text-white outline-none"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                />
              </div>
              <div className="md:col-span-6">
                <label className="text-white/80 text-sm mb-1 block">Cargo</label>
                <input
                  className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2 text-white outline-none"
                  value={newUser.job_title}
                  onChange={(e) => setNewUser({ ...newUser, job_title: e.target.value })}
                />
              </div>
              <div className="md:col-span-4">
                <label className="text-white/80 text-sm mb-1 block">Perfil</label>
                <select
                  className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2 text-white outline-none"
                  value={newUser.type_user}
                  onChange={(e) => setNewUser({ ...newUser, type_user: e.target.value })}
                >
                  <option value="Usuario">Usuario</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-white/80 text-sm mb-1 block">Data de Registro</label>
                <input
                  type="date"
                  className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2 text-white outline-none"
                  value={newUser.date_registration}
                  readOnly
                />
              </div>
              <div className="md:col-span-4">
                <label className="text-white/80 text-sm mb-1 block">Setor</label>
                <select
                  className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2 text-white outline-none"
                  value={sectorSelection}
                  onChange={(e) => {
                    const selected = e.target.value
                    if (!selected) return
                    const current = newUser.authorizedSector
                      ? newUser.authorizedSector.split(',').map((s) => s.trim()).filter(Boolean)
                      : []
                    if (current.includes(selected)) {
                    setSectorSelection('')
                    return
                  }
                  const nextList = [...current, selected]
                  const csv = nextList.join(', ')
                    setNewUser({ ...newUser, allowed_sector: csv, authorizedSector: csv })
                    setSectorSelection('')
                  }}
                >
                  <option value="" hidden>
                    --
                  </option>
                  {sectorOptions.map((opt) => {
                    const current = newUser.authorizedSector
                      ? newUser.authorizedSector.split(',').map((s) => s.trim()).filter(Boolean)
                      : []
                    return (
                      <option key={opt} value={opt} disabled={current.includes(opt)}>
                        {opt}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="md:col-span-8">
                <label className="text-white/80 text-sm mb-1 block">Setor Autorizado</label>
                <textarea
                  className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2 text-white outline-none resize-y min-h-[38px]"
                  value={newUser.authorizedSector}
                  readOnly
                />
              </div>
              <div className="md:col-span-4">
                <label className="text-white/80 text-sm mb-1 block">Metodos</label>
                <select
                  className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2 text-white outline-none"
                  value={newUser.modules}
                  onChange={(e) => setNewUser({ ...newUser, modules: e.target.value })}
                >
                  <option value="">Selecione</option>
                  <option value="Metodo A">Metodo A</option>
                  <option value="Metodo B">Metodo B</option>
                  <option value="Metodo C">Metodo C</option>
                </select>
              </div>
              <div className="md:col-span-6">
                <p className="text-white/80 text-sm mb-1 block">Permissoes (Security)</p>
                <div className="grid grid-cols-6 gap-6">
                  {['CREATER', 'UPDATE', 'DELETE', 'READ', 'PASSWORD'].map((perm) => (
                    <label key={perm} className="flex items-center gap-2 text-white/80 text-sm">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={newUser.security.includes(perm)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUser({ ...newUser, security: [...newUser.security, perm] })
                          } else {
                            setNewUser({
                              ...newUser,
                              security: newUser.security.filter((p) => p !== perm),
                            })
                          }
                        }}
                      />
                      {perm}
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 flex items-end">
                <button
                  type="button"
                  className="w-full px-4 py-2 rounded-md bg-white/10 border border-white/15 text-white hover:bg-emerald-500/20 hover:border-emerald-300/40 transition-colors"
                  title="Adicionar"
                >
                  Adicionar
                </button>
              </div>
              <div className="md:col-span-12">
                <label className="text-white/80 text-sm mb-1 block">Observações</label>
                <textarea
                  className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2 text-white outline-none resize-y min-h-[60px]"
                  value={newUser.authorizedModules}
                  onChange={(e) => setNewUser({ ...newUser, authorizedModules: e.target.value })}
                />
              </div>
              {createFeedback && (
                <div className="md:col-span-2 text-sm text-amber-200 bg-amber-500/10 border border-amber-300/40 rounded-md px-3 py-2">
                  {createFeedback}
                </div>
              )}
              <div className="md:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-md bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors"
                  onClick={() => {
                    setShowCreate(false)
                    setCreateFeedback(null)
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isCreating}
                >
                  {isCreating ? 'Criando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default Security
