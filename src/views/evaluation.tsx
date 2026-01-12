import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bell, CalendarDays, Eye, EyeOff, FileText, Filter, RefreshCcw, RotateCw, Search, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import PayrollPlaceholderPanel from './payroll/PayrollPlaceholderPanel'

interface EvaluationProps {
  onBack: () => void
  userName?: string
  userRole?: string
  title?: string
  description?: string
}

type ActiveTab = 'experience' | 'semiannual' | 'alerts' | 'general'

type SidebarItem = {
  key: ActiveTab
  label: string
  title: string
  description: string
  icon: LucideIcon
}

type CompetencyScore = {
  label: string
  score: number
}

type EmployeeStatusRow = {
  name: string
  cpf: string
  admission: string
  status: string
  statusDate: string
  role: string
  sector: string
}

const sidebarItems: SidebarItem[] = [
  {
    key: 'experience',
    label: 'Experiencia',
    title: 'Contrato de experiencia',
    description: 'Checklist, metas e parecer do contrato de experiencia.',
    icon: FileText,
  },
  {
    key: 'semiannual',
    label: 'Semestral',
    title: 'Avaliacao semestral',
    description: 'Ciclos semestrais de desempenho e feedback.',
    icon: CalendarDays,
  },
  {
    key: 'alerts',
    label: 'Alerta',
    title: 'Alertas',
    description: 'Pendencias e alertas de avaliacao.',
    icon: Bell,
  },
  {
    key: 'general',
    label: 'Geral',
    title: 'Visao geral',
    description: 'Resumo de indicadores e historico.',
    icon: Settings,
  },
]

const experienceEmployee = {
  name: 'ABNER SILAS DOS SANTOS',
  role: 'AJUDANTE DE PRODUCAO III',
  area: 'PRODUCAO PANTANEIRA',
  birthDate: '21/08/1997',
  hireDate: '27/01/2016',
  age: '28',
  salary: 'R$ 11.382,00',
  scoreLabel: '9,60',
}

const experienceCompetencies: CompetencyScore[] = [
  { label: 'Trabalho em Equipe', score: 10 },
  { label: 'Comunicacao', score: 10 },
  { label: 'Produtividade', score: 8 },
  { label: 'Organizacao', score: 9 },
  { label: 'Lideranca', score: 10 },
  { label: 'Iniciativa', score: 9 },
]

const experienceBarCompetencies: CompetencyScore[] = [
  experienceCompetencies[0],
  experienceCompetencies[1],
  experienceCompetencies[2],
  experienceCompetencies[3],
  experienceCompetencies[4],
  experienceCompetencies[5],
]

const experienceWarnings = [
  {
    date: '01/10/2024',
    occurrence: 'ADVERTENCIA',
    afastamento: 'NAO',
    reason: 'POR NAO EFETUAR O 5S',
    appliedBy: 'LIDER SETOR',
  },
]

const employeeStatusRows: EmployeeStatusRow[] = [
  {
    name: 'ABNER SILAS DOS SANTOS',
    cpf: '123.456.789-00',
    admission: '27/01/2016',
    status: 'ATIVO',
    statusDate: '05/02/2025',
    role: 'AJUDANTE DE PRODUCAO III',
    sector: 'PRODUCAO',
  },
  {
    name: 'ADAILTON ANDRE BATISTA',
    cpf: '987.654.321-00',
    admission: '14/03/2018',
    status: 'AFASTADO',
    statusDate: '10/01/2025',
    role: 'OPERADOR DE MAQUINA',
    sector: 'ABATE',
  },
  {
    name: 'ANA CAROLINA PEREIRA',
    cpf: '456.789.123-00',
    admission: '02/08/2021',
    status: 'ATIVO',
    statusDate: '01/02/2025',
    role: 'ASSISTENTE ADMINISTRATIVO',
    sector: 'ADMINISTRATIVO',
  },
  {
    name: 'BRUNO HENRIQUE LIMA',
    cpf: '321.654.987-00',
    admission: '19/11/2019',
    status: 'FERIAS',
    statusDate: '03/02/2025',
    role: 'LIDER DE SETOR',
    sector: 'DESOSSA',
  },
]

const CHART_COLORS = ['#8b5cf6', '#f97316', '#ef4444', '#f59e0b', '#22c55e', '#0ea5e9']

const ACTIVE_TAB_KEY = 'evaluation-active-tab'

const Evaluation: React.FC<EvaluationProps> = ({
  onBack,
  userName = 'Usuario',
  userRole = 'Perfil nao informado',
  title = 'Avaliacao',
  description = 'Avaliacao do contrato de experiencia e avaliacao semestral',
}) => {
  const [active, setActive] = useState<ActiveTab>(() => {
    if (typeof window === 'undefined') return 'experience'
    const saved = window.localStorage.getItem(ACTIVE_TAB_KEY) as ActiveTab | null
    return saved === 'experience' || saved === 'semiannual' || saved === 'alerts' || saved === 'general'
      ? saved
      : 'experience'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACTIVE_TAB_KEY, active)
    }
  }, [active])

  const activeItem = useMemo(() => sidebarItems.find((item) => item.key === active) ?? sidebarItems[0], [active])
  const ActiveIcon = activeItem.icon
  const [employeeFilterText, setEmployeeFilterText] = useState('')
  const [isEmployeeTableVisible, setIsEmployeeTableVisible] = useState(true)

  const filteredEmployeeStatusRows = useMemo(() => {
    const term = employeeFilterText.trim().toLowerCase()
    if (!term) return employeeStatusRows
    return employeeStatusRows.filter((row) => {
      const name = row.name.toLowerCase()
      const cpf = row.cpf.toLowerCase()
      return name.includes(term) || cpf.includes(term)
    })
  }, [employeeFilterText])

  const radarData = useMemo(
    () =>
      experienceCompetencies.map((item) => ({
        name: item.label,
        value: item.score,
      })),
    []
  )

  const barData = useMemo(
    () =>
      experienceBarCompetencies.map((item) => ({
        name: item.label,
        value: item.score,
      })),
    []
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">{title}</p>
          <h3 className="text-white text-xl font-semibold mt-1">{description}</h3>
        </div>
        <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-3 rounded-xl shadow-inner shadow-black/20">
          <div>
            <p className="text-emerald-300 font-semibold leading-tight">{userName}</p>
            <p className="text-white/60 text-[11px] uppercase tracking-[0.25em]">{userRole}</p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-emerald-100 bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 rounded-lg hover:bg-emerald-500/25 hover:border-emerald-400/70 transition-colors text-xs font-semibold uppercase tracking-wide"
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>

      <div className="flex gap-0">
        <div className="group relative self-start">
          <div className="flex flex-col bg-white/5 border border-white/10 border-r-0 rounded-l-xl overflow-hidden w-12 group-hover:w-40 transition-all duration-300 shadow-inner shadow-black/20">
            {sidebarItems.map((item, idx) => {
              const Icon = item.icon
              const isLast = idx === sidebarItems.length - 1
              const isActive = item.key === active
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`relative flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors h-11 ${
                    !isLast ? 'border-b border-white/5' : ''
                  } ${isActive ? 'bg-emerald-500/15 text-emerald-100' : ''}`}
                  title={item.label}
                  onClick={() => setActive(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-300' : 'text-white/80'}`} />
                  <span className="font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 bg-white/5 border border-white/10 rounded-r-xl rounded-bl-xl rounded-tl-none p-4 shadow-inner shadow-black/10 min-h-[540px]">
          <div className="bg-slate-900/60 border border-emerald-400/40 rounded-lg p-3 shadow-inner shadow-black/10 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-emerald-200 font-semibold uppercase">
                <ActiveIcon className="w-6 h-6 text-amber-300" />
                {activeItem.label}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-[0.2em]">
                  <Filter className="w-4 h-4 text-emerald-300" />
                  Filtros
                </div>
                <select
                  defaultValue="pantaneira"
                  className="bg-slate-900/70 text-emerald-300 text-[11px] border border-emerald-400/40 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
                >
                  <option value="pantaneira" className="bg-[#1f2c4d] text-emerald-300">
                    Pantaneira
                  </option>
                  <option value="frigosul" className="bg-[#1f2c4d] text-emerald-300">
                    Frigosul
                  </option>
                </select>
                <select
                  defaultValue="setor"
                  className="bg-slate-900/70 text-emerald-300 text-[11px] border border-emerald-400/40 rounded-md px-2 py-1.5 outline-none focus:border-emerald-400"
                >
                  <option value="setor" className="bg-[#1f2c4d] text-emerald-300">
                    Setor
                  </option>
                  <option value="producao" className="bg-[#1f2c4d] text-emerald-300">
                    Producao
                  </option>
                  <option value="administrativo" className="bg-[#1f2c4d] text-emerald-300">
                    Administrativo
                  </option>
                </select>
                <button
                  type="button"
                  className="inline-flex items-center justify-center text-emerald-100 rounded-full border border-transparent px-2 py-1.5 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-colors"
                  title="Limpar filtros"
                >
                  <RotateCw className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
          {active === 'experience' ? (
            <div className="space-y-3">
              <div className="border border-emerald-400/40 rounded-lg bg-slate-900/60 shadow-lg shadow-emerald-500/10 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-56">
                    <input
                      type="text"
                      placeholder="Campo ou Nome"
                      className="w-full bg-slate-900/70 text-emerald-100 text-sm border border-emerald-400/40 rounded-md pl-3 pr-9 py-2 outline-none focus:border-emerald-300/80 focus:ring-1 focus:ring-emerald-300/60 transition shadow-inner shadow-emerald-500/10"
                      value={employeeFilterText}
                      onChange={(e) => setEmployeeFilterText(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-200 hover:text-emerald-100"
                      title="Pesquisar Campo ou Nome"
                      aria-label="Pesquisar"
                    >
                      <Search className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-md border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-emerald-400/60 transition"
                    disabled={!employeeFilterText.trim()}
                    title="Limpar filtro de nome"
                    onClick={() => setEmployeeFilterText('')}
                  >
                    <RefreshCcw className={`text-amber-300 w-5 h-5 ${!employeeFilterText.trim() ? 'opacity-30 cursor-not-allowed' : ''}`} />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-md border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-emerald-400/60 transition"
                    title="Ocultar/mostrar tabela"
                    onClick={() => setIsEmployeeTableVisible((prev) => !prev)}
                  >
                    {isEmployeeTableVisible ? <EyeOff className="w-5 h-5 text-rose-400" /> : <Eye className="w-5 h-5 text-emerald-400" />}
                  </button>
                </div>

                {isEmployeeTableVisible && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-[11px] text-white/80 border-collapse">
                      <thead className="bg-green-800 text-[11px] uppercase tracking-[0.2em] text-white/70">
                        <tr>
                          <th className="py-2 px-2 text-left">NOME</th>
                          <th className="py-2 px-2 text-left">CPF</th>
                          <th className="py-2 px-2 text-center">ADMISSAO</th>
                          <th className="py-2 px-2 text-center">STATUS</th>
                          <th className="py-2 px-2 text-center">DATA STATUS</th>
                          <th className="py-2 px-2 text-left">FUNCAO</th>
                          <th className="py-2 px-2 text-left">SETOR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployeeStatusRows.map((row) => (
                          <tr key={`${row.cpf}-${row.statusDate}`} className="odd:bg-white/5">
                            <td className="py-2 px-2 whitespace-nowrap">{row.name}</td>
                            <td className="py-2 px-2 whitespace-nowrap">{row.cpf}</td>
                            <td className="py-2 px-2 text-center whitespace-nowrap">{row.admission}</td>
                            <td className="py-2 px-2 text-center whitespace-nowrap">{row.status}</td>
                            <td className="py-2 px-2 text-center whitespace-nowrap">{row.statusDate}</td>
                            <td className="py-2 px-2 whitespace-nowrap">{row.role}</td>
                            <td className="py-2 px-2 whitespace-nowrap">{row.sector}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-emerald-400/40 bg-slate-900/60 p-2">
                <div className="grid grid-cols-1 lg:grid-cols-[120px_1fr_150px_310px] gap-2 items-stretch justify-items-center lg:justify-items-stretch">
                  <div className="bg-slate-900/80 rounded-md border border-emerald-400/40 p-1 w-28 h-36 flex items-center justify-center shadow-inner">
                    <div className="h-full w-full border border-emerald-500/70" />
                  </div>

                  <div className="flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/60">Nome do Funcionario</p>
                        <p className="text-white text-xl font-semibold">{experienceEmployee.name}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/60">Cargo</p>
                        <p className="text-white text-base font-semibold">{experienceEmployee.role}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/60">Area</p>
                        <p className="text-white text-base font-semibold">{experienceEmployee.area}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-600/70 border border-emerald-400/60 rounded-md flex flex-col items-center justify-center text-white shadow-lg">
                    <p className="text-5xl font-semibold">{experienceEmployee.scoreLabel}</p>
                    <p className="text-[11px] mt-3 uppercase tracking-widest text-white/90">Avaliacao do</p>
                    <p className="text-[11px] uppercase tracking-widest text-white/90">Funcionario</p>
                  </div>
                  <div className="bg-slate-900/80 rounded-md border border-emerald-400/40 overflow-hidden">
                    <div className="bg-emerald-600/70 text-white text-sm uppercase tracking-[0.35em] px-3 py-2 text-center font-semibold">
                      Nome do Funcionario
                    </div>
                    <div className="h-[140px] border-t border-emerald-500/70" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                <div className="bg-slate-900/60 rounded-lg border border-emerald-400/40 text-white/80 p-4 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/60">Nome Completo</p>
                    <p className="text-base font-semibold text-white">{experienceEmployee.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/60">Data de Nascimento</p>
                    <p className="text-base font-semibold text-white">{experienceEmployee.birthDate}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/60">Data de Contratacao</p>
                    <p className="text-base font-semibold text-white">{experienceEmployee.hireDate}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/60">Idade</p>
                    <p className="text-base font-semibold text-white">{experienceEmployee.age}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/60">Salario</p>
                    <p className="text-base font-semibold text-white">{experienceEmployee.salary}</p>
                  </div>
                </div>

                <div className="bg-slate-900/60 rounded-lg border border-emerald-400/40 p-4">
                  <p className="text-xs font-semibold text-white/70">Nota individual por competencia (Radar)</p>
                  <div className="mt-3 h-[230px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius="90%">
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis
                          dataKey="name"
                          tick={{ fill: '#e2e8f0', fontSize: 11, textAnchor: 'middle', dominantBaseline: 'inherit' }}
                          tickFormatter={(label) => {
                            const match = radarData.find((item) => item.name === label)
                            if (!match) return String(label)
                            return `${match.name}: ${match.value.toFixed(2)}`
                          }}
                        />
                        <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                        <Radar
                          dataKey="value"
                          stroke={CHART_COLORS[0]}
                          strokeWidth={2}
                          fill={CHART_COLORS[0]}
                          fillOpacity={0.12}
                          dot={(props: any) => (
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={5}
                              fill={CHART_COLORS[props.index % CHART_COLORS.length]}
                            />
                          )}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-slate-900/60 rounded-lg border border-emerald-400/40 p-2 pr-2 flex flex-col overflow-hidden">
                  <p className="text-xs font-semibold text-white/70">Nota individual por competencia (Barras)</p>
                  <div className="mt-4 flex-1 min-h-[240px] chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} layout="vertical" margin={{ left: -35, right: 55, top: 0, bottom: 0 }}>
                        <XAxis type="number" domain={[0, 10]} hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          tick={{ fill: '#e2e8f0', fontSize: 11 }}
                          axisLine={{ stroke: '#334155' }}
                          tickLine={false}
                        />
                        <Bar dataKey="value" barSize={25} radius={0}>
                          {barData.map((_, idx) => (
                            <Cell key={`bar-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                          <LabelList
                            dataKey="value"
                            position="right"
                            offset={6}
                            formatter={(label) => (typeof label === 'number' ? label.toFixed(2) : String(label ?? ''))}
                            fill="#e2e8f0"
                            fontSize={12}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-lg border border-emerald-400/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white/80">Advertencia e Suspensao</p>
                  <span className="text-xs text-white/50">(em construcao)</span>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-xs text-white/80 border border-emerald-400/40">
                    <thead className="bg-green-800 text-white/70">
                      <tr>
                        <th className="px-2 py-1 border border-emerald-400/40">DATA</th>
                        <th className="px-2 py-1 border border-emerald-400/40">OCORRENCIAS</th>
                        <th className="px-2 py-1 border border-emerald-400/40">AFASTAMENTO</th>
                        <th className="px-2 py-1 border border-emerald-400/40">MOTIVO</th>
                        <th className="px-2 py-1 border border-emerald-400/40">APLICADA POR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {experienceWarnings.map((row) => (
                        <tr key={row.date} className="text-center">
                          <td className="px-2 py-1 border border-emerald-400/40">{row.date}</td>
                          <td className="px-2 py-1 border border-emerald-400/40">{row.occurrence}</td>
                          <td className="px-2 py-1 border border-emerald-400/40">{row.afastamento}</td>
                          <td className="px-2 py-1 border border-emerald-400/40 text-left">{row.reason}</td>
                          <td className="px-2 py-1 border border-emerald-400/40">{row.appliedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <PayrollPlaceholderPanel icon={ActiveIcon} title={activeItem.title} description={activeItem.description} />
          )}
        </div>
      </div>
    </div>
  )
}

export default Evaluation
