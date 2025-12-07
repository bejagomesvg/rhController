import { Check, X, AlertTriangle, Info } from 'lucide-react'

interface LogItemProps {
  message: string
}

const LogItem: React.FC<LogItemProps> = ({ message }) => {
  const lower = message.toLowerCase()

  const isSuccess = message.startsWith('OoO')
  const isError =
    message.startsWith('XxX') || lower.includes('campos obrigatorios faltando')
  const isWarning = message.startsWith(':)')

  const cleanMessage = message.replace(/^(OoO|XxX|\:\))\s*/, '')

  const baseClass = 'text-xs flex items-start gap-1 text-white/80'

  if (isSuccess) {
    return (
      <span className={baseClass}>
        <Check className="w-4 h-4 text-emerald-400 mt-0.5" />
        <span>{cleanMessage}</span>
      </span>
    )
  }

  if (isError) {
    const start = cleanMessage.indexOf('(')
    const end = cleanMessage.lastIndexOf(')')
    const hasGroup = start !== -1 && end > start
    const before = hasGroup ? cleanMessage.slice(0, start) : cleanMessage
    const middle = hasGroup ? cleanMessage.slice(start, end + 1) : ''
    const after = hasGroup ? cleanMessage.slice(end + 1) : ''

    return (
      <span className={baseClass}>
        <X className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
        <span>
          {hasGroup ? (
            <>
              {before}
              <span className="text-rose-300">{middle}</span>
              {after}
            </>
          ) : (
            cleanMessage
          )}
        </span>
      </span>
    )
  }

  if (isWarning) {
    return (
      <span className={baseClass}>
        <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5" />
        <span>{cleanMessage}</span>
      </span>
    )
  }

  return (
    <span className={baseClass}>
      <Info className="w-3 h-3 text-sky-400 mt-0.5" />
      <span>{message}</span>
    </span>
  )
}

export default LogItem
