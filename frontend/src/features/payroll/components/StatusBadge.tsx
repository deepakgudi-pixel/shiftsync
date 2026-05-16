import { cn } from '@/lib/utils'

type StatusBadgeProps = {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const className = status === 'PAID'
    ? 'bg-green-100 text-green-700'
    : status === 'PROCESSED'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-yellow-100 text-yellow-700'

  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider', className)}>
      {status}
    </span>
  )
}
