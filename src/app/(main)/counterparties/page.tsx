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

  // Все завершённые сделки с контрагентами
  const { data: dealCounts } = await supabase
    .from('orders')
    .select('counterparty_id, total_price, counter_price, counter_status')
    .eq('status', 'completed')
    .not('counterparty_id', 'is', null)

  // Все платежи
  const { data: allPayments } = await supabase
    .from('payments')
    .select('counterparty_id, amount, direction')
    .eq('owner_id', user!.id)

  // Считаем баланс: сумма сделок − полученные платежи + выплаченные
  const ordersTotalMap: Record<string, number> = {}
  const dealsMap: Record<string, number> = {}
  for (const d of dealCounts ?? []) {
    if (!d.counterparty_id) continue
    const price = d.counter_status === 'accepted' && d.counter_price ? d.counter_price : d.total_price
    ordersTotalMap[d.counterparty_id] = (ordersTotalMap[d.counterparty_id] ?? 0) + price
    dealsMap[d.counterparty_id] = (dealsMap[d.counterparty_id] ?? 0) + 1
  }

  const paymentsMap: Record<string, number> = {}
  for (const p of allPayments ?? []) {
    if (!p.counterparty_id) continue
    const val = p.direction === 'in' ? -p.amount : p.amount
    paymentsMap[p.counterparty_id] = (paymentsMap[p.counterparty_id] ?? 0) + val
  }

  const enriched = (counterparties ?? []).map(c => ({
    ...c,
    balance:     (ordersTotalMap[c.id] ?? 0) + (paymentsMap[c.id] ?? 0),
    deals_count: dealsMap[c.id] ?? 0,
  }))

  return (
    <CounterpartyList counterparties={enriched} />
  )
}
