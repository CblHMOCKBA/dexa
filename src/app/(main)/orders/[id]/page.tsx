import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/ui/BackButton'
import OrderDetail from '@/components/orders/OrderDetail'
import LeaveReview from '@/components/profile/LeaveReview'
import DocumentGenerator from '@/components/documents/DocumentGenerator'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      listing:listings(*),
      buyer:profiles!orders_buyer_id_fkey(*),
      seller:profiles!orders_seller_id_fkey(*)
    `)
    .eq('id', id)
    .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
    .single()

  if (!order) notFound()

  const [{ data: events }, { data: existingReview }, { data: existingDoc }] = await Promise.all([
    supabase.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: true }),
    order.status === 'completed'
      ? supabase.from('reviews').select('id').eq('order_id', id).eq('reviewer_id', user!.id).single()
      : Promise.resolve({ data: null }),
    order.status === 'completed'
      ? supabase.from('documents').select('id, pdf_url, number').eq('order_id', id).eq('owner_id', user!.id).single()
      : Promise.resolve({ data: null }),
  ])

  return (
    <div className="pb-nav" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <BackButton href="/orders" />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', lineHeight: 1.2 }}>Сделка</h1>
          <p style={{ fontSize: 11, color: '#9498AB', marginTop: 1 }}>
            #{id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        {order.status === 'completed' && (
          <a href={`/profile/${user!.id === order.buyer_id ? order.seller_id : order.buyer_id}`}
            style={{ fontSize: 13, color: '#1E6FEB', fontWeight: 600, textDecoration: 'none' }}>
            Профиль →
          </a>
        )}
      </div>

      <OrderDetail
        order={order}
        initialEvents={events ?? []}
        currentUserId={user!.id}
      />

      {/* Накладная — только для продавца после завершения */}
      {order.status === 'completed' && order.seller_id === user!.id && (
        <div style={{ padding: '0 16px 16px' }}>
          <DocumentGenerator
            order={order}
            currentUserId={user!.id}
            existingDocId={existingDoc?.id}
            existingDocUrl={existingDoc?.pdf_url ?? undefined}
            existingDocNumber={existingDoc?.number ?? undefined}
          />
        </div>
      )}

      {/* Отзыв — только для покупателя */}
      {order.status === 'completed' && order.buyer_id === user!.id && (
        <div style={{ padding: '0 16px 16px' }}>
          <LeaveReview
            order={order}
            currentUserId={user!.id}
            alreadyReviewed={!!existingReview}
          />
        </div>
      )}
    </div>
  )
}
