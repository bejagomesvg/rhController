import React, { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import {
  AlertTriangle,
  Check,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  ShieldUser,
  UserRound,
  ArrowLeft,
  Table,
  Users,
  FileText,
  Award,
  Calendar,
  TrendingUp,
  MessageCircle,
  HeartPulse,
  Gift,
  Server,
  Code2,
  Database,
  FactoryIcon,
} from 'lucide-react'
import Dashboard from './views/Dashboard'
import './style.css'
import type { UserRegistration } from './models/user'
import {
  fetchUserByUsername,
  hashPasswordPBKDF2,
  isDefaultPassword,
  normalizeUsername,
  updateLastAccess,
  updatePassword,
  verifyPassword,
} from './services/authService'
import { clearSession, loadSession, saveSession } from './services/sessionService'
import Security from './views/Security'
import TableLoad from './views/Table_load'
import Operations from './views/Operations'
import Payroll from './views/Payroll'

type Mode = 'login' | 'set-password' | 'dashboard' | 'security'

export function App(): ReactElement {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  })
  const savedSession = loadSession()
  const [mode, setMode] = useState<Mode>(() => {
    if (!savedSession) return 'login'
    if (typeof window === 'undefined') return 'dashboard'
    const storedMode = window.localStorage.getItem('rh_mode') as Mode | null
    return storedMode === 'security' || storedMode === 'dashboard' ? storedMode : 'dashboard'
  })
  const [securityCard, setSecurityCard] = useState<{ title: string; description: string; accent?: string } | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = window.localStorage.getItem('rh_security_card')
      return stored ? (JSON.parse(stored) as { title: string; description: string; accent?: string }) : null
    } catch {
      return null
    }
  })
  const [pendingUser, setPendingUser] = useState<{ id: number; username: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<UserRegistration | null>(savedSession)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
  const isSetPassword = mode === 'set-password'
  const isDashboard = mode === 'dashboard' || mode === 'security'
  const allowedModules = currentUser
    ? {
        recruitment: currentUser.recruitment,
        payroll: currentUser.payroll,
        training: currentUser.training,
        shift_schedule_and_vacation: currentUser.shift_schedule_and_vacation,
        evaluation: currentUser.evaluation,
        communication: currentUser.communication,
        health_and_safety: currentUser.health_and_safety,
        benefits: currentUser.benefits,
        development: currentUser.development,
        infrastructure: currentUser.infrastructure,
        security: currentUser.security,
        database: currentUser.database,
        table_load: currentUser.table_load,
        operations: currentUser.operations,
      }
    : undefined

  function resetFeedback() {
    setFeedback({ type: null, message: '' })
  }

  function handleLogout() {
    setMode('login')
    setCurrentUser(null)
    setPendingUser(null)
    setSecurityCard(null)
    setUsername('')
    setPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setRememberMe(false)
    resetFeedback()
    clearSession()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) return
    const normalizedUsername = normalizeUsername(username)
    if (!normalizedUsername || !password) {
      setFeedback({
        type: 'error',
        message: 'Informe usuário e senha para continuar.',
      })
      return
    }

    setIsLoading(true)
    resetFeedback()

    try {
      const user = await fetchUserByUsername(normalizedUsername)
      if (!user) {
        setFeedback({
          type: 'error',
          message: 'Usuário não encontrado.',
        })
        return
      }

      if (!user.password) {
        setMode('set-password')
        setPendingUser({ id: user.id, username: user.username })
        setFeedback({
          type: 'error',
          message: 'Senha não definida. Cadastre uma nova senha.',
        })
        return
      }

      if (await isDefaultPassword(user.password)) {
        const matchesDefault = await verifyPassword(password, user.password)
        if (matchesDefault) {
          setMode('set-password')
          setPendingUser({ id: user.id, username: user.username })
          setFeedback({
            type: 'error',
            message: 'Senha padrão em uso. Defina uma nova senha.',
          })
        } else {
          setFeedback({
            type: 'error',
            message: 'Usuário ou senha inválidos.',
          })
        }
        return
      }

      const isValidPassword = await verifyPassword(password, user.password)

      if (!isValidPassword) {
        setFeedback({
          type: 'error',
          message: 'Usuário ou senha inválidos.',
        })
        return
      }

      if (!user.is_authorized) {
        setFeedback({
          type: 'error',
          message: 'Usuário sem autorização. Procure um administrador.',
        })
        return
      }

      resetFeedback()
      setCurrentUser(user)
      setMode('dashboard')
      saveSession(user)
      updateLastAccess(user.id)
      setPassword('')
    } catch (error) {
      console.error('Erro ao validar usuário no Supabase:', error)
      setFeedback({
        type: 'error',
        message:
          error instanceof Error && error.message.includes('Configuração do banco')
            ? 'Configuração do banco ausente. Verifique o arquivo .env.'
            : 'Erro ao acessar o servidor. Tente novamente.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading || !pendingUser) return

    if (!newPassword || newPassword.length < 6) {
      setFeedback({
        type: 'error',
        message: 'A nova senha deve ter ao menos 6 caracteres.',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        type: 'error',
        message: 'As senhas não conferem.',
      })
      return
    }

    setIsLoading(true)
    resetFeedback()

    try {
      const hashedPassword = await hashPasswordPBKDF2(newPassword)
      await updatePassword(pendingUser.id, hashedPassword)

      setFeedback({
        type: 'success',
        message: 'Senha cadastrada com sucesso. Faça login novamente.',
      })
      setMode('login')
      setPendingUser(null)
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Erro ao salvar nova senha:', error)
      setFeedback({
        type: 'error',
        message:
          error instanceof Error && error.message.includes('Configuração do banco')
            ? 'Configuração do banco ausente. Verifique o arquivo .env.'
            : 'Não foi possível salvar a nova senha. Tente novamente.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!feedback.message) return
    const timer = window.setTimeout(() => {
      setFeedback({ type: null, message: '' })
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [feedback.message])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('rh_mode', mode)
  }, [mode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (securityCard) {
      window.localStorage.setItem('rh_security_card', JSON.stringify(securityCard))
    } else {
      window.localStorage.removeItem('rh_security_card')
    }
  }, [securityCard])

  // Atualiza permiss�es/m�dulos periodicamente enquanto logado.
  useEffect(() => {
    if (!currentUser?.username) return
    const interval = window.setInterval(async () => {
      try {
        const freshUser = await fetchUserByUsername(currentUser.username)
        if (freshUser) {
          setCurrentUser(freshUser)
          saveSession(freshUser)
        }
      } catch (error) {
        console.error('Erro ao atualizar permissões do usuário:', error)
      }
    }, 20000)

    return () => window.clearInterval(interval)
  }, [currentUser?.username])

  const cardRing = isSetPassword || isDashboard ? 'ring-emerald-200/10' : 'ring-rose-200/10'
  const cardMaxWidth = isDashboard ? 'max-w-5xl md:max-w-6xl' : 'max-w-md'
  const accentIconMap: Record<string, any> = {
    // HR
    recruitment: Users,
    payroll: FileText,
    training: Award,
    shift_schedule_and_vacation: Calendar,
    evaluation: TrendingUp,
    communication: MessageCircle,
    health_and_safety: HeartPulse,
    benefits: Gift,
    operations: FactoryIcon,
    // Tech
    infrastructure: Server,
    security: ShieldCheck,
    development: Code2,
    database: Database,
    table_load: Table,
  }

  const HeaderIcon = mode === 'security'
    ? accentIconMap[securityCard?.accent || 'security'] || ShieldCheck
    : ShieldUser
  const accentColor = securityCard?.accent ?? '#22c55e'

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-[15px]">
      <div className={`w-full ${cardMaxWidth} z-10`}>
        <div
          className={`bg-slate-900/65 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl px-5 md:px-6 py-[15px] relative ring-1 ${cardRing}`}
        >
          <div className={`flex items-center justify-center ${isDashboard ? 'mb-0' : 'mb-6'}`}>
            <div
              className={`line-anim left h-px bg-white/35 flex-1 relative overflow-hidden ${
                isSetPassword || isDashboard ? 'green' : ''
              }`}
            >
              <span />
            </div>
            {mode === 'security' ? (
              <div className="flex items-center gap-0 shrink-0">
                <button
                  type="button"
                  onClick={() => setMode('dashboard')}
                  className="w-9 h-9 rounded-full border-2 border-white/60 bg-white/5 flex items-center justify-center shadow-inner shadow-black/30 focus:outline-none transition-colors hover:bg-emerald-500/20 hover:border-emerald-300/40"
                  title="Voltar para o dashboard"
                >
                  <ShieldUser
                    className={`w-6 h-6 shrink-0 ${isSetPassword || isDashboard ? 'text-emerald-300' : 'text-rose-300'}`}
                  />
                </button>
                <ArrowLeft className="w-5 h-5 -mx-0.5" style={{ color: accentColor }} />
                <div className="border-2 border-white/60 rounded-full p-5 backdrop-blur-sm">
                  <HeaderIcon
                    className={`w-16 h-16 shrink-0 avatar-beat ${
                      isSetPassword || isDashboard ? 'text-emerald-400' : 'text-rose-500'
                    }`}
                  />
                </div>
              </div>
            ) : (
              <div className="border-2 border-white/60 rounded-full p-5 backdrop-blur-sm shrink-0">
                <HeaderIcon
                  className={`w-16 h-16 shrink-0 avatar-beat ${
                    isSetPassword || isDashboard ? 'text-emerald-400' : 'text-rose-500'
                  }`}
                />
              </div>
            )}
            <div
              className={`line-anim right h-px bg-white/35 flex-1 relative overflow-hidden ${
                isSetPassword || isDashboard ? 'green' : ''
              }`}
            >
              <span />
            </div>
          </div>

          {!isDashboard && (
            <p className="text-center text-white text-lg font-semibold tracking-wide mb-7">Área Restrita</p>
          )}

          {mode === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div
                className={`flex shadow-lg rounded-md overflow-hidden transition-transform duration-200 group border border-rose-200/40 bg-gradient-to-r from-white/95 via-white/90 to-white/80 ${
                  isLoading ? 'opacity-70' : 'hover:scale-[1.01]'
                }`}
              >
                <div className="w-14 bg-rose-50/80 backdrop-blur-md flex items-center justify-center border-r border-rose-200/60 group-hover:bg-rose-100/80 transition-colors">
                  <UserRound className="w-6 h-6 text-rose-500" />
                </div>
                <input
                  type="text"
                  placeholder="USUÁRIO"
                  className="flex-1 h-12 bg-transparent py-3 px-4 text-slate-700 placeholder-slate-500 focus:outline-none focus:bg-white/90 transition-colors font-semibold tracking-wide text-sm uppercase disabled:cursor-not-allowed"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  required
                />
              </div>

              <div
                className={`flex shadow-lg rounded-md overflow-hidden transition-transform duration-200 group border border-rose-200/40 bg-gradient-to-r from-white/95 via-white/90 to-white/80 ${
                  isLoading ? 'opacity-70' : 'hover:scale-[1.01]'
                }`}
              >
                <div className="w-14 bg-rose-50/80 backdrop-blur-md flex items-center justify-center border-r border-rose-200/60 group-hover:bg-rose-100/80 transition-colors">
                  <LockKeyhole className="w-6 h-6 text-rose-500" />
                </div>
                <input
                  type="password"
                  placeholder="* * * * * *"
                  className="flex-1 h-12 bg-transparent py-3 px-4 text-slate-700 placeholder-slate-500 focus:outline-none focus:bg-white/90 transition-colors font-semibold tracking-wide text-sm disabled:cursor-not-allowed"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold py-3 rounded-lg shadow-lg transform transition-all duration-200 tracking-widest text-sm flex items-center justify-center ${
                  isLoading
                    ? 'opacity-80 cursor-wait'
                    : 'hover:bg-pink-600 hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-md'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Aguarde....
                  </>
                ) : (
                  'ENTRAR'
                )}
              </button>

              {feedback.message && (
                <div
                  className={`flex items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm border ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900'
                      : 'bg-amber-50/90 border-amber-300 text-amber-900'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {feedback.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="whitespace-nowrap text-center">{feedback.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-white/90 text-sm mt-10">
                <label
                  className={`flex items-center cursor-pointer group ${
                    isLoading ? 'pointer-events-none opacity-70' : ''
                  }`}
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={rememberMe}
                      onChange={() => setRememberMe(!rememberMe)}
                      disabled={isLoading}
                    />
                    <div
                      className={`w-5 h-5 border-2 border-white/60 rounded transition-colors duration-200 flex items-center justify-center ${
                        rememberMe ? 'bg-rose-500 border-rose-500' : 'group-hover:border-white bg-transparent'
                      }`}
                    >
                      {rememberMe && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                  </div>
                  <span className="ml-2 font-normal select-none group-hover:text-white transition-colors">
                    Lembrar Senha
                  </span>
                </label>

                <div className="relative group">
                  <a
                    href="#"
                    className={`font-normal italic hover:text-white hover:underline transition-colors opacity-90 hover:opacity-100 ${
                      isLoading ? 'pointer-events-none opacity-50' : ''
                    }`}
                  >
                    Esqueceu a Senha?
                  </a>
                  <span
                    className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-amber-50 text-amber-900 text-xs px-3 py-2 shadow-lg border border-amber-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2"
                    role="tooltip"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Procure os Administratores
                  </span>
                </div>
              </div>
            </form>
          )}

          {mode === 'set-password' && (
            <form onSubmit={handleSetPassword} className="space-y-6">
              <div className="text-white text-sm font-semibold text-center">
                Cadastre uma nova senha para <span className="underline text-emerald-500">{pendingUser?.username}</span>
              </div>

              <div
                className={`flex shadow-lg rounded-md overflow-hidden transition-transform duration-200 group border border-rose-200/40 bg-gradient-to-r from-white/95 via-white/90 to-white/80 ${
                  isLoading ? 'opacity-70' : 'hover:scale-[1.01]'
                }`}
              >
                <div className="w-14 bg-rose-50/80 backdrop-blur-md flex items-center justify-center border-r border-rose-200/60 group-hover:bg-rose-100/80 transition-colors">
                  <LockKeyhole className="w-6 h-6 text-rose-500" />
                </div>
                <input
                  type="password"
                  placeholder="Nova senha"
                  className="flex-1 h-12 bg-transparent py-3 px-4 text-slate-700 placeholder-slate-500 focus:outline-none focus:bg-white/90 transition-colors font-semibold tracking-wide text-sm disabled:cursor-not-allowed"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div
                className={`flex shadow-lg rounded-md overflow-hidden transition-transform duration-200 group border border-rose-200/40 bg-gradient-to-r from-white/95 via-white/90 to-white/80 ${
                  isLoading ? 'opacity-70' : 'hover:scale-[1.01]'
                }`}
              >
                <div className="w-14 bg-rose-50/80 backdrop-blur-md flex items-center justify-center border-r border-rose-200/60 group-hover:bg-rose-100/80 transition-colors">
                  <LockKeyhole className="w-6 h-6 text-rose-500" />
                </div>
                <input
                  type="password"
                  placeholder="Confirmar senha"
                  className="flex-1 h-12 bg-transparent py-3 px-4 text-slate-700 placeholder-slate-500 focus:outline-none focus:bg-white/90 transition-colors font-semibold tracking-wide text-sm disabled:cursor-not-allowed"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`flex-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold py-3 rounded-lg shadow-lg transform transition-all duration-200 tracking-widest text-sm flex items-center justify-center ${
                    isLoading
                      ? 'opacity-80 cursor-wait'
                      : 'hover:bg-green-600 hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-md'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : (
                    'SALVAR SENHA'
                  )}
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setMode('login')
                    setPendingUser(null)
                    setNewPassword('')
                    setConfirmPassword('')
                    resetFeedback()
                  }}
                  className="px-4 h-11 rounded-lg border border-white/30 text-white/90 font-semibold hover:bg-white/10 transition-colors disabled:opacity-60 flex items-center justify-center"
                >
                  Voltar
                </button>
              </div>

              {feedback.message && (
                <div
                  className={`flex items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm border ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900'
                      : 'bg-amber-50/90 border-amber-300 text-amber-900'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {feedback.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="whitespace-nowrap text-center">{feedback.message}</span>
                </div>
              )}
            </form>
          )}

          {mode === 'dashboard' && (
            <div className="space-y-1 -mt-10">
              <Dashboard
                onLogout={handleLogout}
                userName={currentUser?.username || currentUser?.name || 'Usuário'}
                userRole={currentUser?.type_user || 'Perfil não informado'}
                allowedModules={allowedModules}
                onOpenSecurity={(module) => {
                  setSecurityCard(module)
                  setMode('security')
                }}
              />

              {feedback.message && (
                <div
                  className={`flex items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm border ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900'
                      : 'bg-amber-50/90 border-amber-300 text-amber-900'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {feedback.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="whitespace-nowrap text-center">{feedback.message}</span>
                </div>
              )}
            </div>
          )}

          {mode === 'security' && (
            <div className="space-y-1 -mt-10">
              {securityCard?.accent === 'table_load' ? (
                <TableLoad
                  onBack={() => setMode('dashboard')}
                  userName={currentUser?.username || currentUser?.name || 'Usuario'}
                  userRole={currentUser?.type_user || 'Perfil nao informado'}
                  title={securityCard?.title}
                  description={securityCard?.description}
                />
              ) : securityCard?.accent === 'payroll' ? (
                <Payroll
                  onBack={() => setMode('dashboard')}
                  userName={currentUser?.name || currentUser?.username || 'Usuario'}
                  userRole={currentUser?.type_user || 'Perfil nao informado'}
                  title={securityCard?.title}
                  description={securityCard?.description}
                  supabaseUrl={supabaseUrl}
                  supabaseKey={supabaseKey}
                />
              ) : securityCard?.accent === 'operations' ? (
                <Operations
                  onBack={() => setMode('dashboard')}
                  userName={currentUser?.name || currentUser?.username || 'Usuario'}
                  userRole={currentUser?.type_user || 'Perfil nao informado'}
                  title={securityCard?.title}
                  description={securityCard?.description}
                  supabaseUrl={supabaseUrl}
                  supabaseKey={supabaseKey}
                />
              ) : (
                <Security
                  onBack={() => setMode('dashboard')}
                  userName={currentUser?.name || currentUser?.username || 'Usuario'}
                  userRole={currentUser?.type_user || 'Perfil nao informado'}
                  title={securityCard?.title}
                  description={securityCard?.description}
                />
              )}
            </div>
          )}

          <p className="text-center text-white/70 text-xs mt-1">&copy; rhControle - Version 2025.1</p>
        </div>
      </div>
    </div>
  )
}
