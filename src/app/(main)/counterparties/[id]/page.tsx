import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/ui/BackButton'
import CounterpartyDetail from '@/components/counterparties/CounterpartyDetail'

export default async function CounterpartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: cp }, { data: orders }, { data: payments }] = await Promise.all([
    supabase.from('counterparties').select('*').eq('id', id).eq('owner_id', user!.id).single(),
    supabase.from('orders')
      .select('*, listing:listings(title)')
      .eq('counterparty_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('payments')
      .select('*')
      .eq('counterparty_id', id)
      .eq('owner_id', user!.id)
      .order('created_at', { ascending: false }),
  ])

  if (!cp) notFound()

  // Баланс = сумма завершённых сделок − сумма полученных платежей
  // Положительный = ещё должны мне, отрицательный = переплата, 0 = рассчитались
  const ordersTotal = (orders ?? [])
    .filter((o: { status: string }) => o.status === 'completed')
    .reduce((s: number, o: { counter_status?: string; counter_price?: number; total_price: number }) => {
      const price = o.counter_status === 'accepted' && o.counter_price ? o.counter_price : o.total_price
      return s + price
    }, 0)
  const paymentsIn = (payments ?? [])
    .filter((p: { direction: string }) => p.direction === 'in')
    .reduce((s: number, p: { amount: number }) => s + p.amount, 0)
  const paymentsOut = (payments ?? [])
    .filter((p: { direction: string }) => p.direction === 'out')
    .reduce((s: number, p: { amount: number }) => s + p.amount, 0)
  const computedBalance = ordersTotal - paymentsIn + paymentsOut

  return (
    <div className="pb-nav" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <BackButton href="/counterparties" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cp.name}
          </p>
          {cp.company && (
            <p style={{ fontSize: 11, color: '#9498AB', marginTop: 1 }}>{cp.company}</p>
          )}
        </div>
      </div>
      <CounterpartyDetail
        counterparty={cp}
        orders={orders ?? []}
        payments={payments ?? []}
        balance={computedBalance}
        currentUserId={user!.id}
      />
    </div>
  )
}
