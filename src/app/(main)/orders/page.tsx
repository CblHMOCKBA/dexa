import { createClient } from '@/lib/supabase/server'
import OrdersClient from '@/components/orders/OrdersClient'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      listing:listings(*),
      buyer:profiles!orders_buyer_id_fkey(*),
      seller:profiles!orders_seller_id_fkey(*)
    `)
    .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
    .order('created_at', { ascending: false })

  // Загружаем события для каждого ордера
  const orderIds = (orders ?? []).map(o => o.id)
  let events: Record<string, unknown[]> = {}

  if (orderIds.length > 0) {
    const { data: evts } = await supabase
      .from('order_events')
      .select('*')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true })

    for (const ev of evts ?? []) {
      const oid = (ev as { order_id: string }).order_id
      if (!events[oid]) events[oid] = []
      events[oid].push(ev)
    }
  }

  const ordersWithEvents = (orders ?? []).map(o => ({
    ...o,
    events: events[o.id] ?? [],
  }))

  return (
    <OrdersClient
      orders={ordersWithEvents as Parameters<typeof OrdersClient>[0]['orders']}
      currentUserId={user!.id}
    />
  )
}
