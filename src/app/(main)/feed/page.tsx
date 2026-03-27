import { createClient } from '@/lib/supabase/server'
import HomeDashboard from '@/components/feed/HomeDashboard'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: listings },
    { data: activeOrders },
    { data: lowStockListings },
    { data: unreadMessages },
  ] = await Promise.all([
    // Все активные объявления
    supabase
      .from('listings')
      .select('*, seller:profiles(*)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50),

    // Мои активные сделки (не завершённые)
    supabase
      .from('orders')
      .select('id, status, total_price, counter_price, counter_status')
      .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
      .in('status', ['pending', 'confirmed', 'in_delivery']),

    // Товары с низким остатком
    supabase
      .from('listings')
      .select('id')
      .eq('seller_id', user!.id)
      .gt('min_stock', 0)
      .filter('quantity', 'lte', 'min_stock')
      .neq('status', 'sold'),

    // Непрочитанные — только в чатах где пользователь участник
    supabase
      .from('chats')
      .select('id', { count: 'exact', head: true })
      .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`),
  ])

  const totalOrdersValue = (activeOrders ?? []).reduce((s, o) => {
    const price = o.counter_status === 'accepted' && o.counter_price ? o.counter_price : o.total_price
    return s + (price ?? 0)
  }, 0)

  return (
    <HomeDashboard
      listings={listings ?? []}
      activeOrders={activeOrders ?? []}
      unreadCount={unreadMessages ?? 0}
      lowStockCount={(lowStockListings ?? []).length}
      currentUserId={user!.id}
      totalOrdersValue={totalOrdersValue}
    />
  )
}
