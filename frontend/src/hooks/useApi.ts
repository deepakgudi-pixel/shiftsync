'use client'
import { useAuth } from '@clerk/nextjs'
import axios from 'axios'
import { useMemo } from 'react'
import { getApiBaseUrl } from '@/lib/env'

export const useApi = () => {
  const { getToken } = useAuth()

  return useMemo(() => {
    const instance = axios.create({
      baseURL: getApiBaseUrl(),
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
