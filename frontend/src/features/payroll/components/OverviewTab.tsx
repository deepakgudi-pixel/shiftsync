'use client'
import { DollarSign, Clock, Users, TrendingUp, Download } from 'lucide-react'
import { getInitials, cn } from '@/lib/utils'
import { formatMoney as fmt, getCurrencySymbol } from '@/features/payroll/utils'
import { StatusBadge } from '@/features/payroll/components/StatusBadge'
import type { Member, PayslipWithPeriod, PayPeriod, PayPeriodTimesheet, PayPeriodSummary, TimesheetEmployee } from '@/types'

type OverviewTabProps = {
  member: Member | null
  summary: PayPeriodSummary | null
  timesheetData: PayPeriodTimesheet | null
  payslips: PayslipWithPeriod[]
  payPeriods: PayPeriod[]
  selectedPeriodId: string | null
  onPeriodChange: (id: string) => void
  onDownloadPdf: (id: string) => void
}

export function OverviewTab({
  member,
  summary,
  timesheetData,
  payslips,
  payPeriods,
  selectedPeriodId,
  onPeriodChange,
  onDownloadPdf,
}: OverviewTabProps) {
  const sym = getCurrencySymbol(summary?.rule ? 'USD' : 'USD')

  return (
    <div className="space-y-6">
      {member?.role !== 'EMPLOYEE' && payPeriods.length > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Pay Period:</label>
          <select
            value={selectedPeriodId || ''}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="border border-zinc-200 px-3 py-2 text-sm font-bold bg-white"
          >
            {payPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {new Date(p.start_date).toLocaleDateString()} — {new Date(p.end_date).toLocaleDateString()} ({p.period_type})
              </option>
            ))}
          </select>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          {[
            { label: 'Employees', value: summary.employeeCount, icon: Users, color: 'text-blue-600' },
            { label: 'Total Hrs', value: `${summary.totalHours}h`, icon: Clock, color: 'text-zinc-600' },
            { label: 'Base Pay', value: fmt(summary.totalBaseEarnings, sym), icon: DollarSign, color: 'text-green-600' },
            { label: 'OT Cost', value: fmt(summary.totalOvertimeEarnings, sym), icon: TrendingUp, color: 'text-orange-500' },
            { label: 'Total Cost', value: fmt(summary.totalCost, sym), icon: DollarSign, color: 'text-black' },
          ].map((card) => (
            <div key={card.label} className="bg-white border border-zinc-200 p-4 md:p-5">
              <p className="text-[9px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{card.label}</p>
              <p className={cn('text-base md:text-xl font-bold flex items-center gap-2', card.color)}>
                <card.icon size={14} className="md:size-[18]" />
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}
      {summary?.rule && (
        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
          OT: {summary.rule.daily_threshold_hours}h/day · {summary.rule.weekly_threshold_hours}h/week · {summary.rule.daily_multiplier}x multiplier
        </p>
      )}

      {timesheetData?.employees?.length > 0 && <EmployeeBreakdown employees={timesheetData.employees} sym={sym} />}

      {timesheetData?.employees?.length === 0 && (
        <div className="p-8 md:p-12 text-center bg-white border border-zinc-200">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No timesheet data for this period</p>
        </div>
      )}

      {member?.role === 'EMPLOYEE' && payslips.length > 0 && (
        <div className="bg-white border border-zinc-200">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-zinc-100">
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-black">My Payslips</h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {payslips.map((ps) => (
              <div key={ps.id} className="px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-xs uppercase tracking-wider truncate">{ps.period_type} Payslip</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {new Date(ps.start_date).toLocaleDateString()} — {new Date(ps.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-green-600 text-sm">{fmt(ps.total_earnings, sym)}</span>
                  <StatusBadge status={ps.status} />
                  <button onClick={() => onDownloadPdf(ps.id)} className="text-zinc-400 hover:text-black transition-colors p-1">
                    <Download size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EmployeeBreakdown({ employees, sym }: { employees: TimesheetEmployee[]; sym: string }) {
  return (
    <div className="bg-white border border-zinc-200">
      <div className="px-4 md:px-6 py-4 border-b border-zinc-100">
        <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-black">Employee Breakdown</h3>
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Employee</th>
              <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Hrs</th>
              <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">OT Hrs</th>
              <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Base</th>
              <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">OT Pay</th>
              <th className="text-right px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.employeeId} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {getInitials(emp.name)}
                    </div>
                    <span className="font-bold text-xs uppercase tracking-wider truncate">{emp.name}</span>
                  </div>
                </td>
                <td className="text-right px-3 py-4 font-bold text-sm">{emp.totalHours}h</td>
                <td className="text-right px-3 py-4">
                  {emp.overtimeHours > 0 ? (
                    <span className="text-orange-500 font-bold text-sm">{emp.overtimeHours}h</span>
                  ) : (
                    <span className="text-zinc-300 text-sm">—</span>
                  )}
                </td>
                <td className="text-right px-3 py-4 font-bold text-sm text-green-600">{fmt(emp.baseEarnings, sym)}</td>
                <td className="text-right px-3 py-4">
                  {emp.overtimeEarnings > 0 ? (
                    <span className="text-orange-500 font-bold text-sm">{fmt(emp.overtimeEarnings, sym)}</span>
                  ) : (
                    <span className="text-zinc-300 text-sm">—</span>
                  )}
                </td>
                <td className="text-right px-4 py-4 font-bold text-black">{fmt(emp.totalEarnings, sym)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden divide-y divide-zinc-100">
        {employees.map((emp) => (
          <div key={emp.employeeId} className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {getInitials(emp.name)}
              </div>
              <span className="font-bold text-xs uppercase tracking-wider truncate">{emp.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-50 p-2">
                <p className="text-[9px] text-zinc-400 uppercase tracking-wider">Hours</p>
                <p className="font-bold text-sm mt-0.5">{emp.totalHours}h</p>
              </div>
              <div className="bg-zinc-50 p-2">
                <p className="text-[9px] text-zinc-400 uppercase tracking-wider">OT Hrs</p>
                <p className="font-bold text-sm mt-0.5 text-orange-500">
                  {emp.overtimeHours > 0 ? `${emp.overtimeHours}h` : '—'}
                </p>
              </div>
              <div className="bg-zinc-50 p-2">
                <p className="text-[9px] text-zinc-400 uppercase tracking-wider">Total</p>
                <p className="font-bold text-sm mt-0.5 text-black">{fmt(emp.totalEarnings, sym)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500">
                  Base: <span className="text-green-600 font-bold">{fmt(emp.baseEarnings, sym)}</span>
                </span>
                {emp.overtimeEarnings > 0 && (
                  <span className="text-[10px] text-zinc-500">
                    OT: <span className="text-orange-500 font-bold">{fmt(emp.overtimeEarnings, sym)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
