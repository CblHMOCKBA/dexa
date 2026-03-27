import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/ui/BackButton'
import ListingDetail from '@/components/listings/ListingDetail'

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: listing } = await supabase
    .from('listings')
    .select('*, seller:profiles(*)')
    .eq('id', id)
    .single()

  if (!listing) notFound()

  // История закрытых сделок по этому товару (для графика цены)
  const { data: priceHistory } = await supabase
    .from('orders')
    .select('total_price, counter_price, counter_status, created_at, quantity')
    .eq('listing_id', id)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })
    .limit(20)

  // Другие предложения этого же товара на рынке
  const { data: similar } = await supabase
    .from('listings')
    .select('*, seller:profiles(*)')
    .eq('status', 'active')
    .neq('id', id)
    .or(
      listing.brand
        ? `brand.eq.${listing.brand}`
        : `title.ilike.%${listing.title.split(' ')[0]}%`
    )
    .limit(5)

  return (
    <div className="pb-nav" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <BackButton />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {listing.title}
          </p>
          {listing.brand && (
            <p style={{ fontSize: 11, color: '#9498AB', marginTop: 1 }}>{listing.brand}</p>
          )}
        </div>
      </div>
      <ListingDetail
        listing={listing}
        priceHistory={priceHistory ?? []}
        similar={similar ?? []}
        currentUserId={user!.id}
      />
    </div>
  )
}
