import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import JoinClient from '@/components/rooms/JoinClient'

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/join/${code}`)

  const { data: invite } = await supabase
    .from('invite_links')
    .select('*, room:rooms(*)')
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (!invite) {
    return <JoinClient status="invalid" />
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return <JoinClient status="expired" />
  }

  if (invite.uses_left !== null && invite.uses_left <= 0) {
    return <JoinClient status="exhausted" />
  }

  const { data: existing } = await supabase
    .from('room_members')
    .select('role')
    .eq('room_id', invite.room_id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    redirect(`/rooms/${invite.room_id}`)
  }

  return (
    <JoinClient
      status="valid"
      inviteCode={code}
      room={invite.room as Parameters<typeof JoinClient>[0]['room']}
      userId={user.id}
      usesLeft={invite.uses_left}
    />
  )
}
