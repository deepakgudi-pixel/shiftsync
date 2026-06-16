import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const baseUrl = process.env.UX_BASE_URL || 'http://localhost:3000'
const screenshotDir = process.env.UX_SCREENSHOT_DIR || '/tmp/shiftsync-ux-screenshots'
const routes = ['/', '/demo-access']

await mkdir(screenshotDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []

try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const consoleErrors = []
    const failedRequests = []

    page.on('pageerror', (error) => {
      consoleErrors.push(`pageerror: ${error.message}`)
    })

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(`console: ${message.text()}`)
      }
    })

    page.on('requestfailed', (request) => {
      const failure = request.failure()
      const isDevNavigationAbort = request.url() === page.url() && failure?.errorText === 'net::ERR_ABORTED'
      if (isDevNavigationAbort) {
        return
      }
      failedRequests.push(`${request.url()} :: ${failure?.errorText || 'request failed'}`)
    })

    const url = new URL(route, baseUrl).toString()
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

    const screenshot = join(screenshotDir, route === '/' ? 'home.png' : `${route.slice(1)}.png`)
    await page.screenshot({ path: screenshot, fullPage: true })

    const bodyText = await page.locator('body').innerText({ timeout: 5_000 })
    const overlayCount = await page
      .locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')
      .count()

    results.push({
      route,
      hasContent: bodyText.trim().length > 100,
      overlayCount,
      consoleErrors,
      failedRequests,
      screenshot,
    })

    await page.close()
  }
} finally {
  await browser.close()
}

const failures = results.filter((result) => {
  return !result.hasContent || result.overlayCount > 0 || result.consoleErrors.length > 0
})

console.log(JSON.stringify(results, null, 2))

if (failures.length > 0) {
  process.exitCode = 1
}
