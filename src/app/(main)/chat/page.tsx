import { createClient } from '@/lib/supabase/server'
import ChatListClient from '@/components/chat/ChatListClient'

export default async function ChatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: chats }, { data: roomMembers }] = await Promise.all([
    supabase
      .from('chats')
      .select(`
        *,
        listing:listings(id, title, price, status),
        buyer:profiles!chats_buyer_id_fkey(id, name, location),
        seller:profiles!chats_seller_id_fkey(id, name, location),
        last_message:messages(id, text, sender_id, created_at)
      `)
      .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('room_members')
      .select('room_id, role, rooms(*)')
      .eq('user_id', user!.id),
  ])

  // Собираем комнаты с количеством участников
  const roomIds = (roomMembers ?? []).map((rm: { room_id: string }) => rm.room_id)
  let roomsWithCount: unknown[] = []

  if (roomIds.length > 0) {
    const { data: counts } = await supabase
      .from('room_members')
      .select('room_id')
      .in('room_id', roomIds)

    const countMap: Record<string, number> = {}
    for (const c of counts ?? []) {
      const rid = (c as { room_id: string }).room_id
      countMap[rid] = (countMap[rid] ?? 0) + 1
    }

    roomsWithCount = (roomMembers ?? []).map((rm: { room_id: string; role: string; rooms: unknown }) => ({
      ...(rm.rooms as object),
      member_count: countMap[rm.room_id] ?? 1,
      my_role: rm.role,
    }))
  }

  return (
    <ChatListClient
      chats={chats ?? []}
      rooms={roomsWithCount as Parameters<typeof ChatListClient>[0]['rooms']}
      currentUserId={user!.id}
    />
  )
}
