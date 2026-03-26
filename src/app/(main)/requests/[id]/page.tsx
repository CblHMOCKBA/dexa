import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import RequestOffersClient from '@/components/requests/RequestOffersClient'

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const [{ data: request }, { data: offers }] = await Promise.all([
    supabase.from('requests')
      .select('*, buyer:profiles!requests_buyer_id_fkey(*)')
      .eq('id', id).single(),
    supabase.from('request_offers')
      .select('*, seller:profiles!request_offers_seller_id_fkey(id, name, location, rating, deals_count, is_verified)')
      .eq('request_id', id)
      .order('price', { ascending: true }),
  ])

  if (!request) notFound()

  return (
    <RequestOffersClient
      request={request}
      offers={offers ?? []}
      currentUserId={user.id}
    />
  )
}
