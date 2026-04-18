'use client'
import { useAuth } from '@clerk/nextjs'
import axios from 'axios'
import { useMemo } from 'react'

export const useApi = () => {
  const { getToken } = useAuth()

  return useMemo(() => {
    const instance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    })

    instance.interceptors.request.use(async (config) => {
      try {
        const token = await getToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch (err) {
        console.error('Failed to get token', err)
      }
      return config
    })

    return instance
  }, [getToken])
}