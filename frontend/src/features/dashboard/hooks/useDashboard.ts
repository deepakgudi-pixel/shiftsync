'use client'
import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/useApi'
import { SOCKET_RESYNC_EVENT, useSocket } from '@/hooks/useSocket'
import type { Member } from '@/types'
import { useAppLayout } from '@/components/layout/AppLayout'

export type { Member }

export interface DashboardAnalytics {
  totalMembers: number
  shiftsThisWeek: number
  openShifts: number
  completedThisMonth: number
  activeNow: number
  totalHours: number
  totalLaborCost: number
  shiftsByDay: { day: string; total: number; completed: number }[]
}

export interface DashboardShift {
  id: string
  title: string
  start_time: string
  end_time: string
  assignee_id?: string
  status: string
  color: string
  assignee_name?: string
  location?: string
  organisation_id: string
}

export interface DashboardAnnouncement {
  id: string
  title: string
  content: string
  priority: string
  created_at: string
  target_name?: string
  target_member_id?: string
}

export interface DashboardSwapRequest {
  id: string
  shift_id: string
  shift_title: string
  requester_id: string
  requester_name: string
  target_id: string | null
  target_name: string | null
  reason: string
  status: string
  created_at: string
}

export type AnnouncementForm = { title: string; content: string; priority: string; targetMemberId: string }
export type SwapForm = { reason: string; targetId: string }

export function useDashboard() {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const api = useApi()
  const { setPageLoading } = useAppLayout()
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [shifts, setShifts] = useState<DashboardShift[]>([])
  const [announcements, setAnnouncements] = useState<DashboardAnnouncement[]>([])
  const [swaps, setSwaps] = useState<DashboardSwapRequest[]>([])
  const [member, setMember] = useState<Member | null>(null)
  const [team, setTeam] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const socket = useSocket(member?.organisation_id, member?.id)
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [annForm, setAnnForm] = useState({ title: '', content: '', priority: 'NORMAL', targetMemberId: '' })
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<DashboardShift | null>(null)
  const [swapForm, setSwapForm] = useState({ reason: '', targetId: '' })
  const [annLoading, setAnnLoading] = useState(false)

  useEffect(() => {
    setPageLoading(loading)
    return () => setPageLoading(false)
  }, [loading, setPageLoading])

  const loadDashboard = useCallback(
    async (showInitialLoader = false) => {
      if (!isSignedIn) return

      if (showInitialLoader) setLoading(true)

      try {
        const [meRes, annRes] = await Promise.all([
          api.get('/api/members/me'),
          api.get('/api/organisations/announcements'),
        ])

        const me = meRes.data
        setMember(me)
        setAnnouncements(annRes.data)

        const weekParams = {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }

        if (me.role === 'ADMIN') {
          const [ana, sh, teamRes, swapRes] = await Promise.all([
            api.get('/api/analytics/overview'),
            api.get('/api/shifts', { params: weekParams }),
            api.get('/api/members'),
            api.get('/api/shifts/swaps/pending'),
          ])
          setAnalytics(ana.data)
          setShifts(sh.data.slice(0, 5))
          setTeam(teamRes.data)
          setSwaps(swapRes.data)
        } else if (me.role === 'MANAGER') {
          const [sh, teamRes, swapRes] = await Promise.all([
            api.get('/api/shifts', { params: weekParams }),
            api.get('/api/members'),
            api.get('/api/shifts/swaps/pending'),
          ])
          setShifts(sh.data.slice(0, 5))
          setTeam(teamRes.data)
          setSwaps(swapRes.data)
          setAnalytics(null)
        } else {
          const [sh, teamRes] = await Promise.all([
            api.get('/api/shifts', { params: { ...weekParams, assigneeId: me.id } }),
            api.get('/api/members'),
          ])
          setShifts(sh.data)
          setTeam(teamRes.data)
          setAnalytics(null)
          setSwaps([])
        }
      } catch (err: unknown) {
        const error = err as { response?: { status?: number } }
        if (error.response?.status === 404) {
          router.push('/onboarding')
          return
        }
        console.error(err)
      } finally {
        if (showInitialLoader) setLoading(false)
      }
    },
    [api, isSignedIn, router]
  )

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }
    loadDashboard(true)
  }, [isLoaded, isSignedIn, loadDashboard, router])

  useEffect(() => {
    if (!socket) return
    socket.on('shift:created', (shift: DashboardShift) => {
      setShifts((prev) => [shift, ...prev].slice(0, 5))
    })
    socket.on('announcement:new', (ann: DashboardAnnouncement) => {
      if (ann.target_member_id && ann.target_member_id !== member?.id && member?.role !== 'ADMIN') return
      setAnnouncements((prev) => [ann, ...prev])
    })
    socket.on('announcement:deleted', ({ id }: { id: string }) => {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    })
    socket.on('swap:requested', (swap: DashboardSwapRequest) => {
      if (member?.role === 'ADMIN' || member?.role === 'MANAGER') {
        setSwaps((prev) => [swap, ...prev])
      }
    })
    socket.on('swap:processed', ({ id }: { id: string }) => {
      setSwaps((prev) => prev.filter((s) => s.id !== id))
    })
    socket.on('shift:updated', (updated: DashboardShift) => {
      setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    })

    return () => {
      socket.off('shift:created')
      socket.off('announcement:new')
      socket.off('announcement:deleted')
      socket.off('swap:requested')
      socket.off('swap:processed')
      socket.off('shift:updated')
    }
  }, [socket, member])

  useEffect(() => {
    if (!member?.organisation_id) return

    const handleResync = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.orgId !== member.organisation_id || detail?.memberId !== member.id) return
      loadDashboard(false).catch(() => {})
    }

    window.addEventListener(SOCKET_RESYNC_EVENT, handleResync)
    return () => window.removeEventListener(SOCKET_RESYNC_EVENT, handleResync)
  }, [member, loadDashboard])

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    setAnnLoading(true)
    try {
      await api.post('/api/organisations/announcements', annForm)
      setShowAnnModal(false)
      setAnnForm({ title: '', content: '', priority: 'NORMAL', targetMemberId: '' })
    } catch {
      // handled by toast in component
    } finally {
      setAnnLoading(false)
    }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await api.delete(`/api/organisations/announcements/${id}`)
    } catch {
      // handled by toast in component
    }
  }

  const handleRequestSwap = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShift) return
    try {
      await api.post(`/api/shifts/${selectedShift.id}/swap`, swapForm)
      setShowSwapModal(false)
      setSwapForm({ reason: '', targetId: '' })
    } catch {
      // handled by toast in component
    }
  }

  const handleSwapAction = async (swapId: string, shiftId: string, status: string) => {
    try {
      await api.patch(`/api/shifts/${shiftId}/swap/${swapId}`, { status })
      setSwaps((prev) => prev.filter((s) => s.id !== swapId))
    } catch {
      // handled by toast in component
    }
  }

  return {
    user,
    member,
    team,
    analytics,
    shifts,
    announcements,
    swaps,
    loading,
    showAnnModal,
    setShowAnnModal,
    annForm,
    setAnnForm,
    showSwapModal,
    setShowSwapModal,
    selectedShift,
    setSelectedShift,
    swapForm,
    setSwapForm,
    annLoading,
    loadDashboard,
    handlePostAnnouncement,
    handleDeleteAnnouncement,
    handleRequestSwap,
    handleSwapAction,
  }
}
