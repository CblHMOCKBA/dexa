import { createClient } from '@/lib/supabase/server'
import ChatListClient from '@/components/chat/ChatListClient'

export default async function ChatsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

  // PERF FIX: убран лишний await после Promise.all — был запрос room_members
  // для счётчика участников (N+1 паттерн). Заменён на агрегацию через
  // room_members(count) прямо в join к rooms.
  // PERF FIX: chats — добавлен .limit(50) для last_message
  const [{ data: chats }, { data: roomMembers }, { data: publicRooms }] = await Promise.all([
        supabase
          .from('chats')
          .select(`
                  id, created_at, buyer_id, seller_id,
                          listing:listings(id, title, price, status),
                                  buyer:profiles!chats_buyer_id_fkey(id, name, location),
                                          seller:profiles!chats_seller_id_fkey(id, name, location),
                                                  last_message:messages(id, text, sender_id, created_at)
                                                        `)
          .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
          .order('created_at', { ascending: false })
          .limit(50),

        // PERF FIX: получаем member_count прямо в join — убран отдельный
        // запрос room_members для подсчёта (был N+1)
        supabase
          .from('room_members')
          .select('room_id, role, rooms(id, name, description, is_private, created_at, room_members(count))')
          .eq('user_id', user!.id),

        supabase
          .from('rooms')
          .select('id, name, description, is_private, created_at, room_members(count)')
          .eq('is_private', false)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

  // Собираем мои комнаты с member_count из уже загруженных данных (без доп. запроса)
  const myRoomIds = (roomMembers ?? []).map((rm: { room_id: string }) => rm.room_id)

  const myRoomsWithCount = (roomMembers ?? []).map((rm: {
        room_id: string
        role: string
        rooms: { id: string; name: string; description?: string; is_private: boolean; created_at: string; room_members?: { count: number }[] } | null
  }) => {
        if (!rm.rooms) return null
        return {
                ...rm.rooms,
                member_count: rm.rooms.room_members?.[0]?.count ?? 1,
                my_role: rm.role,
                is_member: true,
        }
  }).filter(Boolean)

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
