import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders PAID status with green styling', () => {
    render(<StatusBadge status="PAID" />)
    const badge = screen.getByText('PAID')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('bg-green-100')
    expect(badge.className).toContain('text-green-700')
  })

  it('renders PROCESSED status with blue styling', () => {
    render(<StatusBadge status="PROCESSED" />)
    const badge = screen.getByText('PROCESSED')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('bg-blue-100')
    expect(badge.className).toContain('text-blue-700')
  })

  it('renders DRAFT status with yellow styling', () => {
    render(<StatusBadge status="DRAFT" />)
    const badge = screen.getByText('DRAFT')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('bg-yellow-100')
    expect(badge.className).toContain('text-yellow-700')
  })

  it('applies consistent base classes', () => {
    render(<StatusBadge status="PAID" />)
    const badge = screen.getByText('PAID')
    expect(badge.className).toContain('text-[10px]')
    expect(badge.className).toContain('font-bold')
    expect(badge.className).toContain('uppercase')
    expect(badge.className).toContain('tracking-wider')
  })
})
