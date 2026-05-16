import { render, screen } from '@testing-library/react'
import { PayrollHeader } from './PayrollHeader'
import type { Member } from '@/types'

const createMember = (role: Member['role']): Member => ({
  id: 'member-1',
  name: 'Test User',
  email: 'test@example.com',
  role,
  avatar_url: null,
  hourly_rate: 25,
  organisation_id: 'org-1',
  clerk_user_id: 'clerk-1',
})

describe('PayrollHeader', () => {
  it('renders the payroll title', () => {
    render(
      <PayrollHeader
        currencySymbol="$"
        member={createMember('ADMIN')}
        onOpenCurrency={() => {}}
      />
    )
    expect(screen.getByText('Payroll')).toBeTruthy()
  })

  it('renders organisation name when provided', () => {
    render(
      <PayrollHeader
        organisationName="Acme Corp"
        currencySymbol="$"
        member={createMember('ADMIN')}
        onOpenCurrency={() => {}}
      />
    )
    expect(screen.getByText('Acme Corp')).toBeTruthy()
  })

  it('shows fallback text when no organisation name', () => {
    render(
      <PayrollHeader
        currencySymbol="$"
        member={createMember('ADMIN')}
        onOpenCurrency={() => {}}
      />
    )
    expect(screen.getByText('Organization')).toBeTruthy()
  })

  it('shows total cost for admin', () => {
    render(
      <PayrollHeader
        currencySymbol="$"
        member={createMember('ADMIN')}
        totalCost={5000}
        onOpenCurrency={() => {}}
      />
    )
    expect(screen.getByText('Total Cost')).toBeTruthy()
    expect(screen.getByText('$5,000.00')).toBeTruthy()
  })

  it('shows total cost for manager', () => {
    render(
      <PayrollHeader
        currencySymbol="$"
        member={createMember('MANAGER')}
        totalCost={3000}
        onOpenCurrency={() => {}}
      />
    )
    expect(screen.getByText('$3,000.00')).toBeTruthy()
  })

  it('hides total cost for employee', () => {
    render(
      <PayrollHeader
        currencySymbol="$"
        member={createMember('EMPLOYEE')}
        totalCost={1000}
        onOpenCurrency={() => {}}
      />
    )
    expect(screen.queryByText('Total Cost')).toBeNull()
  })

  it('shows currency button for admin', () => {
    render(
      <PayrollHeader
        currency="USD"
        currencySymbol="$"
        member={createMember('ADMIN')}
        onOpenCurrency={() => {}}
      />
    )
    expect(screen.getByText('USD')).toBeTruthy()
  })

  it('hides currency button for employee', () => {
    render(
      <PayrollHeader
        currency="USD"
        currencySymbol="$"
        member={createMember('EMPLOYEE')}
        onOpenCurrency={() => {}}
      />
    )
    expect(screen.queryByText('USD')).toBeNull()
  })

  it('hides total cost when null', () => {
    render(
      <PayrollHeader
        currencySymbol="$"
        member={createMember('ADMIN')}
        totalCost={null}
        onOpenCurrency={() => {}}
      />
    )
    expect(screen.queryByText('Total Cost')).toBeNull()
  })
})
