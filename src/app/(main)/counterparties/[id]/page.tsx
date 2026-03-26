import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/ui/BackButton'
import CounterpartyDetail from '@/components/counterparties/CounterpartyDetail'

export default async function CounterpartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: cp }, { data: orders }, { data: payments }, { data: balanceRow }] = await Promise.all([
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
    supabase.from('counterparty_balance')
      .select('balance')
      .eq('counterparty_id', id)
      .eq('owner_id', user!.id)
      .single(),
  ])

  if (!cp) notFound()

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
        balance={balanceRow?.balance ?? 0}
        currentUserId={user!.id}
      />
    </div>
  )
}
