import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CounterpartyForm from '@/components/counterparties/CounterpartyForm'

export default async function EditCounterpartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: cp } = await supabase
    .from('counterparties').select('*').eq('id', id).eq('owner_id', user!.id).single()

  if (!cp) notFound()

  return <CounterpartyForm counterparty={cp} />
}
