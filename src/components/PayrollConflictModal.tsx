import React from 'react'
import { AlertTriangle, TriangleAlert } from 'lucide-react'
import type { Action, State } from '../views/Table_load'
import { loadSession } from '../services/sessionService'
import { verifyPassword } from '../services/authService'
import { deletePayrollByMonth } from '../services/payrollService'
import { insertHistory } from '../services/logService'

interface PayrollConflictModalProps {
  state: State
  dispatch: React.Dispatch<Action>
  pushMessage: (message: string) => void
  onHistoryUpdate: () => Promise<void>
  userName: string
  supabaseUrl: string
  supabaseKey: string
}

const PayrollConflictModal: React.FC<PayrollConflictModalProps> = ({
  state,
  dispatch,
  pushMessage,
  onHistoryUpdate,
  userName,
  supabaseUrl,
  supabaseKey,
}) => {
  const { payrollConflictRef, payrollConflictPassword, payrollPasswordErrorType, payrollPasswordAttempts, payrollConflictDate, selectedFile } = state
  const sessionUser = loadSession()

  if (!payrollConflictRef) return null

  const handleDelete = async () => {
    const pwd = payrollConflictPassword.trim()
    if (!pwd) {
      dispatch({ type: 'SET_PAYROLL_PASSWORD_ERROR', payload: 'required' })
      return
    }
    if (!sessionUser) {
      pushMessage('XxX Sessao invalida. Faça login novamente.')
      return
    }
    const passwordResult = await verifyPassword(pwd, sessionUser.password)
    if (!passwordResult) {
      dispatch({ type: 'INCREMENT_PASSWORD_ATTEMPTS' });
      dispatch({ type: 'SET_PAYROLL_PASSWORD_ERROR', payload: 'invalid' });
      if (payrollPasswordAttempts + 1 >= 3) {
        pushMessage('XxX Parece que voce nao tem acesso a exclusao');
        dispatch({ type: 'SET_STATUS', payload: 'error' });
        dispatch({ type: 'RESET_PAYROLL_CONFLICT' })
      }
      return
    }

    if (payrollConflictRef && payrollConflictDate) {
      pushMessage(`Excluindo fechamento da folha pgto : ${payrollConflictRef}`)
      dispatch({ type: 'SET_STATUS', payload: 'uploading' })
      try {
        const deleteResult = await deletePayrollByMonth(payrollConflictDate, supabaseUrl, supabaseKey)
        if (!deleteResult.ok) {
          const errorMessage = deleteResult.error ?? 'Erro desconhecido ao excluir dados'
          dispatch({ type: 'IMPORT_FAILURE', payload: { messages: [`XxX Erro ao excluir dados: ${errorMessage}`] } })
          dispatch({ type: 'RESET_PAYROLL_CONFLICT' })
          return
        }
        pushMessage(`OoO ${deleteResult.deleted} registro(s) excluido(s) da folha ref. ${payrollConflictRef}`)
        await insertHistory({
            table: payrollConflictRef ? `payroll Ref. ${payrollConflictRef}` : 'payroll',
            actions: 'Delete',
            file: selectedFile?.name || '-',
            user: userName || '-',
            type: 'Importado',
          }, supabaseUrl, supabaseKey)
        await onHistoryUpdate()
        dispatch({ type: 'PAYROLL_DELETE_SUCCESS' })
        pushMessage('OoO Exclusão concluida. Voce já pode importar a nova Folha Pgto.')
      } catch (error) {
        dispatch({ type: 'IMPORT_FAILURE', payload: { messages: [`XxX Erro ao excluir: ${(error as Error).message}`] } })
      }
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="relative w-full max-w-xl bg-[#0d1425] border border-white/10 rounded-2xl shadow-[0_25px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/05 via-rose-500/8 to-transparent pointer-events-none" />
        <div className="relative p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-rose-500/15 border border-rose-400/60 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white text-xl font-semibold">Excluir Fechamento!</h3>
              <p className="text-white/80 text-sm mt-2 leading-relaxed">Essa Folha de Pgto {payrollConflictRef} ja foi fechada, porem voce pode exclui-la e inserir novos dados. Isso ira excluir todos os dados definidivamente.</p>
            </div>
          </div>
          <div className="mt-4 flex items-end gap-4 flex-wrap justify-between">
            <div className="w-full max-w-[220px]">
              <label className="text-white/70 text-xs mb-1 block">Senha de confirmacao <span className="text-rose-400">{Math.min(payrollPasswordAttempts, 3)}/3</span></label>
              <input type="password" value={payrollConflictPassword} onChange={(e) => dispatch({ type: 'UPDATE_PAYROLL_PASSWORD', payload: e.target.value })} className={`w-full bg-white/5 text-white text-sm border rounded-lg px-3 py-2.5 outline-none focus:border-emerald-400 ${payrollPasswordErrorType ? 'border-rose-400' : 'border-white/10'}`} placeholder="Digite sua senha" />
              {payrollPasswordErrorType === 'required' && (<div className="flex items-center gap-1 text-amber-300 text-xs mt-1"><TriangleAlert className="w-4 h-4" /><span>Obrigatorio!!!</span></div>)}
              {payrollPasswordErrorType === 'invalid' && (<div className="flex items-center gap-1 text-rose-300 text-xs mt-1"><TriangleAlert className="w-4 h-4" /><span>Senha Incorreta - {Math.max(payrollPasswordAttempts, 1)}</span></div>)}
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button type="button" className="px-5 py-2.5 h-[44px] rounded-lg bg-white/5 border border-white/15 text-white hover:bg-white/10 transition-colors" onClick={() => { dispatch({ type: 'RESET_PAYROLL_CONFLICT' }); pushMessage('XxX Voce cancelo a operacao'); dispatch({ type: 'SET_STATUS', payload: 'error' }); }}>Cancelar</button>
              <button type="button" className="px-5 py-2.5 h-[44px] rounded-lg bg-rose-500 text-white font-semibold hover:bg-rose-600 transition-colors" onClick={handleDelete}>Excluir</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PayrollConflictModal
