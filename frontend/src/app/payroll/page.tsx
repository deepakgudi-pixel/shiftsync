'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import toast from 'react-hot-toast'
import { getInitials, cn } from '@/lib/utils'
import {
  DollarSign, Clock, Download, Plus, Settings, ChevronRight,
  Calendar, Users, FileText, TrendingUp, AlertTriangle, CheckCircle2, X
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
]

const fmt = (n, sym = '$') => `${sym}${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

const tabs = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'periods', label: 'Pay Periods', icon: Calendar, roles: ['ADMIN', 'MANAGER'] },
  { id: 'overtime', label: 'Overtime Rules', icon: AlertTriangle, roles: ['ADMIN', 'MANAGER'] },
  { id: 'rates', label: 'Employee Rates', icon: DollarSign, roles: ['ADMIN', 'MANAGER'] },
  { id: 'payslips', label: 'Payslips', icon: FileText },
]

export default function PayrollPage() {
  const api = useApi()
  const [member, setMember] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [org, setOrg] = useState<any>(null)

  // Data states
  const [payPeriods, setPayPeriods] = useState<any[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [timesheetData, setTimesheetData] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [payslips, setPayslips] = useState<any[]>([])
  const [overtimeRules, setOvertimeRules] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [employeeRates, setEmployeeRates] = useState<any[]>([])

  // Modal state
  const [showModal, setShowModal] = useState<string | null>(null)

  // Form states
  const [otForm, setOtForm] = useState({ name: '', daily_threshold_hours: 8, weekly_threshold_hours: 40, daily_multiplier: 1.5, weekly_multiplier: 1.5 })
  const [periodForm, setPeriodForm] = useState({ period_type: 'BIWEEKLY', start_date: '', end_date: '' })
  const [currencyForm, setCurrencyForm] = useState({ currency: 'USD' })
  const [rateForm, setRateForm] = useState({ member_id: '', hourly_rate: '', effective_from: '' })

  const loadOrg = async () => {
    const res = await api.get('/api/organisations/me')
    setOrg(res.data)
    if (!currencyForm.currency || currencyForm.currency === 'USD') {
      setCurrencyForm({ currency: res.data.currency || 'USD' })
    }
  }

  useEffect(() => {
    const load = async () => {
      const me = await api.get('/api/members/me')
      setMember(me.data)
      await loadOrg()
      await loadPayslips()
      if (me.data.role !== 'EMPLOYEE') {
        await loadOvertimeRules()
        await loadPayPeriods()
        await loadEmployeeRates()
      }
    }
    load()
  }, [])

  const loadPayslips = async () => {
    const res = await api.get('/api/payslips')
    setPayslips(res.data)
  }

  const loadOvertimeRules = async () => {
    const res = await api.get('/api/overtime')
    setOvertimeRules(res.data)
  }

  const loadPayPeriods = async () => {
    const res = await api.get('/api/payroll/pay-periods')
    setPayPeriods(res.data)
    if (res.data.length && !selectedPeriodId) {
      const draft = res.data.find((p: any) => p.status === 'DRAFT')
      setSelectedPeriodId(draft ? draft.id : res.data[0].id)
    }
  }

  const loadEmployeeRates = async () => {
    const res = await api.get('/api/members')
    setEmployees(res.data)
    const rates = await Promise.all(res.data.map(async (m: any) => {
      const r = await api.get(`/api/payroll/employee-rates?memberId=${m.id}`)
      return { ...m, customRate: r.data?.hourly_rate, customOTMult: r.data?.overtime_multiplier }
    }))
    setEmployeeRates(rates)
  }

  useEffect(() => {
    if (selectedPeriodId && member?.role !== 'EMPLOYEE') {
      loadPeriodData(selectedPeriodId)
    }
  }, [selectedPeriodId, member])

  const loadPeriodData = async (id: string) => {
    try {
      const [ts, sm] = await Promise.all([
        api.get(`/api/payroll/pay-periods/${id}/timesheet`),
        api.get(`/api/payroll/pay-periods/${id}/summary`),
      ])
      setTimesheetData(ts.data)
      setSummary(sm.data)
    } catch (e) { /* period may have no data yet */ }
  }

  const saveOvertimeRule = async () => {
    if (overtimeRules.find(r => r.is_active)) return alert('An active rule already exists. Edit or delete it first.')
    await api.post('/api/overtime', otForm)
    await loadOvertimeRules()
    setShowModal(null)
  }

  const deleteOvertimeRule = async (id: string) => {
    if (!confirm('Delete this overtime rule?')) return
    await api.delete(`/api/overtime/${id}`)
    await loadOvertimeRules()
  }

  const createPayPeriod = async () => {
    if (!periodForm.start_date || !periodForm.end_date) return alert('Fill all fields')
    await api.post('/api/payroll/pay-periods', periodForm)
    await loadPayPeriods()
    setShowModal(null)
  }

  const processPayPeriod = async (id: string) => {
    if (!confirm('Process this pay period? This will generate payslips for all employees.')) return
    const res = await api.post(`/api/payroll/pay-periods/${id}/process`)
    await loadPayPeriods()
    await loadPayslips()
    if (selectedPeriodId === id) loadPeriodData(id)
    alert(`Generated ${res.data.payslipsGenerated} payslips`)
  }

  const markPaid = async (id: string) => {
    await api.post(`/api/payroll/pay-periods/${id}/paid`)
    await loadPayPeriods()
  }

  const saveCurrency = async () => {
    await api.put('/api/organisations/currency', { currency: currencyForm.currency })
    await loadOrg()
    setShowModal(null)
  }

  const saveEmployeeRate = async () => {
    if (!rateForm.member_id || !rateForm.hourly_rate || !rateForm.effective_from) return alert('Fill all fields')
    await api.post('/api/payroll/employee-rates', rateForm)
    await loadEmployeeRates()
    setShowModal(null)
  }

  const downloadPdf = async (payslipId: string) => {
    try {
      const res = await api.get(`/api/payslips/${payslipId}/pdf`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `payslip-${payslipId.slice(0, 8)}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Failed to download payslip')
    }
  }

  const getCurrencySym = () => {
    const c = CURRENCIES.find(c => c.code === (org?.currency || 'USD'))
    return c?.symbol || '$'
  }

  const visibleTabs = tabs.filter(t => !t.roles || t.roles.includes(member?.role))

  const statusBadge = (status: string) => {
    const cls = status === 'PAID' ? 'bg-green-100 text-green-700' :
      status === 'PROCESSED' ? 'bg-blue-100 text-blue-700' :
      'bg-yellow-100 text-yellow-700'
    return <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider', cls)}>{status}</span>
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1100px] mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-6 border-b border-zinc-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-black tracking-tight">Payroll</h1>
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1">
            {org?.name || 'Organization'}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {org && (member?.role === 'ADMIN' || member?.can_manage_rates) && (
            <button
              onClick={() => { setCurrencyForm({ currency: org.currency || 'USD' }); setShowModal('currency') }}
              className="text-[10px] md:text-[11px] font-bold text-zinc-500 hover:text-black uppercase tracking-wider border border-zinc-200 px-2 md:px-3 py-1.5 rounded hover:bg-zinc-50 transition-colors shrink-0"
            >
              {org.currency || 'USD'}
            </button>
          )}
          {member?.role !== 'EMPLOYEE' && summary && (
            <div className="bg-black text-white px-3 py-2 md:px-4 md:py-2.5 flex items-center gap-2">
              <DollarSign size={13} className="shrink-0 md:size-[15]" />
              <div>
                <p className="text-[8px] md:text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Total Cost</p>
                <p className="font-bold text-xs md:text-sm">{fmt(summary.totalCost, getCurrencySym())}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-0 border-b border-zinc-200 mb-6 md:mb-8">
        {visibleTabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {member?.role !== 'EMPLOYEE' && payPeriods.length > 0 && (
            <div className="flex items-center gap-4 mb-4">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Pay Period:</label>
              <select
                value={selectedPeriodId || ''}
                onChange={e => setSelectedPeriodId(e.target.value)}
                className="border border-zinc-200 px-3 py-2 text-sm font-bold bg-white"
              >
                {payPeriods.map(p => (
                  <option key={p.id} value={p.id}>
                    {new Date(p.start_date).toLocaleDateString()} — {new Date(p.end_date).toLocaleDateString()} ({p.period_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Employees', value: summary.employeeCount, icon: Users, color: 'text-blue-600' },
                { label: 'Total Hours', value: `${summary.totalHours}h`, icon: Clock, color: 'text-zinc-600' },
                { label: 'Base Pay', value: fmt(summary.totalBaseEarnings, getCurrencySym()), icon: DollarSign, color: 'text-green-600' },
                { label: 'Overtime Cost', value: fmt(summary.totalOvertimeEarnings, getCurrencySym()), icon: TrendingUp, color: 'text-orange-500' },
              ].map(card => (
                <div key={card.label} className="bg-white border border-zinc-200 p-5">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{card.label}</p>
                  <p className={cn('text-xl font-bold flex items-center gap-2', card.color)}>
                    <card.icon size={18} />{card.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {timesheetData?.employees?.length > 0 && (
            <div className="bg-white border border-zinc-200">
              <div className="px-4 md:px-6 py-4 border-b border-zinc-100">
                <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-black">Employee Breakdown</h3>
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Employee</th>
                      <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Hrs</th>
                      <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">OT Hrs</th>
                      <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Base</th>
                      <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">OT Pay</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheetData.employees.map((emp: any) => (
                      <tr key={emp.employeeId} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                              {getInitials(emp.name)}
                            </div>
                            <span className="font-bold text-xs uppercase tracking-wider truncate">{emp.name}</span>
                          </div>
                        </td>
                        <td className="text-right px-3 py-4 font-bold text-sm">{emp.totalHours}h</td>
                        <td className="text-right px-3 py-4">
                          {emp.overtimeHours > 0
                            ? <span className="text-orange-500 font-bold text-sm">{emp.overtimeHours}h</span>
                            : <span className="text-zinc-300 text-sm">—</span>}
                        </td>
                        <td className="text-right px-3 py-4 font-bold text-sm text-green-600">{fmt(emp.baseEarnings, getCurrencySym())}</td>
                        <td className="text-right px-3 py-4">
                          {emp.overtimeEarnings > 0
                            ? <span className="text-orange-500 font-bold text-sm">{fmt(emp.overtimeEarnings, getCurrencySym())}</span>
                            : <span className="text-zinc-300 text-sm">—</span>}
                        </td>
                        <td className="text-right px-4 py-4 font-bold text-black">{fmt(emp.totalEarnings, getCurrencySym())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile card view */}
              <div className="md:hidden divide-y divide-zinc-100">
                {timesheetData.employees.map((emp: any) => (
                  <div key={emp.employeeId} className="p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(emp.name)}
                      </div>
                      <span className="font-bold text-xs uppercase tracking-wider truncate">{emp.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-zinc-50 p-2">
                        <p className="text-[9px] text-zinc-400 uppercase tracking-wider">Hours</p>
                        <p className="font-bold text-sm mt-0.5">{emp.totalHours}h</p>
                      </div>
                      <div className="bg-zinc-50 p-2">
                        <p className="text-[9px] text-zinc-400 uppercase tracking-wider">OT Hrs</p>
                        <p className="font-bold text-sm mt-0.5 text-orange-500">{emp.overtimeHours > 0 ? `${emp.overtimeHours}h` : '—'}</p>
                      </div>
                      <div className="bg-zinc-50 p-2">
                        <p className="text-[9px] text-zinc-400 uppercase tracking-wider">Total</p>
                        <p className="font-bold text-sm mt-0.5 text-black">{fmt(emp.totalEarnings, getCurrencySym())}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500">Base: <span className="text-green-600 font-bold">{fmt(emp.baseEarnings, getCurrencySym())}</span></span>
                        {emp.overtimeEarnings > 0 && (
                          <span className="text-[10px] text-zinc-500">OT: <span className="text-orange-500 font-bold">{fmt(emp.overtimeEarnings, getCurrencySym())}</span></span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {timesheetData?.employees?.length === 0 && (
            <div className="p-8 md:p-12 text-center bg-white border border-zinc-200">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No timesheet data for this period</p>
            </div>
          )}

          {member?.role === 'EMPLOYEE' && payslips.length > 0 && (
            <div className="bg-white border border-zinc-200">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-zinc-100">
                <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-black">My Payslips</h3>
              </div>
              <div className="divide-y divide-zinc-100">
                {payslips.map(ps => (
                  <div key={ps.id} className="px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-xs uppercase tracking-wider truncate">{ps.period_type} Payslip</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {new Date(ps.start_date).toLocaleDateString()} — {new Date(ps.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-green-600 text-sm">{fmt(ps.total_earnings, getCurrencySym())}</span>
                      {statusBadge(ps.status)}
                      <button onClick={() => downloadPdf(ps.id)} className="text-zinc-400 hover:text-black transition-colors p-1">
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== PAY PERIODS TAB ===== */}
      {activeTab === 'periods' && member?.role !== 'EMPLOYEE' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              onClick={() => {
                // default to biweekly starting last Monday
                const today = new Date()
                const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1)
                const sun = new Date(mon); sun.setDate(mon.getDate() + 13)
                setPeriodForm({ period_type: 'BIWEEKLY', start_date: mon.toISOString().slice(0, 10), end_date: sun.toISOString().slice(0, 10) })
                setShowModal('createPeriod')
              }}
              className="flex items-center gap-2 bg-black text-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors"
            >
              <Plus size={14} /> New Pay Period
            </button>
          </div>

          {payPeriods.length === 0 && (
            <div className="p-12 text-center bg-white border border-zinc-200">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No pay periods created yet</p>
            </div>
          )}

          <div className="space-y-3">
            {payPeriods.map(pp => (
              <div key={pp.id} className="bg-white border border-zinc-200 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-bold text-sm uppercase tracking-wider">{pp.period_type}</p>
                    {statusBadge(pp.status)}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">
                    {new Date(pp.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} 
                    {' — '}
                    {new Date(pp.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {pp.total_cost && pp.status !== 'DRAFT' && (
                    <p className="text-xs font-bold text-green-600 mt-1">Total: {fmt(parseFloat(pp.total_cost), getCurrencySym())}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {pp.status === 'DRAFT' && (
                    <button
                      onClick={() => processPayPeriod(pp.id)}
                      className="text-[11px] font-bold bg-blue-600 text-white px-4 py-2 uppercase tracking-wider hover:bg-blue-700 transition-colors"
                    >
                      Process
                    </button>
                  )}
                  {pp.status === 'PROCESSED' && (
                    <button
                      onClick={() => markPaid(pp.id)}
                      className="text-[11px] font-bold bg-green-600 text-white px-4 py-2 uppercase tracking-wider hover:bg-green-700 transition-colors"
                    >
                      Mark Paid
                    </button>
                  )}
                  {pp.payslip_count > 0 && (
                    <span className="text-[10px] font-bold text-zinc-400">{pp.payslip_count} payslips</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== OVERTIME TAB ===== */}
      {activeTab === 'overtime' && member?.role !== 'EMPLOYEE' && (
        <div className="space-y-5">
          {overtimeRules.length > 0 && (
            <div className="grid gap-4">
              {overtimeRules.map(rule => (
                <div key={rule.id} className="bg-white border border-zinc-200 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="font-bold text-sm uppercase tracking-wider">{rule.name}</h3>
                        {rule.is_active
                          ? <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase tracking-wider">Active</span>
                          : <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-wider">Inactive</span>}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Daily Threshold', value: `${rule.daily_threshold_hours}h` },
                          { label: 'Weekly Threshold', value: `${rule.weekly_threshold_hours}h` },
                          { label: 'Daily OT Multiplier', value: `${rule.daily_multiplier}x` },
                          { label: 'Weekly OT Multiplier', value: `${rule.weekly_multiplier}x` },
                        ].map(item => (
                          <div key={item.label} className="bg-zinc-50 p-3">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{item.label}</p>
                            <p className="font-bold text-black">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => deleteOvertimeRule(rule.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
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
              onClick={() => setShowModal('overtime')}
              className="flex items-center gap-2 bg-black text-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors"
            >
              <Plus size={14} /> Add Overtime Rule
            </button>
          </div>
        </div>
      )}

      {/* ===== EMPLOYEE RATES TAB ===== */}
      {activeTab === 'rates' && member?.role !== 'EMPLOYEE' && (
        <div className="bg-white border border-zinc-200">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-black">Employee Rates</h3>
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Employee</th>
                  <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Base Rate</th>
                  <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">OT Mult</th>
                  <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Custom</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeRates.map(emp => (
                  <tr key={emp.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{getInitials(emp.name)}</div>
                        <span className="font-bold text-xs uppercase tracking-wider truncate">{emp.name}</span>
                      </div>
                    </td>
                    <td className="text-right px-3 py-4 font-bold text-sm">{emp.hourly_rate ? fmt(emp.hourly_rate, getCurrencySym()) + '/hr' : '—'}</td>
                    <td className="text-right px-3 py-4 text-sm text-zinc-500">{emp.customOTMult || '1.5x'}</td>
                    <td className="text-right px-3 py-4">
                      {emp.customRate
                        ? <span className="font-bold text-sm text-green-600">{fmt(emp.customRate, getCurrencySym())}/hr</span>
                        : <span className="text-zinc-300 text-sm">Default</span>}
                    </td>
                    <td className="text-right px-4 py-4">
                      <button
                        onClick={() => { setRateForm({ member_id: emp.id, hourly_rate: emp.customRate || emp.hourly_rate || '', effective_from: new Date().toISOString().slice(0, 10) }); setShowModal('rate') }}
                        className="text-[10px] font-bold text-zinc-400 hover:text-black uppercase tracking-wider border border-zinc-200 px-3 py-1.5 rounded hover:bg-zinc-50 transition-colors"
                      >
                        Override
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-zinc-100">
            {employeeRates.map(emp => (
              <div key={emp.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{getInitials(emp.name)}</div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs uppercase tracking-wider truncate">{emp.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{emp.hourly_rate ? fmt(emp.hourly_rate, getCurrencySym()) + '/hr' : 'No rate'}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setRateForm({ member_id: emp.id, hourly_rate: emp.customRate || emp.hourly_rate || '', effective_from: new Date().toISOString().slice(0, 10) }); setShowModal('rate') }}
                  className="text-[10px] font-bold text-zinc-400 hover:text-black uppercase tracking-wider border border-zinc-200 px-3 py-1.5 rounded hover:bg-zinc-50 transition-colors shrink-0"
                >
                  Override
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== PAYSLIPS TAB ===== */}
      {activeTab === 'payslips' && (
        <div className="bg-white border border-zinc-200">
          {payslips.length === 0 && (
            <div className="p-8 md:p-12 text-center">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No payslips generated yet</p>
              {member?.role !== 'EMPLOYEE' && <p className="text-[10px] text-zinc-400 mt-1">Process a pay period to generate payslips</p>}
            </div>
          )}
          {payslips.length > 0 && (
            <div className="divide-y divide-zinc-100 md:divide-y-0">
              {/* Mobile: card view, Desktop: table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Employee</th>
                      <th className="text-left px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Period</th>
                      <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Base</th>
                      <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">OT</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total</th>
                      <th className="text-right px-3 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                      <th className="px-2 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslips.map(ps => (
                      <tr key={ps.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-bold text-xs uppercase tracking-wider truncate max-w-[100px]">{ps.employee_name}</p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="text-xs text-zinc-500 truncate max-w-[120px]">{ps.period_type}</p>
                          <p className="text-[10px] text-zinc-400 truncate max-w-[120px]">{new Date(ps.start_date).toLocaleDateString()} — {new Date(ps.end_date).toLocaleDateString()}</p>
                        </td>
                        <td className="text-right px-3 py-4 font-bold text-sm text-zinc-700">{fmt(ps.base_earnings, getCurrencySym())}</td>
                        <td className="text-right px-3 py-4">
                          {parseFloat(ps.overtime_earnings) > 0
                            ? <span className="text-orange-500 font-bold text-sm">{fmt(ps.overtime_earnings, getCurrencySym())}</span>
                            : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="text-right px-4 py-4 font-bold text-black">{fmt(ps.total_earnings, getCurrencySym())}</td>
                        <td className="text-right px-3 py-4">{statusBadge(ps.status)}</td>
                        <td className="px-2 py-4">
                          <button onClick={() => downloadPdf(ps.id)} className="text-zinc-400 hover:text-black transition-colors">
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile card view */}
              <div className="md:hidden divide-y divide-zinc-100">
                {payslips.map(ps => (
                  <div key={ps.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wider truncate">{ps.employee_name}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{ps.period_type}</p>
                      </div>
                      {statusBadge(ps.status)}
                    </div>
                    <p className="text-[10px] text-zinc-400">{new Date(ps.start_date).toLocaleDateString()} — {new Date(ps.end_date).toLocaleDateString()}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase tracking-wider">Base</p>
                          <p className="font-bold text-xs text-zinc-700">{fmt(ps.base_earnings, getCurrencySym())}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase tracking-wider">OT</p>
                          <p className="font-bold text-xs text-orange-500">
                            {parseFloat(ps.overtime_earnings) > 0 ? fmt(ps.overtime_earnings, getCurrencySym()) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase tracking-wider">Total</p>
                          <p className="font-bold text-sm text-black">{fmt(ps.total_earnings, getCurrencySym())}</p>
                        </div>
                      </div>
                      <button onClick={() => downloadPdf(ps.id)} className="text-zinc-400 hover:text-black transition-colors p-2">
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(null)}>
          <div className="bg-white w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg uppercase tracking-wider">
                {showModal === 'overtime' && 'Overtime Rule'}
                {showModal === 'createPeriod' && 'New Pay Period'}
                {showModal === 'currency' && 'Currency'}
                {showModal === 'rate' && 'Override Rate'}
              </h3>
              <button onClick={() => setShowModal(null)} className="text-zinc-400 hover:text-black"><X size={20} /></button>
            </div>

            {showModal === 'overtime' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Rule Name</label>
                  <input className="w-full border border-zinc-200 px-3 py-2 text-sm" value={otForm.name} onChange={e => setOtForm({ ...otForm, name: e.target.value })} placeholder="Default Overtime Rule" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Daily Threshold (hrs)</label>
                    <input className="w-full border border-zinc-200 px-3 py-2 text-sm" type="number" value={otForm.daily_threshold_hours} onChange={e => setOtForm({ ...otForm, daily_threshold_hours: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Weekly Threshold (hrs)</label>
                    <input className="w-full border border-zinc-200 px-3 py-2 text-sm" type="number" value={otForm.weekly_threshold_hours} onChange={e => setOtForm({ ...otForm, weekly_threshold_hours: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Daily OT Multiplier</label>
                    <input className="w-full border border-zinc-200 px-3 py-2 text-sm" type="number" step="0.1" value={otForm.daily_multiplier} onChange={e => setOtForm({ ...otForm, daily_multiplier: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Weekly OT Multiplier</label>
                    <input className="w-full border border-zinc-200 px-3 py-2 text-sm" type="number" step="0.1" value={otForm.weekly_multiplier} onChange={e => setOtForm({ ...otForm, weekly_multiplier: parseFloat(e.target.value) })} />
                  </div>
                </div>
                <button onClick={saveOvertimeRule} className="w-full bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors">Save Rule</button>
              </div>
            )}

            {showModal === 'createPeriod' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Period Type</label>
                  <select className="w-full border border-zinc-200 px-3 py-2 text-sm" value={periodForm.period_type} onChange={e => setPeriodForm({ ...periodForm, period_type: e.target.value })}>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Biweekly</option>
                    <option value="SEMI_MONTHLY">Semi-Monthly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Start Date</label>
                  <input className="w-full border border-zinc-200 px-3 py-2 text-sm" type="date" value={periodForm.start_date} onChange={e => setPeriodForm({ ...periodForm, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">End Date</label>
                  <input className="w-full border border-zinc-200 px-3 py-2 text-sm" type="date" value={periodForm.end_date} onChange={e => setPeriodForm({ ...periodForm, end_date: e.target.value })} />
                </div>
                <button onClick={createPayPeriod} className="w-full bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors">Create Period</button>
              </div>
            )}

            {showModal === 'currency' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Select Currency</label>
                  <select className="w-full border border-zinc-200 px-3 py-2 text-sm" value={currencyForm.currency} onChange={e => setCurrencyForm({ currency: e.target.value })}>
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
                    ))}
                  </select>
                </div>
                <button onClick={saveCurrency} className="w-full bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors">Save Currency</button>
              </div>
            )}

            {showModal === 'rate' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Hourly Rate</label>
                  <input className="w-full border border-zinc-200 px-3 py-2 text-sm" type="number" step="0.01" value={rateForm.hourly_rate} onChange={e => setRateForm({ ...rateForm, hourly_rate: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Effective From</label>
                  <input className="w-full border border-zinc-200 px-3 py-2 text-sm" type="date" value={rateForm.effective_from} onChange={e => setRateForm({ ...rateForm, effective_from: e.target.value })} />
                </div>
                <button onClick={saveEmployeeRate} className="w-full bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors">Save Rate</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}