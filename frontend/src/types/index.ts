export interface Member {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  avatar_url: string | null
  hourly_rate: number | null
  organisation_id: string
  clerk_user_id: string
  can_manage_rates?: boolean
  org_name?: string
  org_slug?: string
}

export interface Shift {
  id: string
  title: string
  start_time: string
  end_time: string
  location: string | null
  notes: string | null
  color: string
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'
  organisation_id: string
  assignee_id: string | null
  assignee_name?: string
  assignee_avatar?: string
  assignee_role?: string
  created_at: string
  updated_at: string
}

export interface ClockEvent {
  id: string
  shift_id: string
  member_id: string
  type: 'CLOCK_IN' | 'CLOCK_OUT'
  timestamp: string
  latitude: number | null
  longitude: number | null
  member_name?: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  priority: 'NORMAL' | 'HIGH' | 'URGENT'
  organisation_id: string
  created_by: string
  created_at: string
}

export interface SwapRequest {
  id: string
  shift_id: string
  requester_id: string
  target_id: string | null
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  shift_title?: string
  requester_name?: string
  target_name?: string
  created_at: string
}

export interface PayPeriod {
  id: string
  organisation_id: string
  period_type: string
  start_date: string
  end_date: string
  status: 'DRAFT' | 'PROCESSED' | 'PAID'
  processed_at: string | null
  payslip_count?: number
  total_cost?: number
}

export interface Payslip {
  id: string
  member_id: string
  pay_period_id: string
  organisation_id: string
  base_hours: number
  overtime_hours: number
  overtime_rate: number
  base_earnings: number
  overtime_earnings: number
  total_earnings: number
  currency: string
  status: 'DRAFT' | 'PROCESSED' | 'DOWNLOADED' | 'PAID'
  generated_by: string
  created_at: string
}

export interface OvertimeRule {
  id: string
  organisation_id: string
  name: string
  daily_threshold_hours: number
  weekly_threshold_hours: number
  daily_multiplier: number
  weekly_multiplier: number
  is_active: boolean
  created_at: string
}

export interface Analytics {
  totalMembers: number
  totalHours: number
  labourCost: number
  completedShifts: number
  liveStaff: number
}

export interface Notification {
  id: string
  member_id: string
  type: string
  title: string
  body: string
  read: boolean
  data: Record<string, unknown> | null
  created_at: string
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read: boolean
  sender_name?: string
  sender_avatar?: string
  created_at: string
}
