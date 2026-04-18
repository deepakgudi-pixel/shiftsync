import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket(orgId?: string, memberId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!orgId || !memberId) return

    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
      query: { orgId, memberId }
    })

    setSocket(socketInstance)

    return () => {
      if (socketInstance) {
        socketInstance.disconnect()
      }
    }
  }, [orgId, memberId])

  return socket
}