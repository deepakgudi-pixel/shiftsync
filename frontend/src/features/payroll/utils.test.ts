import { formatMoney, getCurrencySymbol } from './utils'
import { CURRENCIES } from './constants'

describe('formatMoney', () => {
  it('formats number with default dollar symbol', () => {
    expect(formatMoney(1234.56)).toBe('$1,234.56')
  })

  it('formats zero', () => {
    expect(formatMoney(0)).toBe('$0.00')
  })

  it('formats string numbers', () => {
    expect(formatMoney('99.99')).toBe('$99.99')
  })

  it('handles null values', () => {
    expect(formatMoney(null)).toBe('$0.00')
  })

  it('handles undefined values', () => {
    expect(formatMoney(undefined)).toBe('$0.00')
  })

  it('uses custom symbol', () => {
    expect(formatMoney(100, '\u20ac')).toBe('\u20ac100.00')
  })

  it('rounds to cents', () => {
    expect(formatMoney(100.999)).toBe('$101.00')
  })

  it('formats large numbers with commas', () => {
    expect(formatMoney(1234567.89)).toBe('$1,234,567.89')
  })
})

describe('getCurrencySymbol', () => {
  it('returns dollar for USD', () => {
    expect(getCurrencySymbol('USD')).toBe('$')
  })

  it('returns euro for EUR', () => {
    expect(getCurrencySymbol('EUR')).toBe('\u20ac')
  })

  it('returns pound for GBP', () => {
    expect(getCurrencySymbol('GBP')).toBe('\u00a3')
  })

  it('returns dollar for unknown currency', () => {
    expect(getCurrencySymbol('XYZ')).toBe('$')
  })

  it('returns dollar for empty string', () => {
    expect(getCurrencySymbol('')).toBe('$')
  })
})

describe('CURRENCIES', () => {
  it('contains all expected currencies', () => {
    const codes = CURRENCIES.map(c => c.code)
    expect(codes).toContain('USD')
    expect(codes).toContain('EUR')
    expect(codes).toContain('GBP')
    expect(codes).toContain('CAD')
    expect(codes).toContain('AUD')
    expect(codes).toContain('INR')
  })

  it('each currency has code, symbol, and name', () => {
    CURRENCIES.forEach(currency => {
      expect(currency.code).toBeDefined()
      expect(currency.symbol).toBeDefined()
      expect(currency.name).toBeDefined()
    })
  })
})
