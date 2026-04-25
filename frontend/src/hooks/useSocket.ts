import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'

export const SOCKET_RESYNC_EVENT = 'shiftsync:socket-resync'

const buildStorageKey = (orgId: string, memberId: string) => `shiftsync:last-event-sync:${orgId}:${memberId}`

export function useSocket(orgId?: string, memberId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const { getToken } = useAuth()
  const hasConnectedRef = useRef(false)

  useEffect(() => {
    if (!orgId || !memberId) {
      hasConnectedRef.current = false
      setSocket(null)
      return
    }

    let active = true
    let socketInstance: Socket | null = null
    let reconnectInterval: ReturnType<typeof setInterval> | null = null
    const storageKey = buildStorageKey(orgId, memberId)

    const updateLastSync = (timestamp: string) => {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(storageKey, timestamp)
    }

    const getLastSync = () => {
      if (typeof window === 'undefined') return null
      return window.localStorage.getItem(storageKey)
    }

    const dispatchResync = (detail: {
      orgId: string
      memberId: string
      replayedCount: number
      hasMore: boolean
      reconnect: boolean
      syncedAt: string
    }) => {
      if (typeof window === 'undefined') return
      window.dispatchEvent(new CustomEvent(SOCKET_RESYNC_EVENT, { detail }))
    }

    const replayMissedEvents = async (token: string, syncedAt: string, reconnect: boolean) => {
      const since = getLastSync()

      if (!since) {
        updateLastSync(syncedAt)
        hasConnectedRef.current = true
        return
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/events/since?since=${encodeURIComponent(since)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!response.ok) {
          updateLastSync(syncedAt)
          hasConnectedRef.current = true
          return
        }

        const data = await response.json()
        updateLastSync(syncedAt)
        hasConnectedRef.current = true

        if ((data.count ?? 0) > 0 || reconnect) {
          dispatchResync({
            orgId,
            memberId,
            replayedCount: data.count ?? 0,
            hasMore: Boolean(data.hasMore),
            reconnect,
            syncedAt,
          })
        }
      } catch (error) {
        console.error('Failed to replay missed socket events', error)
        updateLastSync(syncedAt)
        hasConnectedRef.current = true
      }
    }

    const stopReconnectInterval = () => {
      if (!reconnectInterval) return
      clearInterval(reconnectInterval)
      reconnectInterval = null
    }

    const ensureReconnectInterval = () => {
      if (reconnectInterval || !socketInstance) return
      reconnectInterval = setInterval(() => {
        if (!socketInstance || socketInstance.connected) {
          stopReconnectInterval()
          return
        }

        socketInstance.connect()
      }, 3000)
    }

    const connect = async () => {
      const token = await getToken()
      if (!token || !active) return

      socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
        auth: { token },
        query: { orgId, memberId },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      })

      socketInstance.on('connect', () => {
        stopReconnectInterval()
        socketInstance?.emit('join:org', { organisationId: orgId, memberId })
      })

      socketInstance.on('disconnect', () => {
        ensureReconnectInterval()
      })

      socketInstance.on('connect_error', () => {
        ensureReconnectInterval()
      })

      socketInstance.on('connected', async ({ serverTime }: { serverTime?: string }) => {
        if (!active || !socketInstance) return

        const reconnect = hasConnectedRef.current
        const syncedAt = serverTime || new Date().toISOString()
        await replayMissedEvents(token, syncedAt, reconnect)
      })

      socketInstance.onAny((eventName) => {
        if (
          eventName === 'connect' ||
          eventName === 'disconnect' ||
          eventName === 'connected' ||
          eventName === 'connect_error'
        ) {
          return
        }

        updateLastSync(new Date().toISOString())
      })

      if (active) {
        setSocket(socketInstance)
      } else {
        socketInstance.disconnect()
      }
    }

    connect()

    return () => {
      active = false
      stopReconnectInterval()
      socketInstance?.removeAllListeners()
      socketInstance?.disconnect()
      setSocket(null)
    }
  }, [orgId, memberId, getToken])

  return socket
}
