import { describe, expect, it } from 'vitest'
import { trimTrailingSlash } from './env'

describe('trimTrailingSlash', () => {
  it('removes a single trailing slash', () => {
    expect(trimTrailingSlash('https://api.example.com/')).toBe('https://api.example.com')
  })

  it('removes multiple trailing slashes', () => {
    expect(trimTrailingSlash('https://api.example.com///')).toBe('https://api.example.com')
  })

  it('keeps URLs without trailing slashes unchanged', () => {
    expect(trimTrailingSlash('https://api.example.com/v1')).toBe('https://api.example.com/v1')
  })
})
