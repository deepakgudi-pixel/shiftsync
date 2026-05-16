'use client'
import { X } from 'lucide-react'
import { CURRENCIES, type PayrollModalId } from '@/features/payroll/constants'
import type { OtFormState, PeriodFormState, RateFormState } from '@/features/payroll/hooks/usePayroll'

type PayrollModalsProps = {
  showModal: PayrollModalId | null
  onClose: () => void
  otForm: OtFormState
  setOtForm: (form: OtFormState) => void
  periodForm: PeriodFormState
  setPeriodForm: (form: PeriodFormState) => void
  currencyForm: { currency: string }
  setCurrencyForm: (form: { currency: string }) => void
  rateForm: RateFormState
  setRateForm: (form: RateFormState) => void
  onSaveOvertime: () => void
  onCreatePeriod: () => void
  onSaveCurrency: () => void
  onSaveRate: () => void
  actionLoading: string | null
}

export function PayrollModals({
  showModal,
  onClose,
  otForm,
  setOtForm,
  periodForm,
  setPeriodForm,
  currencyForm,
  setCurrencyForm,
  rateForm,
  setRateForm,
  onSaveOvertime,
  onCreatePeriod,
  onSaveCurrency,
  onSaveRate,
  actionLoading,
}: PayrollModalsProps) {
  if (!showModal) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-modal-title"
        className="bg-white w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 id="payroll-modal-title" className="font-bold text-lg uppercase tracking-wider">
            {showModal === 'overtime' && 'Overtime Rule'}
            {showModal === 'createPeriod' && 'New Pay Period'}
            {showModal === 'currency' && 'Currency'}
            {showModal === 'rate' && 'Override Rate'}
          </h3>
          <button aria-label="Close dialog" onClick={onClose} className="text-zinc-400 hover:text-black">
            <X size={20} />
          </button>
        </div>

        {showModal === 'overtime' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Rule Name</label>
              <input
                className="w-full border border-zinc-200 px-3 py-2 text-sm"
                value={otForm.name}
                onChange={(e) => setOtForm({ ...otForm, name: e.target.value })}
                placeholder="Default Overtime Rule"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Daily Threshold (hrs)</label>
                <input
                  className="w-full border border-zinc-200 px-3 py-2 text-sm"
                  type="number"
                  value={otForm.daily_threshold_hours}
                  onChange={(e) => setOtForm({ ...otForm, daily_threshold_hours: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Weekly Threshold (hrs)</label>
                <input
                  className="w-full border border-zinc-200 px-3 py-2 text-sm"
                  type="number"
                  value={otForm.weekly_threshold_hours}
                  onChange={(e) => setOtForm({ ...otForm, weekly_threshold_hours: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Daily OT Multiplier</label>
                <input
                  className="w-full border border-zinc-200 px-3 py-2 text-sm"
                  type="number"
                  step="0.1"
                  value={otForm.daily_multiplier}
                  onChange={(e) => setOtForm({ ...otForm, daily_multiplier: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Weekly OT Multiplier</label>
                <input
                  className="w-full border border-zinc-200 px-3 py-2 text-sm"
                  type="number"
                  step="0.1"
                  value={otForm.weekly_multiplier}
                  onChange={(e) => setOtForm({ ...otForm, weekly_multiplier: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <button
              onClick={onSaveOvertime}
              disabled={actionLoading === 'overtime'}
              className="w-full bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors disabled:opacity-60"
            >
              {actionLoading === 'overtime' ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        )}

        {showModal === 'createPeriod' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Period Type</label>
              <select
                className="w-full border border-zinc-200 px-3 py-2 text-sm"
                value={periodForm.period_type}
                onChange={(e) => setPeriodForm({ ...periodForm, period_type: e.target.value })}
              >
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Biweekly</option>
                <option value="SEMI_MONTHLY">Semi-Monthly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Start Date</label>
              <input
                className="w-full border border-zinc-200 px-3 py-2 text-sm"
                type="date"
                value={periodForm.start_date}
                onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">End Date</label>
              <input
                className="w-full border border-zinc-200 px-3 py-2 text-sm"
                type="date"
                value={periodForm.end_date}
                onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
              />
            </div>
            <button
              onClick={onCreatePeriod}
              disabled={actionLoading === 'createPeriod'}
              className="w-full bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors disabled:opacity-60"
            >
              {actionLoading === 'createPeriod' ? 'Creating...' : 'Create Period'}
            </button>
          </div>
        )}

        {showModal === 'currency' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Select Currency</label>
              <select
                className="w-full border border-zinc-200 px-3 py-2 text-sm"
                value={currencyForm.currency}
                onChange={(e) => setCurrencyForm({ currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onSaveCurrency}
              disabled={actionLoading === 'currency'}
              className="w-full bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors disabled:opacity-60"
            >
              {actionLoading === 'currency' ? 'Saving...' : 'Save Currency'}
            </button>
          </div>
        )}

        {showModal === 'rate' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Hourly Rate</label>
              <input
                className="w-full border border-zinc-200 px-3 py-2 text-sm"
                type="number"
                step="0.01"
                value={rateForm.hourly_rate}
                onChange={(e) => setRateForm({ ...rateForm, hourly_rate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Effective From</label>
              <input
                className="w-full border border-zinc-200 px-3 py-2 text-sm"
                type="date"
                value={rateForm.effective_from}
                onChange={(e) => setRateForm({ ...rateForm, effective_from: e.target.value })}
              />
            </div>
            <button
              onClick={onSaveRate}
              disabled={actionLoading === 'rate'}
              className="w-full bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors disabled:opacity-60"
            >
              {actionLoading === 'rate' ? 'Saving...' : 'Save Rate'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
