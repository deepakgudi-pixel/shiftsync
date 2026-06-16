'use client'
import { Activity, Calendar, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import { AdminStats } from '@/features/dashboard/components/AdminStats'
import { AnalyticsChart } from '@/features/dashboard/components/AnalyticsChart'
import { UpcomingShifts } from '@/features/dashboard/components/UpcomingShifts'
import { SwapRequests } from '@/features/dashboard/components/SwapRequests'
import { Announcements } from '@/features/dashboard/components/Announcements'
import { AnnouncementModal } from '@/features/dashboard/components/AnnouncementModal'
import { SwapModal } from '@/features/dashboard/components/SwapModal'

export default function DashboardPage() {
  const dashboard = useDashboard()
  const {
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
    handlePostAnnouncement,
    handleDeleteAnnouncement,
    handleRequestSwap,
    handleSwapAction,
  } = dashboard

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div className="min-h-screen p-5 md:p-8">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-card">
            <div className="h-10 w-64 bg-zinc-100 animate-pulse rounded mb-2" />
            <div className="h-4 w-48 bg-zinc-100 animate-pulse rounded" />
          </div>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-zinc-100 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const roleLabel = member?.role ? member.role.toLowerCase() : 'operator'

  return (
    <div className="min-h-screen p-5 md:p-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-card">
          <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
            <div className="p-6 md:p-8">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                  <ShieldCheck size={13} />
                  {roleLabel} workspace
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Realtime sync active
                </span>
              </div>
              <h1 className="text-3xl font-bold text-black md:text-4xl">
                {greeting}, <span className="text-zinc-500">{user?.firstName || 'there'}</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                Your scheduling, attendance, payroll, and team signals are collected here so the next action is easy to spot.
              </p>
            </div>
            <div className="border-t border-zinc-200 bg-zinc-950 p-6 text-white lg:border-l lg:border-t-0 md:p-8">
              <p className="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                <Calendar size={14} />
                {new Date()
                  .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  .toUpperCase()}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Open Swaps</p>
                  <p className="mt-2 text-2xl font-bold">{swaps.length}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Upcoming</p>
                  <p className="mt-2 text-2xl font-bold">{shifts.length}</p>
                </div>
              </div>
              <p className="mt-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                <Activity size={13} />
                Operations snapshot
              </p>
            </div>
          </div>
        </div>

        {(analytics || loading) && member?.role === 'ADMIN' && (
          <AdminStats analytics={analytics} loading={loading} />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {(analytics || loading) && member?.role === 'ADMIN' && (
            <AnalyticsChart analytics={analytics} loading={loading} />
          )}

          <UpcomingShifts
            shifts={shifts}
            member={member}
            onRequestSwap={(shift) => {
              setSelectedShift(shift)
              setShowSwapModal(true)
            }}
          />

          {(swaps.length > 0 || loading) && (member?.role === 'ADMIN' || member?.role === 'MANAGER') && (
            <SwapRequests swaps={swaps} loading={loading} onAction={handleSwapAction} />
          )}

          <Announcements
            announcements={announcements}
            member={member}
            onDelete={(id) => {
              handleDeleteAnnouncement(id).then(() => toast.success('Announcement removed')).catch(() => toast.error('Failed to remove'))
            }}
            onCreatePost={() => setShowAnnModal(true)}
          />
        </div>

        {showAnnModal && (
          <AnnouncementModal
            onClose={() => setShowAnnModal(false)}
            onSubmit={(e) => {
              handlePostAnnouncement(e).then(() => toast.success('Announcement posted')).catch(() => toast.error('Failed to post announcement'))
            }}
            loading={annLoading}
            form={annForm}
            onFormChange={setAnnForm}
            team={team}
            currentMemberId={member?.id}
          />
        )}

        {showSwapModal && (
          <SwapModal
            selectedShift={selectedShift}
            onClose={() => setShowSwapModal(false)}
            onSubmit={(e) => {
              handleRequestSwap(e).then(() => toast.success('Swap request submitted')).catch(() => toast.error('Failed to submit request'))
            }}
            form={swapForm}
            onFormChange={setSwapForm}
            team={team}
            currentMemberId={member?.id}
          />
        )}
      </div>
    </div>
  )
}
