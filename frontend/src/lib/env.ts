export const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const getApiBaseUrl = () =>
  trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')

export const getSocketBaseUrl = () =>
  trimTrailingSlash(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000')
