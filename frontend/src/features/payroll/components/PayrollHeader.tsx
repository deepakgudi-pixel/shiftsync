import { DollarSign } from 'lucide-react'
import type { Member } from '@/types'
import { formatMoney } from '../utils'

type PayrollHeaderProps = {
  organisationName?: string
  currency?: string
  currencySymbol: string
  member: Member | null
  totalCost?: number | string | null
  onOpenCurrency: () => void
}

export function PayrollHeader({
  organisationName,
  currency,
  currencySymbol,
  member,
  totalCost,
  onOpenCurrency,
}: PayrollHeaderProps) {
  return (
    <div className="mb-6 border-b border-zinc-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-4xl font-bold text-black tracking-tight">Payroll</h1>
        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1">
          {organisationName || 'Organization'}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {currency && (member?.role === 'ADMIN' || member?.can_manage_rates) && (
          <button
            onClick={onOpenCurrency}
            className="text-[10px] md:text-[11px] font-bold text-zinc-500 hover:text-black uppercase tracking-wider border border-zinc-200 px-2 md:px-3 py-1.5 rounded hover:bg-zinc-50 transition-colors shrink-0"
          >
            {currency}
          </button>
        )}
        {member?.role !== 'EMPLOYEE' && totalCost !== undefined && totalCost !== null && (
          <div className="bg-black text-white px-3 py-2 md:px-4 md:py-2.5 flex items-center gap-2">
            <DollarSign size={13} className="shrink-0 md:size-[15]" />
            <div>
              <p className="text-[8px] md:text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Total Cost</p>
              <p className="font-bold text-xs md:text-sm">{formatMoney(totalCost, currencySymbol)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
