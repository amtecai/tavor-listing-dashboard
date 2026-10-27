import { Studio } from '@/components/Studio'

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Studio listingId={id} />
}
