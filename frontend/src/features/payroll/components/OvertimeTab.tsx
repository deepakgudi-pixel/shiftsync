'use client'
import { Plus, X } from 'lucide-react'
import type { OvertimeRule } from '@/types'

type OvertimeTabProps = {
  overtimeRules: OvertimeRule[]
  onDelete: (id: string) => void
  onAdd: () => void
}

export function OvertimeTab({ overtimeRules, onDelete, onAdd }: OvertimeTabProps) {
  return (
    <div className="space-y-5">
      {overtimeRules.length > 0 && (
        <div className="grid gap-4">
          {overtimeRules.map((rule) => (
            <div key={rule.id} className="bg-white border border-zinc-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="font-bold text-sm uppercase tracking-wider">{rule.name}</h3>
                    {rule.is_active ? (
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase tracking-wider">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-wider">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Daily Threshold', value: `${rule.daily_threshold_hours}h` },
                      { label: 'Weekly Threshold', value: `${rule.weekly_threshold_hours}h` },
                      { label: 'Daily OT Multiplier', value: `${rule.daily_multiplier}x` },
                      { label: 'Weekly OT Multiplier', value: `${rule.weekly_multiplier}x` },
                    ].map((item) => (
                      <div key={item.label} className="bg-zinc-50 p-3">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{item.label}</p>
                        <p className="font-bold text-black">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => onDelete(rule.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {overtimeRules.length === 0 && (
        <div className="p-12 text-center bg-white border border-zinc-200">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No overtime rules configured</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onAdd}
          className="flex items-center gap-2 bg-black text-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors"
        >
          <Plus size={14} /> Add Overtime Rule
        </button>
      </div>
    </div>
  )
}
