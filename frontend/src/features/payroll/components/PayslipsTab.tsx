'use client'
import { Download } from 'lucide-react'
import { formatMoney as fmt, getCurrencySymbol } from '@/features/payroll/utils'
import { StatusBadge } from '@/features/payroll/components/StatusBadge'
import type { Member, PayslipWithPeriod } from '@/types'

type PayslipsTabProps = {
  payslips: PayslipWithPeriod[]
  member: Member | null
  currency: string
  onDownloadPdf: (id: string) => void
}

export function PayslipsTab({ payslips, member, currency, onDownloadPdf }: PayslipsTabProps) {
  const sym = getCurrencySymbol(currency)

  if (payslips.length === 0) {
    return (
      <div className="bg-white border border-zinc-200">
        <div className="p-8 md:p-12 text-center">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No payslips generated yet</p>
          {member?.role !== 'EMPLOYEE' && (
            <p className="text-[10px] text-zinc-400 mt-1">Process a pay period to generate payslips</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-zinc-200">
      <div className="divide-y divide-zinc-100 md:divide-y-0">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Employee</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Period</th>
                <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Base</th>
                <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">OT</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total</th>
                <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((ps) => (
                <tr key={ps.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-bold text-xs uppercase tracking-wider truncate max-w-[100px]">{ps.employee_name}</p>
                  </td>
                  <td className="px-3 py-4">
                    <p className="text-xs text-zinc-500 truncate max-w-[120px]">{ps.period_type}</p>
                    <p className="text-[10px] text-zinc-400 truncate max-w-[120px]">
                      {new Date(ps.start_date).toLocaleDateString()} — {new Date(ps.end_date).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="text-right px-3 py-4 font-bold text-sm text-zinc-700">{fmt(ps.base_earnings, sym)}</td>
                  <td className="text-right px-3 py-4">
                    {ps.overtime_earnings > 0 ? (
                      <span className="text-orange-500 font-bold text-sm">{fmt(ps.overtime_earnings, sym)}</span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="text-right px-4 py-4 font-bold text-black">{fmt(ps.total_earnings, sym)}</td>
                  <td className="text-right px-3 py-4">
                    <StatusBadge status={ps.status} />
                  </td>
                  <td className="px-2 py-4">
                    <button onClick={() => onDownloadPdf(ps.id)} className="text-zinc-400 hover:text-black transition-colors">
                      <Download size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-zinc-100">
          {payslips.map((ps) => (
            <div key={ps.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-xs uppercase tracking-wider truncate">{ps.employee_name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{ps.period_type}</p>
                </div>
                <StatusBadge status={ps.status} />
              </div>
              <p className="text-[10px] text-zinc-400">
                {new Date(ps.start_date).toLocaleDateString()} — {new Date(ps.end_date).toLocaleDateString()}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[9px] text-zinc-400 uppercase tracking-wider">Base</p>
                    <p className="font-bold text-xs text-zinc-700">{fmt(ps.base_earnings, sym)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-400 uppercase tracking-wider">OT</p>
                    <p className="font-bold text-xs text-orange-500">
                      {ps.overtime_earnings > 0 ? fmt(ps.overtime_earnings, sym) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-400 uppercase tracking-wider">Total</p>
                    <p className="font-bold text-sm text-black">{fmt(ps.total_earnings, sym)}</p>
                  </div>
                </div>
                <button onClick={() => onDownloadPdf(ps.id)} className="text-zinc-400 hover:text-black transition-colors p-2">
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
