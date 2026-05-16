import { cn } from '@/lib/utils'
import type { PayrollTab, PayrollTabId } from '../constants'

type PayrollTabsProps = {
  activeTab: PayrollTabId
  tabs: PayrollTab[]
  onChange: (tabId: PayrollTabId) => void
}

export function PayrollTabs({ activeTab, tabs, onChange }: PayrollTabsProps) {
  return (
    <div className="flex flex-wrap gap-0 border-b border-zinc-200 mb-6 md:mb-8">
      {tabs.map(tab => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2.5 md:py-3 text-[10px] md:text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all',
              activeTab === tab.id
                ? 'border-black text-black bg-white'
                : 'border-transparent text-zinc-400 hover:text-black hover:border-zinc-300'
            )}
          >
            <Icon size={12} className="md:size-[14]" /> {tab.label}
          </button>
        )
      })}
    </div>
  )
}
