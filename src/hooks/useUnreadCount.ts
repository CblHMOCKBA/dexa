'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useUnreadCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let userId: string | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userId = user.id

      // 1. Получаем ID чатов где пользователь участник
      const { data: chats } = await supabase
        .from('chats')
        .select('id')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)

      const chatIds = (chats ?? []).map((c: { id: string }) => c.id)
      if (chatIds.length === 0) return

      // 2. Считаем непрочитанные в этих чатах
      const { count: initial } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', userId)
        .in('chat_id', chatIds)

      setCount(initial ?? 0)

      // 3. Realtime подписка
      channel = supabase
        .channel('unread-badge')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const msg = payload.new as { sender_id: string; is_read: boolean; chat_id: string }
            if (msg.sender_id !== userId && !msg.is_read && chatIds.includes(msg.chat_id)) {
              setCount(prev => prev + 1)
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages' },
          (payload) => {
            const next = payload.new as { is_read: boolean }
            const prev = payload.old as { is_read: boolean; sender_id: string }
            if (!prev.is_read && next.is_read && prev.sender_id !== userId) {
              setCount(c => Math.max(0, c - 1))
            }
          }
        )
        .subscribe()
    }

    init()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return count
}
