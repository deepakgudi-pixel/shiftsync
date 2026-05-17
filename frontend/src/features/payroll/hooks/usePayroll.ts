'use client'
import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import toast from 'react-hot-toast'
import { useAppLayout } from '@/components/layout/AppLayout'
import type { Member, PayPeriod, PayslipWithPeriod, OvertimeRule, PayPeriodTimesheet, PayPeriodSummary } from '@/types'
import type { PayrollModalId } from '@/features/payroll/constants'

export type OtFormState = {
  name: string
  daily_threshold_hours: number
  weekly_threshold_hours: number
  daily_multiplier: number
  weekly_multiplier: number
}

export type PeriodFormState = {
  period_type: string
  start_date: string
  end_date: string
}

export type RateFormState = {
  member_id: string
  hourly_rate: string
  effective_from: string
}

export type EmployeeWithRate = Member & {
  customRate?: number | null
  customOTMult?: number | null
}

type ApiError = { response?: { data?: { error?: string }; status?: number } }

export function usePayroll() {
  const api = useApi()
  const { setPageLoading } = useAppLayout()
  const [member, setMember] = useState<Member | null>(null)
  const [org, setOrg] = useState<{ name: string; currency: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    setPageLoading(loading)
    return () => setPageLoading(false)
  }, [loading, setPageLoading])

  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [timesheetData, setTimesheetData] = useState<PayPeriodTimesheet | null>(null)
  const [summary, setSummary] = useState<PayPeriodSummary | null>(null)
  const [payslips, setPayslips] = useState<PayslipWithPeriod[]>([])
  const [overtimeRules, setOvertimeRules] = useState<OvertimeRule[]>([])
  const [employeeRates, setEmployeeRates] = useState<EmployeeWithRate[]>([])

  const [showModal, setShowModal] = useState<PayrollModalId | null>(null)
  const [otForm, setOtForm] = useState<OtFormState>({
    name: '',
    daily_threshold_hours: 8,
    weekly_threshold_hours: 40,
    daily_multiplier: 1.5,
    weekly_multiplier: 1.5,
  })
  const [periodForm, setPeriodForm] = useState<PeriodFormState>({
    period_type: 'BIWEEKLY',
    start_date: '',
    end_date: '',
  })
  const [currencyForm, setCurrencyForm] = useState({ currency: 'USD' })
  const [rateForm, setRateForm] = useState<RateFormState>({
    member_id: '',
    hourly_rate: '',
    effective_from: '',
  })

  const loadOrg = useCallback(async () => {
    const res = await api.get('/api/organisations/me')
    setOrg(res.data)
    return res.data as { currency: string }
  }, [api])

  const loadPayslips = useCallback(async () => {
    const res = await api.get('/api/payslips')
    setPayslips(res.data)
  }, [api])

  const loadOvertimeRules = useCallback(async () => {
    const res = await api.get('/api/overtime')
    setOvertimeRules(res.data)
  }, [api])

  const loadPayPeriods = useCallback(async () => {
    const res = await api.get('/api/payroll/pay-periods')
    const periods = res.data as PayPeriod[]
    setPayPeriods(periods)
    if (periods.length) {
      const draft = periods.find((p) => p.status === 'DRAFT')
      setSelectedPeriodId((prev) => prev || (draft ? draft.id : periods[0].id))
    }
  }, [api])

  const loadEmployeeRates = useCallback(async () => {
    // Single batch query — replaces the previous N+1 per-member requests
    const res = await api.get('/api/payroll/employee-rates/all')
    const rows = res.data as (Member & {
      custom_rate: number | null
      custom_ot_mult: number | null
    })[]
    setEmployeeRates(
      rows.map((r) => ({ ...r, customRate: r.custom_rate, customOTMult: r.custom_ot_mult }))
    )
  }, [api])

  const loadPeriodData = useCallback(
    async (id: string) => {
      try {
        const [ts, sm] = await Promise.all([
          api.get(`/api/payroll/pay-periods/${id}/timesheet`),
          api.get(`/api/payroll/pay-periods/${id}/summary`),
        ])
        setTimesheetData(ts.data)
        setSummary(sm.data)
      } catch {
        setTimesheetData(null)
        setSummary(null)
      }
    },
    [api]
  )

  useEffect(() => {
    const load = async () => {
      try {
        const me = await api.get('/api/members/me')
        const memberData = me.data as Member
        setMember(memberData)
        const orgData = await loadOrg()
        await loadPayslips()
        if (memberData.role !== 'EMPLOYEE') {
          await loadOvertimeRules()
          await loadPayPeriods()
          await loadEmployeeRates()
        }
        setCurrencyForm((current) => {
          if (current.currency && current.currency !== 'USD') return current
          return { currency: orgData.currency || 'USD' }
        })
      } catch (err) {
        const error = err as ApiError
        toast.error(error.response?.data?.error || 'Failed to load payroll')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [api, loadOrg, loadPayslips, loadOvertimeRules, loadPayPeriods, loadEmployeeRates])

  useEffect(() => {
    if (selectedPeriodId && member?.role !== 'EMPLOYEE') {
      loadPeriodData(selectedPeriodId)
    }
  }, [selectedPeriodId, member, loadPeriodData])

  const saveOvertimeRule = async () => {
    if (overtimeRules.find((r) => r.is_active)) {
      toast.error('An active overtime rule already exists')
      return
    }
    setActionLoading('overtime')
    try {
      await api.post('/api/overtime', otForm)
      await loadOvertimeRules()
      setShowModal(null)
      toast.success('Overtime rule saved')
    } catch (err) {
      const error = err as ApiError
      toast.error(error.response?.data?.error || 'Failed to save overtime rule')
    } finally {
      setActionLoading(null)
    }
  }

  const deleteOvertimeRule = async (id: string) => {
    try {
      await api.delete(`/api/overtime/${id}`)
      await loadOvertimeRules()
      toast.success('Overtime rule deleted')
    } catch (err) {
      const error = err as ApiError
      toast.error(error.response?.data?.error || 'Failed to delete overtime rule')
    }
  }

  const createPayPeriod = async () => {
    if (!periodForm.start_date || !periodForm.end_date) {
      toast.error('Fill all pay period fields')
      return
    }
    if (new Date(periodForm.end_date) < new Date(periodForm.start_date)) {
      toast.error('End date must be on or after the start date')
      return
    }
    setActionLoading('createPeriod')
    try {
      await api.post('/api/payroll/pay-periods', periodForm)
      await loadPayPeriods()
      setShowModal(null)
      toast.success('Pay period created')
    } catch (err) {
      const error = err as ApiError
      toast.error(error.response?.data?.error || 'Failed to create pay period')
    } finally {
      setActionLoading(null)
    }
  }

  const processPayPeriod = async (id: string) => {
    setActionLoading(`process:${id}`)
    try {
      const res = await api.post(`/api/payroll/pay-periods/${id}/process`)
      await loadPayPeriods()
      await loadPayslips()
      if (selectedPeriodId === id) loadPeriodData(id)
      const { payslipsGenerated, skipped } = res.data as { payslipsGenerated: number; skipped: { name: string }[] }
      if (skipped?.length > 0) {
        const names = skipped.map((s) => s.name).join(', ')
        toast.success(`Generated ${payslipsGenerated} payslips. Skipped: ${names}`)
      } else {
        toast.success(`Generated ${payslipsGenerated} payslips`)
      }
    } catch (err) {
      const error = err as ApiError
      toast.error(error.response?.data?.error || 'Failed to process')
    } finally {
      setActionLoading(null)
    }
  }

  const reprocessPayPeriod = async (id: string) => {
    setActionLoading(`reset:${id}`)
    try {
      await api.delete(`/api/payroll/pay-periods/${id}/payslips`)
      await loadPayPeriods()
      if (selectedPeriodId === id) await loadPeriodData(id)
      toast.success('Period reset — you can now process again')
    } catch (err) {
      const error = err as ApiError
      toast.error(error.response?.data?.error || 'Failed to reset')
    } finally {
      setActionLoading(null)
    }
  }

  const markPaid = async (id: string) => {
    setActionLoading(`paid:${id}`)
    try {
      await api.post(`/api/payroll/pay-periods/${id}/paid`)
      await loadPayPeriods()
      toast.success('Pay period marked as paid')
    } catch (err) {
      const error = err as ApiError
      toast.error(error.response?.data?.error || 'Failed to mark pay period as paid')
    } finally {
      setActionLoading(null)
    }
  }

  const saveCurrency = async () => {
    setActionLoading('currency')
    try {
      await api.put('/api/organisations/currency', { currency: currencyForm.currency })
      await loadOrg()
      setShowModal(null)
      toast.success('Currency updated')
    } catch (err) {
      const error = err as ApiError
      toast.error(error.response?.data?.error || 'Failed to update currency')
    } finally {
      setActionLoading(null)
    }
  }

  const saveEmployeeRate = async () => {
    if (!rateForm.member_id || !rateForm.hourly_rate || !rateForm.effective_from) {
      toast.error('Fill all rate fields')
      return
    }
    setActionLoading('rate')
    try {
      await api.post('/api/payroll/employee-rates', rateForm)
      await loadEmployeeRates()
      setShowModal(null)
      toast.success('Employee rate saved')
    } catch (err) {
      const error = err as ApiError
      toast.error(error.response?.data?.error || 'Failed to save employee rate')
    } finally {
      setActionLoading(null)
    }
  }

  const downloadPdf = async (payslipId: string) => {
    try {
      const res = await api.get(`/api/payslips/${payslipId}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `payslip-${payslipId.slice(0, 8)}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download payslip')
    }
  }

  return {
    member,
    org,
    loading,
    actionLoading,
    payPeriods,
    selectedPeriodId,
    setSelectedPeriodId,
    timesheetData,
    summary,
    payslips,
    overtimeRules,
    employeeRates,
    showModal,
    setShowModal,
    otForm,
    setOtForm,
    periodForm,
    setPeriodForm,
    currencyForm,
    setCurrencyForm,
    rateForm,
    setRateForm,
    saveOvertimeRule,
    deleteOvertimeRule,
    createPayPeriod,
    processPayPeriod,
    reprocessPayPeriod,
    markPaid,
    saveCurrency,
    saveEmployeeRate,
    downloadPdf,
  }
}
