import {
  AlertTriangle,
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { Member } from '@/types'

export type PayrollTabId = 'overview' | 'periods' | 'overtime' | 'rates' | 'payslips'

export type PayrollModalId = 'overtime' | 'createPeriod' | 'currency' | 'rate'

export type CurrencyOption = {
  code: string
  symbol: string
  name: string
}

export type PayrollTab = {
  id: PayrollTabId
  label: string
  icon: LucideIcon
  roles?: Member['role'][]
}

export const CURRENCIES: CurrencyOption[] = [
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

export const PAYROLL_TABS: PayrollTab[] = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'periods', label: 'Pay Periods', icon: Calendar, roles: ['ADMIN', 'MANAGER'] },
  { id: 'overtime', label: 'Overtime Rules', icon: AlertTriangle, roles: ['ADMIN', 'MANAGER'] },
  { id: 'rates', label: 'Employee Rates', icon: DollarSign, roles: ['ADMIN', 'MANAGER'] },
  { id: 'payslips', label: 'Payslips', icon: FileText },
]
