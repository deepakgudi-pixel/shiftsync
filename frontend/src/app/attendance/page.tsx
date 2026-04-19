'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useSocket } from '@/hooks/useSocket'
import { fmtDateTime, cn, getInitials, fmtTime } from '@/lib/utils'
import { Clock, CheckCircle, LogIn, LogOut, MapPin, Activity, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("bg-surface-100 animate-pulse rounded-[2rem]", className)} />
)

const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-white/80 border border-white/60 p-6 rounded-[2.5rem] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] flex items-center gap-5">
    <div className={cn('w-14 h-14 rounded-3xl flex items-center justify-center shadow-sm', color)}>
      <Icon size={24} strokeWidth={2.5} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-ink-tertiary opacity-60 mb-1">{label}</p>
      <p className="text-3xl font-black text-ink tracking-tighter leading-none" style={{fontFamily:'var(--font-bricolage)'}}>{value}</p>
    </div>
  </div>
)

export default function AttendancePage() {
  const api = useApi()
  const [assignedShifts, setAssignedShifts] = useState<any[]>([])
  const [inProgressShifts, setInProgressShifts] = useState<any[]>([])
  const [liveAttendance, setLiveAttendance] = useState<any[]>([])
  const [timesheet, setTimesheet] = useState<any>(null)
  const [member, setMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const socket = useSocket(member?.organisation_id, member?.id)

  const loadShifts = async (memberId: string) => {
    const sh = await api.get('/api/shifts', {
      params: {
        assigneeId: memberId,
        start: new Date(Date.now() - 24*60*60*1000).toISOString(),
        end: new Date(Date.now() + 7*24*60*60*1000).toISOString()
      }
    })
    // FIX: Include shifts that are OPEN but assigned to this user
    setAssignedShifts(sh.data.filter((s: any) => s.status === 'ASSIGNED' || s.status === 'OPEN'))
    setInProgressShifts(sh.data.filter((s: any) => s.status === 'IN_PROGRESS'))
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, tsRes] = await Promise.all([
          api.get('/api/members/me'),
          api.get('/api/attendance/timesheet/me'),
        ]);
        
        const me = meRes.data;
        setMember(me);
        setTimesheet(tsRes.data);
        
        await loadShifts(me.id);

        if (me.role !== 'EMPLOYEE') {
          const live = await api.get('/api/attendance/live')
          setLiveAttendance(live.data)
        }
      } catch (err) { console.error(err) } finally { setLoading(false) }
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
      toast.success('Clocked in!')
      if (member) await loadShifts(member.id)
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed') }
  }

  const clockOut = async (shiftId: string) => {
    try {
      await api.post('/api/attendance/clock-out', { shiftId })
      toast.success('Clocked out! Timesheet updated.')
      if (member) {
        await loadShifts(member.id)
        const ts = await api.get('/api/attendance/timesheet/me')
        setTimesheet(ts.data)
      }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                <Clock size={18} className="text-brand-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>{timesheet.totalHours}h</p>
                <p className="text-sm text-ink-tertiary">Hours this month</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle size={18} className="text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>{timesheet.timesheet.length}</p>
                <p className="text-sm text-ink-tertiary">Shifts completed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Currently clocked in — show clock out */}
      {inProgressShifts.length > 0 && (
        <div className="card p-5 mb-6 border-green-200 bg-green-50">
          <h2 className="font-semibold text-ink mb-4 flex items-center gap-2" style={{fontFamily:'var(--font-bricolage)'}}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Currently Clocked In
          </h2>
          <div className="space-y-3">
            {inProgressShifts.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-green-100">
                <div className="w-2 h-2 rounded-full flex-shrink-0 bg-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{s.title}</p>
                  <p className="text-xs text-ink-tertiary">{fmtDateTime(s.start_time)}</p>
                </div>
                <button
                  onClick={() => clockOut(s.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-medium hover:bg-red-600 active:scale-95 transition-all"
                >
                  <LogOut size={14} /> Clock Out
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready to clock in */}
      {assignedShifts.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-ink mb-4" style={{fontFamily:'var(--font-bricolage)'}}>Ready to Clock In</h2>
          <div className="space-y-3">
            {assignedShifts.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background: s.color || '#4f6eff'}} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{s.title}</p>
                  <p className="text-xs text-ink-tertiary">{fmtDateTime(s.start_time)}</p>
                </div>
                <button
                  onClick={() => clockIn(s.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 active:scale-95 transition-all"
                >
                  <LogIn size={14} /> Clock In
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live attendance — managers/admins */}
      {liveAttendance.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-ink mb-4 flex items-center gap-2" style={{fontFamily:'var(--font-bricolage)'}}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Currently On Shift ({liveAttendance.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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

      {/* Timesheet */}
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
                  <p className="text-xs text-green-600">Completed</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {assignedShifts.length === 0 && inProgressShifts.length === 0 && (
        <div className="card p-8 text-center text-ink-tertiary">
          <Clock size={32} className="mx-auto mb-3 text-ink-disabled" />
          <p className="text-sm">No upcoming shifts assigned to you</p>
        </div>
      )}
    </div>
  )
}