import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import WarehouseList from '@/components/warehouse/WarehouseList'

export default async function WarehousePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: listings }, { data: templates }] = await Promise.all([
    supabase
      .from('listings')
      .select('*')
      .eq('seller_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('listing_templates')
      .select('*')
      .eq('seller_id', user!.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <WarehouseList
      initialListings={listings ?? []}
      initialTemplates={templates ?? []}
    />
  )
}
