'use client'
import { getInitials } from '@/lib/utils'
import { formatMoney as fmt, getCurrencySymbol } from '@/features/payroll/utils'
import type { EmployeeWithRate } from '@/features/payroll/hooks/usePayroll'

type EmployeeRatesTabProps = {
  employeeRates: EmployeeWithRate[]
  currency: string
  onOverride: (emp: EmployeeWithRate) => void
}

export function EmployeeRatesTab({ employeeRates, currency, onOverride }: EmployeeRatesTabProps) {
  const sym = getCurrencySymbol(currency)

  return (
    <div className="bg-white border border-zinc-200">
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-zinc-100 flex items-center justify-between">
        <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-black">Employee Rates</h3>
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Employee</th>
              <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Base Rate</th>
              <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">OT Mult</th>
              <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Custom</th>
              <th className="text-right px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employeeRates.map((emp) => (
              <tr key={emp.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {getInitials(emp.name)}
                    </div>
                    <span className="font-bold text-xs uppercase tracking-wider truncate">{emp.name}</span>
                  </div>
                </td>
                <td className="text-right px-3 py-4 font-bold text-sm">
                  {emp.hourly_rate ? `${fmt(emp.hourly_rate, sym)}/hr` : '—'}
                </td>
                <td className="text-right px-3 py-4 text-sm text-zinc-500">{emp.customOTMult || '1.5x'}</td>
                <td className="text-right px-3 py-4">
                  {emp.customRate ? (
                    <span className="font-bold text-sm text-green-600">{fmt(emp.customRate, sym)}/hr</span>
                  ) : (
                    <span className="text-zinc-300 text-sm">Default</span>
                  )}
                </td>
                <td className="text-right px-4 py-4">
                  <button
                    onClick={() => onOverride(emp)}
                    className="text-[10px] font-bold text-zinc-400 hover:text-black uppercase tracking-wider border border-zinc-200 px-3 py-1.5 rounded hover:bg-zinc-50 transition-colors"
                  >
                    Override
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden divide-y divide-zinc-100">
        {employeeRates.map((emp) => (
          <div key={emp.id} className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {getInitials(emp.name)}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-xs uppercase tracking-wider truncate">{emp.name}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {emp.hourly_rate ? `${fmt(emp.hourly_rate, sym)}/hr` : 'No rate'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onOverride(emp)}
              className="text-[10px] font-bold text-zinc-400 hover:text-black uppercase tracking-wider border border-zinc-200 px-3 py-1.5 rounded hover:bg-zinc-50 transition-colors shrink-0"
            >
              Override
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
