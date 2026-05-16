import { fmtTime, fmtDateTime, fmtRelative, getInitials, cn, STATUS_COLORS, ROLE_COLORS } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'inactive')).toBe('base active')
  })

  it('deduplicates classes', () => {
    expect(cn('text-red-500', 'text-red-600')).toBe('text-red-600')
  })
})

describe('fmtTime', () => {
  it('formats time from ISO string', () => {
    const result = fmtTime('2026-05-16T09:30:00Z')
    expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/)
  })

  it('formats time from Date object', () => {
    const date = new Date('2026-05-16T14:45:00Z')
    const result = fmtTime(date)
    expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/)
  })
})

describe('fmtDateTime', () => {
  it('formats full date and time', () => {
    const result = fmtDateTime('2026-05-16T09:30:00Z')
    expect(result).toMatch(/May 16, 2026/)
    expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/)
  })
})

describe('fmtRelative', () => {
  it('returns relative time string', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const result = fmtRelative(future)
    expect(result).toContain('in')
  })

  it('handles past dates', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const result = fmtRelative(past)
    expect(result).toContain('ago')
  })
})

describe('getInitials', () => {
  it('extracts initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('handles single name', () => {
    expect(getInitials('John')).toBe('J')
  })

  it('handles three names', () => {
    expect(getInitials('John William Doe')).toBe('JWD')
  })

  it('uppercases result', () => {
    expect(getInitials('john doe')).toBe('JD')
  })
})

describe('STATUS_COLORS', () => {
  it('has colors for all shift statuses', () => {
    expect(STATUS_COLORS['ASSIGNED']).toBeDefined()
    expect(STATUS_COLORS['IN_PROGRESS']).toBeDefined()
    expect(STATUS_COLORS['OPEN']).toBeDefined()
  })

  it('returns valid tailwind classes', () => {
    Object.values(STATUS_COLORS).forEach(color => {
      expect(color).toContain('bg-')
      expect(color).toContain('text-')
    })
  })
})

describe('ROLE_COLORS', () => {
  it('has colors for all roles', () => {
    expect(ROLE_COLORS['ADMIN']).toBeDefined()
    expect(ROLE_COLORS['MANAGER']).toBeDefined()
    expect(ROLE_COLORS['EMPLOYEE']).toBeDefined()
  })

  it('returns valid tailwind classes', () => {
    Object.values(ROLE_COLORS).forEach(color => {
      expect(color).toContain('bg-')
      expect(color).toContain('text-')
    })
  })
})
