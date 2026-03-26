import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewRequestClient from '@/components/requests/NewRequestClient'

export default async function NewRequestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <NewRequestClient userId={user.id} />
}
