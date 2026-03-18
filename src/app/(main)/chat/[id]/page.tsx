import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatWindowClient from '@/components/chat/ChatWindowClient'

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: chat } = await supabase
    .from('chats')
    .select('*, listing:listings(*), buyer:profiles!chats_buyer_id_fkey(*), seller:profiles!chats_seller_id_fkey(*)')
    .eq('id', id)
    .single()

  if (!chat) notFound()

  // Проверяем что текущий юзер — участник чата
  if (chat.buyer_id !== user!.id && chat.seller_id !== user!.id) notFound()

  const { data: messages } = await supabase
    .from('messages')
    .select('*, sender:profiles(*)')
    .eq('chat_id', id)
    .order('created_at', { ascending: true })

  return (
    <ChatWindowClient
      chat={chat}
      initialMessages={messages ?? []}
      currentUserId={user!.id}
    />
  )
}
