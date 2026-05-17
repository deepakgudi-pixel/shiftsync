import { render, screen } from '@testing-library/react'
import Sidebar from '@/components/layout/Sidebar'
import { vi } from 'vitest'

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({
    user: {
      id: 'user-1',
      fullName: 'Test User',
      firstName: 'Test',
      primaryEmailAddress: { emailAddress: 'test@example.com' },
      imageUrl: '',
    },
  }),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('mock-token') }),
}))

vi.mock('@/hooks/useApi', () => ({
  useApi: () => ({
    get: vi.fn().mockResolvedValue({
      data: { id: 'member-1', role: 'ADMIN', name: 'Test User', email: 'test@example.com' },
    }),
  }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

describe('Sidebar', () => {
  it('renders the Relay logo', () => {
    render(<Sidebar />)
    expect(screen.getByText('Relay')).toBeTruthy()
  })

  it('renders all navigation items', () => {
    render(<Sidebar />)
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('Schedule')).toBeTruthy()
    expect(screen.getByText('Team')).toBeTruthy()
    expect(screen.getByText('Attendance')).toBeTruthy()
    expect(screen.getByText('Payroll')).toBeTruthy()
    expect(screen.getByText('Analytics')).toBeTruthy()
    expect(screen.getByText('Messages')).toBeTruthy()
    expect(screen.getByText('Audit Log')).toBeTruthy()
    expect(screen.getByText('Invite')).toBeTruthy()
  })

  it('renders user name', () => {
    render(<Sidebar />)
    expect(screen.getByText('Test User')).toBeTruthy()
  })

  it('renders sign out button', () => {
    render(<Sidebar />)
    expect(screen.getByText('Sign Out')).toBeTruthy()
  })

  it('highlights active nav item', () => {
    render(<Sidebar />)
    const dashboardLink = screen.getByText('Dashboard').closest('a')
    expect(dashboardLink).toBeTruthy()
    expect(dashboardLink?.className).toContain('bg-white')
  })

  it('does not show delete organisation button for non-admin', async () => {
    vi.doMock('@/hooks/useApi', () => ({
      useApi: () => ({
        get: vi.fn().mockResolvedValue({
          data: { id: 'member-1', role: 'EMPLOYEE', name: 'Test User', email: 'test@example.com' },
        }),
      }),
    }))

    const { unmount } = render(<Sidebar />)
    await vi.waitFor(() => {
      expect(screen.queryByText('Delete Organisation')).toBeNull()
    })
    unmount()
  })
})
