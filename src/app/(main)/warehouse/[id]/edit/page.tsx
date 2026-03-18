import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/ui/BackButton'
import ListingForm from '@/components/warehouse/ListingForm'

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .eq('seller_id', user!.id)  // только свои товары
    .single()

  if (!listing) notFound()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <BackButton href="/warehouse" />
        <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', flex: 1 }}>
          Редактировать
        </h1>
      </div>
      <ListingForm listing={listing} showSaveAsTemplate={false} />
    </div>
  )
}
