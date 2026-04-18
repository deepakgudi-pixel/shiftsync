import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
})

api.interceptors.request.use(async (config) => {
  // Token is automatically injected via Clerk's useAuth hook in components
  return config
})

export default api
