import { createClient } from '@/lib/supabase/server'
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard'
import BottomNav from '@/components/ui/BottomNav'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: orders },
    { data: listings },
    { data: counterparties },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id, total_price, status, created_at, buyer_id, seller_id, quantity,
        listing:listings(title, brand, model, cost_price),
        buyer:profiles!orders_buyer_id_fkey(name),
        seller:profiles!orders_seller_id_fkey(name)
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('created_at', { ascending: false }),

    supabase
      .from('listings')
      .select('id, title, brand, price, quantity, status, cost_price, created_at')
      .eq('seller_id', user.id),

    supabase
      .from('counterparties')
      .select('id, name, type')
      .eq('owner_id', user.id),
  ])

  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>
      <div className="page-header pt-safe">
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>Аналитика</h1>
      </div>
      <AnalyticsDashboard
        orders={(orders ?? []) as AnalyticsOrder[]}
        listings={listings ?? []}
        userId={user.id}
      />
      <BottomNav />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnalyticsOrder = any
