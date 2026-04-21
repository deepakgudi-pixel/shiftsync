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
  CREATE:    { icon: Plus,       color: 'text-emerald-600',   bg: 'bg-emerald-50' },
  UPDATE:    { icon: Pencil,    color: 'text-amber-600',     bg: 'bg-amber-50' },
  DELETE:    { icon: Trash2,     color: 'text-rose-600',      bg: 'bg-rose-50' },
  CLOCK_IN:  { icon: Clock,      color: 'text-brand-600',     bg: 'bg-brand-50' },
  CLOCK_OUT: { icon: CheckCircle, color: 'text-purple-600',   bg: 'bg-purple-50' },
  APPROVE:   { icon: CheckCircle, color: 'text-emerald-600',  bg: 'bg-emerald-50' },
  REJECT:    { icon: XCircle,    color: 'text-rose-600',     bg: 'bg-rose-50' },
  REQUEST:   { icon: ArrowRightLeft, color: 'text-cyan-600', bg: 'bg-cyan-50' },
}

const ENTITY_LABELS: Record<string, string> = {
  shift: 'Shift',
  member: 'Member',
  swap_request: 'Swap Request',
  clock_event: 'Clock Event',
  announcement: 'Announcement',
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("bg-surface-100 animate-pulse rounded-2xl", className)} />
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-2xl font-black text-ink mb-2">Access Restricted</p>
          <p className="text-sm text-ink-tertiary">Only admins and managers can view audit logs.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-ink tracking-tight">Audit Log</h1>
        <p className="text-[11px] font-bold text-ink-tertiary uppercase tracking-widest opacity-60 mt-1">Track all changes and activity</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4 mb-6 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <Filter size={16} className="text-ink-tertiary" />
          <span className="text-sm font-semibold text-ink">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select
            className="input text-sm"
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
            className="input text-sm"
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
            className="input text-sm"
            value={filters.start}
            onChange={e => handleFilterChange('start', e.target.value)}
            placeholder="From date"
          />
          <input
            type="date"
            className="input text-sm"
            value={filters.end}
            onChange={e => handleFilterChange('end', e.target.value)}
            placeholder="To date"
          />
          <div className="flex gap-2">
            <button onClick={applyFilters} className="btn-primary text-sm flex-1">Apply</button>
            <button onClick={clearFilters} className="btn-secondary text-sm">Clear</button>
          </div>
        </div>
      </div>

      {/* Log list */}
      <div className="space-y-4">
        {loading ? (
          [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32" />)
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center shadow-card">
            <FileText size={40} className="mx-auto text-surface-300 mb-3" />
            <p className="text-lg font-semibold text-ink">No audit logs yet</p>
            <p className="text-sm text-ink-tertiary mt-1">Activity will appear here as changes are made.</p>
          </div>
        ) : (
          logs.map(log => {
            const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.UPDATE
            const Icon = config.icon
            return (
              <div key={log.id} className="bg-white rounded-2xl border border-surface-200 p-5 shadow-card hover:shadow-card-hover transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0', config.bg)}>
                      <Icon size={18} className={config.color} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {log.member_name || 'System'}
                      </p>
                      <p className="text-xs text-ink-tertiary">
                        {log.action} {ENTITY_LABELS[log.entity_type] || log.entity_type}
                        {log.entity_id && <span className="text-surface-300"> · {log.entity_id.slice(0, 8)}...</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={cn('badge text-xs', config.bg, config.color)}>{log.action}</span>
                    <p className="text-xs text-ink-tertiary mt-1">{fmtDateTime(log.created_at)}</p>
                    <p className="text-[10px] text-surface-300">{fmtRelative(log.created_at)}</p>
                  </div>
                </div>

                {/* Diff view for UPDATE/DELETE */}
                {(log.action === 'UPDATE' || log.action === 'DELETE') && log.old_values && log.new_values && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
                      <p className="text-[10px] font-bold uppercase text-ink-disabled mb-2">Before</p>
                      <pre className="text-xs text-ink-secondary overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.old_values, null, 2)}
                      </pre>
                    </div>
                    <div className="p-4 rounded-xl bg-brand-50 border border-brand-100">
                      <p className="text-[10px] font-bold uppercase text-brand-600 mb-2">After</p>
                      <pre className="text-xs text-ink-secondary overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.new_values, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* New values for CREATE/CLOCK_IN/CLOCK_OUT/REQUEST */}
                {(log.action === 'CREATE' || log.action === 'CLOCK_IN' || log.action === 'CLOCK_OUT' || log.action === 'REQUEST') && log.new_values && (
                  <div className="mt-4 p-4 rounded-xl bg-surface-50 border border-surface-200">
                    <p className="text-[10px] font-bold uppercase text-ink-disabled mb-2">Details</p>
                    <pre className="text-xs text-ink-secondary overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.new_values, null, 2)}
                    </pre>
                  </div>
                )}

                {/* IP address */}
                {log.ip_address && (
                  <p className="text-xs text-surface-300 mt-3">IP: {log.ip_address}</p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && logs.length > 0 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-ink-tertiary">
            {pagination.total} total entries
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadLogs(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn-secondary p-2 disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-ink">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => loadLogs(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="btn-secondary p-2 disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}