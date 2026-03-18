import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RoomWindowClient from '@/components/rooms/RoomWindowClient'

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Проверяем членство
  const { data: membership } = await supabase
    .from('room_members')
    .select('role')
    .eq('room_id', id)
    .eq('user_id', user!.id)
    .single()

  if (!membership) notFound()

  const [{ data: room }, { data: messages }, { data: members }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', id).single(),
    supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', id)
      .order('created_at', { ascending: true })
      .limit(50),
    supabase
      .from('room_members')
      .select('*, profile:profiles(*)')
      .eq('room_id', id),
  ])

  if (!room) notFound()

  return (
    <RoomWindowClient
      room={room}
      initialMessages={messages ?? []}
      members={members ?? []}
      currentUserId={user!.id}
      myRole={membership.role as 'owner' | 'admin' | 'member'}
    />
  )
}
