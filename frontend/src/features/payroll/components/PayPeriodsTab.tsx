'use client'
import { Plus } from 'lucide-react'
import { StatusBadge } from '@/features/payroll/components/StatusBadge'
import { formatMoney as fmt, getCurrencySymbol } from '@/features/payroll/utils'
import type { PayPeriod } from '@/types'

type PayPeriodsTabProps = {
  payPeriods: PayPeriod[]
  actionLoading: string | null
  currency: string
  onProcess: (id: string) => void
  onMarkPaid: (id: string) => void
  onReset: (id: string) => void
  onCreateNew: () => void
}

export function PayPeriodsTab({
  payPeriods,
  actionLoading,
  currency,
  onProcess,
  onMarkPaid,
  onReset,
  onCreateNew,
}: PayPeriodsTabProps) {
  const sym = getCurrencySymbol(currency)

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 bg-black text-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors"
        >
          <Plus size={14} /> New Pay Period
        </button>
      </div>

      {payPeriods.length === 0 && (
        <div className="p-12 text-center bg-white border border-zinc-200">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No pay periods created yet</p>
        </div>
      )}

      <div className="space-y-3">
        {payPeriods.map((pp) => (
          <div
            key={pp.id}
            className="bg-white border border-zinc-200 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <p className="font-bold text-sm uppercase tracking-wider">{pp.period_type}</p>
                <StatusBadge status={pp.status} />
              </div>
              <p className="text-xs text-zinc-500 truncate">
                {new Date(pp.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' — '}
                {new Date(pp.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              {pp.total_cost && pp.status !== 'DRAFT' && (
                <p className="text-xs font-bold text-green-600 mt-1">
                  Total: {fmt(pp.total_cost, sym)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {pp.status === 'DRAFT' && (
                <button
                  onClick={() => onProcess(pp.id)}
                  disabled={actionLoading === `process:${pp.id}`}
                  className="text-[11px] font-bold bg-blue-600 text-white px-4 py-2 uppercase tracking-wider hover:bg-blue-700 transition-colors"
                >
                  {actionLoading === `process:${pp.id}` ? 'Processing...' : 'Process'}
                </button>
              )}
              {pp.status === 'PROCESSED' && (
                <>
                  <button
                    onClick={() => onMarkPaid(pp.id)}
                    disabled={actionLoading === `paid:${pp.id}`}
                    className="text-[11px] font-bold bg-green-600 text-white px-4 py-2 uppercase tracking-wider hover:bg-green-700 transition-colors"
                  >
                    {actionLoading === `paid:${pp.id}` ? 'Saving...' : 'Mark Paid'}
                  </button>
                  <button
                    onClick={() => onReset(pp.id)}
                    disabled={actionLoading === `reset:${pp.id}`}
                    className="text-[11px] font-bold text-zinc-500 border border-zinc-200 px-3 py-2 uppercase tracking-wider hover:bg-zinc-50 transition-colors"
                    title="Delete payslips and reset to DRAFT"
                  >
                    {actionLoading === `reset:${pp.id}` ? 'Resetting...' : 'Reset'}
                  </button>
                </>
              )}
              {pp.payslip_count > 0 && (
                <span className="text-[10px] font-bold text-zinc-400">{pp.payslip_count} payslips</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
