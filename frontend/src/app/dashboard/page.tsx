'use client'
import { Calendar } from 'lucide-react'
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
      <div className="p-5 md:p-8 max-w-[1400px] mx-auto min-h-screen">
        <div className="mb-10 border-b border-zinc-200 pb-8">
          <div className="h-10 w-64 bg-zinc-100 animate-pulse rounded mb-2" />
          <div className="h-4 w-48 bg-zinc-100 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-zinc-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8 max-w-[1400px] mx-auto min-h-screen">
      <div className="mb-10 border-b border-zinc-200 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-black tracking-tight mb-2">
          {greeting}, <span className="text-zinc-500">{user?.firstName || 'there'}</span>
        </h1>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <Calendar size={14} />
          {new Date()
            .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            .toUpperCase()}
        </p>
      </div>

      {(analytics || loading) && member?.role === 'ADMIN' && (
        <AdminStats analytics={analytics} loading={loading} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
  )
}
