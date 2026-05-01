import { createClient } from '@/lib/supabase/server'
import WarehouseList from '@/components/warehouse/WarehouseList'

export default async function WarehousePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

  // PERF FIX: select('*') → явные поля (убираем лишние данные из сети)
  // PERF FIX: добавлен .limit(200) чтобы не тянуть безлимитный список
  const [{ data: listings }, { data: templates }] = await Promise.all([
        supabase
          .from('listings')
          .select(
                    'id, title, brand, model, condition, price, quantity, cost_price, min_stock, status, tags, description, created_at, seller_id'
                  )
          .eq('seller_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(200),

        supabase
          .from('listing_templates')
          .select('id, name, data, created_at, seller_id')
          .eq('seller_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

  return (
        <WarehouseList
                initialListings={listings ?? []}
                initialTemplates={templates ?? []}
              />
      )
}
