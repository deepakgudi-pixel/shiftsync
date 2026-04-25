'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useSocket } from '@/hooks/useSocket'
import { useRouter } from 'next/navigation'
import { fmtDateTime, cn, getInitials, fmtTime } from '@/lib/utils'
import { Clock, CheckCircle, LogIn, LogOut, MapPin, Activity, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("bg-zinc-100 animate-pulse rounded-none", className)} />
)

export default function AttendancePage() {
  const api = useApi()
  const router = useRouter()
  const [assignedShifts, setAssignedShifts] = useState<any[]>([])
  const [inProgressShifts, setInProgressShifts] = useState<any[]>([])
  const [liveAttendance, setLiveAttendance] = useState<any[]>([])
  const [timesheet, setTimesheet] = useState<any>(null)
  const [member, setMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submittingShiftId, setSubmittingShiftId] = useState<string | null>(null)
  const socket = useSocket(member?.organisation_id, member?.id)

  const loadShifts = async (memberId: string) => {
    const sh = await api.get('/api/shifts', {
      params: {
        assigneeId: memberId,
        start: new Date(Date.now() - 24*60*60*1000).toISOString(),
        end: new Date(Date.now() + 7*24*60*60*1000).toISOString()
      }
    })
    setAssignedShifts(sh.data.filter((s: any) => s.status === 'ASSIGNED' || s.status === 'OPEN'))
    setInProgressShifts(sh.data.filter((s: any) => s.status === 'IN_PROGRESS'))
  }

  const refreshLiveAttendance = async (role?: string) => {
    if (role === 'EMPLOYEE') return
    const live = await api.get('/api/attendance/live')
    setLiveAttendance(live.data)
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
          await refreshLiveAttendance(me.role)
        }
      } catch (err: any) { 
        if (err.response?.status === 404) router.push('/onboarding')
        else {
          console.error(err)
          toast.error('Failed to load attendance data')
        }
      } finally { setLoading(false) }
    }
    load()
  }, [api, router])

  useEffect(() => {
    if (!socket) return
    socket.on('attendance:clockIn', (data: any) => {
      toast.success(`${data.memberName || 'A team member'} clocked in`)
      if (member?.role !== 'EMPLOYEE') refreshLiveAttendance(member?.role).catch(() => {})
    })
    socket.on('attendance:clockOut', (data: any) => {
      const name = data.memberName || 'A team member'
      const worked = typeof data.hoursWorked === 'number' ? ` - ${data.hoursWorked.toFixed(1)}h worked` : ''
      toast(`${name} clocked out${worked}`)
      if (member?.role !== 'EMPLOYEE') refreshLiveAttendance(member?.role).catch(() => {})
    })
    return () => { socket.off('attendance:clockIn'); socket.off('attendance:clockOut') }
  }, [socket])

  const clockIn = async (shiftId: string) => {
    try {
      setSubmittingShiftId(shiftId)
      await api.post('/api/attendance/clock-in', { shiftId })
      toast.success('Clocked in!')
      if (member) {
        await loadShifts(member.id)
        await refreshLiveAttendance(member.role)
      }
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setSubmittingShiftId(null) }
  }

  const clockOut = async (shiftId: string) => {
    try {
      setSubmittingShiftId(shiftId)
      await api.post('/api/attendance/clock-out', { shiftId })
      toast.success('Clocked out! Timesheet updated.')
      if (member) {
        await loadShifts(member.id)
        const ts = await api.get('/api/attendance/timesheet/me')
        setTimesheet(ts.data)
        await refreshLiveAttendance(member.role)
      }
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setSubmittingShiftId(null) }
  }

  if (loading) {
    return (
      <div className="p-5 md:p-8 max-w-[1000px] mx-auto min-h-screen">
        <div className="mb-10 border-b border-zinc-200 pb-8">
          <Skeleton className="h-10 w-48 mb-3" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8 max-w-[1000px] mx-auto min-h-screen">
      <div className="mb-10 border-b border-zinc-200 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-black tracking-tight mb-2">Attendance</h1>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">Clock in/out and view timesheets</p>
      </div>

      {/* Timesheet summary */}
      {timesheet && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          <div className="bg-white border border-zinc-200 p-6 rounded-none shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                <Clock size={18} className="text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">{timesheet.totalHours}h</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Hours this month</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-zinc-200 p-6 rounded-none shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                <CheckCircle size={18} className="text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">{timesheet.timesheet.length}</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Units completed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Currently clocked in — show clock out */}
      {inProgressShifts.length > 0 && (
        <div className="bg-white border border-zinc-200 p-5 mb-6 shadow-sm">
          <h2 className="text-[10px] font-bold text-black mb-4 uppercase tracking-[0.2em] border-l-2 border-black pl-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Currently Clocked In
          </h2>
          <div className="space-y-3">
            {inProgressShifts.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-100">
                <div className="w-2.5 h-2.5 bg-emerald-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-black uppercase tracking-widest">{s.title}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{fmtDateTime(s.start_time)}</p>
                </div>
                <button
                  onClick={() => clockOut(s.id)}
                  disabled={submittingShiftId === s.id}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95"
                >
                  <LogOut size={12} /> {submittingShiftId === s.id ? 'Saving...' : 'Clock Out'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready to clock in */}
      {assignedShifts.length > 0 && (
        <div className="bg-white border border-zinc-200 p-5 mb-6 shadow-sm">
          <h2 className="text-[10px] font-bold text-black mb-4 uppercase tracking-[0.2em] border-l-2 border-black pl-3">Ready to Clock In</h2>
          <div className="space-y-3">
            {assignedShifts.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-100">
                <div className="w-2.5 h-2.5 flex-shrink-0 border border-zinc-200" style={{background: s.color || '#000'}} />
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-black uppercase tracking-widest">{s.title}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{fmtDateTime(s.start_time)}</p>
                </div>
                <button
                  onClick={() => clockIn(s.id)}
                  disabled={submittingShiftId === s.id}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95"
                >
                  <LogIn size={12} /> {submittingShiftId === s.id ? 'Saving...' : 'Clock In'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live attendance — managers/admins */}
      {liveAttendance.length > 0 && (
        <div className="bg-white border border-zinc-200 p-5 mb-6 shadow-sm">
          <h2 className="text-[10px] font-bold text-black mb-4 uppercase tracking-[0.2em] border-l-2 border-black pl-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Currently On Shift ({liveAttendance.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {liveAttendance.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-100">
                <div className="w-9 h-9 bg-zinc-200 flex items-center justify-center text-zinc-500 font-bold text-[10px] flex-shrink-0 uppercase tracking-tighter">
                  {getInitials(s.member_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-black truncate uppercase tracking-widest">{s.member_name}</p>
                  <p className="text-[9px] font-bold text-zinc-400 truncate uppercase tracking-wider">{s.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timesheet */}
      {timesheet?.timesheet?.length > 0 && (
        <div className="bg-white border border-zinc-200 p-5 shadow-sm">
          <h2 className="text-[10px] font-bold text-black mb-4 uppercase tracking-[0.2em] border-l-2 border-black pl-3">This Month's Timesheet</h2>
          <div className="space-y-1">
            {timesheet.timesheet.map((row: any) => (
              <div key={row.id} className="flex items-center gap-3 p-3 border-b border-zinc-50 last:border-0 hover:bg-zinc-50 transition-colors">
                <div className="w-2 h-2 flex-shrink-0 bg-black" style={{background: row.color}} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-black uppercase tracking-widest">{row.title}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{fmtDateTime(row.start_time)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-black">{row.hoursWorked}h</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">Completed</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {assignedShifts.length === 0 && inProgressShifts.length === 0 && (
        <div className="p-12 text-center bg-white border border-zinc-200">
          <Clock size={32} className="mx-auto mb-4 text-zinc-200" />
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No upcoming shifts assigned</p>
        </div>
      )}
    </div>
  )
}
