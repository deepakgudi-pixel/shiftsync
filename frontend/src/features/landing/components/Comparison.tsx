'use client'
import { CircleCheck, CircleX } from 'lucide-react'

const LEGACY_ITEMS = [
  { t: 'Scheduling Chaos', d: 'Spreadsheets and whiteboards that allow double-bookings.' },
  { t: 'Disconnected Data', d: 'Attendance and payroll live in separate, siloed systems.' },
  { t: 'Opaque Accountability', d: 'No audit trail of who changed what, when, or why.' },
  { t: 'Delayed Sync', d: 'Important updates die in ignored email threads or group chats.' },
]

const RELAY_ITEMS = [
  { t: 'SQL-Level Validation', d: 'Hard-coded constraints make scheduling conflicts physically impossible.' },
  { t: 'Unified Ecosystem', d: 'Hours worked flow instantly into payroll—no manual reconciliation.' },
  { t: 'Immutable Audit Logs', d: 'Every write operation is logged with before/after state diffs.' },
  { t: 'Zero-Latency Updates', d: 'Socket.io broadcasts changes across all nodes in under 50ms.' },
]

export function Comparison() {
  return (
    <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center py-20 sm:py-32 z-10 sm:overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="mb-16">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">BEYOND LEGACY TOOLS</h2>
          <p className="text-white/40 uppercase tracking-[0.3em] text-[10px] font-bold">
            Designed for clarity. Built for control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-white/10 border border-white/10">
          <div className="bg-white/[0.02] p-8 md:p-12">
            <h3 className="text-white text-[10px] font-bold uppercase tracking-widest mb-10">
              Traditional Workforce Software
            </h3>
            <ul className="space-y-8">
              {LEGACY_ITEMS.map((item, i) => (
                <li key={i} className="flex gap-4">
                  <CircleX size={16} className="text-white shrink-0 mt-1" />
                  <div>
                    <p className="text-white text-sm font-bold uppercase tracking-wider mb-1">{item.t}</p>
                    <p className="text-white/40 text-xs leading-relaxed">{item.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white/[0.02] p-8 md:p-12 relative overflow-hidden">
            <h3 className="text-white text-[10px] font-bold uppercase tracking-widest mb-10">
              Relay Orchestration
            </h3>
            <ul className="space-y-8">
              {RELAY_ITEMS.map((item, i) => (
                <li key={i} className="flex gap-4">
                  <CircleCheck size={16} className="text-white shrink-0 mt-1" />
                  <div>
                    <p className="text-white text-sm font-bold uppercase tracking-wider mb-1">{item.t}</p>
                    <p className="text-white/40 text-xs leading-relaxed">{item.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
