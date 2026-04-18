import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtTime(date: string | Date) {
  return format(new Date(date), 'h:mm a')
}

export function fmtDateTime(date: string | Date) {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function fmtRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: 'bg-brand-100 text-brand-700',
  IN_PROGRESS: 'bg-green-100 text-green-700',
  OPEN: 'bg-amber-100 text-amber-700',
}

export const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-rose-100 text-rose-700',
  MANAGER: 'bg-purple-100 text-purple-700',
  EMPLOYEE: 'bg-brand-100 text-brand-700',
}