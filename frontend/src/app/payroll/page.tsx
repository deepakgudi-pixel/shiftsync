'use client'
import { useState } from 'react'
import { usePayroll, type EmployeeWithRate } from '@/features/payroll/hooks/usePayroll'
import { getCurrencySymbol } from '@/features/payroll/utils'
import { PAYROLL_TABS } from '@/features/payroll/constants'
import { PayrollHeader } from '@/features/payroll/components/PayrollHeader'
import { PayrollLoadingState } from '@/features/payroll/components/PayrollLoadingState'
import { PayrollTabs } from '@/features/payroll/components/PayrollTabs'
import { OverviewTab } from '@/features/payroll/components/OverviewTab'
import { PayPeriodsTab } from '@/features/payroll/components/PayPeriodsTab'
import { OvertimeTab } from '@/features/payroll/components/OvertimeTab'
import { EmployeeRatesTab } from '@/features/payroll/components/EmployeeRatesTab'
import { PayslipsTab } from '@/features/payroll/components/PayslipsTab'
import { PayrollModals } from '@/features/payroll/components/PayrollModals'

export default function PayrollPage() {
  const payroll = usePayroll()
  const {
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
  } = payroll

  const currency = org?.currency || 'USD'
  const currencySymbol = getCurrencySymbol(currency)
  const visibleTabs = PAYROLL_TABS.filter(
    (tab) => !tab.roles || (member?.role ? tab.roles.includes(member.role) : false)
  )

  const [activeTab, setActiveTab] = useState<'overview' | 'periods' | 'overtime' | 'rates' | 'payslips'>('overview')

  if (loading) {
    return <PayrollLoadingState />
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1100px] mx-auto min-h-screen">
      <PayrollHeader
        organisationName={org?.name}
        currency={currency}
        currencySymbol={currencySymbol}
        member={member}
        totalCost={summary?.totalCost}
        onOpenCurrency={() => {
          setCurrencyForm({ currency })
          setShowModal('currency')
        }}
      />

      <PayrollTabs activeTab={activeTab} tabs={visibleTabs} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <OverviewTab
          member={member}
          summary={summary}
          timesheetData={timesheetData}
          payslips={payslips}
          payPeriods={payPeriods}
          selectedPeriodId={selectedPeriodId}
          onPeriodChange={setSelectedPeriodId}
          onDownloadPdf={downloadPdf}
        />
      )}

      {activeTab === 'periods' && member?.role !== 'EMPLOYEE' && (
        <PayPeriodsTab
          payPeriods={payPeriods}
          actionLoading={actionLoading}
          currency={currency}
          onProcess={processPayPeriod}
          onMarkPaid={markPaid}
          onReset={reprocessPayPeriod}
          onCreateNew={() => {
            const today = new Date()
            const mon = new Date(today)
            mon.setDate(today.getDate() - today.getDay() + 1)
            const sun = new Date(mon)
            sun.setDate(mon.getDate() + 13)
            setPeriodForm({
              period_type: 'BIWEEKLY',
              start_date: mon.toISOString().slice(0, 10),
              end_date: sun.toISOString().slice(0, 10),
            })
            setShowModal('createPeriod')
          }}
        />
      )}

      {activeTab === 'overtime' && member?.role !== 'EMPLOYEE' && (
        <OvertimeTab
          overtimeRules={overtimeRules}
          onDelete={deleteOvertimeRule}
          onAdd={() => setShowModal('overtime')}
        />
      )}

      {activeTab === 'rates' && member?.role !== 'EMPLOYEE' && (
        <EmployeeRatesTab
          employeeRates={employeeRates}
          currency={currency}
          onOverride={(emp: EmployeeWithRate) => {
            setRateForm({
              member_id: emp.id,
              hourly_rate: String(emp.customRate ?? emp.hourly_rate ?? ''),
              effective_from: new Date().toISOString().slice(0, 10),
            })
            setShowModal('rate')
          }}
        />
      )}

      {activeTab === 'payslips' && (
        <PayslipsTab
          payslips={payslips}
          member={member}
          currency={currency}
          onDownloadPdf={downloadPdf}
        />
      )}

      <PayrollModals
        showModal={showModal}
        onClose={() => setShowModal(null)}
        otForm={otForm}
        setOtForm={setOtForm}
        periodForm={periodForm}
        setPeriodForm={setPeriodForm}
        currencyForm={currencyForm}
        setCurrencyForm={setCurrencyForm}
        rateForm={rateForm}
        setRateForm={setRateForm}
        onSaveOvertime={saveOvertimeRule}
        onCreatePeriod={createPayPeriod}
        onSaveCurrency={saveCurrency}
        onSaveRate={saveEmployeeRate}
        actionLoading={actionLoading}
      />
    </div>
  )
}
