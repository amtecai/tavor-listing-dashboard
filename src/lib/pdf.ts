// HTML -> PDF with headless Chromium. On Vercel the browser comes from @sparticuz/chromium;
// locally set CHROMIUM_PATH (e.g. /opt/pw-browsers/chromium).
import puppeteer, { type Browser } from 'puppeteer-core'

async function launch(): Promise<Browser> {
  if (process.env.CHROMIUM_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--font-render-hinting=none'] })
  }
  const chromium = (await import('@sparticuz/chromium')).default
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, '--font-render-hinting=none'],
    headless: true,
  })
}

/** `baseUrl` resolves the document's root-relative links (/fonts, /brand, /api/assets). */
export async function htmlToPdf(html: string, baseUrl: string): Promise<Uint8Array> {
  const browser = await launch()
  try {
    const page = await browser.newPage()
    await page.emulateMediaType('print')
    const withBase = html.replace(/<head>/i, `<head><base href="${baseUrl.replace(/\/$/, '')}/">`)
    await page.setContent(withBase, { waitUntil: 'load', timeout: 60_000 })
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r }))))
      ;(window as unknown as { __tavorLayout?: () => void }).__tavorLayout?.()
    })
    return await page.pdf({ preferCSSPageSize: true, printBackground: true, timeout: 60_000 })
  } finally {
    await browser.close()
  }
}
