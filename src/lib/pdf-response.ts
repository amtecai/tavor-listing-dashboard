import { htmlToPdf } from './pdf'

export async function pdfResponse(html: string, origin: string, title: string) {
  const pdf = await htmlToPdf(html, origin)
  const name = `Tavor - ${title || 'Property Opportunity Summary'}.pdf`.replace(/[^\w ,.&()'-]/g, '')
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, max-age=3600' },
  })
}
