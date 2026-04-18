'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useSocket } from '@/hooks/useSocket'
import { fmtDateTime, cn, getInitials } from '@/lib/utils'
import { Clock, CheckCircle, LogIn, LogOut, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AttendancePage() {
  const api = useApi()
  const [myShifts, setMyShifts] = useState<any[]>([])
  const [liveAttendance, setLiveAttendance] = useState<any[]>([])
  const [timesheet, setTimesheet] = useState<any>(null)
  const [member, setMember] = useState<any>(null)
  const socket = useSocket(member?.organisation_id, member?.id)

  useEffect(() => {
    const load = async () => {
      try {
        const me = await api.get('/api/members/me')
        setMember(me.data)
        const [ts, sh] = await Promise.all([
          api.get('/api/attendance/timesheet/me'),
          api.get('/api/shifts', { params: { assigneeId: me.data.id, start: new Date().toISOString(), end: new Date(Date.now()+7*24*60*60*1000).toISOString() } }),
        ])
        setTimesheet(ts.data)
        setMyShifts(sh.data.filter((s: any) => s.status === 'ASSIGNED'))
        if (me.data.role !== 'EMPLOYEE') {
          const live = await api.get('/api/attendance/live')
          setLiveAttendance(live.data)
        }
      } catch (err) { console.error(err) }
    }
    load()
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('attendance:clockIn', (data: any) => {
      toast.success(`${data.memberName} clocked in`)
    })
    socket.on('attendance:clockOut', (data: any) => {
      toast(`${data.memberName} clocked out — ${data.hoursWorked?.toFixed(1)}h worked`)
    })
    return () => { socket.off('attendance:clockIn'); socket.off('attendance:clockOut') }
  }, [socket])

  const clockIn = async (shiftId: string) => {
    try {
      await api.post('/api/attendance/clock-in', { shiftId })
      toast.success('Clocked in successfully')
      setMyShifts(p => p.filter(s => s.id !== shiftId))
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed') }
  }

  return (
    <div className="p-6 max-w-[1000px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>Attendance</h1>
        <p className="text-sm text-ink-tertiary mt-0.5">Clock in/out and view timesheets</p>
      </div>

      {/* Timesheet summary */}
      {timesheet && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Clock size={18} className="text-brand-500" /></div>
              <div>
                <p className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>{timesheet.totalHours}h</p>
                <p className="text-sm text-ink-tertiary">Hours this month</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><CheckCircle size={18} className="text-green-500" /></div>
              <div>
                <p className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>{timesheet.timesheet.length}</p>
                <p className="text-sm text-ink-tertiary">Shifts completed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My upcoming shifts to clock into */}
      {myShifts.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-ink mb-4" style={{fontFamily:'var(--font-bricolage)'}}>Ready to Clock In</h2>
          <div className="space-y-3">
            {myShifts.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background: s.color || '#4f6eff'}} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{s.title}</p>
                  <p className="text-xs text-ink-tertiary">{fmtDateTime(s.start_time)}</p>
                </div>
                <button onClick={() => clockIn(s.id)} className="btn-primary flex items-center gap-1.5 py-2 text-xs">
                  <LogIn size={14} /> Clock In
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live attendance (managers only) */}
      {liveAttendance.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-ink mb-4 flex items-center gap-2" style={{fontFamily:'var(--font-bricolage)'}}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Currently On Shift ({liveAttendance.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {liveAttendance.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-green-100 bg-green-50">
                <div className="w-9 h-9 rounded-lg bg-green-200 flex items-center justify-center text-green-700 font-semibold text-xs flex-shrink-0">
                  {getInitials(s.member_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{s.member_name}</p>
                  <p className="text-xs text-ink-tertiary truncate">{s.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timesheet list */}
      {timesheet?.timesheet?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-4" style={{fontFamily:'var(--font-bricolage)'}}>This Month's Timesheet</h2>
          <div className="space-y-2">
            {timesheet.timesheet.map((row: any) => (
              <div key={row.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 transition-colors">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background: row.color || '#4f6eff'}} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{row.title}</p>
                  <p className="text-xs text-ink-tertiary">{fmtDateTime(row.start_time)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">{row.hoursWorked}h</p>
                  <p className="text-xs text-ink-tertiary">{row.clock_in ? 'Completed' : 'No clock data'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
