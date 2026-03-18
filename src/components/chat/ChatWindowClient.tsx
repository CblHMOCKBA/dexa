'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Chat, Message, Listing } from '@/types'
import Avatar from '@/components/ui/Avatar'
import TimerSelect from '@/components/orders/TimerSelect'
import ListingCardMessage, { encodeListingCard, decodeListingCard, type ListingCardData } from '@/components/chat/ListingCardMessage'

// Тип с оптимистичным статусом
type OptimisticMessage = Message & {
  status?: 'sending' | 'sent' | 'error'
  temp?: boolean
}

type Props = { chat: Chat; initialMessages: Message[]; currentUserId: string }

// ── Утилиты ──────────────────────────────────────────────────

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatDateSep(d: string) {
  const date = new Date(d)
  const now  = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// ── Компонент ────────────────────────────────────────────────

export default function ChatWindowClient({ chat, initialMessages, currentUserId }: Props) {
  const router = useRouter()
  const [msgs, setMsgs]           = useState<OptimisticMessage[]>(initialMessages)
  const [text, setText]           = useState('')
  const [panel, setPanel]         = useState<'none' | 'share' | 'order'>('none')
  const [timerMins, setTimerMins] = useState(30)
  const [orderLoading, setOrderLoading] = useState(false)
  const [myListings, setMyListings]     = useState<Listing[]>([])
  const [loadingListings, setLoadingListings] = useState(false)
  const [showMenu, setShowMenu]         = useState(false)
  const [menuAction, setMenuAction]     = useState<'none'|'delete'|'clear'|'export'>('none')
  const [menuLoading, setMenuLoading]   = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const seenIds   = useRef<Set<string>>(new Set(initialMessages.map(m => m.id)))

  const partner     = chat.buyer_id === currentUserId ? chat.seller : chat.buyer
  const partnerName = partner?.name ?? 'Продавец'
  const isBuyer     = currentUserId === chat.buyer_id

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`chat-${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `chat_id=eq.${chat.id}`,
      }, payload => {
        const m = payload.new as Message
        if (seenIds.current.has(m.id)) return
        seenIds.current.add(m.id)
        // Заменяем temp-сообщение реальным если текст совпадает
        setMsgs(prev => {
          const tempIdx = prev.findIndex(x => x.temp && x.sender_id === m.sender_id && x.text === m.text)
          if (tempIdx >= 0) {
            const updated = [...prev]
            updated[tempIdx] = { ...m, status: 'sent' }
            return updated
          }
          return [...prev, { ...m, status: 'sent' }]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [chat.id])

  // Загрузка товаров для шеринга
  useEffect(() => {
    if (panel !== 'share') return
    if (myListings.length > 0) return
    setLoadingListings(true)
    const supabase = createClient()
    supabase.from('listings').select('id,title,price,brand,status')
      .eq('seller_id', currentUserId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { setMyListings((data as Listing[]) ?? []); setLoadingListings(false) })
  }, [panel])

  function resize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // ── OPTIMISTIC SEND ──────────────────────────────────────
  async function send(customText?: string) {
    const t = (customText ?? text).trim()
    if (!t) return
    if (!customText) { setText(''); if (inputRef.current) inputRef.current.style.height = 'auto' }

    // 1. Добавляем СРАЗУ с temp ID
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const tempMsg: OptimisticMessage = {
      id: tempId, chat_id: chat.id, sender_id: currentUserId,
      text: t, is_read: false,
      created_at: new Date().toISOString(),
      status: 'sending', temp: true,
    }
    seenIds.current.add(tempId)
    setMsgs(prev => [...prev, tempMsg])

    // 2. Шлём на сервер в фоне
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('messages')
        .insert({ chat_id: chat.id, sender_id: currentUserId, text: t })
        .select('id').single()

      if (error) throw error
      if (data?.id) seenIds.current.add(data.id)

      // 3. Помечаем как отправлено
      setMsgs(prev => prev.map(m =>
        m.id === tempId ? { ...m, id: data?.id ?? tempId, status: 'sent', temp: false } : m
      ))
    } catch {
      // 4. Ошибка — показываем статус
      setMsgs(prev => prev.map(m =>
        m.id === tempId ? { ...m, status: 'error' } : m
      ))
    }
  }

  async function retrySend(msg: OptimisticMessage) {
    setMsgs(prev => prev.filter(m => m.id !== msg.id))
    await send(msg.text)
  }

  async function shareListingCard(listing: Listing) {
    const cardData: ListingCardData = {
      id:          listing.id,
      title:       listing.title,
      price:       listing.price,
      brand:       listing.brand ?? null,
      model:       (listing as { model?: string }).model ?? null,
      condition:   listing.condition,
      seller_id:   listing.seller_id,
      seller_name: (listing.seller as { name?: string })?.name ?? 'Продавец',
      status:      listing.status as 'active' | 'reserved' | 'sold',
    }
    await send(encodeListingCard(cardData))
    setPanel('none')
  }

  async function createOrder() {
    if (!chat.listing || orderLoading || !isBuyer) return
    setOrderLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('orders').insert({
      listing_id: chat.listing.id, chat_id: chat.id,
      buyer_id: chat.buyer_id, seller_id: chat.seller_id,
      quantity: 1, total_price: chat.listing.price, timer_minutes: timerMins,
    })
    setOrderLoading(false)
    if (!error) { setPanel('none'); router.push('/orders') }
  }

  // Группировка сообщений
  function isSameGroup(i: number) {
    if (i === 0) return false
    return msgs[i].sender_id === msgs[i - 1].sender_id &&
           isSameDay(msgs[i].created_at, msgs[i - 1].created_at)
  }

  // Статус доставки
  function DeliveryStatus({ msg }: { msg: OptimisticMessage }) {
    if (msg.sender_id !== currentUserId) return null
    if (msg.status === 'sending') return <span style={{ opacity: 0.5 }}>⏳</span>
    if (msg.status === 'error')   return <span style={{ color: '#E8251F' }}>!</span>
    return <span style={{ opacity: 0.7 }}>✓</span>
  }

  async function deleteChat() {
    setMenuLoading(true)
    const supabase = createClient()
    await supabase.from('messages').delete().eq('chat_id', chat.id)
    await supabase.from('chats').delete().eq('id', chat.id)
    setMenuLoading(false)
    router.push('/chat')
  }

  async function clearHistory() {
    setMenuLoading(true)
    const supabase = createClient()
    await supabase.from('messages').delete().eq('chat_id', chat.id)
    setMsgs([])
    setMenuLoading(false)
    setMenuAction('none')
    setShowMenu(false)
  }

  function exportHistory() {
    const lines = msgs.map(m => {
      const who  = m.sender_id === currentUserId ? 'Я' : partnerName
      const time = new Date(m.created_at).toLocaleString('ru-RU')
      return `[${time}] ${who}: ${m.text}`
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `dexa-chat-${partnerName}-${new Date().toISOString().slice(0,10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setShowMenu(false)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh',
      // iOS Safari keyboard fix
      minHeight: '-webkit-fill-available',
      background: '#F2F3F5', overflow: 'hidden',
      position: 'fixed', inset: 0,
    }}>

      {/* ── HEADER ── */}
      <div style={{
        flexShrink: 0, zIndex: 20,
        position: 'sticky', top: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px 10px', paddingTop: 'calc(10px + var(--sat))',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E8E9ED',
      }}>
        <Link href="/chat" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </Link>
        <Avatar name={partnerName} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 16, color: '#1A1C21', lineHeight: 1.2 }}>{partnerName}</p>
          {partner?.location && <p style={{ fontSize: 12, color: '#9498AB' }}>{partner.location}</p>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setPanel(p => p === 'share' ? 'none' : 'share')} style={{
            width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: panel === 'share' ? '#EBF2FF' : '#F2F3F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={panel === 'share' ? '#1E6FEB' : '#9498AB'} strokeWidth="2">
              <rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>
              <rect x="3" y="13" width="8" height="8" rx="1"/><path d="M13 17h8M17 13v8"/>
            </svg>
          </button>
          {chat.listing && isBuyer && chat.listing.status === 'active' && (
            <button onClick={() => setPanel(p => p === 'order' ? 'none' : 'order')} style={{
              width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: panel === 'order' ? '#1E6FEB' : '#F2F3F5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={panel === 'order' ? 'white' : '#9498AB'} strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </button>
          )}

          {/* ⋮ Меню */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(v => !v)} style={{
              width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: showMenu ? '#F2F3F5' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="5"  r="1.5" fill="#9498AB"/>
                <circle cx="12" cy="12" r="1.5" fill="#9498AB"/>
                <circle cx="12" cy="19" r="1.5" fill="#9498AB"/>
              </svg>
            </button>

            {showMenu && (
              <div style={{
                position: 'fixed', top: 'calc(10px + var(--sat) + 52px)', right: 12, zIndex: 100,
                background: 'white', borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                minWidth: 220, overflow: 'hidden',
                animation: 'pop-in 0.18s var(--spring-bounce) both',
              }}>
                {([
                  { icon: '💬', label: 'Поделиться товаром', action: () => { setShowMenu(false); setPanel('share') }, color: '#1A1C21' },
                  { icon: '📥', label: 'Экспорт истории', action: exportHistory, color: '#1A1C21' },
                  { icon: '🗑', label: 'Очистить историю', action: () => setMenuAction('clear'), color: '#F0B90B' },
                  { icon: '🚫', label: 'Удалить чат', action: () => setMenuAction('delete'), color: '#E8251F' },
                ] as const).map((item, i, arr) => (
                  <button key={item.label} onClick={item.action} style={{
                    width: '100%', padding: '13px 16px', border: 'none', cursor: 'pointer',
                    background: 'white', display: 'flex', alignItems: 'center', gap: 12,
                    borderBottom: i < arr.length - 1 ? '1px solid #F2F3F5' : 'none',
                    textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: item.color }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Backdrop для закрытия меню */}
      {showMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 15 }}
          onClick={() => setShowMenu(false)} />
      )}

      {/* Диалог подтверждения */}
      {(menuAction === 'delete' || menuAction === 'clear') && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px',
        }}>
          <div style={{
            background: 'white', borderRadius: 20, padding: '24px',
            width: '100%', maxWidth: 320,
            animation: 'pop-in 0.2s var(--spring-bounce) both',
          }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', marginBottom: 8, textAlign: 'center' }}>
              {menuAction === 'delete' ? 'Удалить чат?' : 'Очистить историю?'}
            </p>
            <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              {menuAction === 'delete'
                ? 'Чат и все сообщения будут удалены без возможности восстановления'
                : 'Все сообщения будут удалены, чат останется'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setMenuAction('none'); setShowMenu(false) }} style={{
                flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                background: '#F2F3F5', color: '#1A1C21', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                Отмена
              </button>
              <button
                onClick={menuAction === 'delete' ? deleteChat : clearHistory}
                disabled={menuLoading}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                  background: menuAction === 'delete' ? '#E8251F' : '#F0B90B',
                  color: menuAction === 'delete' ? 'white' : '#1A1C21',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  opacity: menuLoading ? 0.6 : 1,
                }}
              >
                {menuLoading ? '...' : menuAction === 'delete' ? 'Удалить' : 'Очистить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ПАНЕЛЬ: ПОДЕЛИТЬСЯ ── */}
      {panel === 'share' && (
        <div style={{
          flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED',
          padding: '12px 16px', maxHeight: 260, overflowY: 'auto',
          animation: 'slide-up 0.2s var(--spring-smooth) both',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Поделиться товаром
          </p>
          {chat.listing && (
            <button onClick={() => shareListingCard(chat.listing as Listing)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              background: '#F8F9FB', borderRadius: 12, padding: '10px 12px',
              border: '1.5px solid #E0E1E6', cursor: 'pointer', marginBottom: 8, textAlign: 'left',
            }}>
              <span style={{ fontSize: 20 }}>📦</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{chat.listing.title}</p>
                <p style={{ fontSize: 12, color: '#1E6FEB', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {(chat.listing as Listing).price?.toLocaleString('ru-RU')} ₽
                </p>
              </div>
              <span style={{ fontSize: 11, background: '#EBF2FF', color: '#1249A8', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                тема
              </span>
            </button>
          )}
          {loadingListings ? (
            <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', padding: '8px 0' }}>...</p>
          ) : myListings.map(l => (
            <button key={l.id} onClick={() => shareListingCard(l)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              background: '#F8F9FB', borderRadius: 12, padding: '10px 12px',
              border: '1.5px solid #E0E1E6', cursor: 'pointer', marginBottom: 6, textAlign: 'left',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{l.title}</p>
                <p style={{ fontSize: 12, color: '#00B173', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {l.price.toLocaleString('ru-RU')} ₽
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2">
                <path d="m22 2-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* ── ПАНЕЛЬ: ОРДЕР ── */}
      {panel === 'order' && chat.listing && (
        <div style={{
          flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED',
          padding: '14px 16px', animation: 'slide-up 0.2s var(--spring-smooth) both',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>🔒 Забронировать</p>
            <button onClick={() => setPanel('none')} style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: '#F2F3F5', color: '#5A5E72', cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
          <div style={{ background: '#F2F3F5', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{chat.listing.title}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#1E6FEB', marginTop: 3 }}>
              {(chat.listing as Listing).price?.toLocaleString('ru-RU')} ₽
            </p>
          </div>
          <TimerSelect value={timerMins} onChange={setTimerMins} />
          <button onClick={createOrder} disabled={orderLoading} style={{
            width: '100%', marginTop: 12, padding: '13px', borderRadius: 12,
            background: '#1E6FEB', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 700, cursor: orderLoading ? 'not-allowed' : 'pointer',
            opacity: orderLoading ? 0.7 : 1,
          }}>
            {orderLoading ? 'Создаём...' : `Забронировать · ${timerMins} мин`}
          </button>
        </div>
      )}

      {/* ── КАРТОЧКА ТОВАРА ── */}
      {chat.listing && panel === 'none' && (
        <div style={{
          flexShrink: 0, margin: '8px 12px 0',
          background: 'white', borderRadius: 12,
          borderLeft: '3px solid #F0B90B', padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{chat.listing.title}</p>
            <p style={{ fontSize: 12, color: '#1E6FEB', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {(chat.listing as Listing).price?.toLocaleString('ru-RU')} ₽
            </p>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            background: (chat.listing as Listing).status === 'active' ? '#E6F9F3' : '#F2F3F5',
            color: (chat.listing as Listing).status === 'active' ? '#006644' : '#9498AB',
          }}>
            {(chat.listing as Listing).status === 'active' ? 'В наличии' : 'Продан'}
          </span>
        </div>
      )}

      {/* ── СООБЩЕНИЯ ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 2,
        WebkitOverflowScrolling: 'touch',
      }}>
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8 }}>
            <Avatar name={partnerName} size="lg" />
            <p style={{ fontWeight: 700, color: '#1A1C21', marginTop: 4 }}>{partnerName}</p>
            <p style={{ fontSize: 13, color: '#9498AB' }}>Начни диалог</p>
          </div>
        )}

        {msgs.map((m, i) => {
          const own     = m.sender_id === currentUserId
          const group   = isSameGroup(i)
          const showSep = i === 0 || !isSameDay(m.created_at, msgs[i - 1].created_at)

          return (
            <div key={m.id}>
              {/* Разделитель дат */}
              {showSep && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 8px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#9498AB',
                    background: 'rgba(255,255,255,0.8)',
                    backdropFilter: 'blur(4px)',
                    padding: '4px 12px', borderRadius: 20,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}>
                    {formatDateSep(m.created_at)}
                  </span>
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: own ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end', gap: 6,
                marginTop: group && !showSep ? 1 : 6,
              }}>
                {!own && (
                  <div style={{ width: 28, flexShrink: 0 }}>
                    {(!msgs[i + 1] || msgs[i + 1].sender_id !== m.sender_id) && (
                      <Avatar name={partnerName} size="xs" />
                    )}
                  </div>
                )}

                <div style={{ maxWidth: '78%', opacity: m.status === 'sending' ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                  {(() => {
                    const cardData = decodeListingCard(m.text)
                    if (cardData) {
                      return (
                        <ListingCardMessage
                          data={cardData}
                          currentUserId={currentUserId}
                          chatId={chat.id}
                          isOwn={own}
                          timeStr={formatTime(m.created_at)}
                          deliveryStatus={<DeliveryStatus msg={m} />}
                        />
                      )
                    }
                    return (
                      <>
                        <div style={{
                          padding: '8px 12px',
                          borderRadius: own
                            ? (group && !showSep ? '18px 4px 4px 18px' : '18px 18px 4px 18px')
                            : (group && !showSep ? '4px 18px 18px 4px' : '4px 18px 18px 18px'),
                          background: m.status === 'error' ? '#FFEBEA' : own ? '#2AABEE' : '#fff',
                          color: m.status === 'error' ? '#A8170F' : own ? '#fff' : '#1A1C21',
                          fontSize: 15, lineHeight: 1.45,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {m.text}
                          <span style={{
                            fontSize: 10, marginLeft: 8, float: 'right',
                            marginTop: 2, whiteSpace: 'nowrap',
                            opacity: 0.65, fontFamily: 'var(--font-mono)',
                            color: m.status === 'error' ? '#A8170F' : 'inherit',
                          }}>
                            {formatTime(m.created_at)}{' '}<DeliveryStatus msg={m} />
                          </span>
                        </div>
                        {m.status === 'error' && (
                          <button onClick={() => retrySend(m)} style={{
                            display: 'block', marginTop: 4, marginLeft: 'auto',
                            fontSize: 11, color: '#E8251F', fontWeight: 700,
                            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
                          }}>↻ Повторить</button>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── INPUT ── */}
      <div style={{
        flexShrink: 0, zIndex: 20,
        position: 'sticky', bottom: 0,
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '8px 12px', paddingBottom: 'calc(10px + var(--sab))',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid #E8E9ED',
      }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => { setText(e.target.value); resize(e.target) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Сообщение..."
          rows={1}
          style={{
            flex: 1, background: '#F2F3F5', border: '1.5px solid transparent',
            borderRadius: 22, padding: '10px 16px', fontSize: 15, color: '#1A1C21',
            outline: 'none', resize: 'none', overflow: 'hidden',
            minHeight: 44, maxHeight: 120, fontFamily: 'system-ui',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#2AABEE' }}
          onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
        />
        <button
          onClick={() => send()}
          disabled={!text.trim()}
          style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0, border: 'none',
            background: text.trim() ? '#2AABEE' : '#E0E1E6',
            cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, transform 0.1s',
            transform: text.trim() ? 'scale(1)' : 'scale(0.9)',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="m22 2-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
