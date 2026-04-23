import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'

export function useSocket(orgId?: string, memberId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const { getToken } = useAuth()

  useEffect(() => {
    if (!orgId || !memberId) return

    const connect = async () => {
      const token = await getToken()

      const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
        auth: { token },
        query: { orgId, memberId }
      })

      setSocket(socketInstance)
    }

    connect()

    return () => {
      setSocket(null)
    }
  }, [orgId, memberId, getToken])

  return socket
}