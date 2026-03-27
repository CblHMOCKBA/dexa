import { createClient } from '@/lib/supabase/server'
import ChatListClient from '@/components/chat/ChatListClient'

export default async function ChatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: chats }, { data: roomMembers }, { data: publicRooms }] = await Promise.all([
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
    // Комнаты где я участник
    supabase
      .from('room_members')
      .select('room_id, role, rooms(*)')
      .eq('user_id', user!.id),
    // Все публичные комнаты — видны всем
    supabase
      .from('rooms')
      .select('*, room_members(count)')
      .eq('is_private', false)
      .order('created_at', { ascending: false }),
  ])

  // Мои комнаты с реальным счётчиком участников
  const myRoomIds = (roomMembers ?? []).map((rm: { room_id: string }) => rm.room_id)
  let myRoomsWithCount: unknown[] = []

  if (myRoomIds.length > 0) {
    // Получаем точный счётчик через RPC или агрегацию
    const { data: allMembers } = await supabase
      .from('room_members')
      .select('room_id')
      .in('room_id', myRoomIds)

    const countMap: Record<string, number> = {}
    for (const m of allMembers ?? []) {
      const rid = (m as { room_id: string }).room_id
      countMap[rid] = (countMap[rid] ?? 0) + 1
    }

    myRoomsWithCount = (roomMembers ?? []).map((rm: { room_id: string; role: string; rooms: unknown }) => ({
      ...(rm.rooms as object),
      member_count: countMap[rm.room_id] ?? 1,
      my_role: rm.role,
      is_member: true,
    }))
  }

  // Добавляем публичные комнаты где я ещё не участник
  const publicNotMember = (publicRooms ?? [])
    .filter((r: { id: string }) => !myRoomIds.includes(r.id))
    .map((r: { room_members?: { count: number }[]; [key: string]: unknown }) => ({
      ...r,
      member_count: (r.room_members as { count: number }[])?.[0]?.count ?? 0,
      my_role: null,
      is_member: false,
    }))

  const roomsWithCount = [...myRoomsWithCount, ...publicNotMember]

  return (
    <ChatListClient
      chats={chats ?? []}
      rooms={roomsWithCount as Parameters<typeof ChatListClient>[0]['rooms']}
      currentUserId={user!.id}
    />
  )
}
