import { render, screen } from '@testing-library/react'
import { AdminStats } from './AdminStats'
import type { DashboardAnalytics } from '@/features/dashboard/hooks/useDashboard'

const mockAnalytics: DashboardAnalytics = {
  totalMembers: 12,
  shiftsThisWeek: 25,
  openShifts: 3,
  assignedShifts: 15,
  completedThisMonth: 45,
  activeNow: 5,
  totalHours: 180.5,
  totalLaborCost: 4500,
  shiftsByDay: [],
  analyticsWindowDays: 30,
}

describe('AdminStats', () => {
  it('renders skeleton loaders when loading', () => {
    render(<AdminStats analytics={null} loading={true} />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(4)
  })

  it('renders total members stat', () => {
    render(<AdminStats analytics={mockAnalytics} loading={false} />)
    expect(screen.getByText('Total Members')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
  })

  it('renders active shifts stat', () => {
    render(<AdminStats analytics={mockAnalytics} loading={false} />)
    expect(screen.getByText('Active Shifts')).toBeTruthy()
    expect(screen.getByText('25')).toBeTruthy()
  })

  it('renders open slots stat with critical sub', () => {
    render(<AdminStats analytics={mockAnalytics} loading={false} />)
    expect(screen.getByText('Open Slots')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('Critical')).toBeTruthy()
  })

  it('renders live now stat', () => {
    render(<AdminStats analytics={mockAnalytics} loading={false} />)
    expect(screen.getByText('Live Now')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('renders 4 stat cards', () => {
    render(<AdminStats analytics={mockAnalytics} loading={false} />)
    const labels = ['Total Members', 'Active Shifts', 'Open Slots', 'Live Now']
    labels.forEach(label => {
      expect(screen.getByText(label)).toBeTruthy()
    })
  })
})
