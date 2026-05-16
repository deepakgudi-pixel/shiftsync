import { CURRENCIES } from './constants'

export const formatMoney = (value: number | string | null | undefined, symbol = '$') => {
  const amount = typeof value === 'number' ? value : parseFloat(String(value || 0))
  const safeAmount = Number.isFinite(amount) ? amount : 0

  return `${symbol}${(Math.round(safeAmount * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
  })}`
}

export const getCurrencySymbol = (currency = 'USD') => {
  return CURRENCIES.find(option => option.code === currency)?.symbol || '$'
}
