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
    <div className="p-6 max-w-[900px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>Payroll</h1>
          <p className="text-sm text-ink-tertiary mt-0.5">Monthly hours and earnings summary</p>
        </div>
        {member?.role !== 'EMPLOYEE' && (
          <div className="card px-5 py-3 flex items-center gap-3">
            <DollarSign size={18} className="text-brand-500" />
            <div>
              <p className="text-xs text-ink-tertiary">Total This Month</p>
              <p className="font-bold text-ink">${Math.round(totalCost).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {timesheets.map(ts => (
          <div key={ts.id} className="card p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-sm flex-shrink-0">
                {getInitials(ts.name || 'Me')}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink">{ts.name}</p>
                <p className="text-xs text-ink-tertiary">{ts.shifts?.length || ts.timesheet?.length || 0} shifts completed</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-ink-tertiary">Hours</p>
                    <p className="font-bold text-ink flex items-center gap-1"><Clock size={13} className="text-brand-400" />{ts.totalHours}h</p>
                  </div>
                  {ts.totalEarnings != null && (
                    <div>
                      <p className="text-xs text-ink-tertiary">Earnings</p>
                      <p className="font-bold text-green-600 flex items-center gap-1"><DollarSign size={13} />{Math.round(ts.totalEarnings).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {(ts.hourlyRate || ts.hourly_rate) && (
              <p className="text-xs text-ink-tertiary bg-surface-50 rounded-lg px-3 py-2">
                Rate: ${ts.hourlyRate || ts.hourly_rate}/hr
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
