import { render, screen } from '@testing-library/react'
import { UpcomingShifts } from './UpcomingShifts'
import type { DashboardShift } from '@/features/dashboard/hooks/useDashboard'
import type { Member } from '@/types'

const createShift = (overrides: Partial<DashboardShift> = {}): DashboardShift => ({
  id: 'shift-1',
  title: 'Morning Shift',
  start_time: '2026-05-16T09:00:00Z',
  end_time: '2026-05-16T17:00:00Z',
  status: 'ASSIGNED',
  assignee_id: 'member-1',
  assignee_name: 'Test User',
  organisation_id: 'org-1',
  color: '#4f6eff',
  location: null,
  notes: null,
  created_at: '2026-05-15T00:00:00Z',
  updated_at: '2026-05-15T00:00:00Z',
  ...overrides,
})

const createMember = (overrides: Partial<Member> = {}): Member => ({
  id: 'member-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'EMPLOYEE',
  avatar_url: null,
  hourly_rate: 25,
  organisation_id: 'org-1',
  clerk_user_id: 'clerk-1',
  ...overrides,
})

describe('UpcomingShifts', () => {
  it('renders empty state when no shifts', () => {
    render(<UpcomingShifts shifts={[]} member={createMember()} onRequestSwap={() => {}} />)
    expect(screen.getByText('No upcoming shifts')).toBeTruthy()
  })

  it('renders shift title', () => {
    const shifts = [createShift()]
    render(<UpcomingShifts shifts={shifts} member={createMember()} onRequestSwap={() => {}} />)
    expect(screen.getByText('Morning Shift')).toBeTruthy()
  })

  it('renders shift status', () => {
    const shifts = [createShift({ status: 'ASSIGNED' })]
    render(<UpcomingShifts shifts={shifts} member={createMember()} onRequestSwap={() => {}} />)
    expect(screen.getByText('ASSIGNED')).toBeTruthy()
  })

  it('shows swap button for assigned shifts owned by member', () => {
    const shifts = [createShift({ status: 'ASSIGNED', assignee_id: 'member-1' })]
    render(<UpcomingShifts shifts={shifts} member={createMember({ id: 'member-1' })} onRequestSwap={() => {}} />)
    expect(screen.getByText('Request Swap')).toBeTruthy()
  })

  it('hides swap button for non-assigned shifts', () => {
    const shifts = [createShift({ status: 'OPEN', assignee_id: null })]
    render(<UpcomingShifts shifts={shifts} member={createMember()} onRequestSwap={() => {}} />)
    expect(screen.queryByText('Request Swap')).toBeNull()
  })

  it('hides swap button for shifts not owned by member', () => {
    const shifts = [createShift({ status: 'ASSIGNED', assignee_id: 'member-2' })]
    render(<UpcomingShifts shifts={shifts} member={createMember({ id: 'member-1' })} onRequestSwap={() => {}} />)
    expect(screen.queryByText('Request Swap')).toBeNull()
  })

  it('hides swap button for in-progress shifts', () => {
    const shifts = [createShift({ status: 'IN_PROGRESS', assignee_id: 'member-1' })]
    render(<UpcomingShifts shifts={shifts} member={createMember({ id: 'member-1' })} onRequestSwap={() => {}} />)
    expect(screen.queryByText('Request Swap')).toBeNull()
  })

  it('calls onRequestSwap when swap button clicked', () => {
    const onRequestSwap = vi.fn()
    const shift = createShift({ status: 'ASSIGNED', assignee_id: 'member-1' })
    render(<UpcomingShifts shifts={[shift]} member={createMember({ id: 'member-1' })} onRequestSwap={onRequestSwap} />)
    screen.getByText('Request Swap').click()
    expect(onRequestSwap).toHaveBeenCalledWith(shift)
  })

  it('shows "My Upcoming Shifts" for employees', () => {
    render(<UpcomingShifts shifts={[]} member={createMember({ role: 'EMPLOYEE' })} onRequestSwap={() => {}} />)
    expect(screen.getByText('My Upcoming Shifts')).toBeTruthy()
  })

  it('shows "Upcoming Shifts" for managers', () => {
    render(<UpcomingShifts shifts={[]} member={createMember({ role: 'MANAGER' })} onRequestSwap={() => {}} />)
    expect(screen.getByText('Upcoming Shifts')).toBeTruthy()
  })

  it('renders multiple shifts', () => {
    const shifts = [
      createShift({ id: '1', title: 'Morning' }),
      createShift({ id: '2', title: 'Evening' }),
    ]
    render(<UpcomingShifts shifts={shifts} member={createMember()} onRequestSwap={() => {}} />)
    expect(screen.getByText('Morning')).toBeTruthy()
    expect(screen.getByText('Evening')).toBeTruthy()
  })
})
