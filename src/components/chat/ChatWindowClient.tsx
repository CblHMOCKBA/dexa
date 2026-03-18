'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Chat, Message } from '@/types'
import Avatar from '@/components/ui/Avatar'
import TimerSelect from '@/components/orders/TimerSelect'

type Props = { chat: Chat; initialMessages: Message[]; currentUserId: string }

export default function ChatWindowClient({ chat, initialMessages, currentUserId }: Props) {
  const router = useRouter()
  const [msgs, setMsgs]           = useState<Message[]>(initialMessages)
  const [text, setText]           = useState('')
  const [sending, setSending]     = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showOrder, setShowOrder] = useState(false)
  const [timerMins, setTimerMins] = useState(30)
  const [orderLoading, setOrderLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  // FIX: Set для дедупликации ID сообщений
  const seenIds = useRef<Set<string>>(new Set(initialMessages.map(m => m.id)))

  const partner     = chat.buyer_id === currentUserId ? chat.seller : chat.buyer
  const partnerName = partner?.name ?? 'Продавец'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [msgs])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`chat-${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chat.id}`,
      }, payload => {
        const m = payload.new as Message
        // FIX: строгая дедупликация — не добавляем если уже видели этот ID
        if (seenIds.current.has(m.id)) return
        seenIds.current.add(m.id)
        setMsgs(prev => [...prev, m])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // FIX: убрали router из зависимостей — router.refresh() вызывал ре-рендер и дубли
  }, [chat.id])

  function resize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function send() {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    setText('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const supabase = createClient()
    const { data, error } = await supabase
      .from('messages')
      .insert({ chat_id: chat.id, sender_id: currentUserId, text: t })
      .select('id')
      .single()

    // Оптимистично добавляем в seenIds чтобы realtime не задублировал
    if (data?.id) seenIds.current.add(data.id)
    setSending(false)
  }

  async function shareCard() {
    if (!chat.listing) return
    const supabase = createClient()
    const t = `📦 ${chat.listing.title}\n💰 ${chat.listing.price.toLocaleString('ru-RU')} ₽\n📍 ${chat.listing.seller?.location ?? ''}`
    await supabase.from('messages').insert({ chat_id: chat.id, sender_id: currentUserId, text: t })
    setShowShare(false)
  }

  async function createOrder() {
    if (!chat.listing || orderLoading) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== chat.buyer_id) return

    setOrderLoading(true)
    const { error } = await supabase.from('orders').insert({
      listing_id:    chat.listing.id,
      chat_id:       chat.id,
      buyer_id:      chat.buyer_id,
      seller_id:     chat.seller_id,
      quantity:      1,
      total_price:   chat.listing.price,
      timer_minutes: timerMins,
    })
    setOrderLoading(false)

    if (!error) {
      setShowOrder(false)
      router.push('/orders')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#F2F3F5' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', paddingTop: 'calc(12px + var(--sat))',
        background: '#fff', borderBottom: '1px solid #E0E1E6', flexShrink: 0,
      }}>
        <Link href="/chat">
          <div className="btn-icon" style={{ border: 'none', background: 'transparent' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2.5" strokeLinecap="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </div>
        </Link>
        <Avatar name={partnerName} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21', lineHeight: 1.2 }}>{partnerName}</p>
          {partner?.location && (
            <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>{partner.location}</p>
          )}
        </div>
        {chat.listing && (
          <button
            onClick={() => { setShowShare(s => !s); setShowOrder(false) }}
            className="btn-icon"
            style={{ background: showShare ? '#EBF2FF' : 'transparent', border: showShare ? 'none' : '1px solid #E0E1E6' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={showShare ? '#1E6FEB' : '#9498AB'} strokeWidth="2">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </button>
        )}
      </div>

      {/* Быстрые действия */}
      {showShare && chat.listing && (
        <div style={{ background: '#fff', borderBottom: '1px solid #E0E1E6', padding: '10px 16px', flexShrink: 0, animation: 'fade-up 0.15s ease both' }}>
          <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>Быстрые действия</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={shareCard} style={{
              background: '#EBF2FF', color: '#1249A8', border: 'none',
              borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              📤 Поделиться карточкой
            </button>
            {currentUserId === chat.buyer_id && chat.listing.status === 'active' && (
              <button onClick={() => { setShowOrder(s => !s) }} style={{
                background: showOrder ? '#1E6FEB' : '#E6F9F3',
                color: showOrder ? '#fff' : '#006644',
                border: 'none', borderRadius: 10, padding: '8px 14px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                🔒 Создать ордер
              </button>
            )}
          </div>
        </div>
      )}

      {/* Форма создания ордера с TimerSelect */}
      {showOrder && chat.listing && (
        <div style={{
          background: '#fff', borderBottom: '1px solid #E0E1E6',
          padding: '14px 16px', flexShrink: 0,
          animation: 'fade-up 0.18s ease both',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>Создать ордер</p>
            <button onClick={() => setShowOrder(false)} style={{
              background: '#F2F3F5', border: 'none', borderRadius: '50%',
              width: 28, height: 28, cursor: 'pointer', fontSize: 16, color: '#5A5E72',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
          <div style={{ background: '#F2F3F5', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{chat.listing.title}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#1E6FEB', marginTop: 3 }}>
              {chat.listing.price.toLocaleString('ru-RU')} ₽
            </p>
          </div>
          <TimerSelect value={timerMins} onChange={setTimerMins} />
          <button onClick={createOrder} disabled={orderLoading} style={{
            width: '100%', marginTop: 12, padding: '12px', borderRadius: 12,
            background: '#1E6FEB', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 700, cursor: orderLoading ? 'not-allowed' : 'pointer',
            opacity: orderLoading ? 0.6 : 1, transition: 'opacity 0.15s',
          }}>
            {orderLoading ? 'Создаём...' : `🔒 Забронировать · ${timerMins} мин`}
          </button>
        </div>
      )}

      {/* Карточка товара */}
      {chat.listing && !showShare && !showOrder && (
        <div style={{
          margin: '10px 12px 0', background: '#fff', borderRadius: 14,
          borderLeft: '3px solid #F0B90B', padding: '10px 14px', flexShrink: 0,
        }}>
          <p style={{ fontSize: 11, color: '#F0B90B', fontFamily: 'var(--font-mono)', fontWeight: 700, marginBottom: 3 }}>
            📦 Товар
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1C21' }}>{chat.listing.title}</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#5A5E72', marginTop: 2 }}>
            {chat.listing.price.toLocaleString('ru-RU')} ₽
          </p>
        </div>
      )}

      {/* Сообщения */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {msgs.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9498AB', fontSize: 14, padding: '40px 0' }}>
            Начни диалог
          </p>
        )}
        {msgs.map(m => {
          const own = m.sender_id === currentUserId
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
              {!own && <Avatar name={partnerName} size="xs" />}
              <div style={{ maxWidth: '75%' }}>
                <div style={{
                  padding: '9px 13px',
                  borderRadius: own ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: own ? '#2AABEE' : '#fff',
                  color: own ? '#fff' : '#1A1C21',
                  fontSize: 15, lineHeight: 1.45,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.text}
                </div>
                <p style={{ fontSize: 10, color: '#9498AB', fontFamily: 'var(--font-mono)', marginTop: 3, textAlign: own ? 'right' : 'left' }}>
                  {new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Инпут */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '8px 12px', paddingBottom: 'calc(8px + var(--sab))',
        background: '#fff', borderTop: '1px solid #E0E1E6', flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => { setText(e.target.value); resize(e.target) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Сообщение..."
          rows={1}
          style={{
            flex: 1, background: '#F2F3F5', border: '1.5px solid #E0E1E6',
            borderRadius: 22, padding: '10px 16px', fontSize: 15, color: '#1A1C21',
            outline: 'none', resize: 'none', overflow: 'hidden',
            minHeight: 44, maxHeight: 120, fontFamily: 'system-ui',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = '#2AABEE' }}
          onBlur={e => { e.target.style.borderColor = '#E0E1E6' }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: text.trim() ? '#2AABEE' : '#E0E1E6',
            border: 'none', cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s', transform: 'translateY(-1px)',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="m22 2-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
