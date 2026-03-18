import { createClient } from '@/lib/supabase/server'
import CounterpartyList from '@/components/counterparties/CounterpartyList'

export default async function CounterpartiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Загружаем контрагентов с балансом и кол-вом сделок
  const { data: counterparties } = await supabase
    .from('counterparties')
    .select('*')
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: false })

  // Балансы из view
  const { data: balances } = await supabase
    .from('counterparty_balance')
    .select('counterparty_id, balance')
    .eq('owner_id', user!.id)

  // Кол-во сделок
  const { data: dealCounts } = await supabase
    .from('orders')
    .select('counterparty_id')
    .eq('status', 'completed')
    .not('counterparty_id', 'is', null)

  const balanceMap: Record<string, number> = {}
  for (const b of balances ?? []) balanceMap[b.counterparty_id] = b.balance ?? 0

  const dealsMap: Record<string, number> = {}
  for (const d of dealCounts ?? []) {
    if (d.counterparty_id) dealsMap[d.counterparty_id] = (dealsMap[d.counterparty_id] ?? 0) + 1
  }

  const enriched = (counterparties ?? []).map(c => ({
    ...c,
    balance:     balanceMap[c.id] ?? 0,
    deals_count: dealsMap[c.id]   ?? 0,
  }))

  return (
    <CounterpartyList counterparties={enriched} />
  )
}
