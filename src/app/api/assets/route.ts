import { NextResponse } from 'next/server'
import { saveAsset } from '@/lib/assets'

// Image upload from the details form or designer.
export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')
  const listingId = (form.get('listingId') as string) || null
  if (!(file instanceof File) || !file.type.startsWith('image/')) return NextResponse.json({ error: 'Choose an image file' }, { status: 400 })
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'Images must be under 15 MB' }, { status: 400 })
  const asset = await saveAsset(listingId, 'upload', Buffer.from(await file.arrayBuffer()), { mime: file.type })
  return NextResponse.json({ url: asset.url, kind: 'upload', width: asset.width, height: asset.height })
}
