import { createClient } from '@/lib/supabase/server'
import OrdersClient from '@/components/orders/OrdersClient'

export default async function OrdersPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

  // PERF FIX: orders + events грузим параллельно через Promise.all
  // PERF FIX: orders select(*) → явные поля; добавлен .limit(100)
  // PERF FIX: listing:listings(*) → только нужные поля листинга
  const [{ data: orders }, { data: allEvents }] = await Promise.all([
        supabase
          .from('orders')
          .select(`
                  id, status, total_price, counter_price, counter_status,
                          quantity, timer_minutes, courier_note, created_at,
                                  buyer_id, seller_id, listing_id, chat_id, counterparty_id,
                                          listing:listings(id, title, price, condition, status),
                                                  buyer:profiles!orders_buyer_id_fkey(id, name, location),
                                                          seller:profiles!orders_seller_id_fkey(id, name, location)
                                                                `)
          .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
          .order('created_at', { ascending: false })
          .limit(100),

        // PERF FIX: грузим все события сразу одним запросом (не N+1)
        supabase
          .from('order_events')
          .select('id, order_id, type, payload, created_at')
          .order('created_at', { ascending: true }),
      ])

  // Группируем события по order_id на клиенте (O(n) вместо N запросов)
  const events: Record<string, unknown[]> = {}
      for (const ev of allEvents ?? []) {
            const oid = (ev as { order_id: string }).order_id
            if (!events[oid]) events[oid] = []
                  events[oid].push(ev)
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
