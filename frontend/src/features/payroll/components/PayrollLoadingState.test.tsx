import { render, screen } from '@testing-library/react'
import { PayrollLoadingState } from './PayrollLoadingState'

describe('PayrollLoadingState', () => {
  it('renders skeleton placeholders', () => {
    render(<PayrollLoadingState />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(7)
  })

  it('renders 5 tab placeholders in grid', () => {
    render(<PayrollLoadingState />)
    const gridItems = document.querySelectorAll('.bg-zinc-100.animate-pulse')
    expect(gridItems.length).toBeGreaterThanOrEqual(5)
  })

  it('renders header skeleton', () => {
    render(<PayrollLoadingState />)
    const headerSkeletons = document.querySelectorAll('.border-b .animate-pulse')
    expect(headerSkeletons.length).toBe(2)
  })
})
