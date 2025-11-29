import React, { useState } from 'react'
import type { ReactElement } from 'react'
import { AlertTriangle, Check, Loader2, LockKeyhole, ShieldUser, UserRound } from 'lucide-react'
import './style.css'

export function App(): ReactElement {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) return
    setIsLoading(true)
    // Simula processamento
    setTimeout(() => setIsLoading(false), 1000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md z-10 px-4">
        <div className="bg-slate-900/65 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl p-8 md:p-10 relative ring-1 ring-rose-200/10">
          <div className="flex items-center justify-center mb-10">
            <div className="line-anim left h-px bg-white/35 flex-1 relative overflow-hidden">
              <span />
            </div>
            <div className="border-2 border-white/60 rounded-full p-5 backdrop-blur-sm">
              <ShieldUser className="w-20 h-20 text-rose-500 avatar-beat" />
            </div>
            <div className="line-anim right h-px bg-white/35 flex-1 relative overflow-hidden">
              <span />
            </div>
          </div>

          <p className="text-center text-white text-lg font-semibold tracking-wide mb-7">
            Área Restrita
          </p>

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
                className="flex-1 bg-transparent py-3 px-4 text-slate-700 placeholder-slate-500 focus:outline-none focus:bg-white/90 transition-colors font-semibold tracking-wide text-sm uppercase disabled:cursor-not-allowed"
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
                className="flex-1 bg-transparent py-3 px-4 text-slate-700 placeholder-slate-500 focus:outline-none focus:bg-white/90 transition-colors font-semibold tracking-wide text-sm disabled:cursor-not-allowed"
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
                      rememberMe
                        ? 'bg-rose-500 border-rose-500'
                        : 'group-hover:border-white bg-transparent'
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

          <div className="w-full h-px bg-white/20 mt-10" />
          <p className="text-center text-white/70 text-xs mt-3">
            &copy; rhControle - Version 2025.1
          </p>
        </div>
      </div>
    </div>
  )
}
