'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useApi } from '@/hooks/useApi'
import { cn, fmtDateTime, fmtRelative } from '@/lib/utils'
import { FileText, Plus, Pencil, Trash2, Clock, CheckCircle, XCircle, ArrowRightLeft, Filter, ChevronLeft, ChevronRight, User } from 'lucide-react'

interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string
  old_values: any
  new_values: any
  member_name: string
  member_avatar: string
  ip_address: string
  created_at: string
}

const ACTION_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  CREATE:    { icon: Plus,       color: 'text-black',   bg: 'bg-zinc-50' },
  UPDATE:    { icon: Pencil,    color: 'text-black',     bg: 'bg-zinc-50' },
  DELETE:    { icon: Trash2,     color: 'text-black',      bg: 'bg-zinc-50' },
  CLOCK_IN:  { icon: Clock,      color: 'text-black',     bg: 'bg-zinc-50' },
  CLOCK_OUT: { icon: CheckCircle, color: 'text-black',   bg: 'bg-zinc-50' },
  APPROVE:   { icon: CheckCircle, color: 'text-black',  bg: 'bg-zinc-50' },
  REJECT:    { icon: XCircle,    color: 'text-black',     bg: 'bg-zinc-50' },
  REQUEST:   { icon: ArrowRightLeft, color: 'text-black', bg: 'bg-zinc-50' },
}

const ENTITY_LABELS: Record<string, string> = {
  shift: 'Shift',
  member: 'Member',
  swap_request: 'Swap Request',
  clock_event: 'Clock Event',
  announcement: 'Announcement',
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("bg-zinc-100 animate-pulse rounded-none", className)} />
)

export default function AuditPage() {
  const { user, isLoaded, isSignedIn } = useUser()
  const api = useApi()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [member, setMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 50 })
  const [filters, setFilters] = useState({ action: '', entity_type: '', start: '', end: '' })

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const init = async () => {
      try {
        const me = await api.get('/api/members/me')
        setMember(me.data)
      } catch (err) { console.error(err) }
    }
    init()
  }, [isLoaded, isSignedIn, api])

  useEffect(() => {
    if (!member) return
    if (member.role !== 'ADMIN' && member.role !== 'MANAGER') return
    loadLogs(1)
  }, [member])

  const loadLogs = async (page: number) => {
    setLoading(true)
    try {
      const params: any = { page, limit: 50 }
      if (filters.action) params.action = filters.action
      if (filters.entity_type) params.entity_type = filters.entity_type
      if (filters.start) params.start = filters.start
      if (filters.end) params.end = filters.end
      const r = await api.get('/api/audit-logs', { params })
      setLogs(r.data.logs)
      setPagination(r.data.pagination)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(f => ({ ...f, [key]: value }))
  }

  const applyFilters = () => {
    loadLogs(1)
  }

  const clearFilters = () => {
    setFilters({ action: '', entity_type: '', start: '', end: '' })
    loadLogs(1)
  }

  if (!isLoaded || !isSignedIn) return null
  if (member && member.role !== 'ADMIN' && member.role !== 'MANAGER') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h1 className="text-xl font-bold text-black mb-2 uppercase tracking-widest">Access Restricted</h1>
        <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Only administrators and managers can view audit logs.</p>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8 max-w-[1200px] mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-10 border-b border-zinc-200 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-black tracking-tight mb-2">Audit Log</h1>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">Track all changes and activity</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-zinc-200 p-6 rounded-none shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-[10px] font-bold text-black uppercase tracking-[0.2em] border-l-2 border-black pl-3">Filters</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <select
            className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors appearance-none"
            value={filters.action}
            onChange={e => handleFilterChange('action', e.target.value)}
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="CLOCK_IN">Clock In</option>
            <option value="CLOCK_OUT">Clock Out</option>
            <option value="APPROVE">Approve</option>
            <option value="REJECT">Reject</option>
            <option value="REQUEST">Request</option>
          </select>
          <select
            className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors appearance-none"
            value={filters.entity_type}
            onChange={e => handleFilterChange('entity_type', e.target.value)}
          >
            <option value="">All Entities</option>
            <option value="shift">Shift</option>
            <option value="member">Member</option>
            <option value="swap_request">Swap Request</option>
            <option value="clock_event">Clock Event</option>
            <option value="announcement">Announcement</option>
          </select>
          <input
            type="date"
            className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors"
            value={filters.start}
            onChange={e => handleFilterChange('start', e.target.value)}
            placeholder="From date"
          />
          <input
            type="date"
            className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors"
            value={filters.end}
            onChange={e => handleFilterChange('end', e.target.value)}
            placeholder="To date"
          />
          <div className="flex gap-2 flex-col sm:flex-row">
            <button onClick={applyFilters} className="flex-1 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all">Apply</button>
            <button onClick={clearFilters} className="px-4 py-2 border border-zinc-200 text-black text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-50 transition-all">Clear</button>
          </div>
        </div>
      </div>

      {/* Log list */}
      <div className="space-y-4">
        {loading ? (
          [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32" />)
        ) : logs.length === 0 ? (
          <div className="p-12 text-center bg-white border border-zinc-200">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Zero activity logs recorded</p>
          </div>
        ) : (
          logs.map(log => {
            const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.UPDATE
            const Icon = config.icon
            return (
              <div key={log.id} className="bg-white border border-zinc-200 p-6 rounded-none shadow-sm hover:border-zinc-300 transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 flex items-center justify-center flex-shrink-0 border border-zinc-100', config.bg)}>
                      <Icon size={18} className={config.color} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-black uppercase tracking-widest">
                        {log.member_name || 'System'}
                      </p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">
                        {log.action} {ENTITY_LABELS[log.entity_type] || log.entity_type}
                        {log.entity_id && <span className="text-zinc-300 font-mono"> // {log.entity_id.slice(0, 8)}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={cn('text-[8px] font-black px-1.5 py-0.5 uppercase tracking-tighter bg-zinc-100 text-zinc-500 border border-zinc-200')}>{log.action}</span>
                    <p className="text-[9px] font-bold text-zinc-400 mt-2 uppercase tracking-widest">{fmtDateTime(log.created_at)}</p>
                    <p className="text-[8px] font-black text-zinc-300 uppercase tracking-tighter">{fmtRelative(log.created_at)}</p>
                  </div>
                </div>

                {/* Diff view for UPDATE/DELETE */}
                {(log.action === 'UPDATE' || log.action === 'DELETE') && log.old_values && log.new_values && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-none">
                      <p className="text-[9px] font-black uppercase text-zinc-300 tracking-widest mb-3">Previous State</p>
                      <pre className="text-[10px] font-mono text-zinc-600 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(log.old_values, null, 2)}
                      </pre>
                    </div>
                    <div className="p-4 bg-zinc-100 border border-zinc-200 rounded-none">
                      <p className="text-[9px] font-black uppercase text-black tracking-widest mb-3">Updated State</p>
                      <pre className="text-[10px] font-mono text-black overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(log.new_values, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* New values for CREATE/CLOCK_IN/CLOCK_OUT/REQUEST */}
                {(log.action === 'CREATE' || log.action === 'CLOCK_IN' || log.action === 'CLOCK_OUT' || log.action === 'REQUEST') && log.new_values && (
                  <div className="mt-4 p-4 bg-zinc-50 border border-zinc-100 rounded-none">
                    <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-3">Details</p>
                    <pre className="text-[10px] font-mono text-zinc-600 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(log.new_values, null, 2)}
                    </pre>
                  </div>
                )}

                {/* IP address */}
                {log.ip_address && (
                  <p className="text-[8px] font-mono text-zinc-300 mt-4 tracking-tighter uppercase">IP_ADDRESS: {log.ip_address}</p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && logs.length > 0 && (
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-zinc-200">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            {pagination.total} total entries
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadLogs(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-2 bg-white border border-zinc-200 text-black hover:bg-zinc-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[10px] font-bold text-black uppercase tracking-widest mx-2">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => loadLogs(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="p-2 bg-white border border-zinc-200 text-black hover:bg-zinc-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}