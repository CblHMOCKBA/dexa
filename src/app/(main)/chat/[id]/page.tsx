import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatWindowClient from '@/components/chat/ChatWindowClient'

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

  // PERF FIX: chat + messages параллельно через Promise.all
  // PERF FIX: messages — только нужные поля sender (убран select('*') для profiles)
  // PERF FIX: messages — .limit(100) чтобы не тянуть весь архив чата
  const [{ data: chat }, { data: messages }] = await Promise.all([
        supabase
          .from('chats')
          .select(`
                  id, buyer_id, seller_id, created_at,
                          listing:listings(id, title, price, status, condition),
                                  buyer:profiles!chats_buyer_id_fkey(id, name, location),
                                          seller:profiles!chats_seller_id_fkey(id, name, location)
                                                `)
          .eq('id', id)
          .single(),

        supabase
          .from('messages')
          .select('id, chat_id, sender_id, text, is_read, created_at, sender:profiles(id, name)')
          .eq('chat_id', id)
          .order('created_at', { ascending: true })
          .limit(100),
      ])

  if (!chat) notFound()

  // Проверяем что текущий юзер — участник чата
  if (chat.buyer_id !== user!.id && chat.seller_id !== user!.id) notFound()

  return (
        <ChatWindowClient
                chat={chat}
                initialMessages={messages ?? []}
                currentUserId={user!.id}
              />
      )
}
