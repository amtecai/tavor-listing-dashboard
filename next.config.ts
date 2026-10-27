import type { NextConfig } from 'next'

const config: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core', 'sharp'],
  async headers() {
    // Headless Chrome loads the document from about:blank, so fonts need CORS to be usable there.
    return [{ source: '/fonts/:file*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }]
  },
}

export default config
