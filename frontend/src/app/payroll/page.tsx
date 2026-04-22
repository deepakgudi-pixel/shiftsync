'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { getInitials, cn } from '@/lib/utils'
import { DollarSign, Clock, Download } from 'lucide-react'

export default function PayrollPage() {
  const api = useApi()
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [member, setMember] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const me = await api.get('/api/members/me')
      setMember(me.data)
      if (me.data.role !== 'EMPLOYEE') {
        const ts = await api.get('/api/attendance/timesheet')
        setTimesheets(ts.data)
      } else {
        const ts = await api.get('/api/attendance/timesheet/me')
        setTimesheets([{ id: me.data.id, name: me.data.name, ...ts.data }])
      }
    }
    load()
  }, [])

  const totalCost = timesheets.reduce((s, t) => s + (t.totalEarnings || 0), 0)

  return (
    <div className="p-5 md:p-8 max-w-[1000px] mx-auto min-h-screen">
      <div className="mb-10 border-b border-zinc-200 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-black tracking-tight mb-2">Payroll</h1>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">Monthly hours and earnings summary</p>
        </div>
        {member?.role !== 'EMPLOYEE' && (
          <div className="bg-white border border-zinc-200 px-5 py-3 flex items-center gap-3 shadow-sm">
            <DollarSign size={18} className="text-black" />
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total This Month</p>
              <p className="font-bold text-black">${Math.round(totalCost).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {timesheets.map(ts => (
          <div key={ts.id} className="bg-white border border-zinc-200 p-6 rounded-none shadow-sm hover:border-zinc-300 transition-all duration-300 group">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-zinc-50 border border-zinc-100 flex items-center justify-center text-black font-bold text-base flex-shrink-0 group-hover:bg-zinc-100 transition-colors">
                {getInitials(ts.name || 'Me')}
              </div>
              <div className="flex-1">
                <p className="font-bold text-black text-[13px] uppercase tracking-widest">{ts.name}</p>
                <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">{ts.shifts?.length || ts.timesheet?.length || 0} units completed</p>
              </div>
              <div className="sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-zinc-100">
                <div className="flex items-center sm:justify-end gap-6">
                  <div className="flex flex-col">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Hours</p>
                    <p className="font-bold text-black flex items-center gap-1"><Clock size={13} className="text-zinc-300" />{ts.totalHours}h</p>
                  </div>
                  {ts.totalEarnings != null && (
                    <div className="flex flex-col">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Earnings</p>
                      <p className="font-bold text-green-600 flex items-center gap-1"><DollarSign size={13} />{Math.round(ts.totalEarnings).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {(ts.hourlyRate || ts.hourly_rate) && (
              <div className="mt-4 pt-4 border-t border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Registry Rate: <span className="text-black">${ts.hourlyRate || ts.hourly_rate} / HOUR</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {timesheets.length === 0 && (
        <div className="p-12 text-center bg-white border border-zinc-200">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Zero active payroll records</p>
        </div>
      )}
    </div>
  )
}
