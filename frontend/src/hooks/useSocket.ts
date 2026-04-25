import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'

export function useSocket(orgId?: string, memberId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const { getToken } = useAuth()

  useEffect(() => {
    if (!orgId || !memberId) {
      setSocket(null)
      return
    }

    let active = true
    let socketInstance: Socket | null = null

    const connect = async () => {
      const token = await getToken()
      if (!token || !active) return

      socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
        auth: { token },
        query: { orgId, memberId },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      })

      socketInstance.on('connect', () => {
        socketInstance?.emit('join:org', { organisationId: orgId, memberId })
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
      socketInstance?.removeAllListeners()
      socketInstance?.disconnect()
      setSocket(null)
    }
  }, [orgId, memberId, getToken])

  return socket
}
