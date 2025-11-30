import React from 'react'
import {
  Users,
  FileText,
  Award,
  Calendar,
  Server,
  ShieldCheck,
  Code2,
  Database,
  LogOut,
  LayoutDashboard,
  HeartPulse,
  MessageCircle,
  TrendingUp,
  Gift,
  Table,
} from 'lucide-react'
import type { ModuleKey } from '../models/user'

interface DashboardProps {
  onLogout: () => void
  userName?: string
  userRole?: string
  allowedModules?: Partial<Record<ModuleKey, string | boolean>>
}

const Dashboard: React.FC<DashboardProps> = ({
  onLogout,
  userName = 'Usuário',
  userRole = 'Perfil não informado',
  allowedModules,
}) => {
  const hrCards = [
    {
      key: 'recruitment' as const,
      title: 'Recrutamento',
      description: 'Gestão de talentos e novas contratações',
      icon: <Users className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-pink-500 to-rose-600',
    },
    {
      key: 'payroll' as const,
      title: 'Folha de Pagamento',
      description: 'Controle salarial e benefícios',
      icon: <FileText className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-purple-500 to-indigo-600',
    },
    {
      key: 'training' as const,
      title: 'Treinamento',
      description: 'Desenvolvimento e cursos corporativos',
      icon: <Award className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-orange-400 to-red-500',
    },
    {
      key: 'shift_schedule_and_vacation' as const,
      title: 'Escalas & Férias',
      description: 'Gestão de tempo e ausências',
      icon: <Calendar className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-yellow-400 to-orange-500',
    },
    {
      key: 'evaluation' as const,
      title: 'Avaliação',
      description: 'Análise de desempenho individual',
      icon: <TrendingUp className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-teal-400 to-emerald-600',
    },
    {
      key: 'communication' as const,
      title: 'Comunicação',
      description: 'Mural e comunicados internos',
      icon: <MessageCircle className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-blue-400 to-cyan-600',
    },
    {
      key: 'health_and_safety' as const,
      title: 'Saúde e Segurança',
      description: 'Medicina e segurança do trabalho',
      icon: <HeartPulse className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-red-400 to-pink-600',
    },
    {
      key: 'benefits' as const,
      title: 'Benefícios',
      description: 'Vale transporte, alimentação e saúde',
      icon: <Gift className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-violet-400 to-purple-600',
    },
  ]

  const techCards = [
    {
      key: 'infrastructure' as const,
      title: 'Infraestrutura',
      description: 'Monitoramento de servidores e redes',
      icon: <Server className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    },
    {
      key: 'security' as const,
      title: 'Segurança',
      description: 'Controle de acesso e firewall',
      icon: <ShieldCheck className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-emerald-400 to-green-600',
    },
    {
      key: 'development' as const,
      title: 'Desenvolvimento',
      description: 'Repositórios e code review',
      icon: <Code2 className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-violet-500 to-fuchsia-600',
    },
    {
      key: 'database' as const,
      title: 'Banco de Dados',
      description: 'Gestão de dados e backups',
      icon: <Database className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-blue-400 to-indigo-500',
    },
    {
      key: 'table_load' as const,
      title: 'Carga de Tabelas',
      description: 'Importação massiva e ETL',
      icon: <Table className="w-5 h-5 text-white" />,
      color: 'bg-gradient-to-br from-slate-500 to-gray-700',
    },
  ]

  const isAllowed = (key: ModuleKey) => !allowedModules || Boolean(allowedModules[key])

  const visibleHrCards = hrCards.filter((card) => isAllowed(card.key))
  const visibleTechCards = techCards.filter((card) => isAllowed(card.key))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/60 flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-rose-300" />
            Painel principal
          </p>
          <h2 className="text-white text-2xl font-bold mt-1 leading-tight">Módulos disponíveis</h2>
          <p className="text-white/70 text-sm">Escolha um módulo para acessar.</p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-3 rounded-xl shadow-inner shadow-black/20">
          <div>
            <p className="text-emerald-300 font-semibold leading-tight">{userName}</p>
            <p className="text-white/60 text-[11px] uppercase tracking-[0.25em]">{userRole}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-rose-100 bg-white/10 border border-white/10 px-3 py-2 rounded-lg hover:bg-rose-500/20 hover:border-rose-300/40 transition-colors text-xs font-semibold uppercase tracking-wide"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.6)]" />
          <h3 className="text-white text-lg font-semibold tracking-wide">Recursos Humanos</h3>
          <div className="h-px flex-1 bg-white/10 rounded-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {visibleHrCards.map((card) => (
            <div
              key={card.title}
              className={`${card.color} w-full rounded-md p-2 shadow-md shadow-black/30 transform hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 cursor-pointer group`}
            >
              <div className="flex items-start gap-3">
                <div className="bg-white/20 w-10 h-10 shrink-0 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                  {card.icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-white text-base font-bold leading-tight">{card.title}</h4>
                  <p className="text-white/85 text-xs font-medium leading-snug mt-1">{card.description}</p>
                  <div className="mt-3 w-8 h-0.5 bg-white/40 rounded-full group-hover:w-full transition-all duration-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
          <h3 className="text-white text-lg font-semibold tracking-wide">Tecnologia & TI</h3>
          <div className="h-px flex-1 bg-white/10 rounded-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {visibleTechCards.map((card) => (
            <div
              key={card.title}
              className={`${card.color} w-full rounded-md p-2 shadow-md shadow-black/30 transform hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 cursor-pointer group`}
            >
              <div className="flex items-start gap-3">
                <div className="bg-white/20 w-10 h-10 shrink-0 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                  {card.icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-white text-base font-bold leading-tight">{card.title}</h4>
                  <p className="text-white/85 text-xs font-medium leading-snug mt-1">{card.description}</p>
                  <div className="mt-3 w-8 h-0.5 bg-white/40 rounded-full group-hover:w-full transition-all duration-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Dashboard
